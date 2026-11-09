/* JoStrong service worker.
 * - Caches the app shell and static assets so workouts open offline.
 * - NEVER caches /api/*, /auth/* or Supabase traffic (personal data and sessions stay out of the cache).
 * - Personal data lives in IndexedDB (per account) and is wiped on sign-out; this worker also deletes its runtime cache then.
 */
const VERSION = "v1";
const STATIC = `jostrong-static-${VERSION}`;
const RUNTIME = `jostrong-runtime-${VERSION}`;
const SHELL = ["/", "/workout", "/workouts", "/progress", "/journey", "/settings", "/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(RUNTIME);
    // Best-effort: a signed-out visitor gets redirects, which we deliberately do not cache.
    await Promise.all(SHELL.map(async (url) => {
      try { const res = await fetch(url, { credentials: "same-origin" }); if (res.ok && !res.redirected) await cache.put(url, res); } catch { /* offline during install */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC, RUNTIME]);
    for (const k of await caches.keys()) if (k.startsWith("jostrong-") && !keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear-caches") {
    event.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("jostrong-")).map((k) => caches.delete(k)))));
  }
});

const isSensitive = (url) => url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || url.hostname.endsWith("supabase.co") || url.hostname.endsWith("supabase.in");

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || isSensitive(url)) return; // network only, not cached

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(caches.open(STATIC).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // Pages and RSC payloads: network first, fall back to the last good copy, then the offline page.
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME);
    try {
      const res = await fetch(req);
      if (res.ok && !res.redirected && (req.mode === "navigate" || req.headers.get("RSC"))) cache.put(req, res.clone());
      return res;
    } catch {
      const hit = (await cache.match(req)) || (await cache.match(url.pathname));
      if (hit) return hit;
      if (req.mode === "navigate") return (await cache.match("/offline")) || new Response("You're offline.", { status: 503, headers: { "content-type": "text/plain" } });
      return new Response("", { status: 504 });
    }
  })());
});

self.addEventListener("push", (event) => {
  let data = { title: "JoStrong", body: "Ready for a little strength training today?", url: "/" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch { /* use defaults */ }
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: data.url }, tag: "jostrong-reminder" }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(self.clients.matchAll({ type: "window" }).then((cs) => { const c = cs.find((w) => "focus" in w); return c ? c.focus() : self.clients.openWindow(target); }));
});
