import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.env.REPO_ROOT || "H:/projects/bosna/dostavljaci-front";
const req = createRequire(path.resolve(REPO, "package.json"));
const esbuild = req("esbuild");
// IIFE za prototip (window.LVW) i ESM za Node provjere (iste funkcije)
await esbuild.build({ entryPoints: [path.join(here, "world-entry.mjs")], bundle: true, format: "iife", globalName: "LVW", outfile: path.join(here, "world.js"), target: "es2020", alias: { "~": path.join(REPO, "app") }, logLevel: "info" });
await esbuild.build({ entryPoints: [path.join(here, "world-entry.mjs")], bundle: true, format: "esm", platform: "node", outfile: path.join(here, "world.node.mjs"), target: "es2022", alias: { "~": path.join(REPO, "app") }, logLevel: "error" });
