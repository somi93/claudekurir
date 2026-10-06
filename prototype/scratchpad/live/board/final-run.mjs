// Cijeli ciklus poslije zadnje izmjene prototipa:
// 1) svi paketi nad izvorom (dev.html) 2) metrike + sklapanje 3) paketi nad tablom + smoke + curenje stilova
// 4) metrike sa pravim brojevima + KONAČNO sklapanje 5) smoke i curenje još jednom nad konačnom datotekom.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "..", "out");
const base = { ...process.env, REPO_ROOT: process.env.REPO_ROOT || "H:/projects/bosna/dostavljaci-front", CDP_PORT: process.env.CDP_PORT || "9337" };
const run = (file, env = {}, args = []) => {
  const r = spawnSync(process.execPath, [path.join(here, file), ...args], { env: { ...base, ...env }, encoding: "utf8", timeout: 1200000, maxBuffer: 1 << 26 });
  return { code: r.status, text: (r.stdout || "") + (r.stderr || "") };
};
const log = (...a) => console.log(...a);
const res = {};
const fail = (what, text) => { log("PAO KORAK:", what); log(text.split("\n").slice(-25).join("\n")); fs.writeFileSync(path.join(out, "final-run.json"), JSON.stringify({ ...res, failed: what }, null, 1)); process.exit(1); };

// 1) izvor
let r = run("run-all.mjs");
let m = r.text.match(/UKUPNO (\d+)\/(\d+)/);
res.dev = m ? { pass: +m[1], total: +m[2] } : null;
log("izvor:", JSON.stringify(res.dev));
if (!m || m[1] !== m[2] || r.code !== 0) fail("paketi nad izvorom", r.text);

// 2) metrike (privremene vrijednosti za ploču) + sklapanje
r = run("metrics.mjs", { CHK_BOARD: "1", CHK_BOARD_OWN: "1", LEAK_PROPS: "1", LEAK_STATES: "1" });
if (r.code !== 0) fail("metrics (privremeno)", r.text);
r = run("build.mjs");
if (r.code !== 0) fail("build (privremeno)", r.text);

// 3) tabla: paketi, smoke, curenje
r = run("run-all.mjs", { E2E_PAGE: "board.preview.html", ONLY: "logic,t1,t2,t4" });
m = r.text.match(/UKUPNO (\d+)\/(\d+)/);
res.boardSuites = m ? { pass: +m[1], total: +m[2] } : null;
log("tabla, paketi:", JSON.stringify(res.boardSuites));
if (!m || m[1] !== m[2] || r.code !== 0) fail("paketi nad tablom", r.text);

const smoke = () => { const x = run("board-smoke.mjs"); const k = x.text.match(/Ukupno: (\d+)\/(\d+) prošlo/); return { code: x.code, pass: k ? +k[1] : 0, total: k ? +k[2] : 0, text: x.text }; };
const leak = () => { const x = run("board-leak.mjs"); const k = x.text.match(/upoređeno (\d+) svojstava u (\d+) stanja; razlika (\d+); elemenata samo na jednoj strani (\d+)/); return { code: x.code, props: k ? +k[1] : 0, states: k ? +k[2] : 0, diff: k ? +k[3] : -1, only: k ? +k[4] : -1, text: x.text }; };
let s = smoke();
let l = leak();
res.smoke = { pass: s.pass, total: s.total }; res.leak = { props: l.props, states: l.states, diff: l.diff, only: l.only };
log("smoke:", JSON.stringify(res.smoke), "curenje:", JSON.stringify(res.leak));
if (s.code !== 0 || s.pass !== s.total) fail("smoke", s.text);
if (l.code !== 0 || l.diff !== 0 || l.only !== 0) fail("curenje stilova", l.text);

// 4) konačne metrike + KONAČNO sklapanje
r = run("metrics.mjs", { CHK_BOARD: String(res.boardSuites.total), CHK_BOARD_OWN: String(res.smoke.total), LEAK_PROPS: String(res.leak.props), LEAK_STATES: String(res.leak.states) });
if (r.code !== 0) fail("metrics (konačno)", r.text);
r = run("build.mjs", { FINAL: "1" });
log(r.text.trim().split("\n").slice(-1)[0].slice(0, 200));
if (r.code !== 0) fail("build (konačno)", r.text);

// 5) smoke i curenje nad konačnom datotekom
s = smoke(); l = leak();
res.finalSmoke = { pass: s.pass, total: s.total }; res.finalLeak = { props: l.props, states: l.states, diff: l.diff, only: l.only };
log("konačno, smoke:", JSON.stringify(res.finalSmoke), "curenje:", JSON.stringify(res.finalLeak));
if (s.code !== 0 || s.pass !== s.total) fail("smoke (konačno)", s.text);
if (l.code !== 0 || l.diff !== 0 || l.only !== 0) fail("curenje (konačno)", l.text);
fs.writeFileSync(path.join(out, "final-run.json"), JSON.stringify({ ...res, failed: null }, null, 1));
log("SVE PROLAZI");
