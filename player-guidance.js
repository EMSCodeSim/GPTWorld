/** Subtle first-session tips — paced for the first 5 / 15 / 30 minutes. */
(function(){
  const KEY='gptworld-guidance-v1';
  const steps=[
    {id:'gather',text:'Gather wood, stone, or herbs nearby — look for glowing resource nodes.',signal:'gather',atMs:8000},
    {id:'inventory',text:'Your pack changed. Keep gathering until you have enough for a simple craft.',signal:'gather',atMs:45000},
    {id:'shelter',text:'Visit your private land from the World Gateway — that property is yours.',signal:'gateway',atMs:90000},
    {id:'food',text:'On your land: plant a crop or craft a basic bow to hunt.',signal:'private',atMs:4*60*1000},
    {id:'craft',text:'Open Craft on your land and make a stone hammer or campfire.',signal:'craft',atMs:8*60*1000},
    {id:'town',text:'Return to town and sell crafted goods when demand looks HIGH.',signal:'town',atMs:12*60*1000},
    {id:'project',text:'Near the council hall, contribute to the active Community Project.',signal:'project',atMs:18*60*1000},
    {id:'home',text:'Pick a direction: improve your cabin, level a skill, or finish the town forge.',signal:'home',atMs:28*60*1000}
  ];
  function load(){try{return JSON.parse(localStorage.getItem(KEY))||{seen:{},soft:{}};}catch{return{seen:{},soft:{}};}}
  function save(state){localStorage.setItem(KEY,JSON.stringify(state));}
  function toast(message){
    const t=document.getElementById('toast');
    if(!t)return;
    t.textContent=message;
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'),4200);
  }
  function mark(id){
    const state=load();
    if(state.seen[id])return false;
    state.seen[id]=true;
    state.lastAt=Date.now();
    save(state);
    return true;
  }
  function showIfNew(id){
    const step=steps.find(s=>s.id===id);
    if(!step)return;
    if(mark(id))toast(step.text);
  }
  function softShow(tip){
    const state=load();
    if(state.seen[tip.id])return;
    const soft=state.soft||{};
    const count=Number(soft[tip.id]||0);
    if(count>=2){state.seen[tip.id]=true;save(state);return;}
    const now=Date.now();
    if(state.lastAt&&now-state.lastAt<90000)return;
    if(now-(state.startedAt||now)<tip.atMs)return;
    soft[tip.id]=count+1;
    state.soft=soft;
    state.lastAt=now;
    save(state);
    toast(tip.text);
  }
  function nextTip(){
    const state=load();
    if(!state.startedAt){state.startedAt=Date.now();save(state);}
    const tip=steps.find(step=>!state.seen[step.id]);
    if(!tip)return;
    softShow(tip);
  }
  window.addEventListener('gptworld:inventory-state',()=>showIfNew('gather'));
  window.addEventListener('gptworld:living-town',e=>{
    if(e.detail?.activeProject)showIfNew('project');
  });
  window.addEventListener('gptworld:living-event',()=>showIfNew('town'));
  const boot=load();
  if(!boot.startedAt){boot.startedAt=Date.now();save(boot);}
  setTimeout(nextTip,10000);
  setInterval(nextTip,120000);
})();
