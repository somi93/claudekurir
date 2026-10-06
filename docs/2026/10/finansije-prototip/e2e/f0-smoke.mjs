// Prvi dim-test: učita se stvarna stranica Finansije nad lažnim finansijskim svijetom?
import { session, sleep, BASE } from "./fh.mjs";

const s = await session("smoke", { width: 1440, height: 900 });
try {
  await s.load("/dispatcher/finance", { wait: ".global-tab-bar", extra: 1500 });
  console.log("gpsApiBase:", await s.evalJs(`window.__NUXT__?.config?.public?.gpsApiBase`));
  console.log("title/H:", await s.evalJs(`document.title + " | " + document.body.scrollHeight`));
  console.log("tabs:", await s.evalJs(`[...document.querySelectorAll('[role=tab]')].map(t => t.textContent.replace(/\\s+/g,' ').trim())`));
  console.log("log:");
  for (const e of s.mode.log) console.log("  ", e.method, e.path + e.q);
  console.log("exceptions:", JSON.stringify(s.exceptions ?? []));
  await s.shot("01-smoke");
  console.log("shot ok");
} finally {
  await s.close();
}
