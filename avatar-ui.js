// Shared public/private-world avatar sheet. Uses server-authoritative crafted possessions.
const API='/.netlify/functions/avatar';
const CLIENT_KEY='gptworld-client-id';
const SLOT_NAMES={head:'Head',chest:'Chest',legs:'Legs',feet:'Feet',back:'Back',mainHand:'Main hand',offHand:'Off hand'};
const SYMBOLS={head:'🪖',chest:'🦺',legs:'👖',feet:'🥾',back:'🎒',mainHand:'⚔️',offHand:'🛡️'};
const iconFor=key=>{
  if(/bow|crossbow/.test(key))return '🏹';
  if(/knife|dagger|sword/.test(key))return '🗡️';
  if(/axe|hammer|pickaxe/.test(key))return '🪓';
  if(/forge|anvil/.test(key))return '🔥';
  if(/cloak|cape/.test(key))return '🧥';
  if(/shield/.test(key))return '🛡️';
  if(/boots|shoes/.test(key))return '🥾';
  if(/herb|poultice|elixir/.test(key))return '🌿';
  if(/wood|beam/.test(key))return '🪵';
  if(/stone|brick/.test(key))return '🪨';
  if(/meat|ration/.test(key))return '🍖';
  return '📦';
};
let data=null,busy=false,filter='';
const root=document.createElement('div');
root.id='avatarRoot';
root.innerHTML=`
<button id="avatarOpen" type="button" aria-haspopup="dialog" aria-controls="avatarPanel">👤 Avatar & Pack</button>
<section id="avatarPanel" class="avatar-overlay" role="dialog" aria-modal="true" aria-labelledby="avatarHeading" hidden>
 <div class="avatar-sheet">
  <header class="avatar-header"><div><span class="avatar-eyebrow">GPTWORLD · YOUR CHARACTER</span><h2 id="avatarHeading">Avatar & Backpack</h2><p id="avatarStatus" role="status" aria-live="polite">Loading your character…</p></div><button id="avatarClose" type="button" aria-label="Close avatar">✕</button></header>
  <div class="avatar-content">
   <section class="avatar-character" aria-label="Character equipment">
    <div class="avatar-figure" role="img" aria-label="Character wearing currently equipped gear">
      <div class="avatar-hair"></div><div class="avatar-head"></div><div class="avatar-neck"></div><div class="avatar-body"></div><div class="avatar-arm avatar-arm-left"></div><div class="avatar-arm avatar-arm-right"></div><div class="avatar-leg avatar-leg-left"></div><div class="avatar-leg avatar-leg-right"></div><div class="avatar-boot avatar-boot-left"></div><div class="avatar-boot avatar-boot-right"></div>
      <div class="avatar-gear avatar-gear-head" id="avatarVisualHead"></div><div class="avatar-gear avatar-gear-chest" id="avatarVisualChest"></div><div class="avatar-gear avatar-gear-back" id="avatarVisualBack"></div><div class="avatar-gear avatar-gear-main" id="avatarVisualMain"></div><div class="avatar-gear avatar-gear-off" id="avatarVisualOff"></div>
    </div>
    <div id="avatarSlots" class="avatar-slots"></div>
   </section>
   <section class="avatar-backpack" aria-label="Backpack contents">
    <div class="avatar-backpack-header"><h3>🎒 Backpack</h3><input id="avatarSearch" placeholder="Find an item…" type="search" aria-label="Search backpack"/></div>
    <div id="avatarResources" class="avatar-resources"></div>
    <div id="avatarItems" class="avatar-items"></div>
   </section>
  </div>
 </div>
</section>`;
document.body.append(root);
const el=id=>root.querySelector('#'+id);
const panel=el('avatarPanel'),status=el('avatarStatus'),slots=el('avatarSlots'),items=el('avatarItems');
const safeText=(node,text)=>{node.textContent=String(text??'');};
async function request(body){
  const clientId=localStorage.getItem(CLIENT_KEY);
  if(!clientId)throw Error('Create or restore your traveler before opening your backpack.');
  const response=await fetch(body?API:`${API}?clientId=${encodeURIComponent(clientId)}`,
    body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,clientId})}:{cache:'no-store'});
  const next=await response.json();
  if(!response.ok||!next.ok)throw Error(next.error||'Cannot load equipment');
  return next;
}
function paint(){
  if(!data)return;
  const equippedIds=new Set(Object.values(data.slots).filter(Boolean));
  const byId=new Map(data.items.map(item=>[item.id,item]));
  slots.replaceChildren();
  for(const [key,label] of Object.entries(SLOT_NAMES)){
    const item=byId.get(data.slots[key]);
    const row=document.createElement('div');row.className='avatar-slot';
    const name=document.createElement('span');name.textContent=`${SYMBOLS[key]} ${label}`;
    const value=document.createElement('strong');value.textContent=item?.name||'Empty';
    row.append(name,value);
    if(item){
      const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.disabled=busy;
      remove.setAttribute('aria-label',`Unequip ${item.name} from ${label}`);
      remove.addEventListener('click',()=>mutate({action:'unequip',slot:key}));
      row.append(remove);
    }slots.append(row);
  }
  const colors={chest:'#526956',legs:'#494b50',feet:'#493c30'};
  for(const key of ['chest','legs','feet']){
    const gear=byId.get(data.slots[key]);if(gear)colors[key]=/iron|steel|plate|armor|mail/.test(gear.key)?'#92999d':/leather|hide/.test(gear.key)?'#7b5136':'#8c7154';
  }
  el('avatarVisualHead').textContent=data.slots.head?'🪖':'';
  el('avatarVisualChest').style.background=colors.chest;
  el('avatarVisualBack').textContent=data.slots.back?iconFor(byId.get(data.slots.back)?.key||'backpack'):'';
  el('avatarVisualMain').textContent=data.slots.mainHand?iconFor(byId.get(data.slots.mainHand)?.key||'sword'):'';
  el('avatarVisualOff').textContent=data.slots.offHand?iconFor(byId.get(data.slots.offHand)?.key||'shield'):'';
  for(const leg of root.querySelectorAll('.avatar-leg'))leg.style.background=colors.legs;
  for(const boot of root.querySelectorAll('.avatar-boot'))boot.style.background=colors.feet;
  safeText(el('avatarResources'),`🪵 ${Number(data.resources.wood||0)} wood  ·  🪨 ${Number(data.resources.stone||0)} stone  ·  🌿 ${Number(data.resources.herbs||0)} herbs  ·  🪙 ${Number(data.resources.coins||0)} coins`);
  items.replaceChildren();
  const remaining=data.items.filter(item=>!item.placed&&item.name.toLowerCase().includes(filter.toLowerCase()));
  if(!remaining.length){const empty=document.createElement('p');empty.className='avatar-empty';empty.textContent='No matching items in your backpack. Gather, craft, or trade for more gear.';items.append(empty);}
  for(const item of remaining){
    const row=document.createElement('div');row.className='avatar-item';
    const icon=document.createElement('span');icon.className='avatar-item-icon';icon.textContent=iconFor(item.key);
    const desc=document.createElement('div');desc.className='avatar-item-desc';
    const title=document.createElement('strong');title.textContent=`${item.name}${item.quantity>1?' ×'+item.quantity:''}`;
    const detail=document.createElement('small');detail.textContent=`${item.quality} · ${item.durability}/${item.maxDurability} durability${equippedIds.has(item.id)?' · Equipped':''}`;
    desc.append(title,detail);row.append(icon,desc);
    if(item.eligibleSlots.length&&!equippedIds.has(item.id)){
      const slot=item.eligibleSlots[0];const equip=document.createElement('button');equip.type='button';equip.textContent=`Equip · ${SLOT_NAMES[slot]}`;equip.disabled=busy;
      equip.addEventListener('click',()=>mutate({action:'equip',slot,itemId:item.id}));
      row.append(equip);
    }
    items.append(row);
  }
  // Existing hunting controls already animate bow shots. Keep their equipped bow in sync.
  const main=byId.get(data.slots.mainHand);
  window.dispatchEvent(new CustomEvent('gptworld:avatar-equipment',{detail:{mainHand:main?.key||'',slots:data.slots,items:data.items}}));
}
async function mutate(body){
  if(busy)return;busy=true;status.textContent='Saving equipment…';
  try{data=await request(body);status.textContent='Equipment saved';paint();}
  catch(error){status.textContent=`Could not change equipment: ${error.message}`;}
  finally{busy=false;}
}
async function open(){
  panel.hidden=false;status.textContent='Loading your character…';
  try{data=await request();safeText(el('avatarHeading'),`${data.name}'s avatar`);status.textContent='Tap an item to equip it. Changes are saved to your traveler.';paint();}
  catch(error){status.textContent=error.message;}
}
function close(){panel.hidden=true;}
el('avatarOpen').addEventListener('click',open);
el('avatarClose').addEventListener('click',close);
panel.addEventListener('click',e=>{if(e.target===panel)close();});
el('avatarSearch').addEventListener('input',e=>{filter=e.target.value;paint();});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){close();e.stopImmediatePropagation();}});
window.addEventListener('gptworld:equipment-refresh',()=>{if(!panel.hidden)open();});
