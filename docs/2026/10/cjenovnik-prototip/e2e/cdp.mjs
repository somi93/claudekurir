// Minimalan CDP klijent (ws) - bez puppeteer-a, jer ga projekat nema.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Koren repozitorijuma: REPO_ROOT ili trenutni direktorijum (pokretati iz korijena repoa); ws je u node_modules projekta.
const require = createRequire(path.join(process.env.REPO_ROOT || process.cwd(), "package.json"));
const WebSocket = require("ws");

// Chrome: CHROME_PATH, inače uobičajene putanje (Windows / Linux).
import { existsSync } from "node:fs";
const CHROME = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find((p) => existsSync(p)) || "chrome";
const PORT = Number(process.env.CDP_PORT || 9335);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ shotsDir, width = 390, height = 844, dpr = 2, mobile = true } = {}) {
  mkdirSync(shotsDir, { recursive: true });
  const userDir = mkdtempSync(path.join(tmpdir(), "cdp-"));
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDir}`,
      "--no-first-run",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "--lang=sr-RS",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let version;
  for (let i = 0; i < 80; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      break;
    } catch {
      await sleep(250);
    }
  }
  if (!version) throw new Error("Chrome se nije podigao");

  const bws = new WebSocket(version.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((r) => bws.once("open", r));
  let bid = 0;
  const bpending = new Map();
  bws.on("message", (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id) {
      const cb = bpending.get(msg.id);
      bpending.delete(msg.id);
      cb?.(msg);
    }
  });
  const browserSend = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++bid;
      bpending.set(i, (msg) => (msg.error ? reject(new Error(`${method}: ${JSON.stringify(msg.error)}`)) : resolve(msg.result)));
      bws.send(JSON.stringify({ id: i, method, params }));
    });

  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((r) => ws.once("open", r));

  let id = 0;
  const pending = new Map();
  const consoleMsgs = [];
  const exceptions = [];
  const logEntries = [];
  const failedRequests = [];
  const listeners = new Map();
  const on = (method, fn) => {
    if (!listeners.has(method)) listeners.set(method, []);
    listeners.get(method).push(fn);
  };

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id) {
      const cb = pending.get(msg.id);
      pending.delete(msg.id);
      cb?.(msg);
      return;
    }
    if (msg.method) for (const fn of listeners.get(msg.method) ?? []) fn(msg.params);
    if (msg.method === "Runtime.consoleAPICalled") {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ");
      consoleMsgs.push({ t: Date.now(), type: msg.params.type, text });
    } else if (msg.method === "Runtime.exceptionThrown") {
      exceptions.push({ t: Date.now(), text: msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text });
    } else if (msg.method === "Log.entryAdded") {
      logEntries.push({ level: msg.params.entry.level, text: msg.params.entry.text, url: msg.params.entry.url });
    } else if (msg.method === "Network.loadingFailed") {
      failedRequests.push({ error: msg.params.errorText, type: msg.params.type });
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, (msg) => (msg.error ? reject(new Error(`${method}: ${JSON.stringify(msg.error)}`)) : resolve(msg.result)));
      ws.send(JSON.stringify({ id: i, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile });
  if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: 'try{localStorage.getItem("dispatcher-token")||localStorage.setItem("dispatcher-token","test")}catch(e){}',
  });

  const evalJs = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`eval: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };

  const waitFor = async (expression, { timeout = 15000, interval = 120, label = expression } = {}) => {
    const t0 = Date.now();
    for (;;) {
      let v;
      try {
        v = await evalJs(expression);
      } catch {
        v = false;
      }
      if (v) return v;
      if (Date.now() - t0 > timeout) throw new Error(`timeout (${timeout}ms): ${label}`);
      await sleep(interval);
    }
  };

  const goto = async (url) => {
    const loaded = new Promise((resolve) => {
      const handler = (raw) => {
        const msg = JSON.parse(raw);
        if (msg.method === "Page.loadEventFired") {
          ws.off("message", handler);
          resolve();
        }
      };
      ws.on("message", handler);
    });
    await send("Page.navigate", { url });
    await Promise.race([loaded, sleep(60000)]);
  };

  const rect = (selector, text) =>
    evalJs(`(() => {
      const els = [...document.querySelectorAll(${JSON.stringify(selector)})];
      const el = ${text ? `els.find(e => e.textContent.replace(/\\s+/g,' ').includes(${JSON.stringify(text)}))` : "els[0]"};
      if (!el) return null;
      el.scrollIntoView({ block: "center", inline: "center" });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    })()`);

  // Pravi klik na sredinu elementa (hit-testing - klikne ono što je zaista na vrhu).
  const tap = async (selector, text) => {
    await sleep(60);
    const r = await rect(selector, text);
    if (!r) throw new Error(`tap: nema elementa ${selector}${text ? ` sa tekstom "${text}"` : ""}`);
    const base = { x: r.x, y: r.y, button: "left", clickCount: 1, pointerType: "mouse" };
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x, y: r.y });
    await send("Input.dispatchMouseEvent", { ...base, type: "mousePressed" });
    await send("Input.dispatchMouseEvent", { ...base, type: "mouseReleased" });
    await sleep(80);
  };

  const shot = async (name, { full = false } = {}) => {
    const params = { format: "png" };
    if (full) {
      const m = await send("Page.getLayoutMetrics");
      const h = Math.min(Math.ceil(m.cssContentSize.height), 6000);
      params.captureBeyondViewport = true;
      params.clip = { x: 0, y: 0, width: Math.ceil(m.cssContentSize.width), height: h, scale: 1 };
    }
    const r = await send("Page.captureScreenshot", params);
    const file = path.join(shotsDir, `${name}.png`);
    writeFileSync(file, Buffer.from(r.data, "base64"));
    return file;
  };

  const setViewport = (w, h, d = dpr, m = mobile) =>
    send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: d, mobile: m });

  const setGeo = (latitude, longitude, accuracy = 12) =>
    send("Emulation.setGeolocationOverride", { latitude, longitude, accuracy });

  // Poslije svakog pokretanja briše se privremeni profil (inače svaka provjera ostavi 15-120 MB u %TEMP% i disk se napuni).
  const close = async () => {
    try {
      ws.close();
      bws.close();
    } catch {}
    await new Promise((resolve) => {
      chrome.once("exit", resolve);
      chrome.kill();
      setTimeout(resolve, 3000);
    });
    await sleep(300);
    try {
      rmSync(userDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
    } catch {}
  };

  return { on, send, browserSend, setGeo, evalJs, waitFor, goto, tap, rect, shot, setViewport, sleep, close, consoleMsgs, exceptions, logEntries, failedRequests };
}
