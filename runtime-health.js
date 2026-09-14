const toast=document.getElementById('toast');
let lastErrorAt=0;
function show(message){if(!toast)return;toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200)}
function refreshRuntime(){try{window.GPTWorldEngine?.refreshWorld?.();window.GPTWorldEngine?.refreshResources?.();}catch{}}
window.addEventListener('online',()=>{show('Connection restored. Syncing world…');refreshRuntime();});
window.addEventListener('offline',()=>show('Offline. Changes will wait for connection.'));
window.addEventListener('focus',refreshRuntime);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshRuntime();});
window.addEventListener('error',event=>{const now=Date.now();if(now-lastErrorAt<5000)return;lastErrorAt=now;console.error('GPTWorld runtime error',event.error||event.message);});
window.addEventListener('unhandledrejection',event=>{const now=Date.now();if(now-lastErrorAt<5000)return;lastErrorAt=now;console.error('GPTWorld rejected promise',event.reason);});