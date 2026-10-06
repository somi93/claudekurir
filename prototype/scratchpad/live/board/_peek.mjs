import { createRequire } from "node:module";
const R = await import("./world.node.mjs"); globalThis.LVW = R;
const LV = createRequire(import.meta.url)("./logic.js");
const NOW = Date.parse("2026-10-06T12:20:00.000Z");
const W = R.buildLiveWorld({ now: new Date(NOW) }); W.clock = () => NOW;
const bal = R.serveLive(W, { pth: "/dispatcher/delivery-companies/24/couriers-balance" })[1].data;
const roster = R.buildRoster(W.couriers, { locations: W.locations(), balances: bal });
const act = R.serveLive(W, { pth: "/dispatcher/orders/active-deliveries" })[1].data.map(R.mapActiveDeliveryDto);
const cs = LV.decorate(roster, { now: NOW, active: act, cashLimit: 200 });
const zc = LV.zoneCounts(cs, W.zones);
for (const z of W.zones) { const r = zc.get(z.id); if (r) console.log(z.name, JSON.stringify(r)); }
console.log(cs.map((c) => `${c.id} ${c.name.padEnd(28)} ${c.live.padEnd(10)} ${c.sig.padEnd(5)} ${c.level.padEnd(5)} cash=${c.cash} ${c.suspended ? "SUSP" : ""}`).join("\n"));
