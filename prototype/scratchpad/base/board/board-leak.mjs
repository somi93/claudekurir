// Curenje stilova: isti niz stanja prototipa u samostalnoj stranici (dev.html) i u tabli (board.preview.html), za okvir računara i okvir telefona.
// Za svaku vrstu elementa (oznaka.klase) u svakom stanju upoređuje se 50 izračunatih svojstava; razlika = curenje (ili stilova table u prototip, ili obrnuto).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { openProto, sleep, here, check, summary, results } from "./plib.mjs";

const boardUrl = pathToFileURL(path.join(here, "board.preview.html")).href;

const PROPS = ['font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-transform','text-align','text-decoration-line','text-wrap-mode','text-wrap-style','white-space','word-break','overflow-wrap','color','background-color','background-image','border-top-width','border-top-style','border-top-color','border-bottom-width','border-bottom-style','border-bottom-color','border-left-width','border-right-width','border-radius','padding-top','padding-right','padding-bottom','padding-left','margin-top','margin-right','margin-bottom','margin-left','display','position','box-sizing','box-shadow','opacity','gap','flex-direction','justify-content','align-items','overflow-x','overflow-y','cursor','list-style-type','text-overflow','font-variant-numeric','outline-style','vertical-align'];
const SIG = `(root) => {
  const props = ${JSON.stringify(PROPS)};
  const seen = new Map();
  for (const e of root.querySelectorAll('*')) {
    const cls = String(e.className && e.className.baseVal === undefined ? e.className : '').trim();
    const key = e.tagName.toLowerCase() + '.' + cls;
    if (seen.has(key)) continue;
    const cs = getComputedStyle(e);
    const o = {};
    for (const p of props) o[p] = cs.getPropertyValue(p);
    seen.set(key, o);
  }
  return [...seen.entries()];
}`;

async function drive(P, scope) {
  const states = [];
  const snap = async (name) => { await sleep(380); states.push({ name, sig: await P.ev(`(${SIG})(document.querySelector(${JSON.stringify(scope)}))`) }); };
  const tryClick = async (sel, name, wait = 380, optional = false) => {
    const present = await P.ev(`!!document.querySelector(${JSON.stringify(scope + " " + sel)})`);
    if (!present) { if (!optional) states.push({ name, missing: true }); return false; }
    await P.click(scope + " " + sel, { wait });
    return true;
  };
  const closeSheet = (n) => tryClick('[data-act="sheet-close"]', n);
  await snap("pocetno");
  if (await tryClick('[data-act="confirm"]', "potvrda")) { await snap("potvrda"); await closeSheet("zatvori1"); }
  if (await tryClick('[data-act="batch"]', "isplata-svima")) { await snap("isplata-svima"); await closeSheet("zatvori2"); }
  if (await tryClick('[data-act="open"]', "detalj")) await snap("detalj");
  if (await tryClick('[data-act="receipt"]', "uplata")) { await snap("uplata"); await closeSheet("zatvori3"); }
  if (await tryClick('[data-act="payout"]', "isplata")) { await snap("isplata"); await closeSheet("zatvori4"); }
  // na telefonu je detalj stranica: nazad na spisak (na računaru zatvara detalj)
  await tryClick('[data-act="back"]', "nazad-na-spisak", 450, true);
  if (await tryClick('[data-act="tab"][data-arg="promet"]', "promet")) {
    await snap("promet");
    if (await tryClick('[data-act="jopen"]', "stavka")) { await snap("stavka"); await closeSheet("zatvori5"); }
    await tryClick('[data-act="tab"][data-arg="stanje"]', "nazad");
  }
  const inp = scope + " input.fc-q-input";
  if (await P.ev(`!!document.querySelector(${JSON.stringify(inp)})`)) {
    await P.focusSel(inp);
    await P.typeText("zzqq");
    await snap("pretraga-prazna");
  } else states.push({ name: "pretraga-prazna", missing: true });
  return states;
}

const FRAMES = [
  { id: "wide", dev: "#d .fc", board: "#proto-d .fc", mobile: false, w: 1440, h: 900 },
  { id: "phone", dev: "#p .fc", board: "#proto-p .fc", mobile: false, w: 1440, h: 900 },
];
const all = {};
let totalCompared = 0, totalDiffs = 0;
const diffsAll = [];
const missingAll = [];
const setDiff = [];
for (const F of FRAMES) {
  let dev, board;
  {
    const P = await openProto({ name: "board-leak", width: F.w, height: F.h, dpr: 1 });
    try { await sleep(1200); dev = await drive(P, F.dev); } finally { await P.close(); }
  }
  {
    const P = await openProto({ name: "board-leak", width: F.w, height: F.h, dpr: 1, url: boardUrl });
    try {
      await sleep(3500);
      if (F.id === "phone") await P.click('[data-mode="phone"]', { wait: 500 });
      board = await drive(P, F.board);
    } finally { await P.close(); }
  }
  console.log(F.id, "dev  :", dev.map((s) => s.name + (s.missing ? "(nema)" : "")).join(" → "));
  console.log(F.id, "tabla:", board.map((s) => s.name + (s.missing ? "(nema)" : "")).join(" → "));
  const rows = [];
  for (const d of dev) {
    const b = board.find((x) => x.name === d.name);
    if (d.missing || !b || b.missing) { rows.push({ okvir: F.id, stanje: d.name, dev: d.missing ? "nema" : "ima", tabla: !b || b.missing ? "nema" : "ima" }); missingAll.push(`${F.id}/${d.name}`); continue; }
    const dm = new Map(d.sig), bm = new Map(b.sig);
    let compared = 0, onlyDev = 0, onlyBoard = 0;
    const diffs = [];
    for (const [key, o] of dm) {
      const bo = bm.get(key);
      if (!bo) { onlyDev++; continue; }
      compared++;
      for (const p of Object.keys(o)) if (o[p] !== bo[p]) diffs.push(`${F.id}/${d.name}: ${key} ${p}: dev "${o[p]}" ≠ tabla "${bo[p]}"`);
    }
    for (const key of bm.keys()) if (!dm.has(key)) onlyBoard++;
    if (onlyDev || onlyBoard) setDiff.push(`${F.id}/${d.name}: samo dev ${onlyDev}, samo tabla ${onlyBoard}`);
    totalCompared += compared; totalDiffs += diffs.length; diffsAll.push(...diffs);
    rows.push({ okvir: F.id, stanje: d.name, vrste: dm.size, upoređeno: compared, samoDev: onlyDev, samoTabla: onlyBoard, razlika: diffs.length });
  }
  console.table(rows);
  all[F.id] = rows;
}
check("curenje: sva stanja iz niza postoje na obje stranice (oba okvira)", missingAll.length === 0, missingAll.join(", "));
check("curenje: upoređeno dovoljno vrsta elemenata kroz stanja", totalCompared >= 1000, `${totalCompared} parova`);
check("curenje: isti skup elemenata u oba (nijedna vrsta samo na jednoj strani)", setDiff.length === 0, setDiff.join("; "));
check("curenje: nijedna razlika stila", totalDiffs === 0, diffsAll.slice(0, 10).join(" | "));
const nStates = Object.values(all).reduce((s, rows) => s + rows.filter((r) => r.upoređeno).length, 0);
fs.writeFileSync(path.join(here, "board-leak.json"), JSON.stringify({ all, totalCompared, totalDiffs, props: PROPS.length, states: nStates, checks: results.length, diffs: diffsAll.slice(0, 80) }, null, 1));
const failed = summary();
process.exit(failed ? 1 : 0);
