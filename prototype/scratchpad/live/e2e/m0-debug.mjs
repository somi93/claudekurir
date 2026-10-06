import { session, sleep } from "./lh.mjs";
const s = await session("before", { width: 1440, height: 900 });
try {
  s.b = s;
  await s.goto("http://localhost:3001/dispatcher");
  for (let i = 0; i < 6; i++) {
    await sleep(2500);
    const info = await s.evalJs(`(() => ({
      url: location.href,
      api: (window.__NUXT__ && window.__NUXT__.config && window.__NUXT__.config.public) ? window.__NUXT__.config.public.gpsApiBase : null,
      token: localStorage.getItem('dispatcher-token'),
      text: document.body.innerText.slice(0, 300).replace(/\\s+/g, ' '),
      has: ['.dispatcher-grid', '.map-card', '.v-navigation-drawer', '.leaflet-container'].map((x) => x + ':' + document.querySelectorAll(x).length).join(' '),
    }))()`);
    console.log(i, JSON.stringify(info));
    console.log("   reqs:", JSON.stringify(s.mode.counts), "inflight", s.mode.inflight);
  }
  console.log("console:", s.consoleMsgs.map((m) => `${m.type}: ${m.text.slice(0, 220)}`).join("\n"));
  console.log("exceptions:", s.exceptions.map((e) => (e.text || "").slice(0, 300)));
  console.log("failed:", JSON.stringify(s.failedRequests.slice(0, 10)));
  await s.shot("dbg");
} finally {
  await s.close();
}
