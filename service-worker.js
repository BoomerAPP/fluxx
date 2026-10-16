/* ============================================================
   FLUXCHAT SERVICE WORKER v1.3
   icon naming: Icon-XX.png
   ============================================================ */

const CACHE_VERSION = "fluxchat-v1";
const RUNTIME_CACHE = "fluxchat-runtime-v1";

/* ---- PRECACHE ---- */
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/css/style.css",
  "./assets/js/app.js",
  "./assets/js/chat.js",
  "./assets/js/auth.js",
  "./assets/js/ai.js",
  "./assets/js/config.js",
  "./assets/js/firebase-config.js",
  // icon sizes
  "./assets/Icon-48.png",
  "./assets/Icon-72.png",
  "./assets/Icon-96.png",
  "./assets/Icon-144.png",
  "./assets/Icon-192.png",
  "./assets/Icon-512.png"
];

/* ---- BYPASS ---- */
const BYPASS_HOSTS = [
  "firebase",
  "firebaseio",
  "googleapis",
  "gstatic",
  "firebasestorage",
  "openrouter.ai",
  "groq.com",
  "pollinations.ai"
];

/* network-first: manifest + html */
const NETWORK_FIRST_PATHS = [
  "/manifest.json",
  "/index.html"
];

function shouldBypass(url) {
  for (var i = 0; i < BYPASS_HOSTS.length; i++) {
    if (url.hostname.indexOf(BYPASS_HOSTS[i]) !== -1) return true;
  }
  return false;
}

function isNetworkFirst(url) {
  var path = url.pathname;
  for (var i = 0; i < NETWORK_FIRST_PATHS.length; i++) {
    if (path.indexOf(NETWORK_FIRST_PATHS[i]) !== -1) return true;
  }
  return false;
}

/* ---- ICON DETECTION (case-insensitive) ---- */
function isIcon(url) {
  return /\/icon-\d+x\d+\.png$/i.test(url.pathname) ||
    /\/Icon-\d+\.png$/.test(url.pathname) ||
    /\/icons\//.test(url.pathname);
}

/* ---- INSTALL ---- */
self.addEventListener("install", function(event) {
  console.log("[SW] install v1.3");
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      return Promise.all(
        PRECACHE_ASSETS.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn("[SW] skip:", url, err.message);
          });
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

/* ---- ACTIVATE ---- */
self.addEventListener("activate", function(event) {
  console.log("[SW] activate v1.3");
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) {
          return k !== CACHE_VERSION && k !== RUNTIME_CACHE;
        }).map(function(k) {
          return caches.delete(k);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ---- FETCH ---- */
self.addEventListener("fetch", function(event) {
  var req = event.request;
  
  if (req.method !== "GET") return;
  
  var url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  
  if (shouldBypass(url)) return;
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  
  /* 1. MANIFEST + HTML = NETWORK-FIRST */
  if (isNetworkFirst(url)) {
    event.respondWith(
      fetch(req)
      .then(function(res) {
        if (res && res.status === 200) {
          var clone = res.clone();
          caches.open(CACHE_VERSION).then(function(c) {
            c.put(req, clone);
          });
        }
        return res;
      })
      .catch(function() {
        return caches.match(req);
      })
    );
    return;
  }
  
  /* 2. ICONS = CACHE-FIRST */
  if (isIcon(url)) {
    event.respondWith(
      caches.match(req).then(function(cached) {
        if (cached) return cached;
        
        return fetch(req).then(function(res) {
          if (!res || res.status !== 200) return res;
          var clone = res.clone();
          caches.open(CACHE_VERSION).then(function(c) {
            c.put(req, clone);
          });
          return res;
        }).catch(function() {
          return new Response("", { status: 204 });
        });
      })
    );
    return;
  }
  
  /* 3. ASSETS LAIN = CACHE-FIRST */
  event.respondWith(
    caches.match(req).then(function(cached) {
      if (cached) return cached;
      
      return fetch(req).then(function(res) {
        if (!res || res.status !== 200) return res;
        
        var clone = res.clone();
        caches.open(RUNTIME_CACHE).then(function(c) {
          c.put(req, clone);
        });
        
        return res;
      }).catch(function() {
        if (req.destination === "image") {
          return new Response("", { status: 204 });
        }
        return new Response("offline", {
          status: 503,
          headers: { "Content-Type": "text/plain" }
        });
      });
    })
  );
});

/* ---- MESSAGE ---- */
self.addEventListener("message", function(event) {
  if (!event.data) return;
  
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  
  if (event.data.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches.keys().then(function(keys) {
        return Promise.all(keys.map(function(k) { return caches.delete(k); }));
      })
    );
  }
  
  if (event.data.type === "CACHE_ICONS") {
    event.waitUntil(
      caches.open(CACHE_VERSION).then(function(cache) {
        return Promise.all(
          PRECACHE_ASSETS
          .filter(function(u) {
            try { return isIcon(new URL(u, self.location.origin)); }
            catch (e) { return false; }
          })
          .map(function(u) {
            return cache.add(u).catch(function() {});
          })
        );
      })
    );
  }
});

console.log("[SW] loaded v1.3");