import {neon} from '@neondatabase/serverless';
import {
  MERCHANTS,
  merchantByKey,
  saleQuote,
  npcPurchasePrice,
  merchantAccepts,
  normalizeQuantity,
  initialMerchantBudgets,
  viewStacks,
  isStackableCrafted,
  splitStackPlan
} from '../lib/economy-core.mjs';

const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=(value,max=100)=>String(value||'').trim().slice(0,max);
const utcDay=()=>new Date().toISOString().slice(0,10);
const migrationMsg=error=>String(error?.message||error||'');
const isEconomyMigration=error=>{
  const msg=migrationMsg(error);
  return /merchant_|inventory_action_receipts|player_crafted_items|player_inventory|column ["']?coins|\bcoins\b|quantity|does not exist|undefined_column/i.test(msg);
};
const plural=(name,n)=>n===1?name:(/[sxz]$|ch$|sh$/i.test(name)?`${name}es`:name.endsWith('y')&&!/[aeiou]y$/i.test(name)?`${name.slice(0,-1)}ies`:`${name}s`);

async function context(sql,clientId){
  try{
    const rows=await sql`
      SELECT p.id,p.display_name,i.wood,i.stone,i.herbs,COALESCE(i.coins,0) AS coins
      FROM players p LEFT JOIN player_inventory i ON i.player_id=p.id
      WHERE p.client_id=${clientId} LIMIT 1
    `;
    return rows[0]||null;
  }catch(error){
    if(isEconomyMigration(error)){const e=new Error('economy_migration_required');e.code='economy_migration_required';throw e;}
    throw error;
  }
}

async function ensureMerchantBudgets(sql){
  const today=utcDay();
  for(const merchant of MERCHANTS){
    await sql`
      INSERT INTO merchant_budgets(merchant_key,budget,replenish_day_key)
      VALUES(${merchant.key},${merchant.defaultBudget},'')
      ON CONFLICT(merchant_key) DO NOTHING
    `;
    await sql`
      UPDATE merchant_budgets
      SET budget=${merchant.replenishAmount},replenish_day_key=${today},updated_at=now()
      WHERE merchant_key=${merchant.key} AND replenish_day_key<>${today}
    `;
  }
}

function bagRow(item,merchantFilter=null){
  const key=item.item_key,quality=item.quality||'standard',quantity=normalizeQuantity(item.quantity??1)||1;
  const merchants=merchantFilter?[merchantFilter]:MERCHANTS;
  const unitPriceByMerchant={};const sellableTo=[];
  for(const merchant of merchants){
    if(!merchantAccepts(merchant,key))continue;
    const price=npcPurchasePrice(key,quality,merchant);
    if(price<=0)continue;
    unitPriceByMerchant[merchant.key]=price;
    sellableTo.push(merchant.key);
  }
  return{id:String(item.id),key,name:item.display_name,quality,durability:Number(item.durability),maxDurability:Number(item.max_durability),quantity,unitPriceByMerchant,sellableTo};
}

async function payload(sql,actor,{merchantKey=null}={}){
  await ensureMerchantBudgets(sql);
  const filter=merchantKey?merchantByKey(merchantKey):null;
  if(merchantKey&&!filter)return{ok:false,error:'merchant_not_found'};
  const [budgetRows,bagRows]=await Promise.all([
    sql`SELECT merchant_key,budget,replenish_day_key,updated_at FROM merchant_budgets`,
    sql`
      SELECT id,item_key,display_name,quality,durability,max_durability,COALESCE(quantity,1) AS quantity
      FROM player_crafted_items
      WHERE player_id=${actor.id} AND placed_at IS NULL
      ORDER BY crafted_at DESC LIMIT 120
    `
  ]);
  const budgets=Object.fromEntries(budgetRows.map(row=>[row.merchant_key,{budget:Number(row.budget||0),dayKey:row.replenish_day_key||'',updatedAt:row.updated_at||null}]));
  const defaults=initialMerchantBudgets(utcDay());
  const list=(filter?[filter]:MERCHANTS).map(merchant=>{
    const state=budgets[merchant.key]||defaults[merchant.key];
    return{key:merchant.key,name:merchant.name,title:merchant.title,building:merchant.building,x:merchant.x,z:merchant.z,outfit:merchant.outfit,budget:Number(state?.budget??merchant.defaultBudget),accepts:[...merchant.accepts],lines:[...merchant.lines]};
  });
  const bag=viewStacks(bagRows.map(item=>bagRow(item,filter)));
  const inventory={wood:Number(actor.wood||0),stone:Number(actor.stone||0),herbs:Number(actor.herbs||0),coins:Number(actor.coins||0)};
  return{ok:true,coins:inventory.coins,inventory,merchants:list,bag};
}

async function sellItem(sql,actor,merchantKey,itemId,quantity,key){
  const prior=await sql`SELECT response FROM merchant_trade_receipts WHERE player_id=${actor.id} AND idempotency_key=${key} LIMIT 1`;
  if(prior.length)return prior[0].response?.error==='pending'?{ok:false,error:'action_in_progress'}:prior[0].response;
  const merchant=merchantByKey(merchantKey);
  if(!merchant)return{ok:false,error:'merchant_not_found'};
  await ensureMerchantBudgets(sql);
  const items=await sql`
    SELECT id,item_key,display_name,quality,COALESCE(quantity,1) AS quantity
    FROM player_crafted_items WHERE id=${itemId} AND player_id=${actor.id} AND placed_at IS NULL LIMIT 1
  `;
  if(!items.length)return{ok:false,error:'item_not_found'};
  const item=items[0],have=normalizeQuantity(item.quantity)||1,want=normalizeQuantity(quantity);
  if(want<=0||want>have)return{ok:false,error:'invalid_quantity'};
  if(!merchantAccepts(merchant,item.item_key))return{ok:false,error:'merchant_rejects_item'};
  const budgetRows=await sql`SELECT budget FROM merchant_budgets WHERE merchant_key=${merchant.key} LIMIT 1`;
  const quote=saleQuote({merchant,itemKey:item.item_key,quality:item.quality,quantity:want,merchantBudget:Number(budgetRows[0]?.budget||0)});
  if(!quote.ok)return quote;
  const sellQty=quote.quantity,unit=quote.unitPrice,total=quote.total,remain=have-sellQty;
  const claimed=await sql`
    INSERT INTO merchant_trade_receipts(player_id,idempotency_key,merchant_key,response)
    VALUES(${actor.id},${key},${merchant.key},'{"ok":false,"error":"pending"}'::jsonb)
    ON CONFLICT(player_id,idempotency_key) DO NOTHING RETURNING player_id
  `;
  if(!claimed.length){
    const raced=await sql`SELECT response FROM merchant_trade_receipts WHERE player_id=${actor.id} AND idempotency_key=${key} LIMIT 1`;
    if(raced.length)return raced[0].response?.error==='pending'?{ok:false,error:'action_in_progress'}:raced[0].response;
    return{ok:false,error:'trade_claim_failed'};
  }
  const receipt=`Sold ${sellQty} ${plural(item.display_name,sellQty)} for ${total} coins.`;
  let rows;
  try{
    rows=await sql`
      WITH budget_change AS (
        UPDATE merchant_budgets SET budget=budget-${total},updated_at=now()
        WHERE merchant_key=${merchant.key} AND budget>=${total}
        RETURNING budget
      ), item_update AS (
        UPDATE player_crafted_items SET quantity=${remain}
        WHERE id=${itemId} AND player_id=${actor.id} AND placed_at IS NULL
          AND COALESCE(quantity,1)=${have} AND ${remain}>0
          AND EXISTS(SELECT 1 FROM budget_change)
        RETURNING id,quantity
      ), item_delete AS (
        DELETE FROM player_crafted_items
        WHERE id=${itemId} AND player_id=${actor.id} AND placed_at IS NULL
          AND COALESCE(quantity,1)=${have} AND ${remain}=0
          AND EXISTS(SELECT 1 FROM budget_change)
        RETURNING id
      ), item_done AS (
        SELECT id,quantity FROM item_update
        UNION ALL
        SELECT id,0::int AS quantity FROM item_delete
      ), coins_change AS (
        UPDATE player_inventory SET coins=coins+${total},updated_at=now()
        WHERE player_id=${actor.id} AND EXISTS(SELECT 1 FROM item_done)
        RETURNING wood,stone,herbs,coins
      ), ledger AS (
        INSERT INTO merchant_trade_ledger(player_id,merchant_key,item_key,quality,quantity,unit_price,total_coins,details)
        SELECT ${actor.id},${merchant.key},${item.item_key},${item.quality},${sellQty},${unit},${total},
          jsonb_build_object('itemId',${String(item.id)}::text,'wanted',${want}::int,'partial',${quote.partial}::boolean,'receipt',${receipt}::text)
        FROM coins_change RETURNING id
      ), finalized AS (
        UPDATE merchant_trade_receipts receipt SET response=(
          SELECT jsonb_build_object(
            'ok',true,'action','sell','merchantKey',${merchant.key}::text,'itemId',${String(item.id)}::text,
            'itemKey',${item.item_key}::text,'name',${item.display_name}::text,'quality',${item.quality}::text,
            'quantity',${sellQty}::int,'wanted',${want}::int,'partial',${quote.partial}::boolean,
            'unitPrice',${unit}::int,'total',${total}::int,'receipt',${receipt}::text,
            'remainingQuantity',(SELECT quantity FROM item_done),'merchantBudget',(SELECT budget FROM budget_change),
            'inventory',jsonb_build_object('wood',coins_change.wood,'stone',coins_change.stone,'herbs',coins_change.herbs,'coins',coins_change.coins),
            'coins',coins_change.coins
          ) FROM coins_change,ledger,budget_change,item_done
        )
        WHERE receipt.player_id=${actor.id} AND receipt.idempotency_key=${key}
        RETURNING response
      ) SELECT response FROM finalized
    `;
  }catch(error){
    const failed={ok:false,error:'trade_transaction_failed'};
    await sql`UPDATE merchant_trade_receipts SET response=${JSON.stringify(failed)}::jsonb WHERE player_id=${actor.id} AND idempotency_key=${key} AND response->>'error'='pending'`;
    throw error;
  }
  if(!rows.length){
    const failed={ok:false,error:'trade_changed'};
    await sql`UPDATE merchant_trade_receipts SET response=${JSON.stringify(failed)}::jsonb WHERE player_id=${actor.id} AND idempotency_key=${key}`;
    return failed;
  }
  return rows[0].response;
}

async function splitStack(sql,actor,itemId,quantity,key){
  const prior=await sql`SELECT response FROM inventory_action_receipts WHERE player_id=${actor.id} AND idempotency_key=${key} LIMIT 1`;
  if(prior.length)return prior[0].response?.error==='pending'?{ok:false,error:'action_in_progress'}:prior[0].response;
  const items=await sql`
    SELECT id,world_id,item_key,display_name,profession,quality,durability,max_durability,maker_name,metadata,COALESCE(quantity,1) AS quantity
    FROM player_crafted_items WHERE id=${itemId} AND player_id=${actor.id} AND placed_at IS NULL LIMIT 1
  `;
  if(!items.length)return{ok:false,error:'item_not_found'};
  const item=items[0],have=normalizeQuantity(item.quantity)||1;
  if(!isStackableCrafted(item.item_key))return{ok:false,error:'item_not_stackable'};
  const plan=splitStackPlan(have,quantity);
  if(!plan.ok)return plan;
  const claimed=await sql`
    INSERT INTO inventory_action_receipts(player_id,idempotency_key,action,response)
    VALUES(${actor.id},${key},'split_stack','{"ok":false,"error":"pending"}'::jsonb)
    ON CONFLICT(player_id,idempotency_key) DO NOTHING RETURNING player_id
  `;
  if(!claimed.length){
    const raced=await sql`SELECT response FROM inventory_action_receipts WHERE player_id=${actor.id} AND idempotency_key=${key} LIMIT 1`;
    if(raced.length)return raced[0].response?.error==='pending'?{ok:false,error:'action_in_progress'}:raced[0].response;
    return{ok:false,error:'split_claim_failed'};
  }
  let rows;
  try{
    rows=await sql`
      WITH original AS (
        UPDATE player_crafted_items SET quantity=${plan.remain}
        WHERE id=${itemId} AND player_id=${actor.id} AND placed_at IS NULL AND COALESCE(quantity,1)=${have}
        RETURNING id,world_id,item_key,display_name,profession,quality,durability,max_durability,maker_name,metadata,quantity
      ), created AS (
        INSERT INTO player_crafted_items(player_id,world_id,item_key,display_name,profession,quality,durability,max_durability,maker_name,metadata,quantity)
        SELECT ${actor.id},world_id,item_key,display_name,profession,quality,durability,max_durability,maker_name,metadata,${plan.take}
        FROM original
        RETURNING id,item_key,display_name,quality,durability,max_durability,quantity
      ), finalized AS (
        UPDATE inventory_action_receipts receipt SET response=(
          SELECT jsonb_build_object(
            'ok',true,'action','split_stack',
            'original',jsonb_build_object('id',original.id::text,'key',original.item_key,'name',original.display_name,'quality',original.quality,'durability',original.durability,'maxDurability',original.max_durability,'quantity',original.quantity),
            'created',jsonb_build_object('id',created.id::text,'key',created.item_key,'name',created.display_name,'quality',created.quality,'durability',created.durability,'maxDurability',created.max_durability,'quantity',created.quantity)
          ) FROM original,created
        )
        WHERE receipt.player_id=${actor.id} AND receipt.idempotency_key=${key}
        RETURNING response
      ) SELECT response FROM finalized
    `;
  }catch(error){
    const failed={ok:false,error:'split_transaction_failed'};
    await sql`UPDATE inventory_action_receipts SET response=${JSON.stringify(failed)}::jsonb WHERE player_id=${actor.id} AND idempotency_key=${key} AND response->>'error'='pending'`;
    throw error;
  }
  if(!rows.length){
    const failed={ok:false,error:'split_changed'};
    await sql`UPDATE inventory_action_receipts SET response=${JSON.stringify(failed)}::jsonb WHERE player_id=${actor.id} AND idempotency_key=${key}`;
    return failed;
  }
  return rows[0].response;
}

export default async req=>{
  if(!process.env.DATABASE_URL)return reply({ok:false,error:'database_not_configured'},503);
  const sql=neon(process.env.DATABASE_URL);
  try{
    const url=new URL(req.url),body=req.method==='POST'?await req.json():{},clientId=clean(req.method==='GET'?url.searchParams.get('clientId'):body.clientId,80);
    if(!clientId)return reply({ok:false,error:'client_id_required'},400);
    const actor=await context(sql,clientId);if(!actor)return reply({ok:false,error:'player_not_registered'},409);
    if(req.method==='GET'){
      const result=await payload(sql,actor,{merchantKey:clean(url.searchParams.get('merchantKey'),40)||null});
      return reply(result,result.ok?200:result.error==='merchant_not_found'?404:400);
    }
    if(req.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
    const action=clean(body.action,40),key=clean(body.idempotencyKey,100);
    if(action==='catalog'){
      const merchantKey=clean(body.merchantKey,40);
      if(!merchantKey)return reply({ok:false,error:'merchant_key_required'},400);
      const result=await payload(sql,actor,{merchantKey});
      return reply(result,result.ok?200:result.error==='merchant_not_found'?404:400);
    }
    if(action==='sell'){
      if(!key)return reply({ok:false,error:'idempotency_key_required'},400);
      const result=await sellItem(sql,actor,clean(body.merchantKey,40),clean(body.itemId,30),body.quantity,key);
      const conflict=['action_in_progress','trade_changed','item_not_found','merchant_rejects_item','merchant_insufficient_funds','merchant_not_found'];
      return reply(result,result.ok?200:conflict.includes(result.error)?409:400);
    }
    if(action==='split_stack'){
      if(!key)return reply({ok:false,error:'idempotency_key_required'},400);
      const result=await splitStack(sql,actor,clean(body.itemId,30),body.quantity,key);
      const conflict=['action_in_progress','split_changed','item_not_found','item_not_stackable','cannot_split_entire_stack'];
      return reply(result,result.ok?200:conflict.includes(result.error)?409:400);
    }
    return reply({ok:false,error:'invalid_action'},400);
  }catch(error){
    console.error('GPTWorld merchant error',error);
    if(error?.code==='economy_migration_required'||isEconomyMigration(error))return reply({ok:false,error:'economy_migration_required'},503);
    return reply({ok:false,error:'merchant_failed'},500);
  }
};
