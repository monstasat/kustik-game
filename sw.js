const CACHE="kustik-game-v1-0";
const CORE=["./","./index.html","./game.js","./manifest.webmanifest","./icon-192.png","./icon-512.png"];

self.addEventListener("install",function(event){
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(function(cache){return cache.addAll(CORE)}));
});
self.addEventListener("activate",function(event){
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){return k!==CACHE}).map(function(k){return caches.delete(k)}));
    })
  ]));
});
self.addEventListener("fetch",function(event){
  if(event.request.method!=="GET")return;
  var req=event.request;
  if(req.mode==="navigate"){
    event.respondWith(
      fetch(req,{cache:"no-store"}).then(function(resp){
        var copy=resp.clone();caches.open(CACHE).then(function(c){c.put("./index.html",copy)});return resp;
      }).catch(function(){return caches.match("./index.html")})
    );
    return;
  }
  event.respondWith(caches.match(req).then(function(cached){
    return cached||fetch(req).then(function(resp){
      if(resp&&resp.ok){var copy=resp.clone();caches.open(CACHE).then(function(c){c.put(req,copy)})}
      return resp;
    });
  }));
});