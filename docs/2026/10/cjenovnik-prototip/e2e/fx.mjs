// Izmišljeni, ali dosljedni podaci za dispečerski ekran Kuriri (oblici tačno kao u types/*.ts).
// Deterministički (seed), pa su brojevi u tablama ponovljivi.
const mulberry = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const FIRST = ["Amir", "Emir", "Haris", "Adnan", "Mirza", "Kenan", "Tarik", "Damir", "Nermin", "Dino", "Jasmin", "Senad", "Edin", "Alen", "Sead", "Armin", "Ismar", "Elvir", "Samir", "Vedran", "Marko", "Nikola", "Milan", "Dejan", "Goran", "Zoran", "Bojan", "Nemanja", "Stefan", "Luka", "Ivan", "Darko", "Slaven", "Željko", "Đorđe", "Čedomir", "Šaban", "Ćamil", "Lazar", "Boris"];
const LAST = ["Hodžić", "Kovačević", "Marković", "Delić", "Mujić", "Babić", "Jovanović", "Petrović", "Salihović", "Begić", "Ćosić", "Đurić", "Nikolić", "Simić", "Tomić", "Lukić", "Zec", "Vuković", "Kurtović", "Hadžić", "Softić", "Džaferović", "Radić", "Stanić", "Mrkonjić", "Pejić", "Ilić", "Bajić", "Čengić", "Šehić"];

const CYR = { a: "а", b: "б", v: "в", g: "г", d: "д", đ: "ђ", e: "е", ž: "ж", z: "з", i: "и", j: "ј", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", r: "р", s: "с", t: "т", ć: "ћ", u: "у", f: "ф", h: "х", c: "ц", č: "ч", š: "ш" };
export const toCyr = (s) => {
  let out = "";
  const low = s.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    const two = low.slice(i, i + 2);
    const upper = s[i] !== low[i];
    let c;
    if (two === "lj") { c = "љ"; i++; }
    else if (two === "nj") { c = "њ"; i++; }
    else if (two === "dž") { c = "џ"; i++; }
    else c = CYR[low[i]] ?? s[i];
    out += upper ? c.toUpperCase() : c;
  }
  return out;
};

const ascii = (s) => s.toLowerCase().replace(/đ/g, "dj").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, ".000000Z");
const day = (d) => d.toISOString().slice(0, 10);
const REASONS = ["Dug gotovine", "Nije se javio na smjenu", "Kvar vozila", "Na zahtjev kurira", "Čeka dokumenta"];
const LONG_REASON = "Kurir nije predao gotovinu 6 dana uprkos tri poziva i dvije poruke; dogovor sa vlasnikom firme da se suspenduje do predaje cjelokupnog iznosa i dolaska u poslovnicu sa vozačkom dozvolom.";

// Ručno postavljeni redovi (tests ih traže po id-u), ostalo se generiše.
export const IDS = { main: 30189, scooter: 30192, longName: 30195, suspendedLong: 30198, noPhone: 30201, cyr: 30204, noVehicle: 30207, oldRow: 30210 };

export function buildCouriers(n = 24, { now = new Date(), seed = 7 } = {}) {
  const r = mulberry(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const out = [];
  const used = new Set();
  const VEH = ["motorbike", "motorbike", "motorbike", "car", "car", "bicycle", "bicycle", "scooter", null];
  const phone = (i) => {
    const a = 60 + Math.floor(r() * 7);
    const b = 100 + Math.floor(r() * 899);
    const c = 100 + Math.floor(r() * 899);
    return [`0${a}/${b}-${c}`, `+387 ${a} ${b} ${c}`, `0${a}${b}${c}`, `0${a} ${b} ${c}`][i % 4];
  };
  for (let i = 0; i < n; i++) {
    let first = pick(FIRST), last = pick(LAST);
    while (used.has(first + last)) { first = pick(FIRST); last = pick(LAST); }
    // imenovani redovi za testove pretrage (dijakritici, ćirilica, formati telefona)
    if (i === 0) { first = "Amir"; last = "Hodžić"; }
    if (i === 8) { first = "Željko"; last = "Đurić"; }
    if (i === 9) { first = "Жељко"; last = "Марковић"; }
    used.add(first + last);
    const id = i < 8 ? [IDS.main, IDS.scooter, IDS.longName, IDS.suspendedLong, IDS.noPhone, IDS.cyr, IDS.noVehicle, IDS.oldRow][i] : 30210 + i * 3 + Math.floor(r() * 3);
    const cyr = i === 5 || (i !== 8 && i !== 9 && r() < 0.1);
    let name = `${first} ${last}`;
    let fn = first, ln = last;
    if (i === 2) { fn = "Aleksandar-Nemanja"; ln = "Petrović-Njegoš Jovanović Mrkonjić"; name = `${fn} ${ln}`; }
    if (cyr) { fn = toCyr(fn); ln = toCyr(ln); name = `${fn} ${ln}`; }
    const vtype = i === 1 ? "scooter" : i === 6 ? null : i === 0 ? "motorbike" : pick(VEH);
    const suspended = i === 3 || (i > 7 && r() < 0.13);
    const created = new Date(now.getTime() - (20 + Math.floor(r() * 380)) * 86400000);
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
      suspended_reason: suspended ? (i === 3 ? LONG_REASON : r() < 0.7 ? pick(REASONS) : null) : null,
      suspended_at: suspended ? iso(new Date(now.getTime() - (1 + Math.floor(r() * 20)) * 86400000)) : null,
      vehicle: vtype ? { id: 9000 + i, type: vtype } : null,
      contact_phone: null,
      bank_account: i === 0 || r() < 0.3 ? `161-${1000000000 + Math.floor(r() * 8999999999)}-${10 + Math.floor(r() * 89)}` : null,
      note: i === 0 ? "Radi pretežno u centru i na Starčevici." : r() < 0.12 ? "Student, radi vikendom." : null,
      paying_type: hasPay ? ptype : null,
      paying: hasPay ? (ptype === 2 ? "20.00" : ptype === 1 ? "900.00" : "2.00") : null,
      contract_signed_at: hasPay ? day(new Date(created.getTime() + 2 * 86400000)) : null,
      contract_active_from: hasPay ? day(new Date(created.getTime() + 9 * 86400000)) : null,
      image_path: null,
      created_at: iso(created),
      detail: hasDetail
        ? {
            date_of_birth: `${1984 + Math.floor(r() * 20)}-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`,
            iban: r() < 0.7 ? `BA39 1990 4401 ${String(1000 + Math.floor(r() * 8999))} ${String(1000 + Math.floor(r() * 8999))}` : null,
            emergency_contact_name: r() < 0.7 ? `${pick(FIRST)} ${last}` : null,
            emergency_contact_phone: r() < 0.7 ? phone(i + 1) : null,
            referral_url: null,
            referral_short_url: null,
            referred_by: r() < 0.15 ? 30189 : null,
          }
        : null,
    };
    if (i === 0) {
      row.detail = { date_of_birth: "1996-03-14", iban: "BA39 1990 4401 2345 6789", emergency_contact_name: "Selma Hodžić", emergency_contact_phone: "066 111 222", referral_url: null, referral_short_url: null, referred_by: null };
      row.paying_type = 3; row.paying = "2.00"; row.contract_signed_at = "2026-08-02"; row.contract_active_from = "2026-08-09";
    }
    if (i === 7) { // star red: bez opcionih polja koja su dodata naknadno (first_name/last_name/email/detail/paying_*)
      delete row.first_name; delete row.last_name; delete row.email; delete row.detail;
      delete row.paying_type; delete row.paying; delete row.contract_signed_at; delete row.contract_active_from;
      delete row.image_path; delete row.created_at;
    }
    out.push(row);
  }
  return out;
}

// courier-locations: SAMO kuriri sa poznatom pozicijom. Stanja po težinama; IDs.main je uvijek "u dostavi".
export function buildLocations(couriers, { now = new Date(), seed = 11 } = {}) {
  const r = mulberry(seed);
  const rows = [];
  const off = (t) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "+00:00");
  couriers.forEach((c, i) => {
    let st;
    if (c.courier_id === IDS.main) st = "delivering";
    else if (c.courier_id === IDS.noVehicle || c.courier_id === IDS.noPhone) st = "none";
    else {
      const x = r();
      st = x < 0.13 ? "delivering" : x < 0.33 ? "online" : x < 0.5 ? "off-recent" : x < 0.68 ? "off-long" : "none";
    }
    if (st === "none") return;
    const ago = { delivering: 20_000, online: 45_000, "off-recent": (12 + Math.floor(r() * 40)) * 60_000, "off-long": (3 + Math.floor(r() * 60)) * 3600_000 }[st];
    rows.push({
      courier_id: c.courier_id,
      name: c.name,
      phone: c.phone,
      suspended: c.suspended,
      vehicle: c.vehicle,
      location: {
        latitude: 44.7722 + (r() - 0.5) * 0.06,
        longitude: 17.191 + (r() - 0.5) * 0.08,
        heading: Math.round(r() * 359),
        speed: st === "delivering" ? 4 + r() * 5 : st === "online" ? 0 : null,
        status: st === "delivering" ? "delivering" : st === "online" ? "online" : "offline",
        updated_at: off(now.getTime() - ago),
      },
    });
  });
  return rows;
}

// couriers-balance: ko kome šta duguje; uključuje i "siročad" kojih nema u couriers-status.
export function buildBalances(couriers, { seed = 13 } = {}) {
  const r = mulberry(seed);
  const rows = couriers.map((c) => {
    const x = r();
    let cash = 0, wage = 0;
    if (c.courier_id === IDS.main) { cash = 180.7; wage = 6; }
    else if (x < 0.22) cash = Math.round((8 + r() * 140) * 10) / 10;
    else if (x < 0.27) cash = -Math.round((5 + r() * 40) * 10) / 10;
    if (r() < 0.3) wage = Math.round((4 + r() * 90) * 10) / 10;
    return { courier_id: c.courier_id, name: c.name, phone: c.phone, cash_owed_to_company: cash, wage_owed_to_courier: wage };
  });
  rows.push({ courier_id: 29980, name: "Enis Čolić", phone: "065 777 123", cash_owed_to_company: 45.5, wage_owed_to_courier: 0 });
  return rows;
}

export function buildInboxSummary(couriers, { now = new Date(), seed = 17 } = {}) {
  const r = mulberry(seed);
  const T = ["Javi se dispečeru", "Predaj gotovinu do petka", "Nova zona Starčevica", "Vikend bonus", "Provjeri vozilo"];
  const rows = [];
  couriers.forEach((c) => {
    if (c.courier_id !== IDS.main && r() > 0.3) return;
    rows.push({
      courier_id: c.courier_id,
      last_message: { title: T[Math.floor(r() * T.length)], sent_at: iso(new Date(now.getTime() - Math.floor(r() * 90) * 3600_000)), category: ["announcement", "todo", "promotion"][Math.floor(r() * 3)], sender: "dispatcher" },
      dispatcher_unread_count: c.courier_id === IDS.main ? 2 : Math.floor(r() * 4) === 0 ? 1 + Math.floor(r() * 3) : 0,
    });
  });
  return rows;
}

// Poruke jednog kurira (GET /couriers/{id}/inbox): dispečerske + platformske ("offer").
export function buildInbox(courierId, count = 25, { now = new Date() } = {}) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const offer = i % 3 === 1;
    out.push({
      id: courierId * 100 + i,
      sender: offer ? "platform" : "dispatcher",
      category: offer ? "offer" : ["announcement", "todo", "promotion"][i % 3],
      title: offer ? `Ponuda #${4200 + i}` : ["Javi se dispečeru", "Predaj gotovinu", "Nova zona", "Vikend bonus", "Kvar na vozilu?"][i % 5] + (i > 4 ? ` (${i})` : ""),
      body: offer ? "Restoran — adresa · 3.50 KM" : "Molim te da se javiš čim stigneš do centra, imamo veliku gužvu u zoni Starčevica i trebaju nam svi slobodni kuriri.",
      sent_at: iso(new Date(now.getTime() - i * 5 * 3600_000)),
      read: i > 3,
    });
  }
  return out;
}

export const COMPANIES = [
  { id: 24, name: "Ordera Dostava Banja Luka", city_id: 1, city_name: "Banja Luka", currency: "KM" },
  { id: 27, name: "Glovo BL", city_id: 1, city_name: "Banja Luka", currency: "KM" },
];

export const FINANCE = {
  delivery_company_id: 24, commission_percentage: 12, commission_percentage_editable: false, cash_limit_amount: 150, cash_limit_enforcement: "NOTIFY_ONLY",
  payout_period_days: 7, currency: "KM", available_currencies: ["KM", "BAM", "EUR", "RSD"], daily_handover_time: null, assignment_mode: "ALL",
  assignment_courier_count: null, assignment_timeout_action: "NEXT_NEAREST", assignment_courier_pool: "ALL_ACTIVE", offer_timeout_seconds: 30, show_price_breakdown: true,
};
