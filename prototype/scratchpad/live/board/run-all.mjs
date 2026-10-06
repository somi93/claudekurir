// Pokreće sve provjere prototipa jednu za drugom i upisuje brojeve u ../out/checks.json.
// E2E_PAGE=dev.html (izvori) ili board.preview.html (sklopljena tabla; fazu telefona preskače jer traži phone.html).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const logs = path.resolve(here, "..", "suites");
fs.mkdirSync(logs, { recursive: true });
const page = process.env.E2E_PAGE || "dev.html";
const only = (process.env.ONLY || "logic,t1,t2,t3,t4").split(",");
const run = (name, file) => {
  const r = spawnSync(process.execPath, [path.join(here, file)], { env: { ...process.env, REPO_ROOT: process.env.REPO_ROOT || "H:/projects/bosna/dostavljaci-front", CDP_PORT: process.env.CDP_PORT || "9337", E2E_PAGE: page }, encoding: "utf8", timeout: 600000 });
  const text = (r.stdout || "") + (r.stderr || "");
  fs.writeFileSync(path.join(logs, `${name}-${page.replace(/\W+/g, "_")}.log`), text);
  const m = text.match(/(\d+)\/(\d+) prošlo/);
  return { name, pass: m ? Number(m[1]) : 0, total: m ? Number(m[2]) : 0, code: r.status, failed: (text.match(/^\s+✘ .*/gm) || []).slice(0, 12) };
};
const out = {};
const jobs = [["logic", "logic-test.mjs"], ["t1", "t1-flows.mjs"], ["t2", "t2-states.mjs"], ["t3", "t3-device.mjs"], ["t4", "t4-scale.mjs"]];
for (const [name, file] of jobs) {
  if (!only.includes(name)) continue;
  if (page !== "dev.html" && name === "t3") continue;
  const r = run(name, file);
  out[name] = r;
  console.log(`${name}: ${r.pass}/${r.total} ${r.code === 0 ? "OK" : "GREŠKE"}`);
  for (const f of r.failed) console.log("   " + f);
}
const total = Object.values(out).reduce((a, r) => ({ pass: a.pass + r.pass, total: a.total + r.total }), { pass: 0, total: 0 });
console.log(`UKUPNO ${total.pass}/${total.total}`);
fs.mkdirSync(path.resolve(here, "..", "out"), { recursive: true });
fs.writeFileSync(path.resolve(here, "..", "out", `checks-${page.replace(/\W+/g, "_")}.json`), JSON.stringify({ ...out, total }, null, 1));
process.exit(total.pass === total.total ? 0 : 1);
