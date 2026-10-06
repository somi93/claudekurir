// "PRIJE" 4: kvarovi i prazna stanja - šta dispečer vidi kad server ne odgovori, kad nema pozicija, kad nema firme.
import fs from "node:fs";
import path from "node:path";
import { session, sleep, out } from "./lh.mjs";

const M = {};
const dump = (s) => s.evalJs(`(() => {
  const t = (sel) => { const e = document.querySelector(sel); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null; };
  return {
    pills: [...document.querySelectorAll('.status-chip')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim()),
    sidebarHead: t('.sidebar-head'),
    sidebarBody: t('.sidebar-card'),
    mapAlert: t('.overlay-alert'),
    overlay: t('.v-overlay__content'),
    sync: t('.overlay-sync'),
    rows: document.querySelectorAll('.courier-item').length,
    skeleton: document.querySelectorAll('.sidebar-skeleton .v-skeleton-loader').length,
    retry: [...document.querySelectorAll('button')].filter((b) => /ponovo|retry/i.test(b.innerText)).length,
  };
})()`);

// F1: prvo učitavanje pada
{
  const s = await session("before", { width: 1440, height: 900 });
  try {
    s.setFlags({ fails: [{ re: /courier-locations/, status: 500, times: 999 }] });
    await s.load("/dispatcher", { wait: ".dispatcher-grid", timeout: 120000 });
    await s.idle(800, 30000);
    await sleep(2500);
    M.firstLoadFail = await dump(s);
    console.log("F1 prvo učitavanje pada:", JSON.stringify(M.firstLoadFail));
    await s.shot("b4-fail-first");
  } finally { await s.close(); }
}

// F2: radi, pa pada osvježavanje
{
  const s = await session("before", { width: 1440, height: 900 });
  try {
    await s.load("/dispatcher", { wait: ".courier-item", timeout: 120000 });
    await s.idle(800, 30000);
    await sleep(1500);
    M.beforeFail = await dump(s);
    s.setFlags({ fails: [{ re: /courier-locations/, status: 500, times: 999 }] });
    await sleep(16500);
    M.staleFail = await dump(s);
    console.log("F2 prije pada:", JSON.stringify(M.beforeFail.sync), "| poslije pada:", JSON.stringify(M.staleFail));
    await s.shot("b4-fail-stale");
  } finally { await s.close(); }
}

// F3: nijedan kurir nema poziciju (server ih izostavlja) - a firma ima 26 kurira
{
  const s = await session("before", { width: 1440, height: 900 });
  try {
    s.W.locations = () => [];
    await s.load("/dispatcher", { wait: ".dispatcher-grid", timeout: 120000 });
    await s.idle(800, 30000);
    await sleep(2500);
    M.noPositions = await dump(s);
    console.log("F3 niko nema poziciju:", JSON.stringify(M.noPositions));
    await s.shot("b4-empty");
  } finally { await s.close(); }
}

// F4: korisnik nema nijednu firmu
{
  const s = await session("before", { width: 1440, height: 900 });
  try {
    s.mode.noCompanies = true;
    await s.load("/dispatcher", { wait: ".dispatcher-grid", timeout: 120000 });
    await s.idle(800, 30000);
    await sleep(2500);
    M.noCompany = await dump(s);
    M.noCompany.requests = s.mode.counts;
    console.log("F4 bez firme:", JSON.stringify(M.noCompany));
    await s.shot("b4-nofirm");
  } finally { await s.close(); }
}

// F5: spor odgovor 4 s - šta se vidi dok se čeka
{
  const s = await session("before", { width: 1440, height: 900 });
  try {
    s.setFlags({ delays: [{ re: /courier-locations/, ms: 4000 }] });
    await s.load("/dispatcher", { wait: ".dispatcher-grid", timeout: 120000 });
    await sleep(1800);
    M.slowLoad = await dump(s);
    console.log("F5 spor odgovor (nakon 1.8 s):", JSON.stringify(M.slowLoad));
    await s.shot("b4-slow");
  } finally { await s.close(); }
}

// F6: koordinate kao tekst (Laravel decimal)
{
  const s = await session("before", { width: 1440, height: 900 });
  try {
    s.W.flags.strings = true;
    await s.load("/dispatcher", { wait: ".courier-item", timeout: 120000 });
    await s.idle(800, 30000);
    await sleep(2000);
    M.stringCoords = { rows: await s.count(".courier-item"), exceptions: s.exceptions.length, paths: await s.count("path.leaflet-interactive") };
    console.log("F6 koordinate kao tekst:", JSON.stringify(M.stringCoords));
  } finally { await s.close(); }
}

fs.writeFileSync(path.join(out, "b4.json"), JSON.stringify(M, null, 1));
console.log("gotovo");
