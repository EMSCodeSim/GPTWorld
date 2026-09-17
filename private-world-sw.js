const CACHE_NAME='gptworld-private-shell-v6';
const THREE_URL='https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
const PRIVATE_SHELL=[
  './private-world.html',
  './private-world.js?v=living-worlds-9',
  './private-world-cache.mjs?v=living-worlds-5',
  './private-world.css?v=living-worlds-9',
  './styles.css?v=living-worlds-5',
  './assets/crafting/campfire-kit.webp',
  './assets/crafting/wooden-crate.webp',
  './assets/crafting/stone-hammer.webp',
  './assets/crafting/stone-hearth.webp',
  './assets/crafting/healing-poultice.webp',
  './assets/crafting/weather-tonic.webp',
  THREE_URL
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>Promise.allSettled(PRIVATE_SHELL.map(url=>cache.add(url)))).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('gptworld-private-shell-')&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

function isPrivateAsset(url){
  if(url.href===THREE_URL)return true;
  if(url.origin!==self.location.origin)return false;
  return /\/(private-world(?:-cache)?\.(?:html|js|mjs|css)|styles\.css)$/.test(url.pathname)||url.pathname.includes('/assets/crafting/');
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(!isPrivateAsset(url))return;
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));return response;
  }).catch(()=>caches.match(event.request,{ignoreSearch:true}).then(cached=>cached||Response.error())));
});
