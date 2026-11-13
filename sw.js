/* global UVServiceWorker, __uv$config */
importScripts("uv/uv.bundle.js");
importScripts("uv.config.js");
importScripts(__uv$config.sw);

const uv = new UVServiceWorker();

// Take control on the first visit so the proxy works without a second reload.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

async function handleRequest(event) {
  if (uv.route(event)) {
    return await uv.fetch(event);
  }
  return await fetch(event.request);
}

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});
