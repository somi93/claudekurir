/* Čista logika ekrana Poruke (bez DOM-a). Isti kod ide u aplikaciju (utils/messageAudience.ts, utils/messageTracking.ts), pa se ovdje provjerava u običnom Node-u. */
(function (g) {
  'use strict';

  const p2 = (n) => String(n).padStart(2, '0');
  const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];

  // srpska množina: 1 kurir, 2-4 kurira, 5+ kurira (21 kurir, 22 kurira, 11-14 kurira)
  const pl = (n, a, b, c) => {
    const m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c;
  };
  const couriersText = (n) => `${n} ${pl(n, 'kurir', 'kurira', 'kurira')}`;

  // ---------------------------------------------------------------- ćirilica -> latinica (ista mapa kao utils/toLatin.ts)
  const CYR = 'А_Б_В_Г_Д_Ђ_Е_Ё_Ж_З_И_Й_Ј_К_Л_Љ_М_Н_Њ_О_П_Р_С_Т_Ћ_У_Ф_Х_Ц_Ч_Џ_Ш_Щ_Ъ_Ы_Ь_Э_Ю_Я_а_б_в_г_д_ђ_е_ё_ж_з_и_й_ј_к_л_љ_м_н_њ_о_п_р_с_т_ћ_у_ф_х_ц_ч_џ_ш_щ_ъ_ы_ь_э_ю_я'.split('_');
  const LAT = 'A_B_V_G_D_Đ_E_Ë_Ž_Z_I_J_J_K_L_Lj_M_N_Nj_O_P_R_S_T_Ć_U_F_H_C_Č_Dž_Š_Ŝ_ʺ_Y_ʹ_È_Û_Â_a_b_v_g_d_đ_e_ë_ž_z_i_j_j_k_l_lj_m_n_nj_o_p_r_s_t_ć_u_f_h_c_č_dž_š_ŝ_ʺ_y_ʹ_è_û_â'.split('_');
  const HAS_CYR = /[Ѐ-ӿ]/;
  const toLatin = (v) => {
    if (!v) return '';
    const s = String(v);
    if (!HAS_CYR.test(s)) return s;
    return s.split('').map((ch) => { const i = CYR.indexOf(ch); return i === -1 ? ch : (LAT[i] || ch); }).join('');
  };

  // ---------------------------------------------------------------- pretraga (utils/searchFold.ts + telefon + redoslijed riječi)
  const fold = (v) => String(v == null ? '' : v).toLowerCase().replace(/đ/g, 'dj').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const searchNeedle = (q) => fold(toLatin(q)).replace(/^\s*#/, '').trim();
  const digits = (s) => String(s == null ? '' : s).replace(/\D/g, '');
  const phoneKey = (raw) => {
    const s = String(raw == null ? '' : raw).trim();
    let d = digits(s);
    if (!d) return '';
    if (s.startsWith('+')) d = d.slice(3);
    else if (d.startsWith('00')) d = d.slice(5);
    else if (d.startsWith('0')) d = d.slice(1);
    if (d.startsWith('0') && (s.startsWith('+') || digits(s).startsWith('00'))) d = d.slice(1);
    return d;
  };
  const PHONEISH = /^[\d\s+()/.-]+$/;
  const matchCourier = (c, query) => {
    const n = searchNeedle(query);
    if (!n) return true;
    if (PHONEISH.test(n) && digits(n).length >= 3) {
      const qd = digits(n);
      const qk = phoneKey(n);
      const anchored = n.startsWith('+') || qd.startsWith('0');
      const pk = phoneKey(c.phone);
      const raw = digits(c.phone);
      return String(c.id).includes(qd) || (!!pk && !!qk && (anchored ? pk.startsWith(qk) : pk.includes(qk))) || (!!raw && raw.includes(qd));
    }
    const hay = fold(toLatin(`${c.first} ${c.last}`)) + ' ' + String(c.id) + ' ' + fold(c.email || '');
    return n.split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
  };

  const group = (d, sizes) => {
    const out = [];
    let i = 0;
    for (const s of sizes) { if (i >= d.length) break; out.push(d.slice(i, i + s)); i += s; }
    while (i < d.length) { out.push(d.slice(i, i + 3)); i += 3; }
    return out.join(' ');
  };
  const fmtPhone = (raw) => {
    if (!raw) return '';
    const s = String(raw).trim();
    const d = digits(s);
    if (!d) return s;
    if (s.startsWith('+')) return `+${d.slice(0, 3)} ${group(d.slice(3), [2, 3, 3])}`.trim();
    if (d.startsWith('00')) return `+${d.slice(2, 5)} ${group(d.slice(5), [2, 3, 3])}`.trim();
    return group(d, [3, 3, 3]);
  };
  const telHref = (raw) => `tel:${String(raw == null ? '' : raw).replace(/[^\d+]/g, '')}`;

  const fullName = (n, l) => toLatin(`${String(n || '').trim()} ${String(l || '').trim()}`.trim());
  const shortName = (n, l) => {
    const a = toLatin(String(n || '').trim()), b = toLatin(String(l || '').trim());
    return b ? `${a} ${b.charAt(0)}.` : a;
  };

  // ---------------------------------------------------------------- vozilo, uživo, novac
  const VEH = {
    motorbike: { label: 'Motor', icon: 'motorbike', ink: '#9a4a07', tint: '#fff2df' },
    car: { label: 'Automobil', icon: 'car', ink: '#2459c7', tint: '#eef4ff' },
    bicycle: { label: 'Bicikl', icon: 'bike', ink: '#00734f', tint: '#e3f8ef' },
    scooter: { label: 'Skuter', icon: 'moped', ink: '#5b6676', tint: '#eceff3' },
    foot: { label: 'Pješice', icon: 'walk', ink: '#5b6676', tint: '#eceff3' },
  };
  const vehKey = (v) => (v ? v : 'foot');
  const LIVE = {
    delivering: { label: 'U dostavi', ink: '#2459c7', tint: '#eef4ff', dot: '#2f6fed', rank: 0 },
    online: { label: 'Slobodan', ink: '#00734f', tint: '#e3f8ef', dot: '#00b37e', rank: 1 },
    offline: { label: 'Offline', ink: '#5b6676', tint: '#eceff3', dot: '#9aa4b2', rank: 2 },
    none: { label: 'Bez signala', ink: '#5b6676', tint: '#eceff3', dot: '#c7ccd6', rank: 3 },
  };
  const liveOf = (c) => (c.live && LIVE[c.live.st] ? c.live.st : 'none');
  const liveGroup = (c) => (liveOf(c) === 'none' ? 'offline' : liveOf(c));
  const ago = (sec) => {
    if (sec == null) return '';
    if (sec < 5) return 'upravo sad';
    if (sec < 60) return `prije ${Math.round(sec)} s`;
    const min = Math.round(sec / 60);
    if (min < 60) return `prije ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `prije ${h} h`;
    const d = Math.round(h / 24);
    return `prije ${d} ${pl(d, 'dan', 'dana', 'dana')}`;
  };
  const seenText = (c) => (liveOf(c) === 'none' ? 'nema lokacije' : ago(c.live.ago));
  const money = (v, cur) => `${Number(v).toFixed(2)} ${cur || 'KM'}`;

  const byName = (a, b) => fold(toLatin(`${a.first} ${a.last}`)).localeCompare(fold(toLatin(`${b.first} ${b.last}`)), 'sr');
  const sortRoster = (list) =>
    [...list].sort((x, y) => LIVE[liveOf(x)].rank - LIVE[liveOf(y)].rank || (x.live ? x.live.ago : 1e9) - (y.live ? y.live.ago : 1e9) || byName(x, y));

  // ---------------------------------------------------------------- kategorije poruka (utils/inbox.ts)
  const CATS = {
    announcement: { label: 'Obaveštenje', chip: 'Obaveštenja', icon: 'bullhorn-outline', color: '#2f6fed', tint: '#2f6fed1f', ink: '#2459c7' },
    todo: { label: 'Za uraditi', chip: 'Za uraditi', icon: 'checkbox-marked-circle-outline', color: '#ff9f1c', tint: '#ff9f1c1f', ink: '#9a4a07' },
    promotion: { label: 'Promocija', chip: 'Promocije', icon: 'tag-outline', color: '#00b37e', tint: '#00b37e1f', ink: '#007a56' },
    offer: { label: 'Ponuda za dostavu', chip: 'Ponude', icon: 'moped-outline', color: '#5b6676', tint: '#eceff3', ink: '#5b6676' },
  };
  const CAT_ORDER = ['announcement', 'todo', 'promotion']; // "offer" je rezervisan i ne bira se
  const catOf = (c) => CATS[c] || CATS.announcement;

  // ---------------------------------------------------------------- tekst poruke -> dijelovi (utils/linkify.ts)
  const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
  const PHONE_PATTERN = /\+?\d(?:[  \-/]?\d){7,16}/g;
  const TRAILING = /[.,;:!?)\]}"'»]+$/;
  const DATE_LIKE = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/;
  const isPhone = (value) => {
    const t = value.trim();
    if (DATE_LIKE.test(t)) return false;
    const d = t.replace(/\D/g, '');
    if (d.length < 8 || d.length > 15) return false;
    return t.startsWith('+') || t.startsWith('0');
  };
  const linkify = (input) => {
    const text = input || '';
    if (!text) return [];
    const urls = [];
    for (const m of text.matchAll(URL_PATTERN)) {
      const t = m[0].replace(TRAILING, '');
      if (!t) continue;
      urls.push({ start: m.index, end: m.index + t.length, text: t, href: /^https?:\/\//i.test(t) ? t : `https://${t}` });
    }
    const phones = [];
    for (const m of text.matchAll(PHONE_PATTERN)) {
      const start = m.index;
      const t = m[0].replace(/[  \-/]+$/, '');
      const end = start + t.length;
      if (urls.some((u) => start < u.end && end > u.start)) continue;
      const before = text[start - 1], after = text[end];
      if ((before && /[\p{L}\d]/u.test(before)) || (after && /[\p{L}\d]/u.test(after))) continue;
      if (!isPhone(t)) continue;
      const d = t.replace(/\D/g, '');
      phones.push({ start, end, text: t, href: d.startsWith('00') ? `tel:+${d.slice(2)}` : t.startsWith('+') ? `tel:+${d}` : `tel:${d}` });
    }
    const all = [...urls, ...phones].sort((a, b) => a.start - b.start);
    const out = [];
    let cur = 0;
    for (const m of all) {
      if (m.start < cur) continue;
      if (m.start > cur) out.push({ type: 'text', text: text.slice(cur, m.start) });
      out.push({ type: 'link', text: m.text, href: m.href });
      cur = m.end;
    }
    if (cur < text.length) out.push({ type: 'text', text: text.slice(cur) });
    return out;
  };

  // ---------------------------------------------------------------- vrijeme
  const clock = (ms) => { const d = new Date(ms); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  const dayLabel = (ms, now) => {
    const sod = (x) => { const d = new Date(x); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
    const diff = Math.round((sod(now) - sod(ms)) / 86400000);
    if (diff === 0) return 'Danas';
    if (diff === 1) return 'Juče';
    const d = new Date(ms);
    return `${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`;
  };
  const agoMs = (ms, now) => ago(Math.max(0, (now - ms) / 1000));

  // ---------------------------------------------------------------- primaoci
  // Pravilo, ne snimak: "U dostavi" je svako ko je u dostavi U TRENUTKU slanja. Suspendovani su van svih grupa osim
  // "Duguju gotovinu" (njima se i dalje šalje opomena) i "Suspendovani".
  const PRESETS = {
    active: { label: 'Svi aktivni', icon: 'account-group-outline', needs: null },
    delivering: { label: 'U dostavi', icon: 'moped-outline', needs: 'locations' },
    online: { label: 'Slobodni', icon: 'wifi', needs: 'locations' },
    offline: { label: 'Offline', icon: 'wifi-off', needs: 'locations' },
    debt: { label: 'Duguju gotovinu', icon: 'cash-multiple', needs: 'balances' },
    suspended: { label: 'Suspendovani', icon: 'account-off-outline', needs: null },
  };
  const PRESET_ORDER = ['active', 'delivering', 'online', 'offline', 'debt', 'suspended'];
  const inPreset = (c, key) => {
    switch (key) {
      case 'active': return !c.suspended;
      case 'delivering': return !c.suspended && liveGroup(c) === 'delivering';
      case 'online': return !c.suspended && liveGroup(c) === 'online';
      case 'offline': return !c.suspended && liveGroup(c) === 'offline';
      case 'debt': return (c.cash || 0) > 0;
      case 'suspended': return !!c.suspended;
      default: return false;
    }
  };
  const presetCounts = (roster) => {
    const o = {};
    for (const k of PRESET_ORDER) o[k] = 0;
    for (const c of roster) for (const k of PRESET_ORDER) if (inPreset(c, k)) o[k] += 1;
    return o;
  };
  // sel: { kind: 'preset', key } | { kind: 'manual', ids: Set<number> }
  const audienceOf = (roster, sel) =>
    sel.kind === 'manual' ? roster.filter((c) => sel.ids.has(c.id)) : roster.filter((c) => inPreset(c, sel.key));
  const audienceText = (list, k = 3) => {
    if (!list.length) return '';
    const head = list.slice(0, k).map((c) => shortName(c.first, c.last));
    const rest = list.length - head.length;
    return rest > 0 ? `${head.join(', ')} i još ${rest}` : head.join(', ').replace(/, ([^,]*)$/, ' i $1');
  };
  const suspendedIn = (list) => list.filter((c) => c.suspended).length;

  // Kad je izabran cijeli spisak firme šalje se all_couriers (kao i danas, useCourierRoster.message).
  const isEveryone = (ids, roster) => roster.length > 0 && ids.length === roster.length && roster.every((c) => ids.includes(c.id));
  const CONFIRM_AT = 10;
  const sendPlan = (roster, list) => {
    const ids = list.map((c) => c.id);
    return { ids, count: ids.length, everyone: isEveryone(ids, roster), confirm: ids.length >= CONFIRM_AT };
  };
  const requestFor = (draft, plan) => {
    const base = { category: draft.category, title: String(draft.title).trim(), body: String(draft.body).trim() };
    if (plan.count === 1) return { method: 'POST', path: `/couriers/${plan.ids[0]}/inbox`, body: { sender: 'dispatcher', ...base } };
    if (plan.everyone) return { method: 'POST', path: '/dispatcher/delivery-companies/24/broadcast', body: { ...base, all_couriers: true } };
    return { method: 'POST', path: '/dispatcher/delivery-companies/24/broadcast', body: { ...base, all_couriers: false, courier_ids: plan.ids } };
  };

  const PLACEHOLDER = /_{2,}/;
  const checkDraft = (draft, count) => {
    const t = String(draft.title || '').trim(), b = String(draft.body || '').trim();
    const out = { titleOk: !!t, bodyOk: !!b, valid: false, hint: '' };
    if (!t && !b) out.hint = 'Upiši naslov i tekst poruke.';
    else if (!t) out.hint = 'Upiši naslov.';
    else if (!b) out.hint = 'Upiši tekst poruke.';
    else if (count === 0) out.hint = 'Izaberi bar jednog kurira.';
    else if (PLACEHOLDER.test(t) || PLACEHOLDER.test(b)) out.hint = 'Zamijeni ___ pravom vrijednošću prije slanja.';
    else out.valid = true;
    return out;
  };
  const isBlankDraft = (d) => !String(d.title || '').trim() && !String(d.body || '').trim();

  // Odgovor servera naspram onoga što je ekran obećao.
  const sentWho = (n) => `${n} ${pl(n, 'kuriru', 'kurira', 'kurira')}`;
  const sentText = (sent, intended) =>
    sent === intended
      ? { tone: 'ok', text: `Poruka poslata ${sentWho(sent)}.` }
      : { tone: 'warn', text: `Poruka poslata ${sent} od ${intended} kurira. Provjeri u praćenju ko je nije dobio.` };

  // ---------------------------------------------------------------- šabloni (početni tekstovi, dispečer ih mijenja)
  const TEMPLATES = [
    { id: 't1', label: 'Gužva u gradu', category: 'announcement', title: 'Velika gužva u gradu', body: 'Trenutno imamo puno narudžbi. Ko je slobodan neka se prijavi u aplikaciji, a ko ne može neka javi dispečeru.' },
    { id: 't2', label: 'Predaj gotovinu', category: 'todo', title: 'Predaj gotovinu', body: 'Molim te da gotovinu koju imaš kod sebe predaš u poslovnici najkasnije do kraja smjene.' },
    { id: 't3', label: 'Oprez: kiša', category: 'announcement', title: 'Pada kiša, pazite na put', body: 'Kiša je cijeli dan. Vozite oprezno i nemojte žuriti zbog vremena dostave.' },
    { id: 't4', label: 'Bonus', category: 'promotion', title: 'Bonus ovog vikenda', body: 'Svaka dostava ovog vikenda nosi bonus od ___ KM. Važi subotom i nedjeljom od ___ do ___ časova.' },
    { id: 't5', label: 'Javi se dispečeru', category: 'todo', title: 'Javi se dispečeru', body: 'Molim te da se javiš dispečeru čim završiš trenutnu dostavu.' },
  ];

  // ---------------------------------------------------------------- praćenje čitanja (dok backend ne da paket poruke)
  // Backend nema oznaku grupne poruke ni "ko je pročitao". Zato se poslije slanja sanduče svakog primaoca čita sa
  // ?category= (ponude se tako ne miješaju) i poruka se traži po tekstu. Gornja granica čuva server od naleta.
  const CHECK_MAX = 40;
  const SKEW_MS = 15 * 60 * 1000;
  const CHECK_PAGE = 10;
  const checkQuery = (batch) => ({ category: batch.category, page: 1, per_page: CHECK_PAGE });
  const ts = (m) => Date.parse(m.sent_at);
  const same = (a, b) => String(a == null ? '' : a).trim() === String(b == null ? '' : b).trim();
  // taken: id-jevi poruka koje je već preuzeo drugi paket istog teksta (isti tekst poslan dvaput)
  const matchSent = (batch, rows, taken) => {
    const t0 = batch.sentAt;
    const blocked = taken || new Set();
    const c = rows
      .filter((m) => m.sender === 'dispatcher' && m.category === batch.category && same(m.title, batch.title) && same(m.body, batch.body) && !blocked.has(m.id) && Math.abs(ts(m) - t0) <= SKEW_MS)
      .sort((a, b) => Math.abs(ts(a) - t0) - Math.abs(ts(b) - t0));
    return c[0] || null;
  };
  // results: Map<courierId, { state: 'read'|'unread'|'missing'|'error'|'pending', inboxId? }>
  const tally = (batch, results) => {
    const o = { total: batch.recipients.length, read: 0, unread: 0, missing: 0, error: 0, pending: 0 };
    for (const id of batch.recipients) {
      const r = results && results.get(id);
      o[r ? r.state : 'pending'] += 1;
    }
    return o;
  };
  const unreadIds = (batch, results) => batch.recipients.filter((id) => results && results.get(id) && results.get(id).state === 'unread');
  const reminderDraft = (batch) => ({ category: batch.category, title: /^podsjetnik:/i.test(batch.title) ? batch.title : `Podsjetnik: ${batch.title}`, body: batch.body });
  const retractTargets = (batch, results) =>
    batch.recipients.filter((id) => results && results.get(id) && results.get(id).inboxId != null).map((id) => ({ courierId: id, inboxId: results.get(id).inboxId }));
  const canTrack = (batch) => batch.recipients.length <= CHECK_MAX;

  // ---------------------------------------------------------------- poruke jednog kurira (bez ponuda): spajanje po kategorijama
  // Tri izvora (obavještenja, za uraditi, promocije), svaki sortiran od najnovije. Poruka se smije izdati tek kad je za
  // SVAKI izvor sa praznim baferom pročitana sljedeća stranica; inače bi starija poruka iz jednog izvora preskočila
  // novu iz drugog.
  const takeNext = (srcs, n) => {
    const out = [];
    while (out.length < n) {
      const blocked = srcs.filter((s) => s.buf.length === 0 && !s.done);
      if (blocked.length) return { out, need: blocked.map((s) => s.key), end: false };
      const live = srcs.filter((s) => s.buf.length);
      if (!live.length) return { out, need: [], end: true };
      const best = live.reduce((a, b) => (ts(b.buf[0]) > ts(a.buf[0]) ? b : a));
      out.push(best.buf.shift());
    }
    const more = srcs.some((s) => s.buf.length || !s.done);
    return { out, need: [], end: !more };
  };

  g.__M = {
    pl, couriersText, toLatin, fold, searchNeedle, digits, phoneKey, matchCourier, fmtPhone, telHref, fullName, shortName,
    VEH, vehKey, LIVE, liveOf, liveGroup, ago, seenText, money, sortRoster, byName,
    CATS, CAT_ORDER, catOf, linkify, clock, dayLabel, agoMs,
    PRESETS, PRESET_ORDER, inPreset, presetCounts, audienceOf, audienceText, suspendedIn, isEveryone, CONFIRM_AT, sendPlan, requestFor,
    checkDraft, isBlankDraft, sentWho, sentText, TEMPLATES,
    CHECK_MAX, SKEW_MS, CHECK_PAGE, checkQuery, matchSent, tally, unreadIds, reminderDraft, retractTargets, canTrack, takeNext,
  };
})(typeof window !== 'undefined' ? window : globalThis);
