const SHELL_CACHE='holdings-v2-shell-v1';
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(SHELL_CACHE).then(cache=>cache.addAll(['/','/manifest.webmanifest','/icon-192.png','/icon-512.png'])));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>n.startsWith('holdings-v2-')&&n!==SHELL_CACHE).map(n=>caches.delete(n)))));
 self.clients.claim();
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const u=new URL(req.url);
 if(u.origin!==self.location.origin)return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).catch(()=>caches.match('/')));
  return;
 }
 if(u.pathname.startsWith('/assets/')||u.pathname.startsWith('/icon-')||u.pathname==='/manifest.webmanifest'){
  event.respondWith(caches.open(SHELL_CACHE).then(async cache=>{
   const cached=await cache.match(req);
   if(cached)return cached;
   const response=await fetch(req);
   if(response.ok)cache.put(req,response.clone());
   return response;
  }));
 }
});
