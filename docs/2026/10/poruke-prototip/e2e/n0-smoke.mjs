// Dim: pokreće vlastiti Chrome, otvara /dispatcher/notifications nad izmišljenim svijetom i snima ekran.
import { session, check, summary, BASE, sleep } from "./nh.mjs";

const s = await session("n0", { width: 1440, height: 900, world: { n: 28 } });
try {
  await s.load("/dispatcher/notifications", { wait: ".composer", timeout: 240000 });
  await s.idle(800);
  await sleep(800);
  const cfg = await s.evalJs(`JSON.stringify({ api: window.useNuxtApp?.().$config?.public?.gpsApiBase, title: document.title, nodes: document.querySelectorAll('*').length, h: document.documentElement.scrollHeight })`);
  console.log("config", cfg);
  await s.shot("desktop-top");
  await s.shot("desktop-full", { full: true });
  console.log("counts", JSON.stringify(s.mode.counts, null, 1));
  console.log("console", s.consoleMsgs.filter((m) => m.type === "error" || m.type === "warning").slice(0, 12).map((m) => m.type + ": " + m.text.slice(0, 160)));
  console.log("exceptions", s.exceptions.slice(0, 5));
} finally {
  await s.close();
}
