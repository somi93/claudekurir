// Provjera čiste logike (logic.js) u običnom Node-u, nad istim svijetom kao prototip i harness.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const R = await import("./world.node.mjs");
globalThis.LVW = R;
const LV = createRequire(import.meta.url)("./logic.js");

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) pass++; else { fail++; console.log(`  ✘ ${name}${detail ? "  — " + detail : ""}`); }
};
const eq = (name, a, b) => check(name, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`);

const NOW = Date.parse("2026-10-06T12:20:00.000Z");
const W = R.buildLiveWorld({ now: new Date(NOW) });
W.clock = () => NOW;
const cm = (s) => new Date(NOW - s * 1000).toISOString();

/* ---------- svježina signala ---------- */
const locAt = (sec) => ({ updated_at: cm(sec) });
eq("signal: 0 s svjež", LV.signalLevel(locAt(0), NOW), "fresh");
eq("signal: 90 s svjež (granica)", LV.signalLevel(locAt(90), NOW), "fresh");
eq("signal: 91 s slab", LV.signalLevel(locAt(91), NOW), "weak");
eq("signal: 300 s slab (granica)", LV.signalLevel(locAt(300), NOW), "weak");
eq("signal: 301 s izgubljen", LV.signalLevel(locAt(301), NOW), "lost");
eq("signal: bez lokacije", LV.signalLevel(null, NOW), "none");
eq("signal: neispravan datum nije izgubljen nego nepoznat", LV.signalLevel({ updated_at: "nije datum" }, NOW), "none");
eq("signal: vrijeme iz budućnosti (sat kurira) ne daje negativnu starost", LV.signalAge({ updated_at: cm(-30) }, NOW), 0);
eq("starost: 8 s", LV.shortAge(8000), "8 s");
eq("starost: 14 min", LV.shortAge(14 * 60000), "14 min");
eq("starost: 2 h", LV.shortAge(2 * 3600000), "2 h");
eq("starost: 1 dan", LV.shortAge(24 * 3600000), "1 dan");
eq("starost: 3 dana", LV.shortAge(3 * 86400000), "3 dana");
eq("tekst signala: upravo sad", LV.signalText(locAt(2), NOW), "upravo sad");
eq("tekst signala: pre 12 s", LV.signalText(locAt(12), NOW), "pre 12 s");
eq("tekst signala: bez lokacije", LV.signalText(null, NOW), "nema lokacije");

/* ---------- brzina ---------- */
eq("brzina: 6.1 m/s = 22 km/h", LV.speedKmh(6.1), 22);
eq("brzina: null je nepoznato", LV.speedKmh(null), null);
eq("brzina: tekst za 6.1 u dostavi", LV.speedText({ speed: 6.1 }, "delivering"), "22 km/h");
eq("brzina: 0 je 'Stoji'", LV.speedText({ speed: 0 }, "online"), "Stoji");
eq("brzina: 0.3 m/s je 'Stoji' (šum GPS-a)", LV.speedText({ speed: 0.3 }, "online"), "Stoji");
eq("brzina: null u dostavi NIJE 'Stoji'", LV.speedText({ speed: null }, "delivering"), "Brzina nepoznata");
eq("brzina: offline bez teksta", LV.speedText({ speed: null }, "offline"), "");
eq("brzina: string iz API-ja", LV.speedKmh("5.0"), 18);

/* ---------- svijet: pet izvora u jedan spisak ---------- */
const rows = W.couriers;
const locsRows = W.locations();
const bal = R.serveLive(W, { pth: "/dispatcher/delivery-companies/24/couriers-balance" })[1].data;
const roster = R.buildRoster(rows, { locations: locsRows, balances: bal });
const orders = {
  waiting: R.serveLive(W, { pth: "/dispatcher/orders/waiting" })[1].data.map(R.mapWaitingOrderDto),
  active: R.serveLive(W, { pth: "/dispatcher/orders/active-deliveries" })[1].data.map(R.mapActiveDeliveryDto),
  pending: R.serveLive(W, { pth: "/dispatcher/orders/pending-restaurant-confirmation" })[1].data.map(R.mapPendingRestaurantOrderDto),
};
const LIMIT = 200;
const couriers = LV.decorate(roster, { now: NOW, active: orders.active, cashLimit: LIMIT });
const counts = LV.courierCounts(couriers, NOW);
eq("svijet: 26 kurira", counts.all, 26);
eq("svijet: 6 u dostavi", counts.delivering, 6);
eq("svijet: 8 slobodnih", counts.online, 8);
eq("svijet: 12 offline (9 offline + 3 bez pozicije)", counts.offline, 12);
eq("svijet: 3 bez pozicije", counts.none, 3);
eq("svijet: stara stranica bi pokazala 23 (samo sa pozicijom)", locsRows.length, 23);
eq("svijet: bez signala 3 (1 u dostavi, 2 slobodna)", counts.lost, 3);
eq("svijet: limit (blizu ili preko) 4", counts.limit, 4);
eq("svijet: suspendovana 2", counts.suspended, 2);
const byName = (n) => couriers.find((c) => c.name === n);
const zeljko = byName("Željko Đurić");
check("Željko: u dostavi a signal izgubljen", zeljko.live === "delivering" && zeljko.sig === "lost" && zeljko.ghost, `${zeljko.live}/${zeljko.sig}`);
eq("Željko: dostava #4262", zeljko.delivery && zeljko.delivery.id, 4262);
eq("Željko: signal star 14 min", LV.shortAge(zeljko.sigMs), "14 min");
const amir = byName("Amir Hodžić");
check("Amir: svjež, u dostavi, nije duh", amir.live === "delivering" && amir.sig === "fresh" && !amir.ghost);
eq("Amir: dostava #4269", amir.delivery && amir.delivery.id, 4269);
eq("Amir: nivo gotovine 'near' (180.70 od 200)", amir.level, "near");
eq("Kenan Mujić (1) preko limita", couriers[1].level, "over");
eq("kurir bez pozicije je 'none', grupa offline", [couriers[4].live, couriers[4].group], ["none", "offline"]);
eq("kurir bez pozicije nema signala niti dostavu", [couriers[4].sig, couriers[4].delivery], ["none", null]);
check("duhovi: tačno 3 i svi su u dostavi ili slobodni", couriers.filter((c) => c.ghost).every((c) => c.live === "delivering" || c.live === "online") && couriers.filter((c) => c.ghost).length === 3);
check("offline kurir sa starim signalom NIJE duh", couriers.filter((c) => c.live === "offline" && c.ghost).length === 0);
eq("dostave: svih 6 u dostavi imaju red narudžbe", couriers.filter((c) => c.live === "delivering" && c.delivery).length, 6);

/* ---------- filteri, pretraga, redoslijed ---------- */
eq("filter: u dostavi", LV.filterCouriers(couriers, { live: "delivering" }, NOW).length, 6);
eq("filter: offline uključuje 'bez pozicije'", LV.filterCouriers(couriers, { live: "offline" }, NOW).length, 12);
eq("filter: bez signala", LV.filterCouriers(couriers, { flags: ["lost"] }, NOW).length, 3);
eq("filter: bez signala + u dostavi", LV.filterCouriers(couriers, { live: "delivering", flags: ["lost"] }, NOW).map((c) => c.name), ["Željko Đurić"]);
eq("filter: limit", LV.filterCouriers(couriers, { flags: ["limit"] }, NOW).length, 4);
eq("filter: više oznaka je presjek", LV.filterCouriers(couriers, { flags: ["limit", "lost"] }, NOW).map((c) => c.name), ["Željko Đurić"]);
eq("pretraga (pravi kod Kuriri): 'zeljko djuric'", LV.filterCouriers(couriers, { q: "zeljko djuric" }, NOW).map((c) => c.name), ["Željko Đurić"]);
eq("pretraga: telefon bez razdjelnika", LV.filterCouriers(couriers, { q: "065123456" }, NOW).map((c) => c.name), ["Željko Đurić"]);
eq("pretraga: ćirilica", LV.filterCouriers(couriers, { q: "Жељко" }, NOW).length, 2);
eq("pretraga + filter", LV.filterCouriers(couriers, { q: "zeljko", live: "online" }, NOW).map((c) => c.name), ["Željko Marković"]);
const sLive = LV.sortCouriers(couriers, "live", NOW);
eq("redoslijed 'uživo': prvi je u dostavi sa najsvježijim signalom", sLive[0].live, "delivering");
check("redoslijed 'uživo': grupe idu delivering, online, offline, none", sLive.map((c) => R.LIVE_META[c.live].rank).every((r, i, a) => i === 0 || a[i - 1] <= r));
const sLost = LV.sortCouriers(couriers, "lost", NOW);
check("redoslijed 'bez signala': tri duha prva, najstariji signal prvi", sLost.slice(0, 3).every((c) => c.ghost) && sLost[0].sigMs >= sLost[1].sigMs && sLost[1].sigMs >= sLost[2].sigMs);
check("redoslijed 'ime' je abecedni", (() => { const n = LV.sortCouriers(couriers, "name", NOW).map((c) => c.name); return n[0].startsWith("Aleksandar") || n[0].startsWith("Alen"); })());
const before = couriers.map((c) => c.id).join();
LV.sortCouriers(couriers, "name", NOW);
eq("redoslijed ne mijenja ulazni niz", couriers.map((c) => c.id).join(), before);

/* ---------- narudžbe ---------- */
const all = LV.normalizeOrders(orders);
eq("narudžbe: 4 + 5 + 6 = 15", all.length, 15);
const tier = (id) => LV.orderTier(all.find((o) => o.id === id));
eq("tier #4277 (kasni, čeka kurira)", tier(4277), "late");
eq("tier #4278 (čeka 18 min)", tier(4278), "critical");
eq("tier #4279 (čeka 6 min)", tier(4279), "warn");
eq("tier #4280 (čeka 2 min)", tier(4280), "calm");
eq("tier #4281 (zakazana)", tier(4281), "sched");
eq("tier #4262 (u dostavi, kasni 11)", tier(4262), "late");
eq("tier #4269 (u dostavi, za 9 min)", tier(4269), "calm");
eq("tier #4282 (restoran 3 min)", tier(4282), "calm");
eq("tier #4283 (restoran 9 min)", tier(4283), "warn");
eq("tier #4284 (restoran 22 min)", tier(4284), "critical");
eq("tier #4150 (restoran 5 h)", tier(4150), "stale");
eq("tekst: kasni 11 min", LV.orderTiming(all.find((o) => o.id === 4262)).text, "Kasni 11 min");
eq("tekst: stiže za 9 min", LV.orderTiming(all.find((o) => o.id === 4269)).text, "Stiže za 9 min");
check("tekst: zakazana", /^Zakazano, za 6 h$/.test(LV.orderTiming(all.find((o) => o.id === 4281)).text), LV.orderTiming(all.find((o) => o.id === 4281)).text);
check("tekst: restoran ne reaguje 5 h", /5h/.test(LV.orderTiming(all.find((o) => o.id === 4150)).text), LV.orderTiming(all.find((o) => o.id === 4150)).text);
eq("filter narudžbi: kasne", LV.filterOrders(all, { group: "late" }).map((o) => o.id).sort(), [4262, 4265, 4277]);
eq("filter narudžbi: čeka kurira 5", LV.filterOrders(all, { group: "wait" }).length, 5);
eq("filter narudžbi: čeka restoran 4", LV.filterOrders(all, { group: "rest" }).length, 4);
eq("filter narudžbi: u toku 6", LV.filterOrders(all, { group: "run" }).length, 6);
eq("redoslijed narudžbi: prvo kasne", LV.sortOrders(all).slice(0, 3).map((o) => LV.orderTier(o)), ["late", "late", "late"]);
eq("redoslijed narudžbi: zadnja je stale ili sched", ["stale", "sched"].includes(LV.orderTier(LV.sortOrders(all).slice(-1)[0])), true);
check("koordinate odredišta su brojevi", all.filter((o) => o.pos).every((o) => typeof o.pos.lat === "number" && typeof o.pos.lng === "number"));
check("narudžba bez lokacije nema pin ni pad", all.find((o) => o.id === 4150).pos === null && all.find((o) => o.id === 4150).address === "");
check("koordinate kao tekst se normalizuju", (() => { const o = LV.normalizeOrders({ waiting: [{ ...orders.waiting[0], location: { ...orders.waiting[0].location, coordination: { lat: "44.77", lng: "17.19" } } }] })[0]; return o.pos && o.pos.lat === 44.77; })());

/* ---------- pažnja ---------- */
const att = LV.buildAttention({ couriers, orders: all, handovers: 4, now: NOW });
eq("pažnja: bez signala 3, od toga u dostavi 1", [att.counts.lost, att.counts.lostDelivering], [3, 1]);
eq("pažnja: kasne 3", att.counts.late, 3);
eq("pažnja: čeka kurira 5, hitno 2 (kasni + 18 min)", [att.counts.waiting, att.counts.waitingCritical], [5, 2]);
eq("pažnja: restoran 3 aktivna (1 hitna), 1 zaostala", [att.counts.restaurant, att.counts.restaurantCritical, att.counts.stale], [3, 1, 1]);
eq("pažnja: limit 4, preko 2, suspendovani 2", [att.counts.limit, att.counts.over, att.counts.suspended], [4, 2, 2]);
eq("pažnja: predaje se prosljeđuju", att.counts.handovers, 4);
eq("pažnja: 7 stavki", att.items.length, 7);
eq("pažnja: prva je kurir u dostavi bez signala sa narudžbom koja kasni", [att.items[0].kind, att.items[0].courierId, att.items[0].orderId, att.items[0].sev], ["courier-lost", zeljko.id, 4262, 100]);
eq("pažnja: druga je narudžba koja kasni a nema kurira", [att.items[1].kind, att.items[1].orderId], ["order-late", 4277]);
eq("pažnja: poredak stavki je silazno po hitnosti", att.items.every((x, i, a) => i === 0 || a[i - 1].sev >= x.sev), true);
check("pažnja: duh u dostavi se ne broji dvaput (nema posebne stavke za #4262)", att.items.filter((x) => x.orderId === 4262).length === 1);
check("pažnja: restoran nosi telefon za poziv", att.items.find((x) => x.kind === "restaurant").tel === "051/216-877");
check("pažnja: slobodni duhovi su zadnji (sev 35)", att.items.slice(-2).every((x) => x.kind === "courier-lost-free" && x.sev === 35));
const attUnknown = LV.buildAttention({ couriers, orders: null, handovers: null, now: NOW });
eq("pažnja: izvor koji ne radi daje 'ne zna', ne nulu (predaje)", attUnknown.counts.handovers, null);
eq("pažnja: bez narudžbi samo stavke o kuririma", attUnknown.items.every((x) => x.kind.startsWith("courier")), true);
eq("pažnja: prazan svijet", LV.buildAttention({ couriers: [], orders: [], handovers: 0, now: NOW }).items.length, 0);

/* ---------- zone ---------- */
const zc = LV.zoneCounts(couriers, W.zones);
const sum = [...zc.values()].reduce((a, z) => a + z.total, 0);
check("zone: samo zone sa geometrijom (6 od 7)", zc.size === 6, `${zc.size}`);
check("zone: Zalužani (bez geometrije) se ne crta", ![...zc.keys()].includes(17));
const zname = (id) => W.zones.find((z) => z.id === id).name;
const zrow = (name) => zc.get(W.zones.find((z) => z.name === name).id);
check("zone: ukupno svi koji su na terenu i u nekoj zoni", sum === counts.delivering + counts.online, `${sum} vs ${counts.delivering + counts.online}`);
eq("zona Starčevica: duh u dostavi se broji kao 'lost', ne 'delivering'", [zrow("Starčevica").lost, zrow("Starčevica").delivering], [1, 1]);
eq("zonaOfPoint van svih zona", LV.zoneOfPoint(45.5, 20.4, W.zones), null);
check("zona: najmanji krug pobjeđuje pri preklapanju", (() => { const z = LV.zoneOfPoint(44.7722, 17.191, W.zones); return z && z.name === "Centar"; })());

/* ---------- mapa ---------- */
eq("metri: ishodište je (0, 0)", LV.toMeters(LV.ORIGIN.lat, LV.ORIGIN.lng), { x: 0, y: 0 });
check("metri: kružno putovanje", (() => { const m = LV.toMeters(44.7855, 17.2112); const p = LV.fromMeters(m.x, m.y); return Math.abs(p.lat - 44.7855) < 1e-9 && Math.abs(p.lng - 17.2112) < 1e-9; })());
check("pikseli po metru: z13 oko 0.073 (13.6 m/px)", Math.abs(1 / LV.ppm(13) - 13.6) < 0.2, `${1 / LV.ppm(13)}`);
check("ekran: sredina pogleda je sredina okvira", (() => { const s = LV.toScreen({ x: 100, y: 50 }, LV.view(100, 50, 13), { w: 800, h: 600 }); return s.x === 400 && s.y === 300; })());
check("ekran: kružno putovanje", (() => { const v = LV.view(120, -40, 14.5), size = { w: 900, h: 700 }; const s = LV.toScreen({ x: 700, y: 900 }, v, size); const m = LV.fromScreen(s, v, size); return Math.abs(m.x - 700) < 1e-6 && Math.abs(m.y - 900) < 1e-6; })());
const SIZE = { w: 700, h: 620 };
const iv = LV.initialView({ couriers, zones: W.zones, size: SIZE, now: NOW });
eq("početni pogled: iz kurira na terenu", iv.reason, "couriers");
check("početni pogled: svi izabrani kuriri su u okviru", (() => { const pick = couriers.filter((c) => c.loc && (c.live !== "offline" || c.sigMs <= LV.RECENT_MS)); return pick.length > 10 && pick.every((c) => { const s = LV.toScreen(LV.toMeters(c.loc.latitude, c.loc.longitude), iv.view, SIZE); return s.x >= 0 && s.x <= SIZE.w && s.y >= 0 && s.y <= SIZE.h; }); })());
check("početni pogled: zum je razuman (12-16)", iv.view.z >= 12 && iv.view.z <= 16, `${iv.view.z}`);
check("početni pogled: centar je u Banjoj Luci a ne u Beogradu", (() => { const p = LV.fromMeters(iv.view.cx, iv.view.cy); return Math.abs(p.lat - 44.77) < 0.05 && Math.abs(p.lng - 17.2) < 0.08; })());
check("početni pogled: kurir offline 3 dana daleko ne razvlači pogled", (() => {
  const far = { ...couriers[0], id: 99999, live: "offline", group: "offline", sigMs: 3 * 86400000, loc: { ...couriers[0].loc, latitude: 45.8, longitude: 19.8 } };
  const v = LV.initialView({ couriers: [...couriers, far], zones: W.zones, size: SIZE, now: NOW });
  return v.view.z === iv.view.z && v.view.cx === iv.view.cx;
})());
eq("početni pogled: jedan kurir = zum 15", LV.initialView({ couriers: [amir], zones: [], size: SIZE, now: NOW }).view.z, 15);
eq("početni pogled: samo stari offline kuriri", LV.initialView({ couriers: [{ ...couriers[3], sigMs: 5 * 3600000 }], zones: W.zones, size: SIZE, now: NOW }).reason, "couriers-old");
eq("početni pogled: bez kurira idu zone", LV.initialView({ couriers: [], zones: W.zones, size: SIZE, now: NOW }).reason, "zones");
eq("početni pogled: bez ičega", LV.initialView({ couriers: [], zones: [], size: SIZE, now: NOW }).reason, "default");
check("početni pogled: bez ičega nije Beograd", (() => { const v = LV.initialView({ couriers: [], zones: [], size: SIZE, now: NOW }).view; const p = LV.fromMeters(v.cx, v.cy); return Math.abs(p.lng - 20.46) > 1; })());
check("fitView: zum nikad iznad 16 niti ispod 10", (() => { const a = LV.fitView([{ x: 0, y: 0 }, { x: 40, y: 40 }], SIZE); const b = LV.fitView([{ x: -90000, y: 0 }, { x: 90000, y: 0 }], SIZE); return a.z <= 16 && b.z >= 10; })());
eq("fitView: bez tačaka", LV.fitView([], SIZE), null);
check("fitView sa donjim listom (telefon): tačke staju iznad njega", (() => {
  const pts = [{ x: -900, y: -700 }, { x: 1100, y: 900 }, { x: 200, y: -200 }];
  const phone = { w: 390, h: 640 }, bottom = 110;
  const v = LV.fitView(pts, phone, { bottom });
  return pts.every((p) => { const s = LV.toScreen(p, v, phone); return s.x >= 0 && s.x <= phone.w && s.y >= 0 && s.y <= phone.h - bottom + 1; });
})());
check("fitView bez donjeg lista daje isti zum, a sa njim je manji ili isti", (() => { const pts = [{ x: -900, y: -700 }, { x: 1100, y: 900 }]; const a = LV.fitView(pts, { w: 390, h: 640 }), b = LV.fitView(pts, { w: 390, h: 640 }, { bottom: 110 }); return b.z <= a.z; })());

/* ---------- klasteri ---------- */
const items = [
  { id: 1, x: 10, y: 10, live: "online" }, { id: 2, x: 20, y: 15, live: "delivering" }, { id: 3, x: 30, y: 12, live: "offline" },
  { id: 4, x: 300, y: 300, live: "online" }, { id: 5, x: 22, y: 18, live: "online", pinned: true },
];
const cl = LV.clusterMarkers(items, 40);
eq("klasteri: tri bliska se spajaju u jedan", cl.filter((c) => c.cluster).length, 1);
eq("klasteri: veličina i sastav", [cl.find((c) => c.cluster).cluster.count, cl.find((c) => c.cluster).cluster.delivering, cl.find((c) => c.cluster).cluster.online, cl.find((c) => c.cluster).cluster.offline], [3, 1, 1, 1]);
check("klasteri: istaknut marker (problem ili izabran) se nikad ne sklanja", cl.some((c) => c.one && c.one.id === 5));
check("klasteri: usamljeni ostaje pojedinačan", cl.some((c) => c.one && c.one.id === 4));
eq("klasteri: zbir markera se ne mijenja", cl.reduce((a, c) => a + (c.one ? 1 : c.cluster.count), 0), 5);
eq("klasteri: prazan ulaz", LV.clusterMarkers([], 40), []);
check("klasteri: položaj je srednja vrijednost", (() => { const c = cl.find((x) => x.cluster).cluster; return Math.abs(c.x - 20) < 1e-9 && Math.abs(c.y - 12.333333333333334) < 1e-9; })());

/* ---------- adresa ---------- */
eq("adresa: prazna", LV.parseQuery(""), { c: null, o: null, t: "k", live: "all", flags: [], q: "", layers: { zones: true, orders: true, labels: true } });
eq("adresa: kurir i tab", [LV.parseQuery("?c=30189&t=n").c, LV.parseQuery("?c=30189&t=n").t], [30189, "n"]);
eq("adresa: neispravan ID se odbacuje", LV.parseQuery("?c=abc&o=-5").c, null);
eq("adresa: nepoznat tab je kurirski", LV.parseQuery("?t=x").t, "k");
eq("adresa: filter stanja i oznake", [LV.parseQuery("?f=delivering,lost").live, LV.parseQuery("?f=delivering,lost").flags], ["delivering", ["lost"]]);
eq("adresa: nepoznata oznaka se ignoriše", LV.parseQuery("?f=zzz").flags, []);
eq("adresa: slojevi", LV.parseQuery("?l=zi").layers, { zones: true, orders: false, labels: true });
const st1 = { c: 30189, o: 4262, t: "n", live: "online", flags: ["limit", "lost"], q: "djuric", layers: { zones: false, orders: true, labels: true } };
eq("adresa: kružno putovanje", LV.parseQuery(LV.buildQuery(st1)), { ...st1, flags: ["lost", "limit"] });
eq("adresa: zadano stanje daje praznu adresu", LV.buildQuery({ c: null, o: null, t: "k", live: "all", flags: [], q: "", layers: { zones: true, orders: true, labels: true } }), "");

/* ---------- tekstovi ---------- */
eq("množina: 1 kurir", LV.plural(1, "kurir", "kurira", "kurira"), "kurir");
eq("množina: 3 kurira", LV.plural(3, "kurir", "kurira", "kurira"), "kurira");
eq("množina: 11 kurira", LV.plural(11, "kurir", "kurira", "kurira"), "kurira");
eq("množina: 21 kurir", LV.plural(21, "kurir", "kurira", "kurira"), "kurir");
eq("podnaslov", LV.subtitle(counts, true), "26 kurira · 14 uživo");
eq("podnaslov dok se ne zna", LV.subtitle(counts, false), "");
eq("udaljenost: 850 m", LV.fmtDist(852), "850 m");
eq("udaljenost: 2,3 km", LV.fmtDist(2310), "2,3 km");

console.log(`\nlogika: ${pass}/${pass + fail} prošlo`);
process.exit(fail ? 1 : 0);
