// Curenje stilova: isti niz stanja prototipa u samostalnoj stranici (dev.html) i u tabli (board.preview.html).
// Za svaku vrstu elementa (oznaka.klase) u svakom stanju upoređuje se 50 izračunatih svojstava; razlika = curenje (stilova table u prototip ili obrnuto).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { openProto, sleep, here, check, summary, results } from "./lib.mjs";

const devUrl = pathToFileURL(path.join(here, "dev.html")).href;
const boardUrl = pathToFileURL(path.join(here, "board.preview.html")).href;

const PROPS = ["font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-transform", "text-align", "text-decoration-line", "white-space", "word-break", "overflow-wrap", "color", "background-color", "background-image", "border-top-width", "border-top-style", "border-top-color", "border-bottom-width", "border-bottom-style", "border-bottom-color", "border-left-width", "border-right-width", "border-radius", "padding-top", "padding-right", "padding-bottom", "padding-left", "margin-top", "margin-right", "margin-bottom", "margin-left", "display", "position", "box-sizing", "box-shadow", "opacity", "gap", "flex-direction", "justify-content", "align-items", "overflow-x", "overflow-y", "cursor", "list-style-type", "text-overflow", "font-variant-numeric", "outline-style", "vertical-align", "z-index"];
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

const STATES = [
  { name: "pocetno", opts: {} },
  { name: "izabran-kurir", opts: { sel: 30189 } },
  { name: "bez-signala", opts: { sel: 30234 } },
  { name: "narudzbe", opts: { tab: "n" } },
  { name: "izabrana-narudzba", opts: { ord: 4262 } },
  { name: "poruka", opts: { sel: 30234 }, sheet: true },
  { name: "pad-pozicija", opts: { fail: "locs" } },
  { name: "bez-kurira", opts: { empty: "fleet" } },
  { name: "telefon", opts: { wide: false, snap: "half", sel: 30189 }, frame: "p" },
];

async function drive(P) {
  const out = [];
  // animirana svojstva (puls markera) bi se uzorkovala u različitom trenutku: poredi se statički stil
  await P.ev(`(() => { const s = document.createElement('style'); s.textContent = '.lv *, .lv *::before, .lv *::after { animation: none !important; transition: none !important; }'; document.head.appendChild(s); return true; })()`);
  for (const s of STATES) {
    const id = s.frame || "d";
    await P.ev(`fresh('${id}', ${JSON.stringify({ pollMs: 60000, ordersMs: 60000, slowMs: 60000, ...s.opts })})`);
    await P.waitFor(`A('${id}').ctx.ready`, { timeout: 20000 });
    await sleep(900);
    if (s.sheet) { await P.ev(`A('${id}').ctx.acts.msg('where')`); await sleep(400); }
    out.push({ name: s.name, sig: await P.ev(`(${SIG})(document.querySelector('#${id} .lv'))`) });
  }
  return out;
}

let dev, board;
{
  const P = await openProto({ name: "board-leak", width: 1480, height: 1000, dpr: 1, url: devUrl });
  try {
    await sleep(1200);
    // isti unutrašnji razmjeri kao okviri na tabli (1 px okvir: 1438×898 i 388×778), da rasporedne vrijednosti (auto margine) budu uporedive
    await P.ev(`(() => { const d = document.getElementById('d'), p = document.getElementById('p'); d.style.width = '1438px'; d.style.height = '898px'; p.style.width = '388px'; p.style.height = '778px'; return true; })()`);
    await P.ev(`document.querySelector('#p').scrollIntoView(); 1`);
    dev = await drive(P);
  } finally { await P.close(); }
}
{
  const P = await openProto({ name: "board-leak", width: 1480, height: 1000, dpr: 1, url: boardUrl });
  try {
    await sleep(3500);
    // okvir telefona na tabli je skriven dok se ne izabere: prikaži ga, ali ostavi i okvir računara vidljiv (skriven okvir nema raspored pa se ne računa)
    await P.ev(`document.getElementById('p').hidden = false; 1`);
    await sleep(300);
    board = await drive(P);
  } finally { await P.close(); }
}

let compared = 0, diffs = 0;
const diffList = [];
const onlyOne = [];
for (let i = 0; i < STATES.length; i++) {
  const a = new Map(dev[i].sig), b = new Map(board[i].sig);
  for (const [key, pa] of a) {
    const pb = b.get(key);
    if (!pb) { onlyOne.push(`${STATES[i].name}: samo u dev ${key}`); continue; }
    for (const p of PROPS) {
      compared++;
      if (pa[p] !== pb[p]) { diffs++; if (diffList.length < 40) diffList.push(`${STATES[i].name} ${key} ${p}: dev="${pa[p]}" tabla="${pb[p]}"`); }
    }
  }
  for (const key of b.keys()) if (!a.has(key)) onlyOne.push(`${STATES[i].name}: samo u tabli ${key}`);
}
console.log(`upoređeno ${compared} svojstava u ${STATES.length} stanja; razlika ${diffs}; elemenata samo na jednoj strani ${onlyOne.length}`);
for (const d of diffList) console.log("  " + d);
for (const o of onlyOne.slice(0, 12)) console.log("  " + o);
check(`curenje stilova: ${compared} svojstava u ${STATES.length} stanja, razlika 0`, diffs === 0, diffList.slice(0, 3).join(" | "));
check("curenje stilova: isti skup elemenata u prototipu i na tabli", onlyOne.length === 0, onlyOne.slice(0, 3).join(" | "));
fs.writeFileSync(path.join(here, "..", "out", "board-leak.json"), JSON.stringify({ compared, diffs, states: STATES.length, diffList, onlyOne }, null, 1));
const failed = summary();
process.exit(failed ? 1 : 0);
