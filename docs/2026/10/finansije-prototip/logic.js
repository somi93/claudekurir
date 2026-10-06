/* Čista logika stranice "Finansije" (prototip). Bez DOM-a: radi u pregledniku (prototip) i u običnom Node-u (logic-test.mjs).
   Sve što je ovdje služi kao izvor za portovanje u app/utils/cashDesk.ts. Pretpostavke o backendu su označene sa [PRETPOSTAVKA].
   Vrijeme se računa u fiksnom pomaku +02:00 samo zato što je tabla ista za svakoga; u aplikaciji idu lokalni getteri (kao formatDateTime). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FC = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- brojevi i novac ---------- */
  const r2 = (v) => Math.round(v * 100) / 100;
  // Iznosi stižu kao broj ili kao tekst ("12.50", ponekad sa zarezom); prazno ili nevažeće = null (isto kao utils/currency.ts toAmount).
  const toAmount = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string") return null;
    const t = value.trim().replace(",", ".");
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  const money = (v, cur = "KM") => `${Number(v).toFixed(2)} ${cur}`;
  const absMoney = (v, cur = "KM") => money(Math.abs(v), cur);
  const signed = (v, cur = "KM") => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)} ${cur}`;
  const plural = (n, one, few, many) => {
    const m100 = n % 100, m10 = n % 10;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };
  const couriersText = (n) => `${n} ${plural(n, "kurir", "kurira", "kurira")}`;

  /* ---------- tekst: ćirilica, dijakritici, pretraga (kao utils/toLatin.ts, searchFold.ts, courierRoster.matchCourier) ---------- */
  const CYR = "А_Б_В_Г_Д_Ђ_Е_Ё_Ж_З_И_Й_Ј_К_Л_Љ_М_Н_Њ_О_П_Р_С_Т_Ћ_У_Ф_Х_Ц_Ч_Џ_Ш_Щ_Ъ_Ы_Ь_Э_Ю_Я_а_б_в_г_д_ђ_е_ё_ж_з_и_й_ј_к_л_љ_м_н_њ_о_п_р_с_т_ћ_у_ф_х_ц_ч_џ_ш_щ_ъ_ы_ь_э_ю_я".split("_");
  const LAT = "A_B_V_G_D_Đ_E_Ë_Ž_Z_I_J_J_K_L_Lj_M_N_Nj_O_P_R_S_T_Ć_U_F_H_C_Č_Dž_Š_Ŝ_ʺ_Y_ʹ_È_Û_Â_a_b_v_g_d_đ_e_ë_ž_z_i_j_j_k_l_lj_m_n_nj_o_p_r_s_t_ć_u_f_h_c_č_dž_š_ŝ_ʺ_y_ʹ_è_û_â".split("_");
  const HAS_CYR = /[Ѐ-ӿ]/;
  const toLatin = (s) => {
    s = String(s == null ? "" : s);
    if (!HAS_CYR.test(s)) return s;
    return s.split("").map((c) => { const i = CYR.indexOf(c); return i === -1 ? c : LAT[i] || c; }).join("");
  };
  const fold = (v) => String(v == null ? "" : v).toLowerCase().replace(/đ/g, "dj").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const needle = (q) => fold(toLatin(q)).replace(/^\s*#/, "").trim();
  const digitsOnly = (v) => String(v == null ? "" : v).replace(/\D/g, "");
  const phoneKey = (raw) => {
    const s = String(raw == null ? "" : raw).trim();
    let d = digitsOnly(s);
    if (!d) return "";
    const intl = s.startsWith("+") || d.startsWith("00");
    if (s.startsWith("+")) d = d.slice(3);
    else if (d.startsWith("00")) d = d.slice(5);
    else if (d.startsWith("0")) d = d.slice(1);
    if (d.startsWith("0") && intl) d = d.slice(1);
    return d;
  };
  const PHONEISH = /^[\d\s+()/.-]+$/;
  const keys = new WeakMap();
  const keyOf = (c) => {
    let k = keys.get(c);
    if (!k) { k = { hay: `${fold(toLatin(c.name))} ${c.id}`, pk: phoneKey(c.phone), raw: digitsOnly(c.phone) }; keys.set(c, k); }
    return k;
  };
  // Ime (sa i bez dijakritika, ćirilica, bilo koji redoslijed riječi), #ID i telefon u bilo kom zapisu.
  const matchCourier = (c, query) => {
    const n = needle(query);
    if (!n) return true;
    const key = keyOf(c);
    if (PHONEISH.test(n) && digitsOnly(n).length >= 3) {
      const qd = digitsOnly(n), qk = phoneKey(n);
      const anchored = n.startsWith("+") || qd.startsWith("0");
      return String(c.id).includes(qd) || (!!key.pk && !!qk && (anchored ? key.pk.startsWith(qk) : key.pk.includes(qk))) || (!!key.raw && key.raw.includes(qd));
    }
    return n.split(/\s+/).filter(Boolean).every((t) => key.hay.includes(t));
  };
  const initials = (name) => {
    const p = toLatin(name).trim().split(/\s+/).filter(Boolean);
    if (!p.length) return "?";
    return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] || "" : "")).toUpperCase();
  };

  /* ---------- vrijeme ---------- */
  const OFFSET = 2 * 3600_000; // [PRETPOSTAVKA] prikaz u +02:00 (Banja Luka, ljeto)
  const pad = (n) => String(n).padStart(2, "0");
  const ms = (v) => (typeof v === "number" ? v : Date.parse(v));
  const loc = (v) => new Date(ms(v) + OFFSET);
  const dayKey = (v) => { const d = loc(v); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
  const hm = (v) => { const d = loc(v); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
  const MON = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];
  const WD = ["ned", "pon", "uto", "sri", "čet", "pet", "sub"];
  const dateShort = (v) => { const d = loc(v); return `${d.getUTCDate()}. ${MON[d.getUTCMonth()]}`; };
  const dateTimeShort = (v) => `${dateShort(v)} ${hm(v)}`;
  const addDaysKey = (key, n) => { const [y, m, d] = key.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
  const dayLabel = (key, nowMs) => {
    const today = dayKey(nowMs);
    if (key === today) return "Danas";
    if (key === addDaysKey(today, -1)) return "Juče";
    const [y, m, d] = key.split("-").map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return `${WD[wd]}, ${d}. ${MON[m - 1]}`;
  };
  // Isti tekst kao utils/courierStatus.relativeTime ("pre 12 min", "pre 3h", "pre 3 dana").
  const ageText = (iso, nowMs) => {
    const s = Math.round((nowMs - ms(iso)) / 1000);
    if (s < 5) return "upravo sad";
    if (s < 60) return `pre ${s}s`;
    const m = Math.round(s / 60);
    if (m < 60) return `pre ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `pre ${h}h`;
    const d = Math.round(h / 24);
    return `pre ${d} ${d === 1 ? "dan" : "dana"}`;
  };
  const DAY_MS = 24 * 3600_000;
  const overdue = (iso, nowMs) => nowMs - ms(iso) > DAY_MS; // [PRETPOSTAVKA] dnevni ciklus predaje: starije od dana kasni

  /* ---------- gotovina naspram limita (utils/cashLimit.ts) ---------- */
  const NEAR_RATIO = 0.8;
  const summarize = (owed, limit) => {
    const counted = Math.max(0, owed);
    const ratio = limit === 0 ? (counted > 0 ? 1 : 0) : counted / limit;
    const over = limit === 0 ? counted > 0 : counted >= limit;
    const near = !over && ratio >= NEAR_RATIO;
    return { state: over ? "over" : near ? "near" : "ok", percent: Math.min(100, Math.round(ratio * 100)), pctRaw: Math.round(ratio * 100), remaining: Math.max(0, limit - counted), exceeded: Math.max(0, counted - limit) };
  };
  const levelOf = (cash, limit) => {
    if (cash == null || !(cash > 0)) return "none";
    if (limit == null) return "ok";
    return summarize(cash, limit).state;
  };

  /* ---------- knjiga: kuriri sa novcem (couriers-balance + couriers-status + cash-handovers/pending) ---------- */
  const payText = (type, paying, cur) => {
    if (!type) return "";
    const a = toAmount(paying);
    const label = { 1: "Mjesečno", 2: "Procenat", 3: "Po dostavi" }[type] || "";
    return `${label}${a != null ? ` · ${a.toFixed(2)} ${type === 2 ? "%" : cur}` : ""}`;
  };
  const buildBook = ({ balances, couriers, pending, limit, cur = "KM" }) => {
    const byId = new Map((couriers || []).map((c) => [c.courier_id, c]));
    const pend = new Map();
    for (const p of pending || []) {
      const a = toAmount(p.reported_amount);
      if (a == null) continue;
      (pend.get(p.courier_id) || pend.set(p.courier_id, []).get(p.courier_id)).push({ id: p.id, amount: a, at: p.reported_at });
    }
    for (const list of pend.values()) list.sort((a, b) => ms(a.at) - ms(b.at));
    const seen = new Set();
    const rows = [];
    const make = (id, bal) => {
      const c = byId.get(id);
      const cash = toAmount(bal && bal.cash_owed_to_company) ?? 0;
      const wage = toAmount(bal && bal.wage_owed_to_courier) ?? 0;
      const name = toLatin((c && c.name) || (bal && bal.name) || `Kurir #${id}`);
      const p = pend.get(id) || [];
      const level = levelOf(cash, limit);
      const sm = limit == null || !(cash > 0) ? null : summarize(cash, limit);
      return {
        id, name, initials: initials(name), phone: (c && c.phone) || (bal && bal.phone) || null,
        cash, wage, level, pct: sm ? sm.percent : null, pctRaw: sm ? sm.pctRaw : null,
        pending: p, pendingSum: r2(p.reduce((s, x) => s + x.amount, 0)), pendingAt: p.length ? p[0].at : null,
        suspended: !!(c && c.suspended), reason: (c && c.suspended_reason) || null,
        inFirm: !!c, bank: (c && c.bank_account) || "", iban: (c && c.detail && c.detail.iban) || "",
        pay: c ? payText(c.paying_type, c.paying, cur) : "",
        zero: cash === 0 && wage === 0 && p.length === 0,
      };
    };
    for (const b of balances || []) { seen.add(b.courier_id); rows.push(make(b.courier_id, b)); }
    for (const id of pend.keys()) if (!seen.has(id)) rows.push(make(id, null)); // predaja kurira kojeg nema u balansu: ne gubi se
    return rows;
  };

  // Brojevi za pločice i filtere: uvijek iz cijele knjige, ne iz filtriranog dijela.
  const counts = (book, nowMs) => {
    const o = { all: 0, pending: 0, debt: 0, limit: 0, wage: 0, zero: 0, over: 0, near: 0, sumCash: 0, sumWage: 0, credit: 0, pendingN: 0, pendingSum: 0, oldestAt: null, oldestOverdue: false, pendingCouriers: 0 };
    for (const r of book) {
      if (r.zero) { o.zero++; continue; }
      o.all++;
      if (r.pending.length) { o.pending++; o.pendingN += r.pending.length; o.pendingSum = r2(o.pendingSum + r.pendingSum); if (!o.oldestAt || ms(r.pendingAt) < ms(o.oldestAt)) o.oldestAt = r.pendingAt; }
      if (r.cash > 0) { o.debt++; o.sumCash = r2(o.sumCash + r.cash); }
      if (r.cash < 0) o.credit = r2(o.credit + -r.cash);
      if (r.level === "near") o.near++;
      if (r.level === "over") o.over++;
      if (r.level === "near" || r.level === "over") o.limit++;
      if (r.wage > 0) { o.wage++; o.sumWage = r2(o.sumWage + r.wage); }
    }
    o.pendingCouriers = o.pending;
    o.oldestOverdue = o.oldestAt ? overdue(o.oldestAt, nowMs) : false;
    return o;
  };

  const FILTERS = {
    all: () => true,
    pending: (r) => r.pending.length > 0,
    debt: (r) => r.cash > 0,
    limit: (r) => r.level === "near" || r.level === "over",
    wage: (r) => r.wage > 0,
    zero: (r) => r.zero,
  };
  // "Svi" skriva nulte redove (šum), ali pretraga ih pokazuje: ko traži kurira, treba ga naći bez obzira na saldo.
  const filterBook = (book, { q = "", filter = "all" } = {}) => {
    const f = FILTERS[filter] || FILTERS.all;
    const hasQ = !!needle(q);
    return book.filter((r) => {
      if (filter === "all") { if (r.zero && !hasQ) return false; }
      else if (!f(r)) return false;
      return !hasQ || matchCourier(r, q);
    });
  };
  const byName = (a, b) => fold(a.name).localeCompare(fold(b.name), "sr");
  const SORTS = { debt: "Najviše duguje", wage: "Najviše zarade", age: "Najstarija predaja", name: "Ime A–Z" };
  const sortBook = (book, mode = "debt") => {
    const a = book.slice();
    if (mode === "name") return a.sort(byName);
    if (mode === "wage") return a.sort((x, y) => y.wage - x.wage || y.cash - x.cash || byName(x, y));
    if (mode === "age") return a.sort((x, y) => (x.pendingAt ? ms(x.pendingAt) : Infinity) - (y.pendingAt ? ms(y.pendingAt) : Infinity) || y.cash - x.cash || byName(x, y));
    return a.sort((x, y) => y.cash - x.cash || y.wage - x.wage || byName(x, y));
  };
  const parseFilter = (v) => (v && FILTERS[v] ? v : "all");
  const parseSort = (v) => (v && SORTS[v] ? v : "debt");

  /* ---------- provjere unosa ---------- */
  // Potvrda predaje: iznos kojeg je dispečer stvarno primio. Razlika naspram prijave i dug poslije potvrde se vide prije slanja.
  const confirmCheck = ({ text, reported, owed, cur = "KM" }) => {
    const amount = toAmount(text);
    const msgs = [];
    if (amount == null || !(amount > 0)) return { valid: false, amount: 0, diff: 0, after: null, msgs, hint: "Upiši iznos veći od 0." };
    if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return { valid: false, amount, diff: 0, after: null, msgs, hint: "Najviše dvije decimale." };
    const diff = r2(amount - reported);
    if (diff === 0) msgs.push({ tone: "ok", text: "Isto kao prijava." });
    else msgs.push({ tone: "warn", text: `Razlika od prijave: ${signed(diff, cur)}. Sistem sam upiše napomenu o razlici; možeš dodati svoju.` });
    if (owed != null && owed >= 0 && amount > owed + 0.001) msgs.push({ tone: "warn", text: `Veće je od duga (${money(owed, cur)}) za ${money(r2(amount - owed), cur)}. Sistem dopušta, ali provjeri.` });
    const after = owed == null ? null : r2(owed - amount);
    return { valid: true, amount, diff, after, msgs, hint: "" };
  };
  // Uplata i isplata (isto pravilo kao utils/courierRoster.checkAmount): veći iznos upozorava, ne zabranjuje.
  const entryCheck = ({ mode, text, owed, cur = "KM" }) => {
    const amount = toAmount(text);
    if (amount == null || !(amount > 0)) return { valid: false, amount: 0, msg: null, hint: "Upiši iznos veći od 0." };
    if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return { valid: false, amount, msg: null, hint: "Najviše dvije decimale." };
    if (owed == null) return { valid: true, amount, msg: null, hint: "" };
    if (amount > owed) return { valid: true, amount, msg: { tone: "warn", text: `Veće je od ${mode === "receipt" ? "duga" : "dugovanja"} za ${money(r2(amount - owed), cur)}. Sistem dopušta, ali provjeri.` }, hint: "" };
    const left = r2(owed - amount);
    return { valid: true, amount, msg: { tone: "ok", text: left === 0 ? (mode === "receipt" ? "Dug se zatvara." : "Zarada se isplaćuje u cijelosti.") : `Ostaje ${mode === "receipt" ? "dug " : ""}${money(left, cur)}.` }, hint: "" };
  };

  /* ---------- isplata svima ---------- */
  const payoutPlan = (book) => {
    const items = sortBook(book.filter((r) => r.wage > 0), "name").map((r) => ({ id: r.id, name: r.name, amount: r.wage, bank: r.bank || r.iban || "", suspended: r.suspended, inFirm: r.inFirm }));
    return { items, total: r2(items.reduce((s, i) => s + i.amount, 0)) };
  };
  // Pokreće `run(item)` za svaki red, najviše `concurrency` istovremeno. run vraća { ok, message?, warning? }; izuzetak je neuspjeh.
  const runBatch = async (items, run, { concurrency = 3, onUpdate = () => {} } = {}) => {
    const results = {};
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const item = items[next++];
        onUpdate(item.id, { state: "run" });
        let res;
        try { res = await run(item); } catch (e) { res = { ok: false, message: (e && e.message) || "Server ne odgovara." }; }
        results[item.id] = res;
        onUpdate(item.id, res.ok ? { state: "ok", warning: res.warning } : { state: "err", message: res.message });
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
    return results;
  };
  const batchSummary = (results) => {
    const v = Object.values(results);
    return { ok: v.filter((r) => r.ok).length, failed: v.filter((r) => !r.ok).length, warnings: v.filter((r) => r.ok && r.warning).length };
  };

  /* ---------- promet (cash-handovers + payouts) ---------- */
  const PERIODS = { today: "Danas", "7d": "7 dana", month: "Ovaj mjesec", prev: "Prošli mjesec", custom: "Od–do" };
  const periodRange = (preset, nowMs) => {
    const today = dayKey(nowMs);
    if (preset === "today") return { from: today, to: today };
    if (preset === "month") return { from: `${today.slice(0, 8)}01`, to: today };
    if (preset === "prev") {
      const first = `${today.slice(0, 8)}01`;
      const last = addDaysKey(first, -1);
      return { from: `${last.slice(0, 8)}01`, to: last };
    }
    return { from: addDaysKey(today, -6), to: today };
  };
  const methodOf = (note) => {
    const m = /\((gotovina|bankovni transfer)\)/i.exec(String(note || ""));
    return m ? m[1].toLowerCase() : null;
  };
  const buildJournal = ({ handovers, payouts, nameOf }) => {
    const rows = [];
    for (const h of handovers || []) {
      const reported = toAmount(h.reported_amount), confirmed = toAmount(h.confirmed_amount);
      const done = h.status === "confirmed";
      if (reported == null) continue;
      rows.push({
        key: `h${h.id}`, kind: "handover", id: h.id, courierId: h.courier_id, name: toLatin(nameOf(h.courier_id)), status: done ? "confirmed" : "pending",
        reported, confirmed: done ? confirmed : null, diff: done && confirmed != null ? r2(confirmed - reported) : 0,
        amount: done && confirmed != null ? confirmed : reported, at: done && h.confirmed_at ? h.confirmed_at : h.reported_at, reportedAt: h.reported_at, confirmedAt: h.confirmed_at || null,
        by: h.confirmed_by_name ? toLatin(h.confirmed_by_name) : null, note: h.note || null, method: null, ref: `Predaja #${h.id}`,
      });
    }
    for (const p of payouts || []) {
      const a = toAmount(p.amount);
      if (a == null) continue;
      rows.push({
        key: `p${p.id}`, kind: "payout", id: p.id, courierId: p.courier_id, name: toLatin(nameOf(p.courier_id)), status: "paid", reported: null, confirmed: null, diff: 0,
        amount: a, at: p.created_at, reportedAt: null, confirmedAt: null, by: null, note: p.note || null, method: methodOf(p.note), ref: p.transaction_id ? `Isplata ${p.transaction_id}` : `Isplata #${p.id}`,
      });
    }
    return rows.sort((a, b) => ms(b.at) - ms(a.at) || (a.key < b.key ? 1 : -1));
  };
  const filterJournal = (rows, { type = "all", courier = null, diffOnly = false, q = "" } = {}) =>
    rows.filter((r) => {
      if (type !== "all" && r.kind !== type) return false;
      if (courier != null && r.courierId !== courier) return false;
      if (diffOnly && !(r.kind === "handover" && r.status === "confirmed" && r.diff !== 0)) return false;
      if (q && !matchCourier({ id: r.courierId, name: r.name, phone: null }, q)) return false;
      return true;
    });
  const journalTotals = (rows) => {
    const o = { inN: 0, inSum: 0, outN: 0, outSum: 0, diffN: 0, diffSum: 0, pendingN: 0, pendingSum: 0 };
    for (const r of rows) {
      if (r.kind === "payout") { o.outN++; o.outSum = r2(o.outSum + r.amount); }
      else if (r.status === "confirmed") { o.inN++; o.inSum = r2(o.inSum + r.amount); if (r.diff !== 0) { o.diffN++; o.diffSum = r2(o.diffSum + r.diff); } }
      else { o.pendingN++; o.pendingSum = r2(o.pendingSum + r.amount); }
    }
    return o;
  };
  const groupDays = (rows, nowMs) => {
    const out = [];
    for (const r of rows) {
      const k = dayKey(r.at);
      let g = out[out.length - 1];
      if (!g || g.key !== k) { g = { key: k, label: dayLabel(k, nowMs), rows: [], inSum: 0, outSum: 0 }; out.push(g); }
      g.rows.push(r);
      if (r.kind === "payout") g.outSum = r2(g.outSum + r.amount);
      else if (r.status === "confirmed") g.inSum = r2(g.inSum + r.amount);
    }
    return out;
  };
  // CSV za lokalni Excel: ";" kao razdvajač, zarez kao decimalni znak; BOM dodaje onaj ko pravi datoteku.
  // Tekst koji počinje sa = + - @ dobija ' ispred (CSV injekcija iz napomene).
  const csvText = (v) => {
    let s = String(v == null ? "" : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csvNum = (v) => (v == null ? "" : Number(v).toFixed(2).replace(".", ","));
  const CSV_HEAD = ["Datum", "Vrijeme", "Vrsta", "Kurir", "ID kurira", "Prijavljeno", "Potvrđeno ili isplaćeno", "Razlika", "Status", "Potvrdio", "Način isplate", "Napomena", "Referenca"];
  const toCsv = (rows) => {
    const lines = [CSV_HEAD.join(";")];
    for (const r of rows) {
      const d = loc(r.at);
      const date = `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}.`;
      lines.push([
        date, hm(r.at), r.kind === "payout" ? "Isplata zarade" : "Predaja gotovine", csvText(r.name), r.courierId, csvNum(r.reported), csvNum(r.kind === "payout" ? r.amount : r.confirmed),
        r.kind === "handover" && r.status === "confirmed" ? csvNum(r.diff) : "", r.kind === "payout" ? "Isplaćeno" : r.status === "confirmed" ? "Potvrđeno" : "Na čekanju",
        csvText(r.by || ""), csvText(r.method || ""), csvText(r.note || ""), csvText(r.ref),
      ].join(";"));
    }
    return lines.join("\r\n");
  };
  const csvName = (nowMs) => `finansije-${dayKey(nowMs)}.csv`;

  return {
    r2, toAmount, money, absMoney, signed, plural, couriersText,
    toLatin, fold, needle, matchCourier, initials, phoneKey,
    loc, dayKey, hm, dateShort, dateTimeShort, addDaysKey, dayLabel, ageText, overdue, DAY_MS, ms,
    NEAR_RATIO, summarize, levelOf,
    buildBook, counts, FILTERS, filterBook, sortBook, SORTS, parseFilter, parseSort, payText,
    confirmCheck, entryCheck, payoutPlan, runBatch, batchSummary,
    PERIODS, periodRange, methodOf, buildJournal, filterJournal, journalTotals, groupDays, toCsv, csvName, csvText,
  };
});
