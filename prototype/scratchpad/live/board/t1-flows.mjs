// Prototip "Kuriri uživo", računar: pravi događaji (miš, tipke, točkić) u pravom Chrome-u nad dev.html (ili board.preview.html).
// Provjerava: početni pogled, izbor (spisak i karta), klaster, povlačenje i zum, filteri i pretraga, pažnja i narudžbe, list za poruku, osvježavanje, slojevi, tastaturu.
import { openProto, check, summary, sleep } from "./lib.mjs";

const P = await openProto({ name: "t1", width: 1480, height: 1000, dpr: 1 });
const { ev, click, key, typeText, focusSel, waitFor, active } = P;
const boot = async (opts = {}, settle = 500) => {
  await ev(`fresh('d', ${JSON.stringify({ pollMs: 6000, ordersMs: 10000, slowMs: 20000, ...opts })})`);
  await waitFor("A('d').ctx.ready", { timeout: 15000 });
  await sleep(settle);
};
const st = (expr) => ev(`(() => { const a = A('d'); return (${expr}); })()`);
const view = () => ev(`(() => { const m = A('d').ctx.parts.map; return { cx: m.view.cx, cy: m.view.cy, z: m.view.z, w: m.size.w, h: m.size.h, n: m.count }; })()`);
const cnt = (sel) => ev(`document.querySelectorAll('#d ${sel}').length`);
const txt = (sel) => ev(`(() => { const e = document.querySelector('#d ${sel}'); return e ? e.textContent.replace(/\\s+/g,' ').trim() : null; })()`);
const tiles = () => ev(`[...document.querySelectorAll('#d .lv-tile')].map((e) => e.querySelector('b').textContent.trim())`);
const logOf = (re) => ev(`A('d').log.filter((e) => /${re}/.test(e.method + ' ' + e.path)).length`);
const toast = () => ev(`(() => { const t = document.querySelector('#d .lv-toast'); return t && !t.hidden ? t.textContent.replace(/\\s+/g,' ').trim() : null; })()`);
const toScreen = (m) => ev(`(() => { const a = A('d'); const mp = a.ctx.parts.map; return a.ctx.LV.toScreen(${JSON.stringify(m)}, mp.view, mp.size); })()`);
const courierScreen = (id) => ev(`(() => { const a = A('d'); const c = a.ctx.V.byId.get(${id}); const mp = a.ctx.parts.map; const L = a.ctx.LV; return L.toScreen(L.toMeters(c.loc.latitude, c.loc.longitude), mp.view, mp.size); })()`);

/* ============ 1. otvaranje ============ */
await boot({}, 700);
{
  check("naslov stranice", (await txt("h1")).startsWith("Kuriri uživo"));
  check("podnaslov: 26 kurira · 14 uživo", /26 kurira · 14 uživo · osvježeno/.test(await txt("h1 small")), await txt("h1 small"));
  check("pločice: Svi 26 / U dostavi 6 / Slobodni 8 / Offline 12", JSON.stringify(await tiles()) === JSON.stringify(["26", "6", "8", "12"]), JSON.stringify(await tiles()));
  const chips = await ev(`[...document.querySelectorAll('#d .lv-chip')].map((e) => e.textContent.replace(/\\s+/g,' ').trim())`);
  check("oznake pažnje: sedam sa brojevima", chips.length === 7 && /Bez signala 3/.test(chips[0]) && /Blizu limita 4/.test(chips[1]) && /Suspendovani 2/.test(chips[2]) && /Kasne 3/.test(chips[3]) && /Čeka kurira 5/.test(chips[4]) && /Čeka restoran 3/.test(chips[5]) && /Predaje čekaju 4/.test(chips[6]), JSON.stringify(chips));
  const v = await view();
  const lat = await st(`a.ctx.LV.fromMeters(a.ctx.parts.map.view.cx, a.ctx.parts.map.view.cy).lat`);
  const lng = await st(`a.ctx.LV.fromMeters(a.ctx.parts.map.view.cx, a.ctx.parts.map.view.cy).lng`);
  check("mapa se otvara u Banjoj Luci (ne u Beogradu)", Math.abs(lat - 44.77) < 0.05 && Math.abs(lng - 17.2) < 0.08, `${lat.toFixed(3)}, ${lng.toFixed(3)}`);
  check("zum je pogodan za grad (12-15)", v.z >= 12 && v.z <= 15, String(v.z));
  const recent = await st(`a.ctx.V.cs.filter((c) => c.loc && (c.live !== 'offline' || c.sigMs <= a.ctx.LV.RECENT_MS)).map((c) => c.id)`);
  let inside = 0;
  for (const id of recent) { const s = await courierScreen(id); if (s.x >= 0 && s.x <= v.w && s.y >= 0 && s.y <= v.h) inside++; }
  check("svi kuriri na terenu su u vidnom polju odmah", inside === recent.length && recent.length >= 12, `${inside}/${recent.length}`);
  check("spisak: 12 redova i 'Prikaži još (14)'", (await cnt(".lv-row")) === 12 && /Prikaži još \(14\)/.test(await txt(".lv-more")), `${await cnt(".lv-row")} ${await txt(".lv-more")}`);
  const requests = await ev(`(() => { const o = {}; for (const e of A('d').log) { const k = e.method + ' ' + e.path.replace(/\\?.*$/, '').replace(/\\/\\d+/g, '/:id'); o[k] = (o[k] || 0) + 1; } return o; })()`);
  check("pri otvaranju svaki izvor tačno jednom (9 poziva)", Object.values(requests).every((n) => n === 1) && Object.keys(requests).length === 9, JSON.stringify(requests));
  const bad = P.b.consoleMsgs.filter((m) => /error/.test(m.type)).length + P.b.exceptions.length;
  check("konzola čista", bad === 0, String(bad));
}

/* ============ 2. izbor iz spiska ============ */
{
  await click("#d .lv-row", { nth: 1, wait: 900 });
  const sel = await st(`a.st.selId`);
  check("klik na red bira kurira", sel != null);
  check("detalj kurira se pojavljuje iznad spiska", (await cnt(".lv-det")) === 1 && (await ev(`document.querySelector('#d .lv-det').getBoundingClientRect().top < document.querySelector('#d .lv-row').getBoundingClientRect().top`)));
  check("red je označen (aria-selected)", (await ev(`document.querySelector('#d .lv-row[aria-selected=true]') !== null`)));
  const s = await courierScreen(sel);
  const v = await view();
  check("karta je poletjela do kurira (centar unutar 6 px, zum >= 14.5)", Math.hypot(s.x - v.w / 2, s.y - v.h / 2) < 6 && v.z >= 14.5, `${s.x.toFixed(0)},${s.y.toFixed(0)} z=${v.z}`);
  check("marker izabranog kurira je istaknut", (await cnt(".lv-mk.is-sel")) === 1);
  const d = await txt(".lv-det");
  check("detalj: ime, ID, 'Trenutna dostava' sa brojem narudžbe", /Trenutna dostava/.test(d) && /#\d{4}/.test(d), d.slice(0, 120));
  check("detalj: četiri brze radnje (Pozovi, Poruka, Detalji, Novac)", /Pozovi/.test(d) && /Poruka/.test(d) && /Detalji/.test(d) && /Novac/.test(d));
  check("Pozovi je tel: veza sa brojem", await ev(`/^tel:\\+?\\d+$/.test(document.querySelector('#d .lv-qb[href^=tel]').getAttribute('href'))`));
  check("detalj: brzina u km/h (ili Stoji / nepoznata)", /(\d+ km\/h|Stoji|Brzina nepoznata)/.test(d), d);
  await click("#d .lv-qb[data-act=goto]", { nth: 0 });
  check("'Detalji' vodi na stranicu Kuriri (obavještenje u prototipu)", /Kuriri/.test(await toast()), await toast());
  await key("Escape");
  await sleep(150);
  check("Esc zatvara detalj", (await cnt(".lv-det")) === 0 && (await st(`a.st.selId`)) == null);
  const a = await active();
  check("fokus se vraća na red", a && a.fk && a.fk.startsWith("row:"), JSON.stringify(a));
}

/* ============ 3. izbor sa karte i klaster ============ */
{
  await boot({}, 700);
  const v0 = await view();
  const zoomed = await st(`a.ctx.parts.map.view.z`);
  // Amir Hodžić (30189) je u centru; klik pravim mišem na njegov marker
  await ev(`A('d').ctx.parts.map.setView({ cx: A('d').ctx.parts.map.view.cx, cy: A('d').ctx.parts.map.view.cy, z: 15 }); true`);
  await ev(`(() => { const a = A('d'); const c = a.ctx.V.byId.get(30189); const m = a.ctx.LV.toMeters(c.loc.latitude, c.loc.longitude); a.ctx.parts.map.setView({ cx: m.x, cy: m.y, z: 15 }); })()`);
  await sleep(300);
  await click("#d .lv-mk[data-arg='30189']", { wait: 500 });
  check("klik na marker bira kurira", (await st(`a.st.selId`)) === 30189);
  check("karta ne skače pri izboru sa karte (centar isti)", await ev(`(() => { const a = A('d'); const c = a.ctx.V.byId.get(30189); const mp = a.ctx.parts.map; const s = a.ctx.LV.toScreen(a.ctx.LV.toMeters(c.loc.latitude, c.loc.longitude), mp.view, mp.size); return Math.hypot(s.x - mp.size.w / 2, s.y - mp.size.h / 2) < 3; })()`));
  check("pri izboru sa karte tab ostaje Kuriri i detalj je gore", (await st(`a.st.tab`)) === "k" && (await cnt(".lv-det")) === 1);
  const dt = await txt(".lv-det");
  check("Amir: u dostavi, narudžba #4269, duguje 180.70 KM", /Amir Hodžić/.test(dt) && /#4269/.test(dt) && /180\.70/.test(dt), dt.slice(0, 200));
  check("linija ka odredištu je nacrtana", (await ev(`document.querySelectorAll('#d .lv-lines .lv-route').length`)) === 1);
  check("odredište narudžbe je označeno na karti", (await cnt(".lv-op")) >= 1);
  // klaster: odzumiraj pa klikni klaster
  await ev(`A('d').ctx.parts.map.fit(); true`);
  await sleep(700);
  const nCl = await cnt(".lv-cl");
  check("pri odzumiranju postoje klasteri", nCl >= 1, String(nCl));
  const zBefore = (await view()).z;
  await click("#d .lv-cl", { wait: 900 });
  check("klik na klaster približava mapu", (await view()).z > zBefore, `${zBefore} -> ${(await view()).z}`);
  // problemi se ne kriju u klasterima
  await ev(`A('d').ctx.parts.map.fit(); true`);
  await sleep(700);
  const lostShown = await ev(`[...document.querySelectorAll('#d .lv-mk.is-lost')].length`);
  check("kuriri bez signala su uvijek pojedinačni markeri (3)", lostShown === 3, String(lostShown));
}

/* ============ 4. povlačenje i zum ============ */
{
  await boot({}, 600);
  const before = await view();
  const box = await ev(`(() => { const r = document.querySelector('#d .lv-map').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  const sx = box.x + box.w * 0.3, sy = box.y + box.h * 0.8;
  await P.b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: sx, y: sy });
  await P.b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: sx, y: sy, button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 8; i++) await P.b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: sx + i * 20, y: sy - i * 10, buttons: 1 });
  await P.b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: sx + 160, y: sy - 80, button: "left", buttons: 0, clickCount: 1 });
  await sleep(200);
  const after = await view();
  const k = await ev(`A('d').ctx.LV.ppm(${before.z})`);
  check("povlačenje mišem pomjera kartu za pređeni put", Math.abs((before.cx - after.cx) - 160 / k) < 3 / k && Math.abs((after.cy - before.cy) + 80 / k) < 3 / k, `${((before.cx - after.cx) * k).toFixed(0)}px, ${((after.cy - before.cy) * k).toFixed(0)}px`);
  check("povlačenje ne bira kurira", (await st(`a.st.selId`)) == null);
  check("poslije povlačenja automatsko pozicioniranje se gasi", await st(`a.st.userMoved === true`));
  // točkić: zum oko pokazivača (tačka ispod pokazivača ostaje)
  const px = Math.round(box.x + box.w * 0.6), py = Math.round(box.y + box.h * 0.4);
  const worldBefore = await ev(`(() => { const a = A('d'); const mp = a.ctx.parts.map; return a.ctx.LV.fromScreen({ x: ${px - box.x}, y: ${py - box.y} }, mp.view, mp.size); })()`);
  await P.b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: px, y: py, deltaX: 0, deltaY: -120 });
  await sleep(150);
  const z2 = (await view()).z;
  const worldAfter = await ev(`(() => { const a = A('d'); const mp = a.ctx.parts.map; return a.ctx.LV.fromScreen({ x: ${px - box.x}, y: ${py - box.y} }, mp.view, mp.size); })()`);
  check("točkić približava za pola nivoa", Math.abs(z2 - (after.z + 0.5)) < 1e-9, `${after.z} -> ${z2}`);
  check("zum je oko pokazivača (tačka ispod ostaje)", Math.hypot(worldBefore.x - worldAfter.x, worldBefore.y - worldAfter.y) < 1, `${Math.hypot(worldBefore.x - worldAfter.x, worldBefore.y - worldAfter.y).toFixed(2)} m`);
  await click("#d [data-act=zoom-out]");
  check("dugme udaljavanja", Math.abs((await view()).z - (z2 - 0.5)) < 1e-9);
  // granice zuma
  for (let i = 0; i < 20; i++) await click("#d [data-act=zoom-in]", { wait: 10 });
  check("zum ne prelazi 17", (await view()).z === 17, String((await view()).z));
  for (let i = 0; i < 30; i++) await click("#d [data-act=zoom-out]", { wait: 10 });
  check("zum ne pada ispod 10", (await view()).z === 10, String((await view()).z));
  await click("#d [data-act=fit]", { wait: 900 });
  const v = await view();
  const recent = await st(`a.ctx.V.cs.filter((c) => c.loc && (c.live !== 'offline' || c.sigMs <= a.ctx.LV.RECENT_MS)).map((c) => c.id)`);
  let inside = 0;
  for (const id of recent) { const s = await courierScreen(id); if (s.x >= 0 && s.x <= v.w && s.y >= 0 && s.y <= v.h) inside++; }
  check("'Prikaži sve' vraća sve kurire u vidno polje", inside === recent.length, `${inside}/${recent.length}`);
  // tastatura na karti
  await focusSel("#d .lv-map");
  const c0 = await view();
  await key("ArrowRight");
  const c1 = await view();
  check("strelica na fokusiranoj karti pomjera kartu udesno", c1.cx > c0.cx);
  await key("+");
  check("taster + približava", (await view()).z > c1.z);
  await key("0");
  await sleep(700);
  check("taster 0 prikazuje sve", Math.abs((await view()).z - v.z) < 0.01);
}

/* ============ 5. filteri i pretraga ============ */
{
  await boot({}, 500);
  await click("#d .lv-tile", { nth: 1 });
  check("pločica 'U dostavi': 6 kurira u spisku", /6 kurira/.test(await txt(".lv-sub")) && (await cnt(".lv-row")) === 6, await txt(".lv-sub"));
  check("pločica je pritisnuta (aria-pressed)", await ev(`document.querySelectorAll('#d .lv-tile')[1].getAttribute('aria-pressed') === 'true'`));
  check("na karti ostaju samo kuriri u dostavi", (await ev(`document.querySelectorAll('#d .lv-mk').length + document.querySelectorAll('#d .lv-cl').length`)) >= 1 && (await ev(`[...document.querySelectorAll('#d .lv-mk')].every((e) => e.classList.contains('lv-mk--delivering'))`)));
  check("brojevi na pločicama ostaju stabilni dok se filtrira", JSON.stringify(await tiles()) === JSON.stringify(["26", "6", "8", "12"]));
  await click("#d .lv-chip[data-arg=lost]");
  check("'U dostavi' + 'Bez signala' = Željko Đurić", /Željko Đurić/.test(await txt(".lv-row")) && (await cnt(".lv-row")) === 1);
  check("'Očisti filtere' je ponuđeno", (await cnt(".lv-clear")) === 1);
  await click("#d .lv-clear");
  check("'Očisti filtere' vraća sve", (await cnt(".lv-row")) === 12 && (await cnt(".lv-clear")) === 0);
  await key("/");
  check("taster / fokusira pretragu", (await active()).fk === "q");
  await typeText("zeljko djuric", 5);
  await sleep(150);
  check("pretraga 'zeljko djuric' nalazi Željka Đurića (pravi kod sa stranice Kuriri)", (await cnt(".lv-row")) === 1 && /Željko Đurić/.test(await txt(".lv-row")), await txt(".lv-sub"));
  check("pretraga je i na karti (jedan marker)", (await cnt(".lv-mk")) === 1, String(await cnt(".lv-mk")));
  await ev(`(() => { const i = document.querySelector('#d #lv-q'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await typeText("065123456", 4);
  check("pretraga telefona bez razdjelnika (u bazi 065/123-456)", (await cnt(".lv-row")) === 1 && /Željko/.test(await txt(".lv-row")));
  await ev(`(() => { const i = document.querySelector('#d #lv-q'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await typeText("Жељко", 4);
  check("pretraga ćirilicom nalazi oba Željka", (await cnt(".lv-row")) === 2);
  await ev(`(() => { const i = document.querySelector('#d #lv-q'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await typeText("zzzz", 4);
  check("bez rezultata: poruka u spisku i na karti", /Nema kurira za ovaj filter/.test(await txt(".lv-pbody")) && /Nijedan kurir ne odgovara filteru/.test(await txt(".lv-mnote")), await txt(".lv-mnote"));
  await click("#d .lv-empty .lv-btn");
  check("'Očisti filtere' iz praznog stanja", (await cnt(".lv-row")) === 12);
  // sortiranje
  await ev(`(() => { const s = document.querySelector('#d select[data-act-change=sort]'); s.value = 'lost'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await sleep(100);
  const firstNames = await ev(`[...document.querySelectorAll('#d .lv-row .nm b')].slice(0, 3).map((e) => e.textContent)`);
  check("redoslijed 'Najduže bez signala': tri kurira bez signala prva", JSON.stringify(firstNames.slice().sort()) === JSON.stringify(["Milan Đurić", "Željko Marković", "Željko Đurić"].sort()), JSON.stringify(firstNames));
  await ev(`(() => { const s = document.querySelector('#d select[data-act-change=sort]'); s.value = 'live'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  // "Prikaži još"
  await click("#d [data-act=more]");
  check("'Prikaži još' dodaje 12 redova", (await cnt(".lv-row")) === 24);
}

/* ============ 6. pažnja i narudžbe ============ */
{
  await boot({}, 500);
  await click("#d .lv-chip[data-arg='o:late']");
  check("oznaka 'Kasne' otvara Narudžbe sa filterom 'kasne'", (await st(`a.st.tab`)) === "n" && (await st(`a.st.ogroup`)) === "late");
  const ids = await ev(`[...document.querySelectorAll('#d .lv-orow')].map((e) => e.getAttribute('data-arg')).sort()`);
  check("kasne narudžbe: #4262, #4265, #4277", JSON.stringify(ids) === JSON.stringify(["4262", "4265", "4277"]), JSON.stringify(ids));
  check("oznaka je pritisnuta", await ev(`document.querySelector('#d .lv-chip[data-arg="o:late"]').getAttribute('aria-pressed') === 'true'`));
  await click("#d .lv-chip[data-arg='o:late']");
  check("drugi klik skida filter", (await st(`a.st.ogroup`)) === "all");
  const att = await ev(`[...document.querySelectorAll('#d .lv-att .it')].map((e) => e.querySelector('b').textContent.trim())`);
  check("'Traži pažnju': prve četiri stavke, prva je Željko Đurić", att.length === 4 && /Željko Đurić: bez signala 14 min/.test(att[0]), JSON.stringify(att));
  check("druga je #4277 koja kasni (nema kurira)", /#4277/.test(att[1]));
  check("'Prikaži sve (7)'", /Prikaži sve \(7\)/.test(await txt("[data-act=att-all]")));
  await click("#d [data-act=att-all]");
  check("prikazuje svih sedam", (await cnt(".lv-att .it")) === 7);
  check("stavka sa kurirom ima 'Pozovi' sa tel:", await ev(`/^tel:/.test(document.querySelector('#d .lv-att .call').getAttribute('href'))`));
  check("restoran koji ne reaguje nosi broj restorana", await ev(`[...document.querySelectorAll('#d .lv-att .it')].some((e) => /Ćevabdžinica Mujo/.test(e.textContent) && /tel:051216877/.test(e.querySelector('.call').getAttribute('href')))`));
  await click("#d .lv-att [data-act=att]", { nth: 0, wait: 900 });
  check("klik na stavku o kuriru: tab Kuriri, izabran Željko, karta na njemu", (await st(`a.st.tab`)) === "k" && /Željko Đurić/.test(await txt(".lv-det")));
  check("detalj duha: crveno upozorenje sa radnjom 'Pošalji Gdje si?'", /Signal je izgubljen 14 min/.test(await txt(".lv-det")) && /Pošalji „Gdje si\?“/.test(await txt(".lv-det")));
  check("detalj duha: dostava #4262 kasni 11 min", /#4262/.test(await txt(".lv-det")) && /Kasni 11 min/.test(await txt(".lv-det")));
  // narudžba
  await click("#d .lv-tab", { nth: 1 });
  await click("#d .lv-orow[data-arg='4278']", { wait: 900 });
  check("klik na narudžbu otvara detalj", /Trattoria Lido/.test(await txt(".lv-det")) && /Čeka kurira 18 min/.test(await txt(".lv-det")), (await txt(".lv-det")).slice(0, 160));
  check("detalj narudžbe: adresa, zona, udaljenost", /Gundulićeva 7/.test(await txt(".lv-det")) && /Lauš/.test(await txt(".lv-det")) && /3,1 km/.test(await txt(".lv-det")));
  check("pin izabrane narudžbe je istaknut", (await cnt(".lv-op.is-sel")) === 1);
  check("'Dodijeli' vodi u Dodelu narudžbi", /Dodijeli/.test(await txt(".lv-det .lv-qa")));
  check("kurir bez narudžbe: poziv kuriru je onemogućen (aria-disabled)", await ev(`[...document.querySelectorAll('#d .lv-det .lv-qb')].filter((e) => e.getAttribute('aria-disabled') === 'true').length === 2`));
  await click("#d .lv-orow[data-arg='4262']", { wait: 900 });
  check("narudžba u dostavi: kurir je naveden i veza ka njemu postoji", /Željko Đurić/.test(await txt(".lv-det")) && (await cnt(".lv-det [data-act=pick-c]")) === 1);
  check("linija kurir -> odredište nacrtana", (await ev(`document.querySelectorAll('#d .lv-lines .lv-route').length`)) === 1);
  await click("#d .lv-ofil [data-arg=rest]");
  check("filter 'Čeka restoran': 4 narudžbe", (await cnt(".lv-orow")) === 4, String(await cnt(".lv-orow")));
  await click("#d .lv-orow[data-arg='4284']", { wait: 400 });
  check("restoran: poziv ima broj", await ev(`/tel:051216877/.test(document.querySelector('#d .lv-det .lv-qb[href^=tel]').getAttribute('href'))`));
  check("narudžba bez koordinata (#4150) nije na karti i to piše", await (async () => { await click("#d .lv-orow[data-arg='4150']", { wait: 300 }); return /nema koordinate/.test(await txt(".lv-det")) && (await cnt(".lv-op.is-sel")) === 0; })());
}

/* ============ 7. poruka kuriru ============ */
{
  await boot({ sel: 30234 }, 900);
  check("Željko (bez signala) je izabran", /Željko Đurić/.test(await txt(".lv-det")));
  await click("#d .lv-det .lv-tint [data-act=msg]", { wait: 300 });
  check("list se otvara sa tekstom 'Gdje si?'", (await ev(`document.querySelector('#d #lv-mt').value`)) === "Gdje si?" && /Izgubili smo tvoj signal/.test(await ev(`document.querySelector('#d #lv-mb').value`)));
  check("naslov lista nosi ime kurira", /Poruka kuriru Željko Đurić/.test(await txt(".lv-sheet h2")));
  check("fokus je u listu", await ev(`document.querySelector('#d .lv-sheet').contains(document.activeElement)`));
  await key("Escape");
  check("Esc sa unesenim tekstom pita 'Imaš nesačuvan unos'", /Imaš nesačuvan unos/.test(await txt(".lv-sheet")));
  await click("#d [data-discard=keep]");
  check("'Nastavi unos' vraća u polje", await ev(`document.querySelector('#d .lv-sheet').contains(document.activeElement)`));
  P.b.mode = null;
  await ev(`A('d').failNext(/POST .*inbox/, 1)`);
  await click("#d [data-act=msg-send]", { wait: 400 });
  check("pad servera: list ostaje, tekst ostaje, piše greška", (await cnt(".lv-sheet")) === 1 && (await ev(`document.querySelector('#d #lv-mt').value`)) === "Gdje si?" && /Ne mogu da pošaljem poruku/.test(await txt(".lv-sh-foot")), await txt(".lv-sh-foot"));
  await click("#d [data-act=msg-send]", { wait: 500 });
  check("slanje: list se zatvara i stiže obavještenje", (await cnt(".lv-sheet")) === 0 && /Poruka je poslata/.test(await toast()), await toast());
  const posts = await ev(`A('d').log.filter((e) => e.method === 'POST').map((e) => ({ path: e.path, body: e.body }))`);
  check("poslat je tačan zahtjev: /couriers/30234/inbox sa vrstom, naslovom i tekstom", posts.length >= 1 && posts[posts.length - 1].path === "/couriers/30234/inbox" && posts[posts.length - 1].body.category === "announcement" && posts[posts.length - 1].body.title === "Gdje si?", JSON.stringify(posts));
  check("fokus se vraća na stranicu", !(await ev(`document.querySelector('#d .lv-sheet')`)) && (await active()) !== null);
  // prazna polja: dugme isključeno
  await click("#d .lv-qa [data-act=msg]", { wait: 300 });
  await ev(`(() => { const t = document.querySelector('#d #lv-mt'), b = document.querySelector('#d #lv-mb'); t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); b.value = ''; b.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  check("bez naslova i teksta 'Pošalji' je isključeno i piše zašto", (await ev(`document.querySelector('#d [data-act=msg-send]').disabled`)) && /Upiši naslov i poruku/.test(await txt(".lv-sh-foot")));
  await click("#d .lv-sh-x");
}

/* ============ 8. osvježavanje ============ */
{
  await boot({ pollMs: 3000 }, 400);
  await ev(`(() => { window.__mk = document.querySelector('#d .lv-mk--delivering:not(.is-lost)'); window.__pos = window.__mk.style.transform; window.__id = window.__mk.getAttribute('data-arg'); })()`);
  await ev(`A('d').ctx.selectCourier(Number(window.__id), { noFly: true })`);
  await sleep(200);
  const n0 = await logOf("courier-locations");
  await sleep(7000);
  const n1 = await logOf("courier-locations");
  check("pozicije se osvježavaju na zadati interval (3 s, bar dva kruga u 7 s)", n1 - n0 >= 2, `${n1 - n0}`);
  const same = await ev(`(() => { const now = document.querySelector('#d .lv-mk[data-arg="' + window.__id + '"]'); return { same: now === window.__mk || (now && now.isConnected), moved: now && now.style.transform !== window.__pos, sel: now && now.classList.contains('is-sel') }; })()`);
  check("marker kurira postoji i poslije osvježavanja (ključ je courierId, ne updated_at)", same.same && same.sel, JSON.stringify(same));
  check("marker je pomjeren na novu poziciju", same.moved, JSON.stringify(same));
  check("izbor i detalj prežive osvježavanje", (await cnt(".lv-det")) === 1);
  // skriven tab: nema zahtjeva; povratak: odmah osvježi
  await ev(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });`);
  const h0 = await logOf("courier-locations");
  await sleep(7000);
  const h1 = await logOf("courier-locations");
  check("dok je tab skriven nema novih zahtjeva za pozicije", h1 === h0, `${h1 - h0}`);
  await ev(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange'));`);
  await sleep(1200);
  check("po povratku u tab osvježava se odmah", (await logOf("courier-locations")) > h1);
  await ev(`delete document.hidden;`);
  // ručno osvježavanje
  const r0 = await logOf("courier-locations");
  await click("#d [data-act=refresh]", { wait: 20 });
  check("'Osvježi' prikazuje stanje zauzeto dok traje", await ev(`document.querySelector('#d [data-act=refresh]').getAttribute('aria-busy') === 'true'`));
  await sleep(900);
  check("'Osvježi' čita sve izvore ponovo i vraća dugme", (await logOf("courier-locations")) > r0 && (await ev(`document.querySelector('#d [data-act=refresh]').getAttribute('aria-busy')`)) === null);
  // praćenje
  await click("#d [data-act=follow]", { wait: 300 });
  check("'Prati na mapi' uključeno", await st(`a.st.follow === true`));
  await ev(`A('d').world.move(60); A('d').load('locs')`);
  await sleep(600);
  const s = await courierScreen(Number(await ev(`window.__id`)));
  const v = await view();
  check("karta prati kurira dok se pomjera", Math.hypot(s.x - v.w / 2, s.y - v.h / 2) < 4, `${s.x.toFixed(0)},${s.y.toFixed(0)}`);
  const box = await ev(`(() => { const r = document.querySelector('#d .lv-map').getBoundingClientRect(); return { x: r.left, y: r.top }; })()`);
  await P.b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x + 200, y: box.y + 200, button: "left", buttons: 1, clickCount: 1 });
  await P.b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x + 260, y: box.y + 230, buttons: 1 });
  await P.b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x + 260, y: box.y + 230, button: "left", buttons: 0, clickCount: 1 });
  await sleep(200);
  check("ručno pomjeranje karte gasi praćenje", await st(`a.st.follow === false`));
}

/* ============ 9. slojevi, legenda, cijeli ekran ============ */
{
  await boot({}, 500);
  const pins = await cnt(".lv-op");
  const zones = await cnt(".lv-zl");
  check("pinovi narudžbi i oznake zona su uključeni", pins >= 5 && zones === 6, `${pins} pinova, ${zones} zona`);
  await click("#d [data-act=menu]");
  check("meni slojeva ima tri prekidača", (await cnt(".lv-menu button")) === 3 && (await ev(`document.querySelector('#d [data-act=menu]').getAttribute('aria-expanded') === 'true'`)));
  await click("#d [data-arg=orders]");
  check("'Narudžbe na karti' isključeno: nema pinova", (await cnt(".lv-op")) === 0);
  await click("#d [data-arg=zones]");
  check("'Zone' isključeno: nema oznaka zona ni krugova", (await cnt(".lv-zl")) === 0 && (await ev(`document.querySelectorAll('#d .lv-base circle').length`)) === 0);
  await key("Escape");
  check("Esc zatvara meni", (await cnt(".lv-menu")) === 0);
  await click("#d [data-act=legend]");
  check("legenda objašnjava isprekidani prsten (bez signala)", /Bez signala/.test(await txt(".lv-legc")));
  await click("#d [data-act=legend]");
  await click("#d [data-act=full]", { wait: 400 });
  // offsetWidth, ne getBoundingClientRect: na tabli je okvir računara smanjen transformacijom, a ovdje se mjeri raspored
  const w = await ev(`document.querySelector('#d .lv-map').offsetWidth`);
  check("'Proširi mapu' skriva panel i širi kartu", (await ev(`getComputedStyle(document.querySelector('#d .lv-panel')).display`)) === "none" && w > 1000, String(w));
  await click("#d .lv-mk", { wait: 400 });
  check("izbor u proširenom prikazu vraća panel", (await ev(`getComputedStyle(document.querySelector('#d .lv-panel')).display`)) !== "none" && (await cnt(".lv-det")) === 1);
}

/* ============ 10. tastatura u spisku ============ */
{
  await boot({}, 500);
  await focusSel("#d #lv-t-k");
  const stops = [];
  for (let i = 0; i < 40; i++) { await key("Tab"); const t = await ev(`(() => { const e = document.activeElement; const p = document.querySelector('#d .lv-panel'); return e && p.contains(e) ? { fk: e.getAttribute('data-fk') } : null; })()`); if (!t) break; stops.push(t); }
  const rowStops = stops.filter((s) => s.fk && s.fk.startsWith("row:")).length;
  check("spisak kurira je jedno zaustavljanje tastera Tab (roving)", rowStops === 1, `${rowStops} od ${stops.length}`);
  await ev(`document.querySelector('#d .lv-row[tabindex="0"]').focus()`);
  await key("ArrowDown"); await key("ArrowDown");
  const a = await active();
  check("strelica dolje pomjera fokus po redovima", a && a.fk && a.fk.startsWith("row:"));
  await key("Enter");
  await sleep(700);
  check("Enter bira kurira", (await st(`a.st.selId`)) != null && (await cnt(".lv-det")) === 1);
  await key("ArrowUp");
  await key("Home");
  const h = await active();
  check("Home vraća na prvi red", h && h.fk && h.fk.startsWith("row:"));
  await key("Escape");
  check("Esc poslije izbora zatvara detalj", (await cnt(".lv-det")) === 0);
  // tabovi: strelice
  await focusSel("#d #lv-t-k");
  await key("ArrowRight");
  check("strelica desno na tabu prelazi na Narudžbe", (await st(`a.st.tab`)) === "n");
}

const failed = summary();
await P.close();
process.exit(failed ? 1 : 0);
