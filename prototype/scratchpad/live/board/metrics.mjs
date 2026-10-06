// Sklapa metrics.json: "prije" iz mjerenja stare stranice (../out/b*.json), "poslije" iz testova prototipa (t3/t4 + logika + provjere).
// Brojevi u tekstu table su __M_B_x__ / __M_A_x__ i dolaze odavde; build.mjs puca ako nekog nema.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "..", "out");
const rj = (f) => JSON.parse(fs.readFileSync(path.join(out, f), "utf8"));
const b1 = rj("b1.json"), b2 = rj("b2.json"), b3 = rj("b3.json"), b4 = rj("b4.json"), b5 = rj("b5.json"), b6 = rj("b6.json"), b7 = rj("b7.json"), b8 = rj("b8.json");
const t3 = rj("t3.json"), t4 = rj("t4.json");
const checks = fs.existsSync(path.join(out, "checks-dev_html.json")) ? rj("checks-dev_html.json") : null;
const R = await import(pathToFileURL(path.join(here, "world.node.mjs")).href);
globalThis.LVW = R;
const LV = createRequire(import.meta.url)(path.join(here, "logic.js"));

const NOW = Date.parse("2026-10-06T12:20:00.000Z");
const W = R.buildLiveWorld({ now: new Date(NOW) });
W.clock = () => NOW;
const M = {};
const r1 = (v) => (Math.round(v * 10) / 10).toString().replace(".", ",");
const dec = (v) => (Math.round(v * 100) / 100).toFixed(2).replace(".", ",");

/* ---------- prije: stara stranica ---------- */
const locs = W.locations();
const inBounds = locs.filter((l) => l.location.latitude >= b1.map.south && l.location.latitude <= b1.map.north && l.location.longitude >= b1.map.west && l.location.longitude <= b1.map.east).length;
M.B_world = W.couriers.length;
M.B_total = locs.length;
M.B_notShown = W.couriers.length - locs.length;
M.B_visible = inBounds;
M.B_openKm = b1.mapOffKm;
M.B_zoom = b1.map.zoom;
M.B_mapW = b1.rects.map.w; M.B_mapH = b1.rects.map.h; M.B_mapEnd = b1.rects.side.b; M.B_vh = 900;
M.B_listH = b1.rects.list.h; M.B_rowH = b1.fold.rowH; M.B_rowsFull = b1.fold.fullyVisibleInList;
M.B_docAfterSel = b2.afterRowClick.scrollH;
M.B_cardH = b2.afterRowClick.card.h;
M.B_laptopMapH = b1.laptop.map.h; M.B_laptopRows = b1.laptop.rows; M.B_laptopDoc = b1.laptop.scrollH;
M.B_markerPx = b2.markerPx.find((m) => m.w === 20).w; M.B_selPx = b2.markerPx.find((m) => m.w === 26).w;
M.B_avatarW = b1.avatar.textW; M.B_avatarBox = b1.avatar.box;
M.B_minC = b1.contrast.min.toString().replace(".", ","); M.B_badC = b1.contrast.below45; M.B_textsC = b1.contrast.count;
M.B_hdrBtn = b1.targets.headerBtns[0][1]; M.B_zoomBtn = b1.targets.zoom[0][0];
// Vuetify v-list-item ima tabindex -2 (nije zaustavljanje; spisak je jedno preko v-list): računaju se samo pravi elementi + 3 dugmeta zaglavlja
M.B_stops = Object.entries(b2.stopsList).filter(([k]) => !/v-list-item/.test(k)).reduce((a, [, n]) => a + n, 0) + 3;
M.B_popupMs = r1(b3.popupClosedByPollMs / 1000);
M.B_recreated = b2.refresh.mut.removed; M.B_markersAll = b1.world.withPosition;
M.B_pollFirst = r1(b3.poll.requestsAtSec[0]); M.B_pollSecond = r1(b3.poll.requestsAtSec[1]);
M.B_hidden36 = b3.hidden.requestsWhileHidden; M.B_hidden8h = Math.round((8 * 3600) / 15);
M.B_busy = r1(b3.poll.busyMs / 1000);
M.B_searchFound = b7.old; M.B_searchTotal = b7.total; M.A_searchFound = b7.neu;
M.B_reqOpen = Object.values(b1.requests).reduce((a, n) => a + n, 0);
M.B_reqOpenPage = 1; // courier-locations
M.B_nodes26 = b5.n26.domNodes; M.B_nodes500 = b5.n500.domNodes; M.B_rows500 = b5.n500.rows; M.B_markers500 = b5.n500.markers;
M.B_type4_26 = b5.n26.search4x_total_ms; M.B_type4_150 = b5.n150.search4x_total_ms; M.B_type4_500 = b5.n500.search4x_total_ms;
M.B_phoneRows0 = b6.layout.rowsInFirstScreen;
M.B_phoneMapPct = Math.round((b6.afterRowTap.map.visiblePx / b6.afterRowTap.map.of) * 100);
M.B_phoneCardPct = Math.round((b6.afterRowTap.card.visiblePx / b6.afterRowTap.card.of) * 100);
M.B_phoneDoc = b6.layout.scrollH; M.B_phoneMapH = b6.layout.map.h; M.B_phoneBars = b6.layout.appbar.h + b6.layout.header.h;
M.B_pillsPhone = b6.layout.pills.h;
M.B_failPills = b4.firstLoadFail.pills.map((p) => p.replace(/\D+/g, "")).join(" / ");
M.B_linkNoPos = b8["bez pozicije"].map.zoom;
// stara pretraga: koji upiti ne prolaze
M.B_searchFail = b7.rows.filter((r) => !r.old).map((r) => r.q);

/* ---------- poslije: prototip (isti svijet, ista logika) ---------- */
const bal = R.serveLive(W, { pth: "/dispatcher/delivery-companies/24/couriers-balance" })[1].data;
const roster = R.buildRoster(W.couriers, { locations: locs, balances: bal });
const act = R.serveLive(W, { pth: "/dispatcher/orders/active-deliveries" })[1].data.map(R.mapActiveDeliveryDto);
const cs = LV.decorate(roster, { now: NOW, active: act, cashLimit: 200 });
const counts = LV.courierCounts(cs, NOW);
const SIZE = { w: t3.lay.map.w, h: t3.lay.map.h };
const iv = LV.initialView({ couriers: cs, zones: W.zones, size: SIZE, now: NOW });
const inside = (list, v) => list.filter((c) => { const s = LV.toScreen(LV.toMeters(c.loc.latitude, c.loc.longitude), v, SIZE); return s.x >= 0 && s.x <= SIZE.w && s.y >= 0 && s.y <= SIZE.h; }).length;
const recent = cs.filter((c) => c.loc && (c.live !== "offline" || c.sigMs <= LV.RECENT_MS));
M.A_recent = recent.length; M.A_visible = inside(recent, iv.view); M.A_visibleAll = inside(cs.filter((c) => c.loc), iv.view); M.A_withPos = cs.filter((c) => c.loc).length;
const ctr = LV.fromMeters(iv.view.cx, iv.view.cy);
const cx = cs.filter((c) => c.loc).reduce((a, c) => a + c.loc.latitude, 0) / M.A_withPos, cy = cs.filter((c) => c.loc).reduce((a, c) => a + c.loc.longitude, 0) / M.A_withPos;
M.A_openKm = r1(LV.distanceM({ lat: ctr.lat, lng: ctr.lng }, { lat: cx, lng: cy }) / 1000);
M.A_zoom = (Math.round(iv.view.z * 100) / 100).toString().replace(".", ",");
M.A_lostFree = cs.filter((c) => c.ghost && c.live === "online").length; M.A_lostDeliv = cs.filter((c) => c.ghost && c.live === "delivering").length;
M.A_svi = counts.all; M.A_deliv = counts.delivering; M.A_free = counts.online; M.A_off = counts.offline; M.A_none = counts.none; M.A_lost = counts.lost; M.A_limit = counts.limit; M.A_susp = counts.suspended;
const o = LV.normalizeOrders({
  waiting: R.serveLive(W, { pth: "/dispatcher/orders/waiting" })[1].data.map(R.mapWaitingOrderDto), active: act,
  pending: R.serveLive(W, { pth: "/dispatcher/orders/pending-restaurant-confirmation" })[1].data.map(R.mapPendingRestaurantOrderDto),
});
const att = LV.buildAttention({ couriers: cs, orders: o, handovers: 4, now: NOW });
M.A_late = att.counts.late; M.A_wait = att.counts.waiting; M.A_waitCrit = att.counts.waitingCritical; M.A_rest = att.counts.restaurant; M.A_restCrit = att.counts.restaurantCritical; M.A_stale = att.counts.stale; M.A_hand = att.counts.handovers;
M.A_items = att.items.length; M.A_orders = o.length;
M.A_pins = o.filter((x) => x.pos).length;
M.A_markerPx = 40; M.A_hitPx = 48;
M.A_minC = t3.minC.toString().replace(".", ","); M.A_texts = t3.texts; M.A_states = t3.states; M.A_minFont = (Math.round(t3.minFont * 100) / 100).toString().replace(".", ",");
M.A_stops = t3.tabStops;
M.A_mapW = t3.lay.map.w; M.A_mapH = t3.lay.map.h; M.A_listH = t3.lay.body.h; M.A_rowH = t3.lay.rowH; M.A_rowsFull = t3.lay.rowsFull; M.A_stripH = t3.lay.strip.h;
M.A_nodes500 = t4.n500.nodes; M.A_markers500 = t4.n500.markers; M.A_clusters500 = t4.n500.clusters; M.A_ready500 = t4.n500.msReady;
M.A_type4_500 = t4.n500.search4x; M.A_filter4_500 = t4.n500.filter4x; M.A_pan4_500 = t4.n500.panStep4x; M.A_zoom1_500 = t4.n500.zoomStep1x; M.A_zoom4_500 = t4.n500.zoomStep4x;
M.A_phonePeek = 100;
// brojevi provjera (zadnji potpuni prolaz run-all.mjs)
const c = (k) => (checks && checks[k] ? checks[k].total : 0);
M.A_chkLogic = c("logic"); M.A_chkFlows = c("t1"); M.A_chkStates = c("t2"); M.A_chkDevice = c("t3"); M.A_chkScale = c("t4");
M.A_chkTotal = checks ? checks.total.total : 0;
// provjere nad sklopljenom tablom: CHK_BOARD = logika+tok+stanja+skala nad board.preview.html, CHK_BOARD_OWN = board-smoke, LEAK_PROPS/LEAK_STATES = board-leak
M.A_chkBoard = Number(process.env.CHK_BOARD || 0);
M.A_chkBoardOwn = Number(process.env.CHK_BOARD_OWN || 0);
M.A_leakProps = String(Number(process.env.LEAK_PROPS || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
M.A_leakStates = Number(process.env.LEAK_STATES || 0);

fs.writeFileSync(path.join(out, "metrics.json"), JSON.stringify(M, null, 1));
console.log(Object.keys(M).length, "mjera upisano; provjere:", M.A_chkTotal);
console.log(JSON.stringify({ visible: M.B_visible, openKm: M.B_openKm, A_vis: `${M.A_visible}/${M.A_recent}`, all: M.A_visibleAll, lost: M.A_lost, minC: M.A_minC }));
