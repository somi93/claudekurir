// Izmišljeni, ali dosljedni FINANSIJSKI podaci za dispečerski ekran Finansije (oblici tačno kao u types/*.ts):
//   couriers-balance, cash-handovers/pending, cash-handovers (istorija, svi statusi), payouts (firma),
//   POST confirm / cash-receipt / payout.
// Determinističko (seed) pa su brojevi ponovljivi. NIJE provjereno nad pravim backendom:
//   - redoslijed istorije (ovdje: najnovije prvo), tekst automatske napomene o razlici, to da cash-receipt NE pravi red u istoriji.
// serveFinance je čista funkcija (bez Fetch-a): koriste je harness (presretač) i prototip table.
import { buildCouriers, IDS } from "./fx.mjs";

const mulberry = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, ".000000Z");
const r2 = (v) => Math.round(v * 100) / 100;
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const LIMIT = 200;
export const DISPATCHERS = [
  { id: 30369, name: "Test Dispečer" },
  { id: 30370, name: "Marija Ilić" },
];

// Stanje: brojevi su KM.
const FIXED = {
  0: { cash: 180.7, wage: 6 }, // IDS.main - brojevi iz dokumenta od 30.09 (90 % limita)
  1: { cash: 214.5, wage: 0 }, // preko limita
  2: { cash: 236.2, wage: 48 }, // preko limita, dugo ime
  3: { cash: 120, wage: 0 }, // suspendovan
  4: { cash: 0, wage: 86.4 },
  5: { cash: 64.3, wage: 120 }, // ćirilica
  6: { cash: 0, wage: 0 },
  7: { cash: -45.5, wage: 12 }, // firma duguje gotovinu
  8: { cash: 164, wage: 33.5 }, // blizu limita
  9: { cash: 12.4, wage: 0 },
};

export function buildFinanceWorld({ now = new Date(), n = 24, nHistory = 36, nPayouts = 22, seed = 31, couriers = null } = {}) {
  const r = mulberry(seed);
  const list = couriers ?? buildCouriers(n, { now });
  const balances = list.map((c, i) => {
    let cash = 0, wage = 0;
    if (FIXED[i]) ({ cash, wage } = FIXED[i]);
    else {
      const x = r();
      if (x < 0.34) cash = r2(5 + r() * 145);
      if (r() < 0.3) wage = r2(5 + r() * 105);
    }
    return { courier_id: c.courier_id, name: c.name, phone: c.phone, cash_owed_to_company: cash, wage_owed_to_courier: wage };
  });
  // "siroče": kurir kojeg nema u couriers-status (otpušten), ali ima otvoren dug
  balances.push({ courier_id: 29980, name: "Enis Čolić", phone: "065 777 123", cash_owed_to_company: 45.5, wage_owed_to_courier: 0 });
  // dispečerski nalog (couriers-balance vraća i njih, memorija couriers-status-includes-dispatchers)
  balances.push({ courier_id: 30369, name: "Test Dispečer", phone: null, cash_owed_to_company: 0, wage_owed_to_courier: 0 });

  const nameOf = (id) => balances.find((b) => b.courier_id === id)?.name ?? `Kurir #${id}`;
  const H = 3600_000, D = 24 * H;

  // Na čekanju (backend: najstarije prvo)
  const pendingSeed = [
    { courier_id: list[7].courier_id, reported: "70.00", ago: 3 * D + 2 * H },
    { courier_id: list[5].courier_id, reported: "50.00", ago: 1 * D + 3 * H },
    { courier_id: list[1].courier_id, reported: "214.50", ago: 2 * H + 40 * 60_000 },
    { courier_id: list[0].courier_id, reported: "95.24", ago: 12 * 60_000 },
  ];
  let hid = 900;
  const pendingRows = pendingSeed.map((p) => ({ id: hid++, courier_id: p.courier_id, reported_amount: p.reported, reported_at: iso(new Date(now.getTime() - p.ago)) }));

  // Istorija predaja: potvrđene kroz 30 dana + ova 4 na čekanju
  const eligible = list.filter((c) => !c.suspended).map((c) => c.courier_id);
  const history = [];
  for (let i = 0; i < nHistory; i++) {
    const cid = eligible[Math.floor(r() * eligible.length)];
    const ago = Math.floor((i + r() * 0.8) * (30 * D / nHistory)) + 5 * H;
    const reported = r2(20 + r() * 160);
    const differs = r() < 0.25;
    const confirmed = differs ? r2(reported - (1 + Math.floor(r() * 9))) : reported;
    const at = new Date(now.getTime() - ago);
    const by = DISPATCHERS[r() < 0.7 ? 0 : 1];
    history.push({
      id: 700 + i, courier_id: cid, reported_amount: reported.toFixed(2), confirmed_amount: confirmed.toFixed(2),
      reported_at: iso(at), confirmed_at: iso(new Date(at.getTime() + (10 + Math.floor(r() * 80)) * 60_000)), status: "confirmed",
      note: differs ? `Razlika: prijavljeno ${reported.toFixed(2)}, potvrđeno ${confirmed.toFixed(2)}` : null,
      confirmed_by: by.id, confirmed_by_name: by.name,
    });
  }
  // Stvarni slučaj iz dokumenta od 04.10: 97.79 -> 92.79
  history.unshift({
    id: 699, courier_id: list[0].courier_id, reported_amount: "97.79", confirmed_amount: "92.79",
    reported_at: iso(new Date(now.getTime() - 2 * D - 4 * H)), confirmed_at: iso(new Date(now.getTime() - 2 * D - 3 * H)), status: "confirmed",
    note: "Razlika: prijavljeno 97.79, potvrđeno 92.79", confirmed_by: 30369, confirmed_by_name: "Test Dispečer",
  });
  for (const p of pendingRows) history.push({ ...p, confirmed_amount: null, confirmed_at: null, status: "pending", note: null, confirmed_by: null, confirmed_by_name: null });
  history.sort((a, b) => b.reported_at.localeCompare(a.reported_at));

  // Isplate firme (zarade): novije prvo
  const payouts = [];
  for (let i = 0; i < nPayouts; i++) {
    const cid = eligible[Math.floor(r() * eligible.length)];
    const method = r() < 0.6 ? "gotovina" : "bankovni transfer";
    payouts.push({
      id: 40 + i, courier_id: cid, amount: r2(30 + r() * 150).toFixed(2), note: `Isplata kuriru (${method})`,
      created_at: iso(new Date(now.getTime() - Math.floor((i + r() * 0.8) * (30 * D / nPayouts)) - 3 * H)), transaction_id: uuid(40 + i),
    });
  }
  payouts.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return { balances, pendingRows, history, payouts, nameOf, nextId: 2000, nextPayout: 500, flags: {}, clock: null };
}

const asDay = (s) => s.slice(0, 10);

// Čista funkcija servera: vraća [status, tijelo] ili null (ruta nije finansijska).
export function serveFinance(F, { pth, method, body, q }) {
  const fl = F.flags;
  let m;
  const ok = (data) => [200, { success: true, data }];
  if ((m = pth.match(/^\/dispatcher\/delivery-companies\/(\d+)\/couriers-balance$/))) {
    const cid = Number(m[1]);
    if (cid !== 24) return ok(cid === 27 ? (F.balances27 ?? []) : []);
    const rows = fl.balanceStrings
      ? F.balances.map((b) => ({ ...b, cash_owed_to_company: b.cash_owed_to_company.toFixed(2), wage_owed_to_courier: b.wage_owed_to_courier.toFixed(2) }))
      : F.balances;
    return ok(rows);
  }
  if ((m = pth.match(/^\/dispatcher\/delivery-companies\/(\d+)\/cash-handovers\/pending$/))) {
    const cid = Number(m[1]);
    return ok(cid === 24 ? F.pendingRows : (F.pending27 ?? []));
  }
  if ((m = pth.match(/^\/dispatcher\/delivery-companies\/(\d+)\/cash-handovers$/))) {
    const cid = Number(m[1]);
    if (cid !== 24) return ok([]);
    let rows = F.history;
    if (q.get("courier_id")) rows = rows.filter((x) => x.courier_id === Number(q.get("courier_id")));
    if (q.get("status")) rows = rows.filter((x) => x.status === q.get("status"));
    if (q.get("from")) rows = rows.filter((x) => asDay(x.reported_at) >= q.get("from"));
    if (q.get("to")) rows = rows.filter((x) => asDay(x.reported_at) <= q.get("to"));
    return ok(rows);
  }
  if ((m = pth.match(/^\/dispatcher\/delivery-companies\/(\d+)\/payouts$/))) {
    const cid = Number(m[1]);
    if (cid !== 24) return ok([]);
    let rows = F.payouts;
    if (q.get("courier_id")) rows = rows.filter((x) => x.courier_id === Number(q.get("courier_id")));
    if (q.get("from")) rows = rows.filter((x) => asDay(x.created_at) >= q.get("from"));
    if (q.get("to")) rows = rows.filter((x) => asDay(x.created_at) <= q.get("to"));
    return ok(rows);
  }
  const stamp = () => (F.clock ? F.clock() : new Date()).toISOString().replace(/\.\d{3}Z$/, ".000000Z");
  if ((m = pth.match(/^\/dispatcher\/cash-handovers\/(\d+)\/confirm$/)) && method === "POST") {
    const pr = F.pendingRows.find((x) => x.id === Number(m[1]));
    if (!pr) return [422, { message: "Predaja je već potvrđena." }];
    if (!(Number(body?.confirmed_amount) > 0)) return [422, { message: "The given data was invalid.", errors: { confirmed_amount: ["Potvrđeni iznos je obavezan."] } }];
    const confirmed = r2(Number(body.confirmed_amount));
    const reported = Number(pr.reported_amount);
    const auto = Math.abs(confirmed - reported) > 0.001 ? `Razlika: prijavljeno ${reported.toFixed(2)}, potvrđeno ${confirmed.toFixed(2)}` : null;
    const row = F.history.find((x) => x.id === pr.id);
    Object.assign(row, { status: "confirmed", confirmed_amount: confirmed.toFixed(2), confirmed_at: stamp(), note: body.note || auto, confirmed_by: 30369, confirmed_by_name: "Test Dispečer" });
    F.pendingRows.splice(F.pendingRows.indexOf(pr), 1);
    const bal = F.balances.find((x) => x.courier_id === pr.courier_id);
    if (bal) bal.cash_owed_to_company = r2(bal.cash_owed_to_company - confirmed);
    return [200, { success: true, handover: { ...row, delivery_company_id: 24 } }];
  }
  if ((m = pth.match(/^\/dispatcher\/couriers\/(\d+)\/(cash-receipt|payout)$/)) && method === "POST") {
    const bal = F.balances.find((x) => x.courier_id === Number(m[1]));
    if (!bal) return [404, { message: "Kurir nikad nije bio povezan sa ovom firmom za dostavu." }];
    const amount = Number(body?.amount);
    if (!(amount > 0)) return [422, { message: "The given data was invalid.", errors: { amount: ["Iznos mora biti veći od 0."] } }];
    if (m[2] === "payout") {
      F.keys = F.keys ?? new Map();
      if (F.keys.has(body.idempotency_key)) return [200, { success: true, transaction_id: F.keys.get(body.idempotency_key) }];
      const tx = uuid(F.nextPayout++);
      F.keys.set(body.idempotency_key, tx);
      const warning = amount > bal.wage_owed_to_courier ? `Iznos (${amount.toFixed(2)}) je veći od zarade (${bal.wage_owed_to_courier.toFixed(2)}).` : undefined;
      bal.wage_owed_to_courier = r2(bal.wage_owed_to_courier - amount);
      F.payouts.unshift({ id: F.nextId++, courier_id: bal.courier_id, amount: amount.toFixed(2), note: body.note || `Isplata kuriru (${body.method})`, created_at: stamp(), transaction_id: tx });
      return [200, { success: true, transaction_id: tx, ...(warning ? { warning } : {}) }];
    }
    const warning = amount > bal.cash_owed_to_company ? `Iznos (${amount.toFixed(2)}) je veći od duga (${bal.cash_owed_to_company.toFixed(2)}).` : undefined;
    bal.cash_owed_to_company = r2(bal.cash_owed_to_company - amount);
    return [200, { success: true, transaction_id: uuid(F.nextPayout++), ...(warning ? { warning } : {}) }];
  }
  return null;
}

// Presretač harnessa: vraća true ako je zahtjev obrađen.
export async function handleFinance(mode, { pth, method, body, u, fulfill }) {
  const F = mode.fin;
  if (!F) return false;
  const r = serveFinance(F, { pth, method, body, q: u.searchParams });
  if (!r) return false;
  await fulfill(r[0], r[1]);
  return true;
}

export { IDS };
