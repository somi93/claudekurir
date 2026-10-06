(() => {
  // ../e2e/fx.mjs
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

  // ../e2e/fin-fx.mjs
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
    const H = 36e5, D = 24 * H;
    const pendingSeed = [
      { courier_id: list[7].courier_id, reported: "70.00", ago: 3 * D + 2 * H },
      { courier_id: list[5].courier_id, reported: "50.00", ago: 1 * D + 3 * H },
      { courier_id: list[1].courier_id, reported: "214.50", ago: 2 * H + 40 * 6e4 },
      { courier_id: list[0].courier_id, reported: "95.24", ago: 12 * 6e4 }
    ];
    let hid = 900;
    const pendingRows = pendingSeed.map((p) => ({ id: hid++, courier_id: p.courier_id, reported_amount: p.reported, reported_at: iso2(new Date(now.getTime() - p.ago)) }));
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
      reported_at: iso2(new Date(now.getTime() - 2 * D - 4 * H)),
      confirmed_at: iso2(new Date(now.getTime() - 2 * D - 3 * H)),
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
        created_at: iso2(new Date(now.getTime() - Math.floor((i + r() * 0.8) * (30 * D / nPayouts)) - 3 * H)),
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

  // world-entry.mjs
  var NOW = Date.parse("2026-10-06T12:20:00.000Z");
  window.FCW = {
    NOW,
    serveFinance,
    build(o = {}) {
      const now = new Date(NOW);
      const couriers = buildCouriers(o.n || 24, { now });
      const F = buildFinanceWorld({ now, couriers, nHistory: o.nHistory, nPayouts: o.nPayouts });
      return {
        company: { id: 24, name: "Ordera Dostava Banja Luka", city: "Banja Luka", currency: "KM" },
        settings: { delivery_company_id: 24, currency: "KM", cash_limit_amount: 200, cash_limit_enforcement: "BLOCK", payout_period_days: 7, daily_handover_time: "14:16" },
        couriers,
        F
      };
    }
  };
})();
