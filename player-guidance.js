/** Subtle first-session tips — marked only after related world signals, not on a timer alone. */
(function(){
  const KEY='gptworld-guidance-v1';
  const steps=[
    {id:'gather',text:'Gather wood, stone, or herbs nearby — look for glowing resource nodes.',signal:'gather'},
    {id:'shelter',text:'Visit your private land from the World Gateway to establish shelter and crafts.',signal:'gateway'},
    {id:'food',text:'On your land: Farm a plot or Hunt with a bow, then cook trail rations.',signal:'private'},
    {id:'craft',text:'Open Craft on your land and make a useful tool or storage.',signal:'craft'},
    {id:'town',text:'Return to town and sell goods to a merchant when demand looks HIGH.',signal:'town'},
    {id:'project',text:'Near the council hall, contribute to the active Community Project.',signal:'project'},
    {id:'home',text:'Your land and the town both remember what you do — head home with a new goal.',signal:'home'}
  ];
  function load(){try{return JSON.parse(localStorage.getItem(KEY))||{seen:{}};}catch{return{seen:{}};}}
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
  function nextTip(){
    const state=load();
    const tip=steps.find(step=>!state.seen[step.id]);
    if(!tip)return;
    const now=Date.now();
    if(state.lastAt&&now-state.lastAt<120000)return;
    // Soft nudge only — do not mark as permanently seen until a related signal fires,
    // except the first tip which is introductory.
    if(tip.id==='gather'){
      state.lastAt=now;save(state);toast(tip.text);return;
    }
    state.lastAt=now;save(state);toast(tip.text);
  }
  window.addEventListener('gptworld:inventory-state',()=>showIfNew('gather'));
  window.addEventListener('gptworld:living-town',e=>{
    if(e.detail?.activeProject)showIfNew('project');
  });
  window.addEventListener('gptworld:living-event',()=>showIfNew('town'));
  setTimeout(nextTip,10000);
  setInterval(nextTip,180000);
})();
