import { BareMuxConnection, BareClient } from "./baremux/index.mjs";

/* ------------------------------------------------------------------ *
 * Transport
 * ------------------------------------------------------------------ */

// The Wisp server that all proxied traffic is tunnelled through.
const WISP_URL = "wss://holywisp.fractl.al/";
let wispUrl = localStorage.getItem("prism.wisp") || WISP_URL;

const here = new URL("./", location.href); // handles /repo/ subpaths
const abs = (p) => new URL(p, here).href;
// Bump the query when the transport build changes so caches don't keep an old one.
const EPOXY_PATH = "epoxy/index.mjs?v=3";
const prefix = __uv$config.prefix;

let connection = null;

/* ------------------------------------------------------------------ *
 * Elements
 * ------------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);
const frame = $("frame");
const omni = $("omni");
const omniForm = $("omniForm");
const heroForm = $("heroForm");
const heroInput = $("heroInput");
const backBtn = $("back");
const forwardBtn = $("forward");
const reloadBtn = $("reload");
const statusEl = $("status");
const statusText = $("statusText");
const noticeEl = $("notice");

/* ------------------------------------------------------------------ *
 * Search engines
 * ------------------------------------------------------------------ */
const ENGINES = {
  DuckDuckGo: "https://duckduckgo.com/?q=%s",
  Google: "https://www.google.com/search?q=%s",
  Brave: "https://search.brave.com/search?q=%s",
  Bing: "https://www.bing.com/search?q=%s",
};
let engine = localStorage.getItem("prism.engine") || "DuckDuckGo";
if (!ENGINES[engine]) engine = "DuckDuckGo";

/* ------------------------------------------------------------------ *
 * Transport startup
 * ------------------------------------------------------------------ */
function setStatus(state, text) {
  statusEl.className = "status" + (state ? " " + state : "");
  statusText.textContent = text;
}

async function startTransport() {
  try {
    if (!("serviceWorker" in navigator)) throw new Error("Service workers are unavailable");
    await navigator.serviceWorker.register("sw.js", { scope: "./" });
    await navigator.serviceWorker.ready;

    connection = new BareMuxConnection(abs("baremux/worker.js"));
    await connection.setTransport(abs(EPOXY_PATH), [{ wisp: wispUrl }]);

    if (await probeWisp()) {
      setStatus("ok", "Tunnel: " + hostOf(wispUrl));
      setConnState("ok", "Ready");
      noticeEl.hidden = true;
    } else {
      setStatus("err", "Cannot reach " + hostOf(wispUrl));
      setConnState("err", "Unreachable");
      $("noticeUrl").textContent = hostOf(wispUrl);
      noticeEl.hidden = false;
    }
  } catch (err) {
    console.error(err);
    setStatus("err", "Transport failed: " + (err && err.message ? err.message : err));
    setConnState("err", "Failed");
  }
}

const hostOf = (url) => url.replace(/^wss?:\/\//, "").replace(/\/$/, "");

// Opens a throwaway socket to the Wisp server so a dead tunnel is visible up front.
function probeWisp() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {}
      resolve(ok);
    };
    const ws = new WebSocket(wispUrl);
    const timer = setTimeout(() => finish(false), 7000);
    ws.onopen = () => finish(true);
    ws.onerror = () => finish(false);
    ws.onclose = () => finish(false);
  });
}

function setConnState(state, text) {
  const el = document.getElementById("connState");
  el.className = "status" + (state ? " " + state : "");
  el.lastElementChild.textContent = text;
}

/* ------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------ */
const history = [];
let cursor = -1;

function looksLikeUrl(input) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) return true;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(input)) return true;
  return /^[^\s/?#]+\.[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(input);
}

function normalize(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(raw)) return "http://" + raw;
  if (looksLikeUrl(raw)) return "https://" + raw;
  return ENGINES[engine].replace("%s", encodeURIComponent(raw));
}

function load(target) {
  frame.src = prefix + __uv$config.encodeUrl(target);
  document.body.classList.add("browsing");
  omni.value = target;
  reloadBtn.disabled = false;
}

function navigate(target, push = true) {
  if (!target) return;
  load(target);
  if (push) {
    history.length = cursor + 1;
    history.push(target);
    cursor = history.length - 1;
  }
  syncButtons();
}

function syncButtons() {
  backBtn.disabled = cursor <= 0;
  forwardBtn.disabled = cursor < 0 || cursor >= history.length - 1;
}

function goHome() {
  document.body.classList.remove("browsing");
  omni.value = "";
  setTimeout(() => heroInput.focus(), 30);
  syncButtons();
}

omniForm.addEventListener("submit", (e) => {
  e.preventDefault();
  navigate(normalize(omni.value));
});

heroForm.addEventListener("submit", (e) => {
  e.preventDefault();
  navigate(normalize(heroInput.value));
});

backBtn.addEventListener("click", () => {
  if (cursor <= 0) return;
  cursor--;
  load(history[cursor]);
  syncButtons();
});

forwardBtn.addEventListener("click", () => {
  if (cursor >= history.length - 1) return;
  cursor++;
  load(history[cursor]);
  syncButtons();
});

reloadBtn.addEventListener("click", () => {
  if (!frame.src) return;
  try {
    frame.contentWindow.location.reload();
  } catch {
    const current = frame.src;
    frame.src = "about:blank";
    setTimeout(() => (frame.src = current), 60);
  }
});

$("homeBtn").addEventListener("click", goHome);
$("noticeSettings").addEventListener("click", () => (settings.hidden = false));

$("fullscreen").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
});

/* ------------------------------------------------------------------ *
 * Shortcuts
 * ------------------------------------------------------------------ */
const SHORTCUTS = [
  ["Google", "https://www.google.com", "G"],
  ["YouTube", "https://www.youtube.com", "Y"],
  ["Wikipedia", "https://en.wikipedia.org", "W"],
  ["Reddit", "https://www.reddit.com", "R"],
  ["GitHub", "https://github.com", "H"],
  ["Discord", "https://discord.com/app", "D"],
  ["Twitch", "https://www.twitch.tv", "T"],
  ["Spotify", "https://open.spotify.com", "S"],
];

const tiles = $("tiles");
for (const [name, url, letter] of SHORTCUTS) {
  const a = document.createElement("a");
  a.className = "tile";
  a.href = "#";
  a.innerHTML = `<i class="ic">${letter}</i><span>${name}</span>`;
  a.addEventListener("click", (e) => {
    e.preventDefault();
    navigate(url);
  });
  tiles.appendChild(a);
}

/* ------------------------------------------------------------------ *
 * Settings drawer
 * ------------------------------------------------------------------ */
const settings = $("settings");
const wispInput = $("wispInput");
wispInput.value = wispUrl;
$("settingsBtn").addEventListener("click", () => (settings.hidden = !settings.hidden));
$("closeSettings").addEventListener("click", () => (settings.hidden = true));

$("saveWisp").addEventListener("click", async () => {
  const next = wispInput.value.trim();
  if (!/^wss?:\/\//i.test(next)) {
    setConnState("err", "Must start with wss://");
    return;
  }
  wispUrl = next;
  localStorage.setItem("prism.wisp", wispUrl);
  setConnState("", "Reconnecting\u2026");
  await startTransport();
});

const enginesEl = $("engines");
for (const name of Object.keys(ENGINES)) {
  const b = document.createElement("button");
  b.className = "engine" + (name === engine ? " active" : "");
  b.textContent = name;
  b.addEventListener("click", () => {
    engine = name;
    localStorage.setItem("prism.engine", name);
    [...enginesEl.children].forEach((el) => el.classList.toggle("active", el === b));
  });
  enginesEl.appendChild(b);
}

$("testBtn").addEventListener("click", async () => {
  const started = Date.now();
  setConnState("", "Testing\u2026");
  try {
    if (!connection) await startTransport();
    const res = await new BareClient().fetch("https://example.com/", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    await res.text();
    setConnState("ok", "Working \u00b7 " + (Date.now() - started) + " ms");
  } catch (err) {
    console.error(err);
    setConnState("err", "Failed: " + (err && err.message ? err.message : err));
  }
});

$("clearBtn").addEventListener("click", async () => {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (err) {
    console.error(err);
  }
  location.reload();
});

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */
startTransport();
heroInput.focus();

// Expose a tiny helper for debugging from the console.
window.prism = { navigate, prefix, wisp: () => wispUrl };
