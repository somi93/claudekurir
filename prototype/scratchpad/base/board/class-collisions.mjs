// Klase koje postoje i u CSS-u table (board.css) i u prototipu (app.css + p*.js): kandidati za curenje stilova.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(here, f), "utf8");

const classesInCss = (css) => {
  const set = new Set();
  // izbaci komentare i sadržaj u { }
  const sel = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{[^{}]*\}/g, "{}").replace(/\{[^{}]*\}/g, "{}");
  for (const m of sel.matchAll(/\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g)) set.add(m[1]);
  return set;
};
const classesInJs = (js) => {
  const set = new Set();
  for (const m of js.matchAll(/class(?:Name)?\s*=\s*\\?["'`]([^"'`]*)["'`]/g)) for (const c of m[1].split(/\s+/)) if (c && !/[$\{]/.test(c)) set.add(c);
  for (const m of js.matchAll(/classList\.(?:add|toggle|remove|contains)\(\s*["']([^"']+)["']/g)) set.add(m[1]);
  // klase unutar šablona sa ${...} (npr. "fc-btn ${x ? 'a' : 'b'}")
  for (const m of js.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) if (c && !/[$\{\}]/.test(c)) set.add(c);
  for (const m of js.matchAll(/['"`]([a-z][a-z0-9-]{1,24})['"`]/g)) set.add("?" + m[1]);
  return set;
};

const boardCss = classesInCss(read("board.css"));
const appCss = classesInCss(read("app.css"));
const protoJs = new Set();
for (const f of ["p0-core.js", "p1-stanje.js", "p2-promet.js", "p3-sheets.js", "p5-boot.js"]) for (const c of classesInJs(read(f))) protoJs.add(c);
const protoClasses = new Set([...appCss, ...[...protoJs].filter((c) => !c.startsWith("?"))]);
const protoWords = new Set([...protoJs].filter((c) => c.startsWith("?")).map((c) => c.slice(1)));

const inBoth = [...boardCss].filter((c) => protoClasses.has(c)).sort();
const maybe = [...boardCss].filter((c) => !protoClasses.has(c) && protoWords.has(c)).sort();
console.log("klase u board.css:", boardCss.size, "| klase u prototipu:", protoClasses.size);
console.log("PRESJEK (sigurni kandidati):", JSON.stringify(inBoth));
console.log("mogući (riječ se pojavljuje u kodu prototipa kao string):", JSON.stringify(maybe));
