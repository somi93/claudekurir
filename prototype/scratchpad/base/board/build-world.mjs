import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(path.resolve(process.env.REPO_ROOT || "H:/projects/bosna/dostavljaci-front", "package.json"));
const esbuild = req("esbuild");
await esbuild.build({ entryPoints: [path.join(here, "world-entry.mjs")], bundle: true, format: "iife", outfile: path.join(here, "world.js"), target: "es2020", logLevel: "info" });
