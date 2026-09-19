/** Inventory stacking, merchant pricing, and economy helpers for GPTWorld. */

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

export const DEFAULT_MAX_STACK=999;
export const MATERIAL_KEYS=Object.freeze(['wood','stone','herbs']);

/** Crafted item_keys that stack when quality + durability match and item is unplaced. */
export const STACKABLE_CRAFTED_KEYS=Object.freeze(new Set([
  'healing-poultice','weather-tonic','trail-rations','seed-pouch',
  'wooden-beam','wooden-door','stone-foundation','iron-fittings'
]));

/** Never stack these (unique / stateful / buildings / placeable furniture). */
export const NON_STACKABLE_CRAFTED_KEYS=Object.freeze(new Set([
  'wooden-crate','campfire-kit','stone-hammer','stone-hearth','reed-mat',
  'basic-house','homestead'
]));

export const QUALITY_PRICE_MOD=Object.freeze({
  standard:1,
  fine:1.35,
  exceptional:1.75
});

/** Base coin values for crafted goods (purchase/sell-to-NPC baseline). */
export const ITEM_BASE_VALUE=Object.freeze({
  'campfire-kit':6,
  'wooden-crate':10,
  'stone-hammer':8,
  'stone-hearth':14,
  'healing-poultice':4,
  'weather-tonic':7,
  'wooden-beam':9,
  'wooden-door':12,
  'stone-foundation':11,
  'iron-fittings':13,
  'reed-mat':5,
  'trail-rations':3,
  'seed-pouch':4
});

/**
 * Merchant definitions. General merchant first; specialists buy overlapping catalogs
 * with higher specialty modifiers.
 */
export const MERCHANTS=Object.freeze([
  {
    key:'general',
    name:'Rowan the Trader',
    title:'General merchant',
    building:'storehouse',
    x:5.8,z:5.2,
    outfit:0x6a5a3e,
    lines:['“I’ll take honest goods for fair coin.”','“Stack what you can. Trade what you don’t need.”'],
    accepts:Object.freeze(['healing-poultice','weather-tonic','trail-rations','seed-pouch','reed-mat','wooden-beam','wooden-door','stone-foundation','iron-fittings','campfire-kit','stone-hammer','wooden-crate','stone-hearth']),
    specialtyMod:0.72,
    defaultBudget:180,
    replenishAmount:180
  },
  {
    key:'carpenter',
    name:'Bren the Carpenter',
    title:'Carpenter',
    building:'inn',
    x:6.2,z:-6.5,
    outfit:0x7a5a40,
    lines:['“Bring me timber work. I’ll pay for clean joins.”'],
    accepts:Object.freeze(['wooden-beam','wooden-door','wooden-crate','reed-mat','campfire-kit']),
    specialtyMod:0.88,
    defaultBudget:140,
    replenishAmount:140
  },
  {
    key:'blacksmith',
    name:'Tovan the Smith',
    title:'Blacksmith',
    building:'smithy',
    x:11,z:1.2,
    outfit:0x455c6b,
    lines:['“Metal and tools, if they’re sound.”'],
    accepts:Object.freeze(['iron-fittings','stone-hammer']),
    specialtyMod:0.9,
    defaultBudget:120,
    replenishAmount:120
  },
  {
    key:'mason',
    name:'Cal the Mason',
    title:'Mason',
    building:'council',
    x:-4.2,z:6.4,
    outfit:0x6b6a68,
    lines:['“Stone that holds is worth coin.”'],
    accepts:Object.freeze(['stone-foundation','stone-hearth','stone-hammer']),
    specialtyMod:0.88,
    defaultBudget:120,
    replenishAmount:120
  },
  {
    key:'provisioner',
    name:'Nessa the Provisioner',
    title:'Provisioner',
    building:'healer',
    x:-3.2,z:-6.2,
    outfit:0x5f6b48,
    lines:['“Food, seed, and trail remedies keep the valley alive.”'],
    accepts:Object.freeze(['trail-rations','seed-pouch','healing-poultice','weather-tonic']),
    specialtyMod:0.9,
    defaultBudget:100,
    replenishAmount:100
  }
]);

export function merchantByKey(key){
  return MERCHANTS.find(merchant=>merchant.key===String(key))||null;
}

export function isStackableCrafted(itemKey,{placed=false,hasStoredContents=false}={}){
  const key=String(itemKey||'');
  if(placed||hasStoredContents)return false;
  if(NON_STACKABLE_CRAFTED_KEYS.has(key))return false;
  if(STACKABLE_CRAFTED_KEYS.has(key))return true;
  // Default: consumables/components stack; tools/furniture/storage do not.
  return false;
}

export function stackSignature({itemKey,quality,durability,maxDurability}={}){
  return [
    String(itemKey||''),
    String(quality||'standard'),
    String(Number(durability||0)),
    String(Number(maxDurability||durability||0))
  ].join('|');
}

export function stacksMatch(a,b){
  if(!a||!b)return false;
  if(String(a.itemKey||a.item_key)!==String(b.itemKey||b.item_key))return false;
  if(String(a.quality||'standard')!==String(b.quality||'standard'))return false;
  if(Number(a.durability)!==Number(b.durability))return false;
  if(Number(a.maxDurability||a.max_durability)!==Number(b.maxDurability||b.max_durability))return false;
  if(a.placed||b.placed||a.placed_at||b.placed_at)return false;
  return isStackableCrafted(a.itemKey||a.item_key);
}

export function normalizeQuantity(value,{max=DEFAULT_MAX_STACK}={}){
  const n=Math.floor(Number(value));
  if(!Number.isFinite(n)||n<=0)return 0;
  return Math.min(max,n);
}

export function splitStackPlan(stackQuantity,requested){
  const total=normalizeQuantity(stackQuantity);
  const take=normalizeQuantity(requested,{max:total});
  if(take<=0||take>=total)return{ok:false,error:take<=0?'invalid_quantity':'cannot_split_entire_stack',take:0,remain:total};
  return{ok:true,take,remain:total-take};
}

export function qualityModifier(quality){
  return QUALITY_PRICE_MOD[String(quality||'standard')]||1;
}

export function npcPurchasePrice(itemKey,quality,merchant){
  const base=Number(ITEM_BASE_VALUE[itemKey]||0);
  if(base<=0)return 0;
  const specialty=Number(merchant?.specialtyMod??0.7);
  return Math.max(1,Math.round(base*qualityModifier(quality)*specialty));
}

export function merchantAccepts(merchant,itemKey){
  return Boolean(merchant?.accepts?.includes(String(itemKey)));
}

export function saleQuote({merchant,itemKey,quality='standard',quantity=1,merchantBudget=0}={}){
  if(!merchant||!merchantAccepts(merchant,itemKey))return{ok:false,error:'merchant_rejects_item'};
  const unit=npcPurchasePrice(itemKey,quality,merchant);
  if(unit<=0)return{ok:false,error:'item_not_priced'};
  const want=normalizeQuantity(quantity);
  if(want<=0)return{ok:false,error:'invalid_quantity'};
  const budget=Math.max(0,Math.floor(Number(merchantBudget)||0));
  const affordable=Math.min(want,Math.floor(budget/unit));
  if(affordable<=0)return{ok:false,error:'merchant_insufficient_funds',unitPrice:unit,wanted:want,affordable:0,total:0,budget};
  return{
    ok:true,
    unitPrice:unit,
    wanted:want,
    quantity:affordable,
    partial:affordable<want,
    total:affordable*unit,
    budget,
    remainingBudget:budget-affordable*unit
  };
}

/** Group bag rows for UI: stackable identical rows shown as one stack when already quantity-aware. */
export function viewStacks(items=[]){
  return items.map(item=>({
    ...item,
    quantity:normalizeQuantity(item.quantity??1)||1,
    stackable:isStackableCrafted(item.key||item.item_key,{placed:Boolean(item.placed||item.placed_at)})
  }));
}

export function quantityChoices(maxQuantity){
  const max=normalizeQuantity(maxQuantity)||0;
  if(max<=0)return[];
  const choices=[1];
  if(max>=10)choices.push(10);
  if(max>1)choices.push(max);
  return [...new Set(choices.filter(n=>n>0&&n<=max))];
}

export function initialMerchantBudgets(dayKey=''){
  return Object.fromEntries(MERCHANTS.map(merchant=>[
    merchant.key,
    {budget:merchant.defaultBudget,dayKey:String(dayKey||''),updatedAt:null}
  ]));
}
