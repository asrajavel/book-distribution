// Network first, so a new release shows at once; the cache only opens the app without network.
// no-cache: ask the server every time (cheap, it answers "unchanged"), else Pages' 10-minute browser cache serves old files.
// Bump VERSION on each release to drop the old cache.
const VERSION = "v15";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.hostname.endsWith("supabase.co") || url.hostname.endsWith("openfreemap.org")) return; // data and map tiles: always live
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(VERSION).then(k => k.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request).then(r => r || Response.error())));
});
