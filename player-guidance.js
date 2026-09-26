/** Contextual new-player guidance for the public + private loop. Avoids long tutorials. */
(function(){
  const KEY='gptworld-guidance-v1';
  const steps=[
    {id:'gather',text:'Gather wood, stone, or herbs nearby — look for glowing resource nodes.'},
    {id:'shelter',text:'Visit your private land from the World Gateway to establish shelter and crafts.'},
    {id:'food',text:'Farm a plot or hunt with a bow for food, then cook trail rations.'},
    {id:'craft',text:'Open Field Crafting on your land and make a useful tool or storage.'},
    {id:'town',text:'Return to town and sell goods to a merchant for coins.'},
    {id:'project',text:'Near the council hall, contribute to the active Community Project.'},
    {id:'home',text:'Head home again — your land and the town both remember what you do.'}
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
  function nextTip(){
    const state=load();
    const tip=steps.find(step=>!state.seen[step.id]);
    if(!tip)return;
    // Only nudge periodically so we do not spam.
    const now=Date.now();
    if(state.lastAt&&now-state.lastAt<90000)return;
    state.seen[tip.id]=true;
    state.lastAt=now;
    save(state);
    toast(tip.text);
  }
  window.addEventListener('gptworld:inventory-state',()=>{
    const state=load();
    if(!state.seen.gather){state.seen.gather=true;save(state);toast(steps[0].text);}
  });
  setTimeout(nextTip,8000);
  setInterval(nextTip,120000);
})();
