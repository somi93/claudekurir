// ---------------------------------------------------------------- okviri
const sideHTML = () => `<aside class="k-side" aria-label="Meni dispečera"><div class="k-brand"><b>Ordera</b><span>Dispečer</span></div><div class="k-firm"><small>Dostavna firma</small><b>${esc(MW.COMPANY.name)}</b></div>
  <nav class="k-nav">${[['map-marker-radius-outline', 'Kuriri uživo', 'Pregled i mapa'], ['account-group-outline', 'Kuriri', 'Lista kurira firme - dodaj, izmeni, suspenduj'], ['account-search-outline', 'Dodela narudžbi', 'Predlog i slanje ponude kuriru'], ['cash-register', 'Finansije', 'Kase kurira - predaje, balansi, isplate'], ['calendar-clock-outline', 'Raspored i zone', 'Zone, smjene i popunjenost'], ['cash-multiple', 'Cenovnik', 'Cene, naknade, pravila za vozila'], ['domain', 'Firma', 'Finansijske postavke i saradnja sa restoranima'], ['bell-outline', 'Poruke', 'Pošalji kuririma i prati ko je pročitao', 1]].map(([ic, t, s, on]) => `<div class="k-ni${on ? ' on' : ''}">${I(ic, 22)}<span class="t"><b>${t}</b><small>${s}</small></span></div>`).join('')}</nav>
  <div class="k-side-foot">Test Dispečer<div>${I('logout', 20)}Odjava</div></div></aside>`;

const frameHTML = (mode) => {
  const desk = mode === 'desk';
  const head = `<header class="k-ph"><button type="button" class="k-back" data-r="back" aria-label="Nazad na početnu">${I('arrow-left', 22)}</button><span class="k-phh"><h1 data-r="title">Poruke</h1><p data-r="sub" aria-live="polite"></p></span></header>`;
  const right = `<section class="m-right" aria-label="Poruka"><div data-r="tabs"></div><div class="m-scroll" data-r="scroll"><div data-r="pane"></div></div></section>`;
  const left = `<section class="k-card k-list" data-r="listcard" aria-label="Kuriri"></section>`;
  return `${desk ? sideHTML() : `<header class="k-bar">${I('menu', 26)}<b>Ordera</b><span>Dispečer</span></header>`}
    <main class="k-main" tabindex="-1">${head}
      <div class="k-body">${desk ? `<div class="m-grid">${left}${right}</div>` : right}</div></main>
    <div class="k-ov" data-r="ov" hidden></div><div class="k-toasts" aria-live="polite"></div>`;
};

// ---------------------------------------------------------------- pokretanje
const fit = (wrap, app, width) => {
  const apply = () => { const s = Math.min(1, wrap.clientWidth / width); app.style.transform = `scale(${s})`; wrap.style.height = `${app.offsetHeight * s}px`; wrap.dataset.scale = s.toFixed(3); };
  apply(); new ResizeObserver(apply).observe(wrap);
};

const renderGallery = () => {
  const dummy = { ui: { flash: new Set(), open: 'g1', filter: {}, rshown: {} }, mode: 'desk' };
  const mk = (over) => ({
    id: 'g', key: 'g', category: 'announcement', title: 'Pada kiša, pazite na put', body: 'Kiša cijeli dan.', sentAt: nowMs() - 6 * 60_000, recipients: [30189, 30192, 30195, 30204, 30207, 30213, 30219, 30225], audience: 'Svi aktivni',
    results: new Map(), status: 'sent', checking: false, checkedAt: null, progress: 0, intended: 8, sentCount: 8, ...over,
  });
  const res = (states) => new Map([30189, 30192, 30195, 30204, 30207, 30213, 30219, 30225].map((id, i) => [id, { state: states[i], inboxId: 1000 + i }]));
  const G = {
    'g-new': mk({ id: 'g-new' }),
    'g-run': mk({ id: 'g-run', checking: true, progress: 5 }),
    'g-done': mk({ id: 'g-done', checkedAt: nowMs() - 40_000, results: res(['read', 'read', 'unread', 'read', 'unread', 'read', 'read', 'missing']) }),
    'g-all': mk({ id: 'g-all', category: 'promotion', title: 'Vikend bonus', checkedAt: nowMs() - 20_000, results: res(Array(8).fill('read')) }),
    'g-gone': mk({ id: 'g-gone', category: 'todo', title: 'Javi se dispečeru', status: 'retracted', retracted: { ok: 8, fail: 0, total: 8 }, checkedAt: nowMs() }),
    'g-big': mk({ id: 'g-big', recipients: Array.from({ length: 41 }, (_, i) => 30000 + i), audience: 'Svi aktivni' }),
  };
  Object.entries(G).forEach(([id, b]) => {
    const host = document.getElementById(id);
    if (host) host.innerHTML = sentCardHTML({ ...dummy, ui: { ...dummy.ui, open: null } }, b);
  });
  const tiles = document.getElementById('g-tiles');
  if (tiles) {
    const inst = { ui: { sel: { kind: 'preset', key: 'delivering' } } };
    const saved = { ...SRV.flags };
    SRV.flags.balances = false;
    tiles.innerHTML = tilesHTML(inst, M.presetCounts(SRV.data.roster));
    Object.assign(SRV.flags, saved);
    $$('button', tiles).forEach((b) => { b.tabIndex = -1; b.setAttribute('inert', ''); });
  }
  const pv = [['g-pv1', 'announcement', 'Pada kiša, pazite na put', 'Kiša cijeli dan. Vozite oprezno.', 'list'], ['g-pv2', 'todo', 'Javi se dispečeru', 'Molim te da se javiš na broj 051 123 456 čim završiš trenutnu dostavu.', 'open'], ['g-pv3', 'promotion', 'Vikend bonus', 'Svaka dostava nosi bonus. Detalji: www.ordera.app/bonus', 'open']];
  pv.forEach(([id, category, title, body, mode]) => {
    const host = document.getElementById(id);
    if (host) host.innerHTML = previewHTML({ ui: { draft: { category, title, body }, pv: mode } });
  });
};

window.__MB = { SRV, M, MW, makeInst, fit, I, esc, nowMs, sentCardHTML, previewHTML, rowHTML };

const boot = () => {
  const deskRoot = $('#m-desk'), phoneRoot = $('#m-phone');
  if (!deskRoot && !phoneRoot) return;
  if (deskRoot) { window.__MB.desk = makeInst('desk', deskRoot); fit($('#m-desk-wrap'), deskRoot, 1280); }
  if (phoneRoot) {
    window.__MB.phone = makeInst('phone', phoneRoot);
    const pw = phoneRoot.parentElement;
    if (pw && !pw.hasAttribute('data-nofit')) fit(pw, phoneRoot, 390);
  }
  renderGallery();

  const themeBtn = $('#theme-btn');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const r = document.documentElement;
    const dark = r.dataset.theme === 'dark' || (!r.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    r.dataset.theme = dark ? 'light' : 'dark';
    themeBtn.setAttribute('aria-pressed', String(!dark));
  });

  // ------------------------------------------------------------ upravljanje na ploči
  const press = (sel, on) => $$(sel).forEach((b) => b.setAttribute('aria-pressed', String(on(b))));
  window.syncControls = () => {
    press('[data-ctl=state]', (b) => b.dataset.v === SRV.flags.state);
    press('[data-ctl=sources]', (b) => (b.dataset.v === 'ok' ? SRV.flags.locations && SRV.flags.balances : b.dataset.v === 'locations' ? !SRV.flags.locations : !SRV.flags.balances));
    press('[data-ctl=send]', (b) => b.dataset.v === SRV.flags.send);
    press('[data-ctl=check]', (b) => b.dataset.v === SRV.flags.check);
    press('[data-ctl=retract]', (b) => b.dataset.v === SRV.flags.retract);
    press('[data-ctl=scale]', (b) => b.dataset.v === SRV.scale);
    press('[data-ctl=phase2]', () => SRV.flags.phase2);
  };
  const rebuildWorld = () => {
    const keep = SRV.log;
    resetWorld();
    SRV.log = keep;
    SRV.insts.forEach((i) => { i.ui.sel = { kind: 'preset', key: 'active' }; i.ui.shown = PAGE; i.ui.q = ''; i.batches = []; i.ui.open = null; i.built = false; });
  };
  $$('[data-ctl]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.ctl, v = b.dataset.v;
    if (k === 'state') SRV.flags.state = v;
    else if (k === 'sources') { if (v === 'ok') { SRV.flags.locations = true; SRV.flags.balances = true; } else if (v === 'locations') SRV.flags.locations = !SRV.flags.locations; else SRV.flags.balances = !SRV.flags.balances; }
    else if (k === 'send') SRV.flags.send = v;
    else if (k === 'check') SRV.flags.check = v;
    else if (k === 'retract') SRV.flags.retract = v;
    else if (k === 'scale') { SRV.scale = v; rebuildWorld(); }
    else if (k === 'phase2') SRV.flags.phase2 = !SRV.flags.phase2;
    syncControls();
    emitAll(k === 'phase2' ? 'phase2' : 'flags');
    renderGallery();
  }));
  $('[data-board=time]')?.addEventListener('click', () => {
    SRV.offset += 120_000;
    SRV.insts.forEach((i) => { i.batches.forEach((b) => { if (b.checkedAt && !b.checking) i.check(b, { auto: true }); }); });
    emitAll('time');
  });
  $('[data-board=reopen]')?.addEventListener('click', () => { SRV.insts.forEach((i) => i.reopen()); });
  $('[data-board=reset]')?.addEventListener('click', () => {
    Object.assign(SRV.flags, { state: 'ok', locations: true, balances: true, send: 'ok', check: 'ok', retract: 'ok', phase2: false });
    SRV.scale = 'small'; SRV.offset = 0; SRV.drafts = {}; SRV.tpl = []; saveTpl();
    rebuildWorld();
    SRV.insts.forEach((i) => { i.timers.forEach(clearTimeout); i.timers = []; i.closeSheet(true); Object.assign(i.ui, { tab: 'new', draft: { category: 'announcement', title: '', body: '' }, touched: {}, submitted: false, restored: null, undo: null, menu: false, hist: null, sendError: '' }); i.built = false; i.refresh(); });
    syncControls(); renderLog(); renderGallery();
  });
  syncControls();

  const logEl = $('#m-log');
  const renderLog = () => {
    if (!logEl) return;
    if (!SRV.log.length) { logEl.innerHTML = '<p class="muted small">Ovdje se vidi šta bi otišlo serveru kad pošalješ poruku, provjeriš čitanje ili povučeš poruku.</p>'; return; }
    const cnt = SRV.hist.reduce((o, e) => { o[e.method] = (o[e.method] || 0) + 1; return o; }, {});
    const head = `<p class="small" style="margin-bottom:10px"><b>Zahtjeva ukupno: ${SRV.hist.length}</b> · ${Object.entries(cnt).map(([m, n]) => `${m} ${n}`).join(' · ')}</p>`;
    logEl.innerHTML = head + SRV.log.slice(0, 6).map((e) => `<div class="k-logrow"><b>${esc(e.method)} <code>${esc(e.path)}</code></b>${e.body ? `<pre class="code">${esc(JSON.stringify(e.body, null, 2))}</pre>` : ''}${e.note ? `<span class="muted small">${esc(e.note)}</span>` : ''}</div>`).join('');
  };
  window.addEventListener('m-log', renderLog); renderLog();
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
