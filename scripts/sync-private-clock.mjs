import fs from 'node:fs';

const mainPath='main.js';
const privatePath='private-world.js';
const htmlPath='private-world.html';
let main=fs.readFileSync(mainPath,'utf8');
let priv=fs.readFileSync(privatePath,'utf8');
let html=fs.readFileSync(htmlPath,'utf8');

const publicAnchor="const REGISTRATION_KEY='gptworld-registration-key';";
if(!main.includes("gptworld-shared-clock")){
  if(!main.includes(publicAnchor)) throw new Error('public clock anchor not found');
  main=main.replace(publicAnchor, `${publicAnchor}\nconst SHARED_CLOCK_KEY='gptworld-shared-clock';\nlet sharedClockPrevious=null;\nfunction publishSharedWorldClock(){\n  try{\n    const now=Date.now(),minutes=Number(elapsedWorldMinutes||0);\n    let rate=Number(sharedClockPrevious?.rate||0);\n    if(sharedClockPrevious&&now>sharedClockPrevious.at){\n      const measured=(minutes-sharedClockPrevious.minutes)/((now-sharedClockPrevious.at)/1000);\n      if(Number.isFinite(measured)&&measured>0&&measured<120)rate=measured;\n    }\n    const sample={minutes,at:now,rate:Number.isFinite(rate)&&rate>0?rate:1};\n    localStorage.setItem(SHARED_CLOCK_KEY,JSON.stringify(sample));\n    sharedClockPrevious=sample;\n  }catch{}\n}\nsetInterval(publishSharedWorldClock,750);\n`);
}

const privateAnchor="const CLIENT_KEY='gptworld-client-id';";
if(!priv.includes("gptworld-shared-clock")){
  if(!priv.includes(privateAnchor)) throw new Error('private clock anchor not found');
  priv=priv.replace(privateAnchor, `${privateAnchor}\nconst SHARED_CLOCK_KEY='gptworld-shared-clock';\nfunction formatSharedClock(minutes){const m=((Math.floor(minutes)%1440)+1440)%1440;return \`${'${String(Math.floor(m/60)).padStart(2,\'0\')}:${String(m%60).padStart(2,\'0\')}'}\`;}\nfunction syncClockFromPublic(){\n  try{\n    const sample=JSON.parse(localStorage.getItem(SHARED_CLOCK_KEY)||'null');\n    if(!sample||!Number.isFinite(Number(sample.minutes)))return;\n    const rate=Number.isFinite(Number(sample.rate))&&Number(sample.rate)>0?Number(sample.rate):1;\n    const minutes=Number(sample.minutes)+Math.max(0,Date.now()-Number(sample.at||Date.now()))/1000*rate;\n    if(statusEls.clock)statusEls.clock.textContent=formatSharedClock(minutes);\n  }catch{}\n}\nsetInterval(syncClockFromPublic,250);\n`);
}

html=html.replace(/private-world\.js\?v=[^\"]+/,'private-world.js?v=shared-clock-1');
fs.writeFileSync(mainPath,main);
fs.writeFileSync(privatePath,priv);
fs.writeFileSync(htmlPath,html);
console.log('Shared public/private clock synchronization patched.');
