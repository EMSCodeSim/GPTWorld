(()=>{
  const button=document.getElementById('craftButton'),panel=document.getElementById('craftingPanel'),close=document.getElementById('closeCrafting'),result=document.getElementById('craftingResult');
  if(!button||!panel)return;
  button.addEventListener('click',()=>{
    panel.hidden=false;
    if(result){result.dataset.outcome='loading';result.hidden=false;result.replaceChildren(Object.assign(document.createElement('strong'),{textContent:'Opening your bag…'}),Object.assign(document.createElement('span'),{textContent:'Syncing skills, recipes, and crafted possessions.'}));}
  },{capture:true});
  close?.addEventListener('click',()=>{panel.hidden=true;},{capture:true});
})();
