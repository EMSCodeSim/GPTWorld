const MEMORY_API='/.netlify/functions/world-memory';
const entries=document.getElementById('chronicleEntries');
const panel=document.querySelector('.chronicle');
const oldToggle=document.getElementById('toggleChronicle');

function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function installToggle(){
  if(!entries||!oldToggle)return;
  const button=oldToggle.cloneNode(true);
  oldToggle.replaceWith(button);
  let open=true;
  const apply=()=>{
    entries.hidden=!open;
    panel?.classList.toggle('chronicle-collapsed',!open);
    button.textContent=open?'Hide':'Show';
    button.setAttribute('aria-expanded',String(open));
  };
  button.addEventListener('click',()=>{open=!open;apply();});
  apply();
}

function parseChronicle(markdown){
  const blocks=[];
  const parts=String(markdown||'').split(/^##\s+/m).slice(1);
  for(const part of parts){
    const lines=part.trim().split('\n');
    const title=(lines.shift()||'').trim();
    const body=lines.join('\n').trim();
    const paragraphs=body.split(/\n\s*\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
    if(!title||!paragraphs.length)continue;
    blocks.push({stamp:title,text:paragraphs.slice(0,2).join(' '),official:true});
  }
  return blocks.reverse();
}

function describeEvent(event){
  const type=String(event?.event_type||'');
  const p=event?.payload||{};
  const who=event?.display_name||'A traveler';
  if(type==='stockpile_deposit')return `${who} deposited ${Number(p.amount||1)} ${p.resource||'resource'} into the settlement stockpile.`;
  if(type==='western_crossing_completed')return 'Travelers completed the Western Crossing, permanently opening the western bank.';
  if(type==='bridge_contribution')return `${who} contributed ${Number(p.wood||0)} wood and ${Number(p.stone||0)} stone to the Western Crossing.`;
  if(type==='ecosystem_year_advanced')return `The living ecosystem advanced to Eco Year ${Number(p.simulatedYear||0)}.`;
  if(type==='landmark_history_inspected')return `${who} inspected the history of the Western Crossing.`;
  if(type==='resource_gathered'||type==='gather')return `${who} gathered ${Number(p.amount||1)} ${p.resource||'resource'}.`;
  return null;
}

function eventStamp(event){
  const d=new Date(event?.created_at||'');
  if(Number.isNaN(d.getTime()))return 'Recent shared activity';
  return `Shared world · ${d.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}`;
}

function render(items){
  if(!entries)return;
  entries.innerHTML='';
  for(const item of items){
    const div=document.createElement('div');
    div.className='entry'+(item.official?' official-entry':'');
    div.innerHTML=`<time>${esc(item.stamp)}</time><p>${esc(item.text)}</p>`;
    entries.appendChild(div);
  }
}

async function refreshChronicle(){
  if(!entries)return;
  let official=[];
  let activity=[];
  try{
    const r=await fetch(`./CHRONICLE.md?v=${Date.now()}`,{cache:'no-store'});
    if(r.ok)official=parseChronicle(await r.text());
  }catch{}
  try{
    const r=await fetch(MEMORY_API,{cache:'no-store'});
    const data=await r.json();
    if(data.ok&&Array.isArray(data.recent_events)){
      const seen=new Set();
      for(const ev of data.recent_events){
        const text=describeEvent(ev);
        if(!text)continue;
        const key=`${ev.event_type}:${JSON.stringify(ev.payload||{})}:${ev.display_name||''}`;
        if(seen.has(key))continue;
        seen.add(key);
        activity.push({stamp:eventStamp(ev),text});
        if(activity.length>=10)break;
      }
    }
  }catch{}
  if(official.length||activity.length)render([...official,...activity]);
}

installToggle();
refreshChronicle();
setInterval(refreshChronicle,30000);
