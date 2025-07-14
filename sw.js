const CACHE_NAME = 'tienlen-v1';
const ASSETS_TO_CACHE = [
  "./index.html",
  "./manifest.json",
  "./sw.js",

  // JavaScript files
  "./js/config.js",
  "./js/engine.js",
  "./js/rules.js",
  "./js/settings.js",
  "./js/utils.js",

  // CSS
  "./styles/style.css",

  // Audio files
  "./audio/chia.mp3",
  "./audio/click.mp3",
  "./audio/danh.mp3",
  "./audio/hehe.mp3",
  "./audio/may-con-ga.mp3",
  "./audio/may-ha-buoi.mp3",
  "./audio/ngu-ne.mp3",
  "./audio/thua-di-cung.mp3",

  // You may have image files — assuming common extensions:
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
