// Prototip "Kuriri uživo": stanja - učitavanje, pad izvora (svaki posebno), zastarjeli podaci, prazna stanja, neispravni podaci, 4x sporiji procesor.
import { openProto, check, summary, sleep } from "./lib.mjs";

const P = await openProto({ name: "t2", width: 1480, height: 1000, dpr: 1 });
const { ev, click, waitFor } = P;
const boot = async (opts = {}, settle = 500, ready = true) => {
  await ev(`fresh('d', ${JSON.stringify({ pollMs: 6000, ordersMs: 10000, slowMs: 20000, ...opts })})`);
  if (ready) await waitFor("A('d').ctx.ready", { timeout: 15000 });
  await sleep(settle);
};
const txt = (sel) => ev(`(() => { const e = document.querySelector('#d ${sel}'); return e ? e.textContent.replace(/\\s+/g,' ').trim() : null; })()`);
const cnt = (sel) => ev(`document.querySelectorAll('#d ${sel}').length`);
const tiles = () => ev(`[...document.querySelectorAll('#d .lv-tile')].map((e) => e.querySelector('b').textContent.trim())`);
const logOf = (re) => ev(`A('d').log.filter((e) => /${re}/.test(e.method + ' ' + e.path)).length`);
const shot = (n) => P.shot(n, { sel: "#d" });

/* ============ učitavanje ============ */
await boot({ delay: 1800 }, 600, false);
{
  check("učitavanje: karta kaže šta radi", /Učitavam kurire i pozicije/.test(await txt(".lv-mnote")), await txt(".lv-mnote"));
  check("učitavanje: spisak je skeleton (5 redova), bez lažne nule", (await cnt(".lv-skr")) === 5 && (await cnt(".lv-row")) === 0);
  check("učitavanje: pločice i oznake se ne crtaju dok se ne zna", (await cnt(".lv-tile")) === 0 && (await cnt(".lv-chip")) === 0);
  check("učitavanje: pretraga je isključena", await ev(`document.querySelector('#d #lv-q').disabled`));
  check("učitavanje: podnaslov je prazan (ne tvrdi '0 kurira')", !/\d+ kurira/.test(await txt("h1 small")), await txt("h1 small"));
  await shot("s-loading");
  await waitFor("A('d').ctx.ready", { timeout: 15000 });
  await sleep(500);
  check("poslije učitavanja: sve je tu", (await cnt(".lv-row")) === 12 && (await cnt(".lv-tile")) === 4);
}

/* ============ spisak kurira ne radi (prvo učitavanje) ============ */
await boot({ fail: "rows" }, 800);
{
  check("pad spiska: karta i panel kažu grešku, ne 'nema kurira'", /Ne mogu da učitam kurire/.test(await txt(".lv-mnote")) && /Ne mogu da učitam kurire/.test(await txt(".lv-pbody")));
  check("pad spiska: objašnjava zašto ne pokazuje prazan spisak", /Prazan spisak bi izgledao kao da firma nema kurira/.test(await txt(".lv-pbody")));
  check("pad spiska: nigdje piše 'Firma još nema kurira'", !/Firma još nema kurira/.test(await txt(".lv-pbody")) && !/Firma još nema kurira/.test(await txt(".lv-mnote")));
  check("pad spiska: 'Pokušaj ponovo' postoji", (await cnt("[data-act=retry]")) >= 2);
  await shot("s-rows-fail");
  await ev(`A('d').clearFails()`);
  await click("#d .lv-mnote [data-act=retry]", { wait: 900 });
  check("'Pokušaj ponovo' vraća cijelu stranicu", (await cnt(".lv-row")) === 12 && (await cnt(".lv-tile")) === 4 && !(await txt(".lv-mnote")));
}

/* ============ pozicije ne rade (prvo učitavanje): spisak radi, stanje uživo se ne tvrdi ============ */
await boot({ fail: "locs" }, 800);
{
  check("pad pozicija: pločice stanja kažu '—', ne 0", JSON.stringify(await tiles()) === JSON.stringify(["26", "—", "—", "—"]), JSON.stringify(await tiles()));
  check("pad pozicija: karta objašnjava (crveno) sa 'Pokušaj ponovo'", /Ne mogu da učitam pozicije kurira/.test(await txt(".lv-notes")) && (await cnt(".lv-notes [data-act=retry]")) === 1);
  check("pad pozicija: spisak kurira radi (26 kurira, 12 redova)", (await cnt(".lv-row")) === 12);
  check("pad pozicija: spisak upozorava da stanje uživo nije pouzdano", /Pozicije kurira nisu stigle/.test(await txt(".lv-pbody")));
  check("pad pozicija: oznaka 'Bez signala' je isključena (ne zna se)", await ev(`document.querySelector('#d .lv-chip[data-arg=lost]') === null || document.querySelector('#d .lv-chip[data-arg=lost]').disabled`));
  check("pad pozicija: traka kaže da pozicije nisu stigle", /Pozicije nisu stigle/.test(await txt("[data-upd]")));
  check("pad pozicija: nijedan kurir nije označen kao offline na karti ni u spisku (stanje se ne tvrdi)", (await cnt(".lv-mk")) === 0 && !/Offline/.test(await txt(".lv-pbody")), `${await cnt(".lv-mk")} markera`);
  await shot("s-locs-fail");
  await ev(`A('d').clearFails()`);
  await click("#d .lv-notes [data-act=retry]", { wait: 900 });
  check("poslije ponovnog pokušaja stanje uživo se vraća", JSON.stringify(await tiles()) === JSON.stringify(["26", "6", "8", "12"]), JSON.stringify(await tiles()));
}

/* ============ osvježavanje padne, podaci postoje ============ */
await boot({ pollMs: 2500 }, 600);
{
  await ev(`A('d').failNext(/GET .*courier-locations/, 999)`);
  await sleep(4500);
  check("zastarjelo: upozorenje 'Pozicije nisu osvježene' sa vremenom i 'Pokušaj ponovo'", /Pozicije nisu osvježene/.test(await txt(".lv-notes")) && /\d\d:\d\d:\d\d/.test(await txt(".lv-notes")) && (await cnt(".lv-notes [data-act=retry]")) === 1, await txt(".lv-notes"));
  check("zastarjelo: stari podaci ostaju (pločice i 12 redova)", JSON.stringify(await tiles()) === JSON.stringify(["26", "6", "8", "12"]) && (await cnt(".lv-row")) === 12);
  check("zastarjelo: traka je crvena i kaže od kada su podaci", await ev(`document.querySelector('#d [data-upd]').classList.contains('is-stale')`) && /nisu osvježene od/.test(await txt("[data-upd]")));
  check("zastarjelo: markeri ostaju na karti", (await cnt(".lv-mk")) >= 10);
  await shot("s-stale");
  await ev(`A('d').clearFails()`);
  await click("#d .lv-notes [data-act=retry]", { wait: 900 });
  check("poslije oporavka upozorenje nestaje", (await cnt(".lv-notes .lv-tint")) === 0 && !(await ev(`document.querySelector('#d [data-upd]').classList.contains('is-stale')`)));
}

/* ============ narudžbe ne rade ============ */
await boot({ fail: "orders" }, 800);
{
  check("pad narudžbi: kuriri i karta rade (12 redova, markeri)", (await cnt(".lv-row")) === 12 && (await cnt(".lv-mk")) >= 10);
  check("pad narudžbi: oznake narudžbi kažu '—' i isključene su", await ev(`['o:late','o:wait','o:rest'].every((k) => { const e = document.querySelector('#d .lv-chip[data-arg="' + k + '"]'); return e && e.disabled && /—/.test(e.textContent); })`));
  check("pad narudžbi: nema pinova na karti", (await cnt(".lv-op")) === 0);
  check("pad narudžbi: nema izmišljenog 'Traži pažnju' o narudžbama (samo kuriri)", await ev(`A('d').ctx.V.att.items.every((x) => x.kind.startsWith('courier'))`));
  await click("#d .lv-tab", { nth: 1 });
  check("pad narudžbi: tab Narudžbe kaže grešku i ima 'Pokušaj ponovo'", /Ne mogu da učitam narudžbe/.test(await txt(".lv-pbody")) && (await cnt(".lv-pbody [data-act=retry]")) === 1);
  check("pad narudžbi: objašnjava zašto ne pokazuje prazan spisak", /Prazan spisak bi izgledao kao da nema narudžbi/.test(await txt(".lv-pbody")));
  check("pad narudžbi: kurir u dostavi kaže da se narudžba ne vidi (ne izmišlja)", await (async () => { await click("#d .lv-tab", { nth: 0 }); await click("#d .lv-row", { nth: 0, wait: 500 }); return /Narudžba se ne vidi u spisku aktivnih dostava \(narudžbe nisu učitane\)/.test(await txt(".lv-det")); })());
  await shot("s-orders-fail");
}

/* ============ novac ne radi ============ */
await boot({ fail: "bal" }, 800);
{
  check("pad gotovine: oznaka limita je '—' i isključena", await ev(`(() => { const e = document.querySelector('#d .lv-chip[data-arg=limit]'); return e && e.disabled && /—/.test(e.textContent); })()`));
  check("pad gotovine: ostalo radi", (await cnt(".lv-row")) === 12 && JSON.stringify(await tiles()) === JSON.stringify(["26", "6", "8", "12"]));
  check("pad gotovine: red kurira ne tvrdi dug", !/Duguje|Preko limita/.test(await txt(".lv-pbody")));
  await click("#d .lv-row", { nth: 0, wait: 500 });
  check("pad gotovine: detalj kaže 'Nije dostupno'", /Gotovina\s*Nije dostupno/.test(await txt(".lv-det")), (await txt(".lv-det")).slice(-160));
}

/* ============ prazna stanja ============ */
await boot({ empty: "fleet" }, 700);
{
  check("firma bez kurira: karta i panel kažu to i nude 'Dodaj kurira'", /Firma još nema kurira/.test(await txt(".lv-mnote")) && /Firma još nema kurira/.test(await txt(".lv-pbody")) && (await cnt("[data-act=goto]")) >= 3);
  check("firma bez kurira: nema pločica ni oznaka", (await cnt(".lv-tile")) === 0 && (await cnt(".lv-chip")) === 0);
  await shot("s-empty-fleet");
}
await boot({ empty: "nopos" }, 800);
{
  check("niko ne šalje poziciju: obavještenje na karti", /Nijedan kurir ne šalje poziciju/.test(await txt(".lv-notes")));
  check("niko ne šalje poziciju: pločice su brojevi (0 / 0 / 26), ne '—'", JSON.stringify(await tiles()) === JSON.stringify(["26", "0", "0", "26"]), JSON.stringify(await tiles()));
  check("niko ne šalje poziciju: pogled je na zonama firme (ne na praznini ni u Beogradu)", (await ev(`A('d').ctx.initialReason`)) === "zones", await ev(`A('d').ctx.initialReason`));
  check("niko ne šalje poziciju: krugovi zona su na karti", (await ev(`document.querySelectorAll('#d .lv-base circle').length`)) === 6);
  await shot("s-nopos");
}

/* ============ neispravni podaci ============ */
await boot({}, 600);
{
  const err0 = P.b.exceptions.length;
  await ev(`(() => {
    const a = A('d'); const W = a.world;
    W.couriers[10].name = null; W.couriers[10].first_name = null; W.couriers[10].last_name = null; W.couriers[10].phone = null; W.couriers[10].vehicle = { id: 1, type: 'hovercraft' };
    W.couriers[11].vehicle = null; W.couriers[12].email = null;
    const orig = W.locations; W.locations = () => { const rows = orig(); const r = rows.find((x) => x.courier_id === W.couriers[10].courier_id); if (r) { r.location.updated_at = 'nije datum'; r.location.speed = '5.0'; r.location.heading = null; r.location.latitude = String(r.location.latitude); r.location.longitude = String(r.location.longitude); } const r2 = rows.find((x) => x.courier_id === W.couriers[13].courier_id); if (r2) { r2.location.updated_at = null; } return rows; };
    W.orders.waiting[0].location = { id: 1, address: null, coordination: { lat: 'x', lng: null } };
    W.orders.active[0].courier = null;
    W.orders.pending[0].restaurant_phone = null;
  })()`);
  await ev(`A('d').load('rows'); A('d').load('locs'); A('d').load('orders');`);
  await sleep(900);
  check("neispravni podaci: stranica ne puca (bez izuzetaka)", P.b.exceptions.length === err0, P.b.exceptions.slice(err0).map((e) => (e.text || "").slice(0, 120)).join(" | "));
  check("neispravni podaci: spisak i dalje ima redove", (await cnt(".lv-row")) >= 12);
  check("neispravno vrijeme signala: nije 'izgubljen signal', red piše 'nema lokacije', nigdje NaN", await ev(`(() => { const a = A('d'); const c = a.ctx.V.cs.find((x) => x.id === a.world.couriers[10].courier_id); const row = document.querySelector('#d .lv-row[data-arg="' + c.id + '"]'); return c.sig === 'none' && !c.ghost && row && /nema lokacije/.test(row.textContent) && !/NaN/.test(document.querySelector('#d .lv-pbody').textContent); })()`));
  check("brzina kao tekst i kurir bez imena i telefona: red postoji i ne puca", await ev(`(() => { const a = A('d'); const id = a.world.couriers[10].courier_id; const row = document.querySelector('#d .lv-row[data-arg="' + id + '"]'); return !!row && /bez telefona/.test(row.textContent) && /Nepoznato vozilo|hovercraft/.test(row.textContent); })()`));
  await click("#d .lv-tab", { nth: 1 });
  check("narudžba sa neispravnim koordinatama se ne crta, a red postoji", (await cnt(".lv-orow")) >= 12);
  await click("#d .lv-tab", { nth: 0 });
}

/* ============ 4x sporiji procesor ============ */
await boot({ n: 500 }, 1200);
{
  await P.b.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const until = async (js, t = 15000) => { const s = Date.now(); for (;;) { if (await ev(js)) return Date.now() - s; if (Date.now() - s > t) return -1; await sleep(10); } };
  const n0 = await cnt(".lv-row");
  await click("#d #lv-q");
  const t0 = Date.now();
  await P.typeText("mar", 5);
  const total = Date.now() - t0;
  check("500 kurira, procesor 4x sporiji: tri slova u pretragu za manje od 900 ms", total < 900, `${total} ms`);
  await ev(`(() => { const i = document.querySelector('#d #lv-q'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(400);
  const t1 = Date.now();
  await click("#d .lv-tile", { nth: 1, wait: 0 });
  const dt = await until(`document.querySelectorAll('#d .lv-tile')[1].getAttribute('aria-pressed') === 'true'`);
  check("500 kurira, 4x: filter stanja za manje od 400 ms", dt >= 0 && dt < 400, `${dt} ms`);
  await click("#d .lv-tile", { nth: 0, wait: 300 });
  await P.b.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  check("500 kurira: DOM ostaje mali (manje od 3000 čvorova u prototipu)", (await ev(`document.querySelectorAll('#d *').length`)) < 3000, String(await ev(`document.querySelectorAll('#d *').length`)));
}

const failed = summary();
await P.close();
process.exit(failed ? 1 : 0);
