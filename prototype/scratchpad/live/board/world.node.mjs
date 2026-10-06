// C:/Users/groba/AppData/Local/Temp/claude/h--projects-bosna-dostavljaci-front/4ea1624d-bf71-4911-81ea-7c24b1de4c14/scratchpad/live/e2e/fx.mjs
var mulberry = (a) => () => {
  a |= 0;
  a = a + 1831565813 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
var FIRST = ["Amir", "Emir", "Haris", "Adnan", "Mirza", "Kenan", "Tarik", "Damir", "Nermin", "Dino", "Jasmin", "Senad", "Edin", "Alen", "Sead", "Armin", "Ismar", "Elvir", "Samir", "Vedran", "Marko", "Nikola", "Milan", "Dejan", "Goran", "Zoran", "Bojan", "Nemanja", "Stefan", "Luka", "Ivan", "Darko", "Slaven", "\u017Deljko", "\u0110or\u0111e", "\u010Cedomir", "\u0160aban", "\u0106amil", "Lazar", "Boris"];
var LAST = ["Hod\u017Ei\u0107", "Kova\u010Devi\u0107", "Markovi\u0107", "Deli\u0107", "Muji\u0107", "Babi\u0107", "Jovanovi\u0107", "Petrovi\u0107", "Salihovi\u0107", "Begi\u0107", "\u0106osi\u0107", "\u0110uri\u0107", "Nikoli\u0107", "Simi\u0107", "Tomi\u0107", "Luki\u0107", "Zec", "Vukovi\u0107", "Kurtovi\u0107", "Had\u017Ei\u0107", "Softi\u0107", "D\u017Eaferovi\u0107", "Radi\u0107", "Stani\u0107", "Mrkonji\u0107", "Peji\u0107", "Ili\u0107", "Baji\u0107", "\u010Cengi\u0107", "\u0160ehi\u0107"];
var CYR = { a: "\u0430", b: "\u0431", v: "\u0432", g: "\u0433", d: "\u0434", \u0111: "\u0452", e: "\u0435", \u017E: "\u0436", z: "\u0437", i: "\u0438", j: "\u0458", k: "\u043A", l: "\u043B", m: "\u043C", n: "\u043D", o: "\u043E", p: "\u043F", r: "\u0440", s: "\u0441", t: "\u0442", \u0107: "\u045B", u: "\u0443", f: "\u0444", h: "\u0445", c: "\u0446", \u010D: "\u0447", \u0161: "\u0448" };
var toCyr = (s) => {
  let out = "";
  const low = s.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    const two = low.slice(i, i + 2);
    const upper = s[i] !== low[i];
    let c;
    if (two === "lj") {
      c = "\u0459";
      i++;
    } else if (two === "nj") {
      c = "\u045A";
      i++;
    } else if (two === "d\u017E") {
      c = "\u045F";
      i++;
    } else c = CYR[low[i]] ?? s[i];
    out += upper ? c.toUpperCase() : c;
  }
  return out;
};
var ascii = (s) => s.toLowerCase().replace(/đ/g, "dj").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
var iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, ".000000Z");
var day = (d) => d.toISOString().slice(0, 10);
var REASONS = ["Dug gotovine", "Nije se javio na smjenu", "Kvar vozila", "Na zahtjev kurira", "\u010Ceka dokumenta"];
var LONG_REASON = "Kurir nije predao gotovinu 6 dana uprkos tri poziva i dvije poruke; dogovor sa vlasnikom firme da se suspenduje do predaje cjelokupnog iznosa i dolaska u poslovnicu sa voza\u010Dkom dozvolom.";
var IDS = { main: 30189, scooter: 30192, longName: 30195, suspendedLong: 30198, noPhone: 30201, cyr: 30204, noVehicle: 30207, oldRow: 30210 };
function buildCouriers(n = 24, { now = /* @__PURE__ */ new Date(), seed = 7 } = {}) {
  const r = mulberry(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const out = [];
  const used = /* @__PURE__ */ new Set();
  const VEH = ["motorbike", "motorbike", "motorbike", "car", "car", "bicycle", "bicycle", "scooter", null];
  const phone = (i) => {
    const a = 60 + Math.floor(r() * 7);
    const b = 100 + Math.floor(r() * 899);
    const c = 100 + Math.floor(r() * 899);
    return [`0${a}/${b}-${c}`, `+387 ${a} ${b} ${c}`, `0${a}${b}${c}`, `0${a} ${b} ${c}`][i % 4];
  };
  for (let i = 0; i < n; i++) {
    let first = pick(FIRST), last = pick(LAST);
    while (used.has(first + last)) {
      first = pick(FIRST);
      last = pick(LAST);
    }
    if (i === 0) {
      first = "Amir";
      last = "Hod\u017Ei\u0107";
    }
    if (i === 8) {
      first = "\u017Deljko";
      last = "\u0110uri\u0107";
    }
    if (i === 9) {
      first = "\u0416\u0435\u0459\u043A\u043E";
      last = "\u041C\u0430\u0440\u043A\u043E\u0432\u0438\u045B";
    }
    used.add(first + last);
    const id = i < 8 ? [IDS.main, IDS.scooter, IDS.longName, IDS.suspendedLong, IDS.noPhone, IDS.cyr, IDS.noVehicle, IDS.oldRow][i] : 30210 + i * 3 + Math.floor(r() * 3);
    const cyr = i === 5 || i !== 8 && i !== 9 && r() < 0.1;
    let name = `${first} ${last}`;
    let fn = first, ln = last;
    if (i === 2) {
      fn = "Aleksandar-Nemanja";
      ln = "Petrovi\u0107-Njego\u0161 Jovanovi\u0107 Mrkonji\u0107";
      name = `${fn} ${ln}`;
    }
    if (cyr) {
      fn = toCyr(fn);
      ln = toCyr(ln);
      name = `${fn} ${ln}`;
    }
    const vtype = i === 1 ? "scooter" : i === 6 ? null : i === 0 ? "motorbike" : pick(VEH);
    const suspended = i === 3 || i > 7 && r() < 0.13;
    const created = new Date(now.getTime() - (20 + Math.floor(r() * 380)) * 864e5);
    const hasDetail = i === 0 || r() < 0.55;
    const hasPay = i === 0 || r() < 0.45;
    const ptype = [1, 2, 3][Math.floor(r() * 3)];
    const row = {
      courier_id: id,
      name,
      first_name: fn,
      last_name: ln,
      phone: i === 4 ? null : i === 8 ? "065/123-456" : i === 9 ? "+387 66 777 888" : phone(i),
      email: i === 4 ? null : `${ascii(first) || "kurir" + i}.${ascii(last) || "ordera"}@ordera`,
      suspended,
      suspended_reason: suspended ? i === 3 ? LONG_REASON : r() < 0.7 ? pick(REASONS) : null : null,
      suspended_at: suspended ? iso(new Date(now.getTime() - (1 + Math.floor(r() * 20)) * 864e5)) : null,
      vehicle: vtype ? { id: 9e3 + i, type: vtype } : null,
      contact_phone: null,
      bank_account: i === 0 || r() < 0.3 ? `161-${1e9 + Math.floor(r() * 8999999999)}-${10 + Math.floor(r() * 89)}` : null,
      note: i === 0 ? "Radi prete\u017Eno u centru i na Star\u010Devici." : r() < 0.12 ? "Student, radi vikendom." : null,
      paying_type: hasPay ? ptype : null,
      paying: hasPay ? ptype === 2 ? "20.00" : ptype === 1 ? "900.00" : "2.00" : null,
      contract_signed_at: hasPay ? day(new Date(created.getTime() + 2 * 864e5)) : null,
      contract_active_from: hasPay ? day(new Date(created.getTime() + 9 * 864e5)) : null,
      image_path: null,
      created_at: iso(created),
      detail: hasDetail ? {
        date_of_birth: `${1984 + Math.floor(r() * 20)}-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`,
        iban: r() < 0.7 ? `BA39 1990 4401 ${String(1e3 + Math.floor(r() * 8999))} ${String(1e3 + Math.floor(r() * 8999))}` : null,
        emergency_contact_name: r() < 0.7 ? `${pick(FIRST)} ${last}` : null,
        emergency_contact_phone: r() < 0.7 ? phone(i + 1) : null,
        referral_url: null,
        referral_short_url: null,
        referred_by: r() < 0.15 ? 30189 : null
      } : null
    };
    if (i === 0) {
      row.detail = { date_of_birth: "1996-03-14", iban: "BA39 1990 4401 2345 6789", emergency_contact_name: "Selma Hod\u017Ei\u0107", emergency_contact_phone: "066 111 222", referral_url: null, referral_short_url: null, referred_by: null };
      row.paying_type = 3;
      row.paying = "2.00";
      row.contract_signed_at = "2026-08-02";
      row.contract_active_from = "2026-08-09";
    }
    if (i === 7) {
      delete row.first_name;
      delete row.last_name;
      delete row.email;
      delete row.detail;
      delete row.paying_type;
      delete row.paying;
      delete row.contract_signed_at;
      delete row.contract_active_from;
      delete row.image_path;
      delete row.created_at;
    }
    out.push(row);
  }
  return out;
}
var COMPANIES = [
  { id: 24, name: "Ordera Dostava Banja Luka", city_id: 1, city_name: "Banja Luka", currency: "KM" },
  { id: 27, name: "Glovo BL", city_id: 1, city_name: "Banja Luka", currency: "KM" }
];
var FINANCE = {
  delivery_company_id: 24,
  commission_percentage: 12,
  commission_percentage_editable: false,
  cash_limit_amount: 150,
  cash_limit_enforcement: "NOTIFY_ONLY",
  payout_period_days: 7,
  currency: "KM",
  available_currencies: ["KM", "BAM", "EUR", "RSD"],
  daily_handover_time: null,
  assignment_mode: "ALL",
  assignment_courier_count: null,
  assignment_timeout_action: "NEXT_NEAREST",
  assignment_courier_pool: "ALL_ACTIVE",
  offer_timeout_seconds: 30,
  show_price_breakdown: true
};

// C:/Users/groba/AppData/Local/Temp/claude/h--projects-bosna-dostavljaci-front/4ea1624d-bf71-4911-81ea-7c24b1de4c14/scratchpad/live/e2e/fin-fx.mjs
var mulberry2 = (a) => () => {
  a |= 0;
  a = a + 1831565813 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
var iso2 = (d) => d.toISOString().replace(/\.\d{3}Z$/, ".000000Z");
var r2 = (v) => Math.round(v * 100) / 100;
var uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
var DISPATCHERS = [
  { id: 30369, name: "Test Dispe\u010Der" },
  { id: 30370, name: "Marija Ili\u0107" }
];
var FIXED = {
  0: { cash: 180.7, wage: 6 },
  // IDS.main - brojevi iz dokumenta od 30.09 (90 % limita)
  1: { cash: 214.5, wage: 0 },
  // preko limita
  2: { cash: 236.2, wage: 48 },
  // preko limita, dugo ime
  3: { cash: 120, wage: 0 },
  // suspendovan
  4: { cash: 0, wage: 86.4 },
  5: { cash: 64.3, wage: 120 },
  // ćirilica
  6: { cash: 0, wage: 0 },
  7: { cash: -45.5, wage: 12 },
  // firma duguje gotovinu
  8: { cash: 164, wage: 33.5 },
  // blizu limita
  9: { cash: 12.4, wage: 0 }
};
function buildFinanceWorld({ now = /* @__PURE__ */ new Date(), n = 24, nHistory = 36, nPayouts = 22, seed = 31, couriers = null } = {}) {
  const r = mulberry2(seed);
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
  balances.push({ courier_id: 29980, name: "Enis \u010Coli\u0107", phone: "065 777 123", cash_owed_to_company: 45.5, wage_owed_to_courier: 0 });
  balances.push({ courier_id: 30369, name: "Test Dispe\u010Der", phone: null, cash_owed_to_company: 0, wage_owed_to_courier: 0 });
  const nameOf = (id) => balances.find((b) => b.courier_id === id)?.name ?? `Kurir #${id}`;
  const H2 = 36e5, D2 = 24 * H2;
  const pendingSeed = [
    { courier_id: list[7].courier_id, reported: "70.00", ago: 3 * D2 + 2 * H2 },
    { courier_id: list[5].courier_id, reported: "50.00", ago: 1 * D2 + 3 * H2 },
    { courier_id: list[1].courier_id, reported: "214.50", ago: 2 * H2 + 40 * 6e4 },
    { courier_id: list[0].courier_id, reported: "95.24", ago: 12 * 6e4 }
  ];
  let hid = 900;
  const pendingRows = pendingSeed.map((p) => ({ id: hid++, courier_id: p.courier_id, reported_amount: p.reported, reported_at: iso2(new Date(now.getTime() - p.ago)) }));
  const eligible = list.filter((c) => !c.suspended).map((c) => c.courier_id);
  const history = [];
  for (let i = 0; i < nHistory; i++) {
    const cid = eligible[Math.floor(r() * eligible.length)];
    const ago = Math.floor((i + r() * 0.8) * (30 * D2 / nHistory)) + 5 * H2;
    const reported = r2(20 + r() * 160);
    const differs = r() < 0.25;
    const confirmed = differs ? r2(reported - (1 + Math.floor(r() * 9))) : reported;
    const at = new Date(now.getTime() - ago);
    const by = DISPATCHERS[r() < 0.7 ? 0 : 1];
    history.push({
      id: 700 + i,
      courier_id: cid,
      reported_amount: reported.toFixed(2),
      confirmed_amount: confirmed.toFixed(2),
      reported_at: iso2(at),
      confirmed_at: iso2(new Date(at.getTime() + (10 + Math.floor(r() * 80)) * 6e4)),
      status: "confirmed",
      note: differs ? `Razlika: prijavljeno ${reported.toFixed(2)}, potvr\u0111eno ${confirmed.toFixed(2)}` : null,
      confirmed_by: by.id,
      confirmed_by_name: by.name
    });
  }
  history.unshift({
    id: 699,
    courier_id: list[0].courier_id,
    reported_amount: "97.79",
    confirmed_amount: "92.79",
    reported_at: iso2(new Date(now.getTime() - 2 * D2 - 4 * H2)),
    confirmed_at: iso2(new Date(now.getTime() - 2 * D2 - 3 * H2)),
    status: "confirmed",
    note: "Razlika: prijavljeno 97.79, potvr\u0111eno 92.79",
    confirmed_by: 30369,
    confirmed_by_name: "Test Dispe\u010Der"
  });
  for (const p of pendingRows) history.push({ ...p, confirmed_amount: null, confirmed_at: null, status: "pending", note: null, confirmed_by: null, confirmed_by_name: null });
  history.sort((a, b) => b.reported_at.localeCompare(a.reported_at));
  const payouts = [];
  for (let i = 0; i < nPayouts; i++) {
    const cid = eligible[Math.floor(r() * eligible.length)];
    const method = r() < 0.6 ? "gotovina" : "bankovni transfer";
    payouts.push({
      id: 40 + i,
      courier_id: cid,
      amount: r2(30 + r() * 150).toFixed(2),
      note: `Isplata kuriru (${method})`,
      created_at: iso2(new Date(now.getTime() - Math.floor((i + r() * 0.8) * (30 * D2 / nPayouts)) - 3 * H2)),
      transaction_id: uuid(40 + i)
    });
  }
  payouts.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { balances, pendingRows, history, payouts, nameOf, nextId: 2e3, nextPayout: 500, flags: {}, clock: null };
}
var asDay = (s) => s.slice(0, 10);
function serveFinance(F, { pth, method, body, q }) {
  const fl = F.flags;
  let m;
  const ok = (data) => [200, { success: true, data }];
  if (m = pth.match(/^\/dispatcher\/delivery-companies\/(\d+)\/couriers-balance$/)) {
    const cid = Number(m[1]);
    if (cid !== 24) return ok(cid === 27 ? F.balances27 ?? [] : []);
    const rows = fl.balanceStrings ? F.balances.map((b) => ({ ...b, cash_owed_to_company: b.cash_owed_to_company.toFixed(2), wage_owed_to_courier: b.wage_owed_to_courier.toFixed(2) })) : F.balances;
    return ok(rows);
  }
  if (m = pth.match(/^\/dispatcher\/delivery-companies\/(\d+)\/cash-handovers\/pending$/)) {
    const cid = Number(m[1]);
    return ok(cid === 24 ? F.pendingRows : F.pending27 ?? []);
  }
  if (m = pth.match(/^\/dispatcher\/delivery-companies\/(\d+)\/cash-handovers$/)) {
    const cid = Number(m[1]);
    if (cid !== 24) return ok([]);
    let rows = F.history;
    if (q.get("courier_id")) rows = rows.filter((x) => x.courier_id === Number(q.get("courier_id")));
    if (q.get("status")) rows = rows.filter((x) => x.status === q.get("status"));
    if (q.get("from")) rows = rows.filter((x) => asDay(x.reported_at) >= q.get("from"));
    if (q.get("to")) rows = rows.filter((x) => asDay(x.reported_at) <= q.get("to"));
    return ok(rows);
  }
  if (m = pth.match(/^\/dispatcher\/delivery-companies\/(\d+)\/payouts$/)) {
    const cid = Number(m[1]);
    if (cid !== 24) return ok([]);
    let rows = F.payouts;
    if (q.get("courier_id")) rows = rows.filter((x) => x.courier_id === Number(q.get("courier_id")));
    if (q.get("from")) rows = rows.filter((x) => asDay(x.created_at) >= q.get("from"));
    if (q.get("to")) rows = rows.filter((x) => asDay(x.created_at) <= q.get("to"));
    return ok(rows);
  }
  const stamp = () => (F.clock ? F.clock() : /* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, ".000000Z");
  if ((m = pth.match(/^\/dispatcher\/cash-handovers\/(\d+)\/confirm$/)) && method === "POST") {
    const pr = F.pendingRows.find((x) => x.id === Number(m[1]));
    if (!pr) return [422, { message: "Predaja je ve\u0107 potvr\u0111ena." }];
    if (!(Number(body?.confirmed_amount) > 0)) return [422, { message: "The given data was invalid.", errors: { confirmed_amount: ["Potvr\u0111eni iznos je obavezan."] } }];
    const confirmed = r2(Number(body.confirmed_amount));
    const reported = Number(pr.reported_amount);
    const auto = Math.abs(confirmed - reported) > 1e-3 ? `Razlika: prijavljeno ${reported.toFixed(2)}, potvr\u0111eno ${confirmed.toFixed(2)}` : null;
    const row = F.history.find((x) => x.id === pr.id);
    Object.assign(row, { status: "confirmed", confirmed_amount: confirmed.toFixed(2), confirmed_at: stamp(), note: body.note || auto, confirmed_by: 30369, confirmed_by_name: "Test Dispe\u010Der" });
    F.pendingRows.splice(F.pendingRows.indexOf(pr), 1);
    const bal = F.balances.find((x) => x.courier_id === pr.courier_id);
    if (bal) bal.cash_owed_to_company = r2(bal.cash_owed_to_company - confirmed);
    return [200, { success: true, handover: { ...row, delivery_company_id: 24 } }];
  }
  if ((m = pth.match(/^\/dispatcher\/couriers\/(\d+)\/(cash-receipt|payout)$/)) && method === "POST") {
    const bal = F.balances.find((x) => x.courier_id === Number(m[1]));
    if (!bal) return [404, { message: "Kurir nikad nije bio povezan sa ovom firmom za dostavu." }];
    const amount = Number(body?.amount);
    if (!(amount > 0)) return [422, { message: "The given data was invalid.", errors: { amount: ["Iznos mora biti ve\u0107i od 0."] } }];
    if (m[2] === "payout") {
      F.keys = F.keys ?? /* @__PURE__ */ new Map();
      if (F.keys.has(body.idempotency_key)) return [200, { success: true, transaction_id: F.keys.get(body.idempotency_key) }];
      const tx = uuid(F.nextPayout++);
      F.keys.set(body.idempotency_key, tx);
      const warning2 = amount > bal.wage_owed_to_courier ? `Iznos (${amount.toFixed(2)}) je ve\u0107i od zarade (${bal.wage_owed_to_courier.toFixed(2)}).` : void 0;
      bal.wage_owed_to_courier = r2(bal.wage_owed_to_courier - amount);
      F.payouts.unshift({ id: F.nextId++, courier_id: bal.courier_id, amount: amount.toFixed(2), note: body.note || `Isplata kuriru (${body.method})`, created_at: stamp(), transaction_id: tx });
      return [200, { success: true, transaction_id: tx, ...warning2 ? { warning: warning2 } : {} }];
    }
    const warning = amount > bal.cash_owed_to_company ? `Iznos (${amount.toFixed(2)}) je ve\u0107i od duga (${bal.cash_owed_to_company.toFixed(2)}).` : void 0;
    bal.cash_owed_to_company = r2(bal.cash_owed_to_company - amount);
    return [200, { success: true, transaction_id: uuid(F.nextPayout++), ...warning ? { warning } : {} }];
  }
  return null;
}

// C:/Users/groba/AppData/Local/Temp/claude/h--projects-bosna-dostavljaci-front/4ea1624d-bf71-4911-81ea-7c24b1de4c14/scratchpad/live/e2e/world.mjs
var mulberry3 = (a) => () => {
  a |= 0;
  a = a + 1831565813 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
var isoUtc = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, ".000000Z");
var isoOff = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "+00:00");
var CENTER = { lat: 44.7722, lng: 17.191 };
var M_LAT = 111320;
var mLng = (lat) => 111320 * Math.cos(lat * Math.PI / 180);
var offsetM = (lat, lng, dx, dy) => ({ lat: lat + dy / M_LAT, lng: lng + dx / mLng(lat) });
var ZONES = [
  { id: 11, city_id: 1, name: "Centar", terrain_factor: 1, center_lat: 44.7722, center_lng: 17.191, radius_meters: 1700 },
  { id: 12, city_id: 1, name: "Borik", terrain_factor: 1.5, center_lat: 44.786, center_lng: 17.209, radius_meters: 1500 },
  { id: 13, city_id: 1, name: "Star\u010Devica", terrain_factor: 1.5, center_lat: 44.7975, center_lng: 17.233, radius_meters: 1600 },
  { id: 14, city_id: 1, name: "Lau\u0161", terrain_factor: 1, center_lat: 44.758, center_lng: 17.174, radius_meters: 1400 },
  { id: 15, city_id: 1, name: "Petri\u0107evac", terrain_factor: 1.5, center_lat: 44.764, center_lng: 17.229, radius_meters: 1500 },
  { id: 16, city_id: 1, name: "Obili\u0107evo", terrain_factor: 1, center_lat: 44.748, center_lng: 17.193, radius_meters: 1300 },
  { id: 17, city_id: 1, name: "Zalu\u017Eani", terrain_factor: 2, center_lat: null, center_lng: null, radius_meters: null }
];
var zoneBy = (name) => ZONES.find((z) => z.name === name);
var S = (state, ago, zone, dx, dy, speed = 0, fresh = false, status = null) => ({ state, ago, zone, dx, dy, speed, fresh, status: status ?? state });
var MIN = 6e4;
var H = 36e5;
var D = 24 * H;
var SCRIPT = [
  /* 0 */
  S("delivering", 8e3, "Centar", 300, 200, 6.1, true),
  /* 1 */
  S("online", 2e4, "Centar", -500, -300, 0, true),
  /* 2 */
  S("delivering", 12e3, "Borik", 200, -100, 4.2, true),
  /* 3 */
  S("offline", 5 * H, "Petri\u0107evac", 100, 100, 0, false),
  /* 4 */
  null,
  /* 5 */
  S("online", 35e3, "Lau\u0161", 100, 150, 0, true),
  /* 6 */
  null,
  /* 7 */
  S("offline", 25 * MIN, "Centar", 900, -600, 0, false),
  /* 8 */
  S("delivering", 14 * MIN, "Star\u010Devica", -300, 100, 5, false),
  // u dostavi, signal izgubljen
  /* 9 */
  S("online", 2 * H, "Borik", -600, 400, 0, false),
  // "slobodan", a nije se javio 2 h
  /* 10 */
  S("delivering", 6e3, "Petri\u0107evac", 200, 100, 7.3, true),
  /* 11 */
  S("delivering", 3e4, "Centar", -200, 700, 3.8, true),
  /* 12 */
  S("online", 5e4, "Obili\u0107evo", 50, 50, 0, true),
  /* 13 */
  S("online", 15e3, "Centar", 600, 500, 0, true, "idle"),
  /* 14 */
  S("online", 7e4, "Borik", 900, 700, 0, true),
  /* 15 */
  S("online", 6 * H, "Lau\u0161", -400, -200, 0, false),
  // "slobodan", a nije se javio 6 h
  /* 16 */
  S("delivering", 25e3, "Star\u010Devica", 500, -300, 2.9, true),
  /* 17 */
  S("offline", 41 * MIN, "Centar", -900, 100, 0, false),
  /* 18 */
  S("offline", 12 * MIN, "Petri\u0107evac", -300, -400, 0, false),
  /* 19 */
  S("offline", 55 * MIN, "Lau\u0161", 700, -300, 0, false),
  /* 20 */
  S("offline", 3 * H, "Obili\u0107evo", -200, 300, 0, false),
  /* 21 */
  S("offline", 9 * H, "Star\u010Devica", 300, 300, 0, false),
  /* 22 */
  S("offline", 26 * H, "Centar", -1200, -200, 0, false),
  /* 23 */
  S("offline", 3 * D, "Borik", 400, -400, 0, false),
  /* 24 */
  null,
  /* 25 */
  S("online", 4e4, "Centar", 100, -700, 0, true)
];
var RESTAURANTS = [
  ["Pizzeria Roma", "Gospodska 14", "051/311-100"],
  ["Burger Hub", "Veselina Masle\u0161e 9", "051/311-222"],
  ["Sushi Bar Ume", "Kralja Alfonsa XIII 21", "051/229-340"],
  ["\u0106evabd\u017Einica Mujo", "M\xE4kel\xE4 3", "051/216-877"],
  ["Bistro Vrbas", "Kej Vrbasa 2", "051/300-415"],
  ["Wok & Roll", "Jevrejska 11", "051/463-902"],
  ["Pekara Zlatno klasje", "Cara Du\u0161ana 33", "051/321-045"],
  ["Trattoria Lido", "Aleja Svetog Save 40", "051/430-218"],
  ["Kebab Istanbul", "Srpska 77", "051/222-190"],
  ["Piletarija Kod Ne\u0161e", "Ive Andri\u0107a 6", "066/501-778"]
];
var ADDR = [
  ["Kralja Petra I Kara\u0111or\u0111evi\u0107a 85", "Centar", 150, 420],
  ["Aleja Svetog Save 12", "Centar", -380, 90],
  ["Vojvode Stepe Stepanovi\u0107a 43", "Borik", 120, 220],
  ["Bulevar cara Du\u0161ana 22", "Centar", 520, -260],
  ["Gunduli\u0107eva 7", "Lau\u0161", -90, -140],
  ["Jevrejska 18", "Centar", -140, 330],
  ["Veljka Mla\u0111enovi\u0107a 14", "Borik", -340, -120],
  ["Cara Lazara 31", "Petri\u0107evac", 210, -190],
  ["Bulevar vojvode \u017Divojina Mi\u0161i\u0107a 9", "Star\u010Devica", 160, 260],
  ["Ivana Franje Juki\u0107a 5", "Centar", 40, -520],
  ["Mije \u010Corkovi\u0107a 1", "Obili\u0107evo", -120, 120],
  ["Srpska 40", "Centar", 260, 140]
];
var loc = (i, id) => {
  const [address, zn, dx, dy] = ADDR[i % ADDR.length];
  const z = zoneBy(zn);
  const p = offsetM(z.center_lat, z.center_lng, dx, dy);
  return { id, address, apartment: i % 3 === 0 ? String(10 + i) : null, floor: i % 3 === 0 ? String(1 + i % 5) : null, firm: null, zip: "78000", coordination: { lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) } };
};
function buildLiveWorld({ now = /* @__PURE__ */ new Date(), n = 26, seed = 7 } = {}) {
  const t0 = now.getTime();
  const couriers = buildCouriers(n, { now, seed });
  couriers.forEach((c, i) => {
    const s = i === 3 || i === 20;
    c.suspended = s;
    c.suspended_reason = s ? i === 3 ? "Dug gotovine" : "Nije se javio na smjenu" : null;
    c.suspended_at = s ? isoUtc(t0 - (2 + i) * D) : null;
  });
  couriers[1].vehicle = { id: 9001, type: "scooter" };
  const F = buildFinanceWorld({ now, couriers, n });
  const fixed = [];
  const rnd = mulberry3(seed + 3);
  const geo = ZONES.filter((z) => z.center_lat != null);
  const genScript = (i) => {
    const x = rnd();
    const z = geo[Math.floor(rnd() * geo.length)].name;
    const dx = Math.round((rnd() - 0.5) * 3e3), dy = Math.round((rnd() - 0.5) * 3e3);
    if (x < 0.1) return null;
    if (x < 0.25) return S("delivering", 5e3 + Math.floor(rnd() * 5e4), z, dx, dy, 2 + rnd() * 6, true);
    if (x < 0.45) return S("online", 5e3 + Math.floor(rnd() * 6e4), z, dx, dy, 0, true);
    if (x < 0.52) return S("online", 3 * H + Math.floor(rnd() * 5 * H), z, dx, dy, 0, false);
    if (x < 0.78) return S("offline", (10 + Math.floor(rnd() * 50)) * MIN, z, dx, dy, 0, false);
    return S("offline", (3 + Math.floor(rnd() * 60)) * H, z, dx, dy, 0, false);
  };
  couriers.forEach((c, i) => {
    const sc = i < SCRIPT.length ? SCRIPT[i] : genScript(i);
    if (!sc) return;
    const z = zoneBy(sc.zone);
    const p = offsetM(z.center_lat, z.center_lng, sc.dx, sc.dy);
    fixed.push({ c, i, sc, lat: p.lat, lng: p.lng, heading: i * 47 % 360, rnd: rnd(), at: t0 - sc.ago });
  });
  const locations = () => fixed.map((f) => ({
    courier_id: f.c.courier_id,
    name: f.c.name,
    phone: f.c.phone,
    suspended: f.c.suspended,
    vehicle: f.c.vehicle,
    location: {
      latitude: +f.lat.toFixed(6),
      longitude: +f.lng.toFixed(6),
      heading: f.sc.state === "offline" || f.sc.speed === 0 ? f.i % 5 === 0 ? null : f.heading : f.heading,
      // server šalje null kad uređaj nije javio brzinu; ovdje i jedan kurir u dostavi
      speed: f.sc.fresh ? f.i === 11 ? null : f.sc.speed : f.sc.state === "delivering" ? f.sc.speed : f.sc.state === "online" ? 0 : null,
      status: f.sc.status === "idle" ? "idle" : f.sc.state,
      updated_at: isoOff(f.sc.fresh ? W.clock() - f.sc.ago : f.at)
    }
  }));
  const mk = (id, name, extra) => ({ id, restaurant_name: name, ...extra });
  const T = (min) => isoUtc(t0 - min * MIN);
  const U = (min) => isoUtc(t0 + min * MIN);
  const waiting = [
    mk(4277, "Pizzeria Roma", { ordered_at: T(31), delivery_time: U(-3), waiting_minutes: 26, minutes_until_delivery: -3, status: "ready", ready_in_minutes: 0, ready_at: T(8), delivery_price: 3.5, location: loc(0, 7001), delivery_zone: "Centar", distance_km: 2.3 }),
    mk(4278, "Trattoria Lido", { ordered_at: T(24), delivery_time: U(14), waiting_minutes: 18, minutes_until_delivery: 14, status: "accepted", ready_in_minutes: 6, ready_at: U(6), delivery_price: 4, location: loc(4, 7002), delivery_zone: "Lau\u0161", distance_km: 3.1 }),
    mk(4279, "Kebab Istanbul", { ordered_at: T(9), delivery_time: U(31), waiting_minutes: 6, minutes_until_delivery: 31, status: "accepted", ready_in_minutes: 12, ready_at: U(12), delivery_price: 3.5, location: loc(2, 7003), delivery_zone: "Borik", distance_km: 1.8 }),
    mk(4280, "Pekara Zlatno klasje", { ordered_at: T(4), delivery_time: U(40), waiting_minutes: 2, minutes_until_delivery: 40, status: "ready", ready_in_minutes: 0, ready_at: T(1), delivery_price: 3, location: loc(3, 7004), delivery_zone: "Centar", distance_km: 1.2 }),
    mk(4281, "Piletarija Kod Ne\u0161e", { ordered_at: T(120), delivery_time: U(370), waiting_minutes: 120, minutes_until_delivery: 370, status: "accepted", ready_in_minutes: 355, ready_at: U(355), delivery_price: 4.5, location: loc(7, 7005), delivery_zone: "Petri\u0107evac", distance_km: 4.2 })
  ];
  const cour = (i) => ({ id: couriers[i].courier_id, name: couriers[i].name, phone: couriers[i].phone, vehicle: couriers[i].vehicle?.type ?? "foot" });
  const active = [
    mk(4269, "Pizzeria Roma", { ordered_at: T(34), delivery_time: U(9), minutes_until_delivery: 9, status: "picked_up", delivery_price: 3.5, courier: cour(0), location: loc(1, 7011) }),
    mk(4271, "Burger Hub", { ordered_at: T(15), delivery_time: U(22), minutes_until_delivery: 22, status: "booked", delivery_price: 3.5, courier: cour(2), location: loc(6, 7012) }),
    mk(4262, "Sushi Bar Ume", { ordered_at: T(58), delivery_time: U(-11), minutes_until_delivery: -11, status: "picked_up", delivery_price: 4.5, courier: cour(8), location: loc(8, 7013) }),
    mk(4274, "Wok & Roll", { ordered_at: T(28), delivery_time: U(15), minutes_until_delivery: 15, status: "picked_up", delivery_price: 3.5, courier: cour(10), location: loc(7, 7014) }),
    mk(4276, "Kebab Istanbul", { ordered_at: T(10), delivery_time: U(27), minutes_until_delivery: 27, status: "booked", delivery_price: 3.5, courier: cour(11), location: loc(5, 7015) }),
    mk(4265, "Trattoria Lido", { ordered_at: T(49), delivery_time: U(-6), minutes_until_delivery: -6, status: "picked_up", delivery_price: 4, courier: cour(16), location: loc(10, 7016) })
  ];
  const pending = [
    { id: 4282, restaurant_name: "Burger Hub", restaurant_phone: "051/311-222", delivery_type: 0, ordered_at: T(3), waiting_minutes: 3, delivery_time: U(45), delivery_price: 3.5, location: loc(9, 7021) },
    { id: 4283, restaurant_name: "Wok & Roll", restaurant_phone: "051/463-902", delivery_type: 0, ordered_at: T(9), waiting_minutes: 9, delivery_time: U(40), delivery_price: 3.5, location: loc(1, 7022) },
    { id: 4284, restaurant_name: "\u0106evabd\u017Einica Mujo", restaurant_phone: "051/216-877", delivery_type: 0, ordered_at: T(22), waiting_minutes: 22, delivery_time: U(25), delivery_price: 4, location: loc(11, 7023) },
    { id: 4150, restaurant_name: "Bistro Vrbas", restaurant_phone: "051/300-415", delivery_type: 0, ordered_at: T(310), waiting_minutes: 310, delivery_time: T(280), delivery_price: 3.5, location: null }
  ];
  const refused = [{ id: 4255, restaurant_name: "\u0106evabd\u017Einica Mujo", delivery_time: T(95), delivery_price: 4, courier_name: couriers[0].name, location: loc(3, 7031) }];
  const W = {
    company: { id: 24, name: "Ordera Dostava Banja Luka", city: "Banja Luka", currency: "KM" },
    couriers,
    F,
    zones: ZONES,
    orders: { waiting, active, pending, refused },
    settings: { ...FINANCE, delivery_company_id: 24, cash_limit_amount: 200, cash_limit_enforcement: "BLOCK", payout_period_days: 7, currency: "KM" },
    flags: { omitNoPosition: true, strings: false },
    clock: () => t0,
    locations,
    t0,
    // --- simulacija za prototip (harness je ne koristi) ---
    // pomjeri svježe kurire koji voze: brzina (m/s) x dt (s) po smjeru; na granici se okreću
    move(dtSec = 15) {
      for (const f of fixed) {
        if (!f.sc.fresh || !(f.sc.speed > 0)) continue;
        const d = f.sc.speed * dtSec;
        const h = f.heading * Math.PI / 180;
        const m = offsetM(f.lat, f.lng, Math.sin(h) * d, Math.cos(h) * d);
        const far = Math.hypot((m.lng - CENTER.lng) * mLng(CENTER.lat), (m.lat - CENTER.lat) * M_LAT);
        if (far > 3800) f.heading = (f.heading + 180) % 360;
        else {
          f.lat = m.lat;
          f.lng = m.lng;
        }
      }
    },
    // zadnji signal je bio prije `agoMs` (kurir koji i dalje "online" stoji na serveru)
    loseSignal(courierId, agoMs = 6 * MIN) {
      const f = fixed.find((x) => x.c.courier_id === courierId);
      if (!f) return false;
      f.sc = { ...f.sc, fresh: false };
      f.at = W.clock() - agoMs;
      return true;
    },
    restoreSignal(courierId) {
      const f = fixed.find((x) => x.c.courier_id === courierId);
      if (!f) return false;
      f.sc = { ...f.sc, fresh: true, ago: 6e3 };
      return true;
    },
    nextOrderId: 4290,
    // nova narudžba koja čeka kurira (restoran je prihvatio, hrana je gotova)
    addWaitingOrder() {
      const id = W.nextOrderId++;
      const now2 = W.clock();
      const nm = RESTAURANTS[id % RESTAURANTS.length][0];
      W.orders.waiting.unshift({ id, restaurant_name: nm, ordered_at: isoUtc(now2 - 2 * MIN), delivery_time: isoUtc(now2 + 38 * MIN), waiting_minutes: 1, minutes_until_delivery: 38, status: "ready", ready_in_minutes: 0, ready_at: isoUtc(now2 - MIN), delivery_price: 3.5, location: loc(id, 7100 + id), delivery_zone: "Centar", distance_km: 1.6 });
      return id;
    }
  };
  return W;
}
var distM = (a, b) => {
  const rad = (x) => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371e3 * Math.asin(Math.sqrt(h));
};
var zoneOf = (lat, lng, zones = ZONES) => {
  const hit = zones.filter((z) => z.center_lat != null && distM({ lat, lng }, { lat: z.center_lat, lng: z.center_lng }) <= z.radius_meters);
  hit.sort((a, b) => a.radius_meters - b.radius_meters);
  return hit[0] ?? null;
};
function liveCoverage(W) {
  const rows = new Map(W.zones.filter((z) => z.center_lat != null).map((z) => [z.id, { zone_id: z.id, zone_name: z.name, online: 0, idle: 0, delivering: 0 }]));
  for (const l of W.locations()) {
    const st = l.location.status;
    if (st === "offline") continue;
    const age = W.clock() - Date.parse(l.location.updated_at);
    if (age > 15 * MIN) continue;
    const z = zoneOf(l.location.latitude, l.location.longitude, W.zones);
    if (!z) continue;
    const r = rows.get(z.id);
    if (st === "delivering") r.delivering++;
    else if (st === "idle") r.idle++;
    else r.online++;
  }
  return [...rows.values()];
}
function serveLive(W, { pth, method = "GET", body = null, q = new URLSearchParams() }) {
  const ok = (data) => [200, { success: true, data }];
  let m;
  if (m = pth.match(/^\/dispatcher\/delivery-companies\/(\d+)\/(.*)$/)) {
    const cid = Number(m[1]);
    const rest = m[2];
    if (cid !== 24) return ok([]);
    if (rest === "couriers-status") return ok(W.couriers);
    if (rest === "courier-locations") {
      const rows = W.locations();
      if (!W.flags.omitNoPosition) {
        for (const c of W.couriers) if (!rows.some((r) => r.courier_id === c.courier_id)) rows.push({ courier_id: c.courier_id, name: c.name, phone: c.phone, suspended: c.suspended, vehicle: c.vehicle, location: null });
      }
      if (W.flags.strings) {
        for (const r of rows) if (r.location) {
          r.location.latitude = String(r.location.latitude);
          r.location.longitude = String(r.location.longitude);
        }
      }
      return ok(rows);
    }
    if (rest === "finance-settings") return ok(W.settings);
  }
  if (pth === "/dispatcher/orders/waiting") return ok(W.orders.waiting);
  if (pth === "/dispatcher/orders/active-deliveries") return ok(W.orders.active);
  if (pth === "/dispatcher/orders/refused") return ok(W.orders.refused);
  if (pth === "/dispatcher/orders/pending-restaurant-confirmation") return ok(W.orders.pending);
  if (pth === "/dispatcher/zones") return ok(W.zones);
  if (pth === "/dispatcher/zones/live-coverage") return ok(liveCoverage(W));
  return serveFinance(W.F, { pth, method, body, q });
}

// app/utils/cashLimit.ts
var NEAR_RATIO = 0.8;
var money = (value) => value.toFixed(2);
var summarizeCashLimit = (owed, limit) => {
  const counted = Math.max(0, owed);
  const ratio = limit === 0 ? counted > 0 ? 1 : 0 : counted / limit;
  const over = limit === 0 ? counted > 0 : counted >= limit;
  const near = !over && ratio >= NEAR_RATIO;
  const state = over ? "over" : near ? "near" : "ok";
  const remaining = Math.max(0, limit - counted);
  const exceeded = Math.max(0, counted - limit);
  let text2;
  if (state === "over") {
    text2 = exceeded > 0 ? `Preko limita za ${money(exceeded)} KM` : "Limit je dostignut";
  } else if (state === "near") {
    text2 = `Blizu limita \xB7 jo\u0161 ${money(remaining)} KM`;
  } else {
    text2 = limit === 0 ? "Bez dozvoljene gotovine" : `Jo\u0161 ${money(remaining)} KM do limita`;
  }
  return { state, percent: Math.min(100, Math.round(ratio * 100)), remaining, exceeded, text: text2 };
};

// app/utils/courierStatus.ts
var STALE_AFTER_MS = 9e4;
var LONG_OFFLINE_MS = 60 * 60 * 1e3;
var courierState = (courier, now) => {
  const loc2 = courier.location;
  if (!loc2) return "offline";
  if (loc2.status === "delivering") return "delivering";
  if (loc2.status === "offline") return "offline";
  if (loc2.status === "online" || loc2.status === "idle") return "online";
  const age = now - new Date(loc2.updated_at).getTime();
  return age > STALE_AFTER_MS ? "offline" : "online";
};
var STATE_META = {
  delivering: { label: "U dostavi", color: "#2f6fed" },
  online: { label: "Slobodan", color: "#00b37e" },
  offline: { label: "Offline", color: "#9aa4b2" }
};
var relativeTime = (timestamp, now) => {
  const diffSeconds = Math.round((now - new Date(timestamp).getTime()) / 1e3);
  if (diffSeconds < 5) return "upravo sad";
  if (diffSeconds < 60) return `pre ${diffSeconds}s`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `pre ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `pre ${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  return `pre ${diffDays} ${diffDays === 1 ? "dan" : "dana"}`;
};

// app/utils/currency.ts
var DEFAULT_CURRENCY = "KM";
var resolveCurrency = (currency) => currency?.trim() || DEFAULT_CURRENCY;
var formatAmount = (value, currency) => `${value.toFixed(2)} ${resolveCurrency(currency)}`;
var toAmount = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const text2 = value.trim().replace(",", ".");
  if (!text2) return null;
  const parsed = Number(text2);
  return Number.isFinite(parsed) ? parsed : null;
};

// app/utils/datetime.ts
var pluralizeSr = (n, one, few, many) => {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};
var formatWaitingDuration = (totalMinutes) => {
  const mins = Math.max(0, Math.round(totalMinutes));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    const rem = mins % 60;
    return rem > 0 ? `${hours}h ${rem}min` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  if (days < 365) return `${days} ${pluralizeSr(days, "dan", "dana", "dana")}`;
  const years = Math.floor(days / 365);
  return `${years} ${pluralizeSr(years, "godina", "godine", "godina")}`;
};

// app/utils/profileForm.ts
var digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");
var DOB_MESSAGES = {
  incomplete: "Upi\u0161i dan, mjesec i godinu, npr. 14.03.1996.",
  invalid: "Taj datum ne postoji. Provjeri dan i mjesec.",
  future: "Datum je u budu\u0107nosti.",
  young: "Datum je neta\u010Dan: najmla\u0111i kurir ima 14 godina.",
  old: "Datum je neta\u010Dan: provjeri godinu."
};
var ibanClean = (value) => String(value ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
var formatIban = (value) => ibanClean(value).replace(/(.{4})/g, "$1 ").trim();
var initials = (name, last, email) => {
  const a = String(name ?? "").trim().charAt(0);
  const b = String(last ?? "").trim().charAt(0);
  return (a + b).toUpperCase() || String(email ?? "?").trim().charAt(0).toUpperCase();
};
var VEHICLE_CHOICES = {
  car: { label: "Automobil", icon: "mdi-car", ink: "#2459c7", tint: "#eef4ff" },
  motorbike: { label: "Motor", icon: "mdi-motorbike", ink: "#9a4a07", tint: "#fff2df" },
  scooter: { label: "Skuter", icon: "mdi-moped", ink: "#5b6676", tint: "#eceff3" },
  bicycle: { label: "Bicikl", icon: "mdi-bike", ink: "#00734f", tint: "#e3f8ef" },
  foot: { label: "Pje\u0161ice", icon: "mdi-walk", ink: "#5b6676", tint: "#eceff3" }
};

// app/utils/toLatin.ts
var CYRILLIC = "\u0410_\u0411_\u0412_\u0413_\u0414_\u0402_\u0415_\u0401_\u0416_\u0417_\u0418_\u0419_\u0408_\u041A_\u041B_\u0409_\u041C_\u041D_\u040A_\u041E_\u041F_\u0420_\u0421_\u0422_\u040B_\u0423_\u0424_\u0425_\u0426_\u0427_\u040F_\u0428_\u0429_\u042A_\u042B_\u042C_\u042D_\u042E_\u042F_\u0430_\u0431_\u0432_\u0433_\u0434_\u0452_\u0435_\u0451_\u0436_\u0437_\u0438_\u0439_\u0458_\u043A_\u043B_\u0459_\u043C_\u043D_\u045A_\u043E_\u043F_\u0440_\u0441_\u0442_\u045B_\u0443_\u0444_\u0445_\u0446_\u0447_\u045F_\u0448_\u0449_\u044A_\u044B_\u044C_\u044D_\u044E_\u044F".split(
  "_"
);
var LATIN = "A_B_V_G_D_\u0110_E_\xCB_\u017D_Z_I_J_J_K_L_Lj_M_N_Nj_O_P_R_S_T_\u0106_U_F_H_C_\u010C_D\u017E_\u0160_\u015C_\u02BA_Y_\u02B9_\xC8_\xDB_\xC2_a_b_v_g_d_\u0111_e_\xEB_\u017E_z_i_j_j_k_l_lj_m_n_nj_o_p_r_s_t_\u0107_u_f_h_c_\u010D_d\u017E_\u0161_\u015D_\u02BA_y_\u02B9_\xE8_\xFB_\xE2".split(
  "_"
);
var HAS_CYRILLIC = /[\u0400-\u04FF]/;
var cyrillicToLatin = (input) => {
  if (!HAS_CYRILLIC.test(input)) return input;
  return input.split("").map((char) => {
    const index = CYRILLIC.indexOf(char);
    return index === -1 ? char : LATIN[index] ?? char;
  }).join("");
};
var toLatin = (value) => {
  if (!value) return "";
  return cyrillicToLatin(String(value));
};

// app/utils/searchFold.ts
var foldForSearch = (value) => String(value ?? "").toLowerCase().replace(/đ/g, "dj").normalize("NFD").replace(/[̀-ͯ]/g, "");
var searchNeedle = (query) => foldForSearch(toLatin(query)).replace(/^\s*#/, "").trim();

// app/utils/courierRoster.ts
var text = (value) => String(value ?? "").trim();
var p2 = (n) => String(n).padStart(2, "0");
var isoDay = (value) => {
  const s = text(value);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
var splitName = (full) => {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
};
var buildRoster = (rows, sources = {}) => {
  const loc2 = new Map((sources.locations ?? []).map((l) => [l.courier_id, l]));
  const bal = new Map((sources.balances ?? []).map((b) => [b.courier_id, b]));
  const sum = new Map((sources.summary ?? []).map((s) => [s.courierId, s]));
  const balancesKnown = sources.balances != null;
  return rows.map((row) => {
    const separate = row.first_name != null;
    const parsed = splitName(String(row.name ?? ""));
    const first = text(separate ? row.first_name : parsed.first);
    const last = text(separate ? row.last_name : parsed.last);
    const detail = row.detail ?? null;
    const balance = bal.get(row.courier_id);
    const summary = sum.get(row.courier_id);
    return {
      id: row.courier_id,
      first,
      last,
      name: toLatin(`${first} ${last}`.trim()),
      phone: text(row.phone) || null,
      email: text(row.email) || null,
      vehicle: row.vehicle?.type ?? null,
      suspended: Boolean(row.suspended),
      reason: text(row.suspended_reason) || null,
      suspendedAt: row.suspended_at ?? null,
      created: isoDay(row.created_at),
      dob: isoDay(detail?.date_of_birth),
      iban: ibanClean(detail?.iban),
      ecName: text(detail?.emergency_contact_name),
      ecPhone: text(detail?.emergency_contact_phone),
      payType: row.paying_type ?? null,
      paying: text(row.paying),
      bank: text(row.bank_account),
      signed: isoDay(row.contract_signed_at),
      from: isoDay(row.contract_active_from),
      note: text(row.note),
      loc: loc2.get(row.courier_id)?.location ?? null,
      cash: balancesKnown ? toAmount(balance?.cash_owed_to_company) ?? 0 : null,
      wage: balancesKnown ? toAmount(balance?.wage_owed_to_courier) ?? 0 : null,
      unread: summary?.dispatcherUnreadCount ?? 0,
      // Ponuda za dostavu nije poruka dispečera: inbox-summary je zna vratiti kao zadnju poruku
      // (dokument 21.09, R11), pa se ovdje ne čuva ("Zadnja poruka" tada pada na čitanje sandučeta).
      lastMsg: summary?.lastMessage && summary.lastMessage.category !== "offer" ? {
        title: summary.lastMessage.title,
        sentAt: summary.lastMessage.sentAt,
        category: summary.lastMessage.category
      } : null
    };
  });
};
var displayName = (c) => toLatin(`${text(c.first)} ${text(c.last)}`.trim());
var UNKNOWN_VEHICLE = {
  label: "Nepoznato vozilo",
  icon: "mdi-help-circle-outline",
  ink: "#5b6676",
  tint: "#eceff3"
};
var vehicleView = (vehicle) => {
  const known = VEHICLE_CHOICES[vehicle ?? "foot"];
  return known ?? { ...UNKNOWN_VEHICLE, label: String(vehicle) };
};
var LIVE_META = {
  delivering: { label: "U dostavi", ink: "#2459c7", tint: "#eef4ff", dot: "#2f6fed", rank: 0 },
  online: { label: "Slobodan", ink: "#00734f", tint: "#e3f8ef", dot: "#00b37e", rank: 1 },
  offline: { label: "Offline", ink: "#5b6676", tint: "#eceff3", dot: "#9aa4b2", rank: 2 },
  none: { label: "Bez signala", ink: "#5b6676", tint: "#eceff3", dot: "#c7ccd6", rank: 3 }
};
var liveOf = (c, now) => {
  if (!c.loc) return "none";
  return courierState(
    {
      courier_id: c.id,
      name: c.name,
      phone: c.phone,
      suspended: c.suspended,
      vehicle: null,
      location: c.loc
    },
    now
  );
};
var liveGroup = (c, now) => {
  const k = liveOf(c, now);
  return k === "none" ? "offline" : k;
};
var seenText = (c, now) => c.loc ? relativeTime(c.loc.updated_at, now) : "nema lokacije";
var signalAge = (c, now) => c.loc ? Math.max(0, (now - new Date(c.loc.updated_at).getTime()) / 1e3) : 1e12;
var cashLevel = (cash, limit) => {
  if (cash == null || !(cash > 0)) return "none";
  if (limit == null) return "ok";
  return summarizeCashLimit(cash, limit).state;
};
var unreadText = (n) => `${n} ${pluralizeSr(n, "nepro\u010Ditana", "nepro\u010Ditane", "nepro\u010Ditanih")}`;
var couriersText = (n) => `${n} ${pluralizeSr(n, "kurir", "kurira", "kurira")}`;
var phoneKey = (raw) => {
  const s = text(raw);
  let d = digitsOnly(s);
  if (!d) return "";
  const intl = s.startsWith("+") || d.startsWith("00");
  if (s.startsWith("+")) d = d.slice(3);
  else if (d.startsWith("00")) d = d.slice(5);
  else if (d.startsWith("0")) d = d.slice(1);
  if (d.startsWith("0") && intl) d = d.slice(1);
  return d;
};
var PHONEISH = /^[\d\s+()/.-]+$/;
var keys = /* @__PURE__ */ new WeakMap();
var keyOf = (c) => {
  let k = keys.get(c);
  if (!k) {
    k = {
      hay: `${foldForSearch(toLatin(`${c.first} ${c.last}`))} ${c.id} ${foldForSearch(c.email)}`,
      pk: phoneKey(c.phone),
      raw: digitsOnly(c.phone)
    };
    keys.set(c, k);
  }
  return k;
};
var matchCourier = (c, query) => {
  const n = searchNeedle(query);
  if (!n) return true;
  const key = keyOf(c);
  if (PHONEISH.test(n) && digitsOnly(n).length >= 3) {
    const qd = digitsOnly(n);
    const qk = phoneKey(n);
    const anchored = n.startsWith("+") || qd.startsWith("0");
    return String(c.id).includes(qd) || !!key.pk && !!qk && (anchored ? key.pk.startsWith(qk) : key.pk.includes(qk)) || !!key.raw && key.raw.includes(qd);
  }
  return n.split(/\s+/).filter(Boolean).every((t) => key.hay.includes(t));
};
var groupDigits = (d, sizes) => {
  const out = [];
  let i = 0;
  for (const s of sizes) {
    if (i >= d.length) break;
    out.push(d.slice(i, i + s));
    i += s;
  }
  while (i < d.length) {
    out.push(d.slice(i, i + 3));
    i += 3;
  }
  return out.join(" ");
};
var fmtPhone = (raw) => {
  const s = text(raw);
  if (!s) return "";
  const d = digitsOnly(s);
  if (!d) return s;
  if (s.startsWith("+")) return `+${d.slice(0, 3)} ${groupDigits(d.slice(3), [2, 3, 3])}`.trim();
  if (d.startsWith("00")) return `+${d.slice(2, 5)} ${groupDigits(d.slice(5), [2, 3, 3])}`.trim();
  return groupDigits(d, [3, 3, 3]);
};
var telHref = (raw) => `tel:${text(raw).replace(/[^\d+]/g, "")}`;
var FLAGS = {
  suspended: (c) => c.suspended,
  noVehicle: (c) => !c.vehicle,
  debt: (c) => (c.cash ?? 0) > 0,
  unread: (c) => c.unread > 0
};
var FLAG_ORDER = ["suspended", "noVehicle", "debt", "unread"];
var rosterCounts = (roster, now) => {
  const o = {
    all: roster.length,
    delivering: 0,
    online: 0,
    offline: 0,
    suspended: 0,
    noVehicle: 0,
    debt: 0,
    unread: 0
  };
  for (const c of roster) {
    o[liveGroup(c, now)] += 1;
    for (const k of FLAG_ORDER) if (FLAGS[k](c)) o[k] += 1;
  }
  return o;
};
var filterRoster = (roster, opts, now) => {
  const { q = "", live = "all", flags = [] } = opts;
  return roster.filter((c) => {
    if (live !== "all" && liveGroup(c, now) !== live) return false;
    for (const f of flags) if (!FLAGS[f](c)) return false;
    return matchCourier(c, q);
  });
};
var nameKey = (c) => foldForSearch(toLatin(`${c.first} ${c.last}`));
var byName = (a, b) => nameKey(a).localeCompare(nameKey(b), "sr");
var sortRoster = (list, mode, now) => {
  const a = [...list];
  if (mode === "name") return a.sort(byName);
  if (mode === "debt") return a.sort((x, y) => (y.cash ?? 0) - (x.cash ?? 0) || byName(x, y));
  if (mode === "created") {
    return a.sort((x, y) => y.created.localeCompare(x.created) || byName(x, y));
  }
  return a.sort(
    (x, y) => LIVE_META[liveOf(x, now)].rank - LIVE_META[liveOf(y, now)].rank || signalAge(x, now) - signalAge(y, now) || byName(x, y)
  );
};
var DAY_MESSAGES = {
  incomplete: DOB_MESSAGES.incomplete,
  invalid: DOB_MESSAGES.invalid,
  range: "Provjeri godinu."
};
var isEveryone = (recipientIds, roster) => roster.length > 0 && recipientIds.length === roster.length && roster.every((c) => recipientIds.includes(c.id));

// app/utils/dispatchBoard.ts
var SCHEDULED_THRESHOLD_MINUTES = 45;
var WAITING_CRITICAL_MINUTES = 15;
var DELIVERY_CRITICAL_MINUTES = 20;
var isScheduledOrder = (order) => {
  const diffMinutes = (new Date(order.deliveryTime).getTime() - new Date(order.orderedAt).getTime()) / 6e4;
  return diffMinutes > SCHEDULED_THRESHOLD_MINUTES;
};
var isCriticalWaitingOrder = (order) => isScheduledOrder(order) ? order.minutesUntilDelivery <= DELIVERY_CRITICAL_MINUTES : order.waitingMinutes >= WAITING_CRITICAL_MINUTES;
var isLateDelivery = (minutesUntilDelivery) => minutesUntilDelivery < 0;
var RESTAURANT_WAIT_WARNING_MINUTES = 5;
var RESTAURANT_WAIT_CRITICAL_MINUTES = 15;
var RESTAURANT_WAIT_STALE_MINUTES = 180;
var restaurantWaitTier = (waitingMinutes) => {
  if (waitingMinutes >= RESTAURANT_WAIT_STALE_MINUTES) return "stale";
  if (waitingMinutes >= RESTAURANT_WAIT_CRITICAL_MINUTES) return "critical";
  if (waitingMinutes >= RESTAURANT_WAIT_WARNING_MINUTES) return "warning";
  return "calm";
};
var isActionableRestaurantWait = (waitingMinutes) => restaurantWaitTier(waitingMinutes) !== "stale";

// app/utils/zoneGeo.ts
var toGeoZone = (z) => ({
  id: z.id,
  name: z.name,
  tf: z.terrainFactor,
  lat: z.centerLat,
  lng: z.centerLng,
  r: z.radiusMeters
});
var boundsOfCircles = (circles, pad = 0.1) => {
  if (!circles.length) return null;
  let s = 90;
  let w = 180;
  let n = -90;
  let e = -180;
  for (const c of circles) {
    const dLat = c.r / 111320 * 1;
    const dLng = c.r / (111320 * Math.max(0.01, Math.cos(c.lat * Math.PI / 180)));
    s = Math.min(s, c.lat - dLat);
    n = Math.max(n, c.lat + dLat);
    w = Math.min(w, c.lng - dLng);
    e = Math.max(e, c.lng + dLng);
  }
  const h = n - s;
  const wd = e - w;
  return [
    [s - h * pad, w - wd * pad],
    [n + h * pad, e + wd * pad]
  ];
};
var centroid = (circles) => circles.length ? {
  lat: circles.reduce((a, c) => a + c.lat, 0) / circles.length,
  lng: circles.reduce((a, c) => a + c.lng, 0) / circles.length
} : null;

// app/models/WaitingOrder.ts
var mapWaitingOrderDto = (dto) => ({
  id: dto.id,
  restaurantName: dto.restaurant_name,
  orderedAt: dto.ordered_at,
  deliveryTime: dto.delivery_time,
  waitingMinutes: dto.waiting_minutes,
  minutesUntilDelivery: dto.minutes_until_delivery,
  status: dto.status,
  readyInMinutes: dto.ready_in_minutes,
  readyAt: dto.ready_at,
  deliveryPrice: dto.delivery_price,
  location: dto.location ?? null,
  deliveryZone: dto.delivery_zone ?? null,
  distanceKm: dto.distance_km ?? null
});

// app/models/ActiveDelivery.ts
var mapCourier = (dto) => ({
  id: dto.id,
  name: dto.name,
  phone: dto.phone,
  vehicle: dto.vehicle
});
var mapActiveDeliveryDto = (dto) => ({
  id: dto.id,
  restaurantName: dto.restaurant_name,
  orderedAt: dto.ordered_at,
  deliveryTime: dto.delivery_time,
  minutesUntilDelivery: dto.minutes_until_delivery,
  status: dto.status,
  deliveryPrice: dto.delivery_price,
  courier: dto.courier ? mapCourier(dto.courier) : null,
  location: dto.location ?? null
});

// app/models/PendingRestaurantOrder.ts
var mapPendingRestaurantOrderDto = (dto) => ({
  id: dto.id,
  restaurantName: dto.restaurant_name,
  restaurantPhone: dto.restaurant_phone || null,
  deliveryType: dto.delivery_type,
  orderedAt: dto.ordered_at,
  waitingMinutes: dto.waiting_minutes,
  deliveryTime: dto.delivery_time,
  deliveryPrice: dto.delivery_price,
  // Backend šalje prazan {} kad adrese nema - svedimo na null.
  location: dto.location && Object.keys(dto.location).length > 0 ? dto.location : null
});
export {
  CENTER,
  COMPANIES,
  FINANCE,
  LIVE_META,
  SCRIPT,
  STATE_META,
  ZONES,
  boundsOfCircles,
  buildLiveWorld,
  buildRoster,
  cashLevel,
  centroid,
  courierState,
  couriersText,
  displayName,
  filterRoster,
  fmtPhone,
  formatAmount,
  formatIban,
  formatWaitingDuration,
  initials,
  isActionableRestaurantWait,
  isCriticalWaitingOrder,
  isEveryone,
  isLateDelivery,
  isScheduledOrder,
  liveCoverage,
  liveGroup,
  liveOf,
  mapActiveDeliveryDto,
  mapPendingRestaurantOrderDto,
  mapWaitingOrderDto,
  matchCourier,
  offsetM,
  pluralizeSr,
  relativeTime,
  restaurantWaitTier,
  rosterCounts,
  seenText,
  serveLive,
  sortRoster,
  summarizeCashLimit,
  telHref,
  toGeoZone,
  toLatin,
  unreadText,
  vehicleView,
  zoneOf
};
