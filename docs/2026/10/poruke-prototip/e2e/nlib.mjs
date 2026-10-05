// Pomoćne funkcije za mjerenje stranice /dispatcher/notifications (stanje "prije").
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { dir, sleep } from "./nh.mjs";

// Polja forme dobijaju data-t da bi se mogla naći bez oslanjanja na redoslijed.
export const tagFields = (s) =>
  s.evalJs(`(() => {
    const by = (t) => [...document.querySelectorAll('.composer .v-input')].find((i) => i.querySelector('.v-label')?.textContent.trim() === t);
    const set = (t, key, sel) => { const i = by(t); const el = i && i.querySelector(sel); if (el) el.setAttribute('data-t', key); return !!el; };
    const hs = [...document.querySelectorAll('.v-input')].find((i) => i.querySelector('.mdi-magnify'));
    const hel = hs && hs.querySelector('input'); if (hel) hel.setAttribute('data-t', 'hsearch');
    return { title: set('Naslov', 'title', 'input'), body: set('Poruka', 'body', 'textarea'), rcpt: set('Primaoci', 'rcpt', 'input'), cat: set('Kategorija', 'cat', 'input'), hsearch: !!hel };
  })()`);

export const clearAndType = async (s, sel, text) => {
  await s.clearField(sel);
  await s.typeText(text);
};

// Pažnja: ".history-empty" ("Nema kurira na listi ove firme.") stranica prikazuje i DOK se spisak učitava,
// pa se na njega ne smije čekati - čeka se na prvi red.
export const waitCouriers = (s, timeout = 20000) =>
  s.waitFor(`document.querySelectorAll('.history-courier-row').length > 0`, { timeout });

export const visibleTexts = (s, sel) =>
  s.evalJs(`[...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => e.offsetParent !== null).map((e) => e.textContent.replace(/\\s+/g,' ').trim())`);

export const openRecipients = async (s) => {
  await s.click(".composer .v-autocomplete .v-field");
  await s.waitFor(`document.querySelectorAll('.v-overlay--active .v-list-item').length > 0`, { timeout: 6000 }).catch(() => {});
  await sleep(300);
};

export const menuItems = (s) =>
  s.evalJs(`[...document.querySelectorAll('.v-overlay--active .v-list-item')].map((e) => e.textContent.replace(/\\s+/g,' ').trim())`);

export const saveJson = (name, obj) => {
  const f = path.join(dir, name);
  let cur = {};
  if (existsSync(f)) {
    try { cur = JSON.parse(readFileSync(f, "utf8")); } catch {}
  }
  writeFileSync(f, JSON.stringify({ ...cur, ...obj }, null, 1));
};

// Elementi koji se mogu dodirnuti u glavnom sadržaju, sa dimenzijama (vidljivi).
export const interactive = (s) =>
  s.evalJs(`(() => {
    const root = document.querySelector('.global-page') || document.body;
    const sel = 'a[href],button,input,select,textarea,[role="button"],[tabindex]';
    return [...root.querySelectorAll(sel)].filter((e) => e.offsetParent !== null && !e.disabled && e.getAttribute('tabindex') !== '-1' && e.type !== 'hidden').map((e) => {
      const r = e.getBoundingClientRect();
      return { tag: e.tagName.toLowerCase(), cls: (e.className && e.className.baseVal === undefined ? e.className : '').toString().slice(0, 60), label: (e.getAttribute('aria-label') || e.textContent || e.placeholder || '').replace(/\\s+/g,' ').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) };
    });
  })()`);
