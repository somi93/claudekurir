/*__ICONS__*/
const M = window.__M, MW = window.__MW;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const I = (n, size = 20, cls = '') => `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="${ICONS[n] || ''}"/></svg>`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PAGE = 12;
const RPAGE = 10;

// ---------------------------------------------------------------- "server": zajednički svijet za oba okvira
const SRV = {
  data: null,
  scale: 'small',
  t0: Date.now(),
  offset: 0,
  liveN: 0,
  // state: ok | loading | error | empty. locations / balances: izvor radi. send: ok | fail | less. check: ok | fail. retract: ok | fail.
  flags: { state: 'ok', locations: true, balances: true, send: 'ok', check: 'ok', retract: 'ok', phase2: false },
  log: [],
  hist: [],
  insts: [],
  tpl: [],
  drafts: {},
};
const nowMs = () => MW.NOW_MS + (Date.now() - SRV.t0) + SRV.offset;
const clockNow = () => M.clock(nowMs());
const resetWorld = () => {
  SRV.data = MW.build(SRV.scale === 'big' ? 500 : 0);
  SRV.log = [];
  SRV.hist = [];
  SRV.liveN = 0;
};
resetWorld();
try { SRV.tpl = JSON.parse(localStorage.getItem('m-tpl') || '[]'); } catch (e) { SRV.tpl = []; }
const saveTpl = () => { try { localStorage.setItem('m-tpl', JSON.stringify(SRV.tpl)); } catch (e) { /* bez pohrane radi i dalje u memoriji */ } };

const byId = (id) => SRV.data.roster.find((c) => c.id === id) || null;
const emitAll = (what) => SRV.insts.forEach((i) => i.onWorld && i.onWorld(what));

const logReq = (method, path, body, note) => {
  SRV.hist.push({ method, path, body, note });
  SRV.log.unshift({ method, path, body, note, t: nowMs() });
  SRV.log.length = Math.min(SRV.log.length, 14);
  window.dispatchEvent(new CustomEvent('m-log'));
};
const lat = (a = 50, b = 140) => sleep(a + Math.random() * (b - a));
const httpErr = (status, message) => Object.assign(new Error(message || `HTTP ${status}`), { status });

// kada će kurir otvoriti poruku koju je upravo dobio (ms poslije slanja) ili nikad
const readAtFor = (c, created) => {
  const r = MW.mulberry(c.id * 31 + (SRV.liveN + 1) * 977)();
  const st = M.liveOf(c);
  if (st === 'delivering') return r < 0.85 ? created + 20_000 + r * 60_000 : null;
  if (st === 'online') return r < 0.92 ? created + 12_000 + r * 130_000 : null;
  if (st === 'offline') return r < 0.3 ? created + (12 + r * 150) * 60_000 : null;
  return null;
};
const isRead = (m) => m.read === true || (m.readAt != null && m.readAt <= nowMs());
const strip = (m) => ({ id: m.id, sender: m.sender, category: m.category, title: m.title, body: m.body, sent_at: m.sent_at, read: isRead(m) });

// GET /couriers/{id}/inbox?category=&page=&per_page=  (meta uz ?page=)
SRV.inbox = async (courierId, { category, page = 1, perPage = RPAGE, fail = false } = {}) => {
  logReq('GET', `/couriers/${courierId}/inbox?category=${category}&page=${page}&per_page=${perPage}`);
  await lat();
  if (fail) throw httpErr(500, 'Server Error');
  const rows = (SRV.data.inbox.get(courierId) || []).filter((m) => !category || m.category === category);
  return { data: rows.slice((page - 1) * perPage, page * perPage).map(strip), meta: { current_page: page, last_page: Math.max(1, Math.ceil(rows.length / perPage)), total: rows.length } };
};

// POST /couriers/{id}/inbox ili POST .../broadcast; odgovor nosi samo broj (kao backend danas)
SRV.send = async (plan, draft) => {
  const req = M.requestFor(draft, plan);
  logReq(req.method, req.path, req.body);
  await lat(260, 460);
  if (SRV.flags.send === 'fail') throw httpErr(500, 'Server Error');
  const missing = SRV.flags.send === 'less' ? plan.ids.slice(-3) : [];
  const created = nowMs();
  SRV.liveN += 1;
  const key = `live${SRV.liveN}`;
  plan.ids.forEach((id, i) => {
    if (missing.includes(id)) return;
    const c = byId(id);
    SRV.data.inbox.get(id).unshift({
      id: SRV.data.nextMsgId(), sender: 'dispatcher', category: draft.category, title: String(draft.title).trim(), body: String(draft.body).trim(),
      sent_at: new Date(created + i * 5).toISOString(), read: false, readAt: readAtFor(c, created), _batch: key,
    });
  });
  return { sent_to_count: plan.ids.length - missing.length, created, key };
};

SRV.del = async (inboxId, { fail = false } = {}) => {
  logReq('DELETE', `/inbox/${inboxId}`);
  await lat(50, 120);
  if (fail) throw httpErr(500, 'Server Error');
  for (const [, arr] of SRV.data.inbox) {
    const i = arr.findIndex((x) => x.id === inboxId);
    if (i >= 0) arr.splice(i, 1);
  }
};

// Faza 2 (čeka backend, B1): paketi sa servera. Ovdje se izvode iz istih sandučića, ali u aplikaciji bi dolazili iz GET .../messages.
SRV.serverBatches = () => {
  const by = new Map();
  for (const [courierId, rows] of SRV.data.inbox) {
    for (const m of rows) {
      if (!m._batch || m._batch.startsWith('old') || m._batch.startsWith('live')) continue;
      if (!by.has(m._batch)) by.set(m._batch, { key: m._batch, category: m.category, title: m.title, body: m.body, sentAt: Date.parse(m.sent_at), rows: [] });
      by.get(m._batch).rows.push({ courierId, read: isRead(m), inboxId: m.id });
    }
  }
  return [...by.values()].sort((a, b) => b.sentAt - a.sentAt);
};

// ---------------------------------------------------------------- HTML dijelovi
const liveDot = (c) => (c.suspended ? '#e5484d' : M.LIVE[M.liveOf(c)].dot);
const tint = (tone, icon, title, body, acts) => `<div class="k-tint k-tint--${tone}" ${tone === 'bad' ? 'role="alert"' : ''}>${I(icon, 22)}<div>${title ? `<b>${title}</b>` : ''}${body}${acts ? `<div class="acts">${acts}</div>` : ''}</div></div>`;
const copyText = async (text) => {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; } } catch (e) { /* rezerva ispod */ }
  return false;
};
const preset = (k) => M.PRESETS[k];
const PRESET_TONE = {
  active: ['#eef4ff', '#2459c7'], delivering: ['#eef4ff', '#2459c7'], online: ['#e3f8ef', '#00734f'], offline: ['#eceff3', '#5b6676'],
  debt: ['#fff2df', '#9a4a07'], suspended: ['#fde8e6', '#b42318'],
};
