const CACHE_NAME = 'tienlen-v1';
const ASSETS_TO_CACHE = [
  "./audio/chia.mp3",
  "./audio/click.mp3",
  "./audio/danh.mp3",
  "./audio/hehe.mp3",
  "./audio/may-con-ga.mp3",
  "./audio/may-ha-buoi.mp3",
  "./audio/ngu-ne.mp3",
  "./audio/thua-di-cung.mp3",
  "./audio/khongco.mp3",
  "./audio/boqua.mp3",

  "./images/icon64.png", 
  "./images/icon128.png", 
  "./images/icon512.png", 
]

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
