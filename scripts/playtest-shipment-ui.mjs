#!/usr/bin/env node
/**
 * Headless Chrome playtest for the Missing Blacksmith Shipment adventure.
 * Captures desktop + mobile screenshots and drives the in-memory quest API loop from the page.
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import {SHIPMENT_POINTS} from '../lib/shipment-quest-core.mjs';

const BASE=process.env.PLAYTEST_URL||'http://127.0.0.1:8765';
const OUT=process.env.PLAYTEST_OUT||'/opt/cursor/artifacts';
const CHROME=process.env.CHROME_PATH||'/usr/bin/google-chrome-stable';
fs.mkdirSync(OUT,{recursive:true});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function shot(page,name){
  const file=path.join(OUT,name);
  await page.screenshot({path:file,fullPage:false});
  console.log('shot',file);
  return file;
}

async function enterWorld(page,name,{fresh=false}={}){
  await page.goto(BASE+'/',{waitUntil:'domcontentloaded',timeout:60000});
  if(fresh){
    await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
    await page.reload({waitUntil:'domcontentloaded'});
  }
  await sleep(2500);
  // Wait for device check
  for(let i=0;i<30;i++){
    const state=await page.evaluate(()=>{
      const btn=document.getElementById('enterWorld');
      const welcome=document.getElementById('welcome');
      const status=document.getElementById('deviceStatus')?.textContent||'';
      return{disabled:btn?.disabled,text:btn?.textContent||'',welcomeHidden:welcome?.hidden,status};
    });
    if(state.welcomeHidden)return 'already-in';
    if(!state.disabled&&/Enter|Create|saved/i.test(state.text))break;
    await sleep(500);
  }
  // Returning traveler on this device: just enter without renaming.
  const linked=await page.evaluate(()=>/linked to/i.test(document.getElementById('deviceStatus')?.textContent||''));
  if(!linked){
    await page.evaluate(n=>{
      const input=document.getElementById('playerName');
      if(input&&!input.disabled){input.value=n;input.dispatchEvent(new Event('input',{bubbles:true}));}
    },name);
  }
  await page.click('#enterWorld');
  await sleep(1200);
  // Recovery code gate
  const needsAck=await page.evaluate(()=>!document.getElementById('recoveryNotice')?.hidden);
  if(needsAck){
    await page.click('#enterWorld');
    await sleep(1000);
  }
  for(let i=0;i<40;i++){
    const hidden=await page.evaluate(()=>document.getElementById('welcome')?.hidden);
    if(hidden)return 'entered';
    const btn=await page.evaluate(()=>({disabled:document.getElementById('enterWorld')?.disabled,text:document.getElementById('enterWorld')?.textContent||''}));
    if(!btn.disabled&&/Enter|saved/i.test(btn.text)){await page.click('#enterWorld');await sleep(800);}
    await sleep(400);
  }
  return 'stuck';
}

async function movePlayer(page,x,z){
  await page.evaluate(async({x,z})=>{
    const player=window.__playtestPlayer;
    if(player){player.position.x=x;player.position.z=z;}
    // Also poke localStorage game state
    try{
      const key='gptworld-day1';
      const state=JSON.parse(localStorage.getItem(key)||'{}');
      state.x=x;state.z=z;localStorage.setItem(key,JSON.stringify(state));
    }catch{}
    const clientId=localStorage.getItem('gptworld-client-id');
    if(clientId){
      await fetch('/.netlify/functions/world',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({clientId,name:'Playtest',x,z})});
    }
  },{x,z});
  await sleep(300);
}

async function openAdventure(page){
  await page.evaluate(()=>window.dispatchEvent(new Event('gptworld:open-adventure')));
  await sleep(400);
}

async function clickChoice(page,substr){
  return page.evaluate(s=>{
    const buttons=[...document.querySelectorAll('#shipmentChoices button, #shipmentDockActions button')];
    const btn=buttons.find(b=>b.textContent.toLowerCase().includes(s.toLowerCase()));
    if(!btn||btn.disabled)return false;
    btn.click();
    return true;
  },substr);
}

async function questStage(page){
  return page.evaluate(async()=>{
    const clientId=localStorage.getItem('gptworld-client-id');
    const r=await fetch('/.netlify/functions/shipment-quest?clientId='+encodeURIComponent(clientId),{cache:'no-store'});
    const d=await r.json();
    return d.quest||null;
  });
}

async function runViewport(browser,label,viewport,traveler){
  const page=await browser.newPage();
  await page.setViewport(viewport);
  // Expose player reference once main.js boots
  await page.evaluateOnNewDocument(()=>{
    const hook=()=>{
      try{
        // main.js does not export player; watch Three scene via mutation of shipment dock presence
      }catch{}
    };
    document.addEventListener('DOMContentLoaded',hook);
  });

  const entry=await enterWorld(page,traveler,{fresh:label==='mobile'});
  console.log(label,'entry',entry);
  await shot(page,`shipment_${label}_welcome_or_world.png`);

  // Try to bind player from interactables and shipmentAdventure via HUD presence
  await page.evaluate(()=>{
    // Soft hook: observe shipment dock creation
    window.__playtestPlayer=null;
    const tryFind=()=>{
      // Walk THREE objects if available through modules is hard; use position sync via evaluate later with DOM only.
    };
    tryFind();
  });

  // Inject a helper by patching player position through the adventure module isn't exported.
  // Instead, drive proximity via presence API + synthetic click after teleporting camera-relative by editing local presence
  // and using the adventure act endpoints through the journal buttons after we move presence.
  // We also monkey-patch Math.hypot distance by moving the real player if we can find it on scene.
  await page.evaluate(()=>{
    const canvas=document.querySelector('canvas');
    // Discover player mesh via shipmentAdventure markers' sibling? Not available.
    // Fallback: redefine nearness by posting presence and calling act from journal which uses player.position —
    // so we MUST move the actual Three.js player. Look for global GPTWorldEngine and walk scene graph for humanoid near spawn.
    const app=document.getElementById('world');
    // Store a mover that sets position on whatever object shipment uses — createShipmentAdventure closes over player.
    // Hack: temporarily override Number/math used by near() by relocating via keyboard simulation won't work for large distances.
  });

  // Better approach: expose mover by rewriting player.position from within page using Object that adventure closes over —
  // We can find the player by searching for the humanoid with pack=false at state coords after start.
  await page.evaluate(()=>{
    // Three is module-scoped. Use the interact prompt / known DOM only.
    // Attach a debug API by intercepting fetch to shipment-quest and… no.
  });

  // Patch: load a small injector that uses Function constructor against shipmentAdventure through event.
  // Simplest reliable path for playtest: call the shipment API from the page for progression, then reload UI,
  // AND separately verify dock/journal rendering for each stage by forcing quest reload after API advances
  // while also teleporting the Three player via a custom event we add… 
  // Since we didn't add a debug event, inject script into window that finds meshes named by scanning all objects:
  const found=await page.evaluate(()=>{
    // Attempt to access THREE via canvas renderer __objects — not standard.
    return Boolean(document.getElementById('shipmentDock'));
  });
  console.log(label,'dockPresent',found);

  // Drive stages via API while syncing a fake player position into adventure by replacing player.position setters.
  // Install a Proxy through the adventure's closed player by monkeypatching Element append? Too hard.
  // Practical solution used here: evaluate clicks on Accept (no proximity), then for location actions POST to API
  // and call shipmentAdventure.reload(); dock/journal will show new stage. Proximity buttons appear only when near —
  // so also inject temporary override of distance by patching Math.hypot for the page... dangerous.
  // Cleaner: add window.__gptworldDebugMove in shipment-adventure — but avoid code change mid-playtest if possible.
  // We'll verify UI text per stage by API advance + reload, and verify proximity buttons by temporarily
  // setting player.position if we can grab it from the interactables array leaked on window.

  await openAdventure(page);
  await sleep(500);
  await shot(page,`shipment_${label}_journal_not_started.png`);

  const accepted=await clickChoice(page,'accept');
  console.log(label,'acceptClick',accepted);
  await sleep(1200);
  await shot(page,`shipment_${label}_after_accept.png`);

  let quest=await questStage(page);
  console.log(label,'stage',quest?.stage,quest?.objective);

  // Advance through API with presence, then reload UI for returning-save feel
  const clientId=await page.evaluate(()=>localStorage.getItem('gptworld-client-id'));
  async function api(action,pos){
    if(pos){
      await page.evaluate(async({clientId,x,z})=>{
        await fetch('/.netlify/functions/world',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId,name:'Playtest',x,z})});
      },{clientId,...pos});
    }
    await page.evaluate(async({clientId,action})=>{
      await fetch('/.netlify/functions/shipment-quest',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({clientId,action,idempotencyKey:crypto.randomUUID()})});
    },{clientId,action});
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await sleep(600);
  }

  if(quest?.stage==='tracking'){
    await api('find_clue_axle',SHIPMENT_POINTS.axle);
    await api('hear_rumor',SHIPMENT_POINTS.mara);
    await api('inspect_tracks',SHIPMENT_POINTS.tracks);
  }
  quest=await questStage(page);
  await openAdventure(page);await sleep(400);
  await shot(page,`shipment_${label}_wagon_stage.png`);
  console.log(label,'afterExplore',quest?.stage,quest?.meta?.clues);

  if(quest?.stage==='wagon_found'){
    await api('avoid_wolf',SHIPMENT_POINTS.wolf);
  }
  quest=await questStage(page);
  if(quest?.stage==='wolf_resolved')await api('recover',SHIPMENT_POINTS.cache);
  quest=await questStage(page);
  if(quest?.stage==='shipment_recovered')await api('turn_in',SHIPMENT_POINTS.tovan);
  quest=await questStage(page);
  await openAdventure(page);await sleep(500);
  await shot(page,`shipment_${label}_completed.png`);
  console.log(label,'completed',quest?.stage,quest?.objective);

  // Returning save: reload page and confirm stage persists
  await page.reload({waitUntil:'domcontentloaded'});
  await sleep(3000);
  const entry2=await enterWorld(page,traveler);
  console.log(label,'returnEntry',entry2);
  await sleep(1500);
  quest=await questStage(page);
  await openAdventure(page);await sleep(400);
  await shot(page,`shipment_${label}_returning_save.png`);
  console.log(label,'returningStage',quest?.stage);

  // Replay
  if(quest?.stage==='completed'){
    await clickChoice(page,'replay');
    await sleep(1000);
    quest=await questStage(page);
    await shot(page,`shipment_${label}_replay.png`);
    console.log(label,'replay',quest?.stage,quest?.meta?.run);
  }

  const dockText=await page.evaluate(()=>document.getElementById('shipmentDockText')?.textContent||'');
  await page.close();
  return{label,quest,dockText};
}

const browser=await puppeteer.launch({
  executablePath:CHROME,
  headless:true,
  args:['--no-sandbox','--disable-gpu','--window-size=1280,800']
});

try{
  const desktop=await runViewport(browser,'desktop',{width:1280,height:800,deviceScaleFactor:1},`ShipD${Date.now().toString().slice(-4)}`);
  const mobile=await runViewport(browser,'mobile',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true},`ShipM${Date.now().toString().slice(-4)}`);
  console.log(JSON.stringify({desktop,mobile},null,2));
}finally{
  await browser.close();
}
