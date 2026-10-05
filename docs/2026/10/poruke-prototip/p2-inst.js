// ---------------------------------------------------------------- instanca (računar / telefon)
function makeInst(mode, root) {
  const inst = {
    id: mode, mode, root, sheet: null, opener: null, sending: false, batches: [], seq: 0, built: false, timers: [],
    ui: {
      tab: 'new', q: '', shown: PAGE, sel: { kind: 'preset', key: 'active' }, draft: { category: 'announcement', title: '', body: '' },
      touched: {}, submitted: false, pv: 'list', menu: false, tabId: null, flash: new Set(), restored: null, undo: null,
      filter: {}, rshown: {}, open: null, hist: null, hdel: null, sendError: '', lastSent: null,
    },
  };
  root.innerHTML = frameHTML(mode);
  inst.el = {
    main: $('.k-main', root), right: $('[data-r=right]', root), list: $('[data-r=listcard]', root), ph: $('.k-ph', root),
    sub: $('[data-r=sub]', root), ov: $('.k-ov', root), toasts: $('.k-toasts', root), back: $('[data-r=back]', root),
  };
  const uid = (s) => `m-${inst.id}-${s}`;
  inst.uid = uid;

  // ------------------------------------------------------------ izvedeno
  const roster = () => SRV.data.roster;
  const ok = () => SRV.flags.state === 'ok';
  const counts = () => M.presetCounts(roster());
  // izabrana grupa čiji izvor ne radi pada na "Svi aktivni" (ne ostaje tiho prazna)
  const normalizeSel = () => {
    const s = inst.ui.sel;
    if (s.kind === 'preset') {
      const p = preset(s.key);
      if ((p.needs === 'locations' && !SRV.flags.locations) || (p.needs === 'balances' && !SRV.flags.balances)) inst.ui.sel = { kind: 'preset', key: 'active' };
    }
  };
  const audience = () => (ok() ? M.audienceOf(roster(), inst.ui.sel) : []);
  const plan = () => M.sendPlan(roster(), audience());
  const matched = () => M.sortRoster(roster().filter((c) => M.matchCourier(c, inst.ui.q)));
  inst.audience = audience;
  inst.plan = plan;
  inst.matched = matched;
  inst.counts = counts;

  // fokus se vraća na isti element poslije ponovnog iscrtavanja
  const keepFocus = (fn) => {
    const a = document.activeElement;
    const fk = a && inst.root.contains(a) ? a.getAttribute('data-fk') : null;
    fn();
    if (fk) { const n = inst.root.querySelector(`[data-fk="${CSS.escape(fk)}"]`); if (n && n !== document.activeElement) n.focus({ preventScroll: true }); }
  };
  inst.keepFocus = keepFocus;
  const q$ = (sel) => inst.root.querySelector(sel);

  // ------------------------------------------------------------ zaglavlje
  const renderHeader = () => {
    const r = roster();
    const live = r.filter((c) => ['delivering', 'online'].includes(M.liveGroup(c))).length;
    $('[data-r=title]', root).textContent = 'Poruke';
    $('[data-r=sub]', root).textContent = ok() ? `${M.couriersText(r.length)} · ${live} uživo` : '';
  };

  // ------------------------------------------------------------ lijeva lista (računar) / list "Izaberi ručno" (telefon)
  const listTarget = () => (inst.mode === 'desk' ? inst.el.list : (inst.sheet && inst.sheet.kind === 'pick' ? q$('[data-r=sbody]') : null));
  const listShell = () => `
    <div class="m-lt"><div class="k-search" data-r="search"><span style="display:grid;place-items:center">${I('magnify', 22)}</span>
      <input type="search" inputmode="search" enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="Ime, telefon ili #ID" aria-label="Pretraži kurire po imenu, telefonu ili ID-u" data-r="q" data-field="q" value="${esc(inst.ui.q)}">
      ${inst.mode === 'desk' ? '<kbd aria-hidden="true" data-r="kbd">/</kbd>' : ''}<button type="button" class="k-x" data-act="clearq" data-r="clearq" aria-label="Obriši pretragu" hidden>${I('close', 20)}</button></div></div>
    <div class="m-sub2" data-r="lsub"></div>
    <div data-r="lbody"></div>
    <div data-r="lmore"></div>`;
  inst.listShell = listShell;

  const renderList = () => {
    const root2 = listTarget();
    if (!root2) return;
    const body = $('[data-r=lbody]', root2), sub = $('[data-r=lsub]', root2), more = $('[data-r=lmore]', root2);
    if (!body) return;
    const st = SRV.flags.state;
    const qEl = $('[data-r=q]', root2);
    if (qEl && qEl.value !== inst.ui.q) qEl.value = inst.ui.q;
    const cl = $('[data-r=clearq]', root2); if (cl) cl.hidden = !inst.ui.q;
    const kb = $('[data-r=kbd]', root2); if (kb) kb.hidden = !!inst.ui.q;
    keepFocus(() => {
      if (st === 'loading') { body.innerHTML = `<ul class="k-ul m-skeleton" role="status" aria-label="Učitavam kurire">${skeletonRows(7)}</ul>`; sub.innerHTML = '<span>Učitavam…</span>'; more.innerHTML = ''; return; }
      if (st === 'error') { body.innerHTML = `<div class="k-empty" role="alert">${I('cloud-off-outline', 34)}<b>Ne mogu da učitam kurire</b><p>Server ne odgovara. Tvoj tekst poruke je sačuvan, samo ne mogu da izaberem primaoce.</p><button type="button" class="k-btn k-btn--p" data-act="retry" data-fk="retry">${I('refresh', 18)}Pokušaj ponovo</button></div>`; sub.innerHTML = ''; more.innerHTML = ''; return; }
      if (st === 'empty') { body.innerHTML = `<div class="k-empty">${I('account-group-outline', 34)}<b>Još nema kurira u ovoj firmi</b><p>Poruku nema kome da se pošalje. Kurire dodaješ na ekranu Kuriri.</p></div>`; sub.innerHTML = ''; more.innerHTML = ''; return; }
      const list = matched();
      const picked = new Set(audience().map((c) => c.id));
      const shown = list.slice(0, inst.ui.shown);
      const tabId = shown.some((c) => c.id === inst.ui.tabId) ? inst.ui.tabId : shown[0] && shown[0].id;
      const pd = $('[data-r=pickdone]', inst.el.ov); if (pd) pd.textContent = picked.size ? `Gotovo · ${picked.size} izabrano` : 'Gotovo';
      sub.innerHTML = `<span><b>${picked.size}</b> od ${roster().length} izabrano</span><span style="display:inline-flex;gap:2px;flex-wrap:wrap"><button type="button" class="m-lnk" data-act="selshown" data-fk="selshown" ${list.length ? '' : 'disabled'}>Izaberi prikazane${list.length !== roster().length ? ` (${list.length})` : ''}</button><button type="button" class="m-lnk" data-act="selnone" data-fk="selnone" ${picked.size ? '' : 'disabled'}>Poništi</button></span>`;
      if (!list.length) {
        const q = inst.ui.q.trim();
        body.innerHTML = `<div class="k-empty">${I('magnify-close', 34)}<b>Nema kurira za „${esc(q)}“</b><p>Pretraga razumije ime sa i bez dijakritika, ćirilicu, telefon u bilo kom zapisu i #ID.</p><button type="button" class="k-btn" data-act="clearq" data-fk="clearq2">Očisti pretragu</button></div>`;
        more.innerHTML = '';
        return;
      }
      body.innerHTML = `<ul class="k-ul" aria-label="Kuriri">${shown.map((c) => rowHTML(inst, c, picked.has(c.id), c.id === tabId, inst.ui.flash.has(c.id))).join('')}</ul>`;
      more.innerHTML = `<div class="m-ground"><span style="flex:1">${list.length > shown.length ? `Prikazano ${shown.length} od ${list.length}` : `Ažurirano ${clockNow()}`}</span>${list.length > shown.length ? `<button type="button" class="k-btn" data-act="more" data-fk="more">Prikaži još ${Math.min(PAGE, list.length - shown.length)}</button>` : `<button type="button" class="k-btn k-btn--icon" data-act="refresh" data-fk="refresh" aria-label="Osvježi listu">${I('refresh', 20)}</button>`}</div>`;
    });
  };
  inst.renderList = renderList;

  // ------------------------------------------------------------ desna strana: tabovi
  const renderTabs = () => {
    const n = inst.batches.length + (SRV.flags.phase2 ? 0 : 0);
    $('[data-r=tabs]', root).innerHTML = `<div class="m-tabs" role="tablist" aria-label="Poruke">
      <button type="button" role="tab" class="m-tab" id="${uid('tab-new')}" aria-selected="${inst.ui.tab === 'new'}" aria-controls="${uid('pane')}" tabindex="${inst.ui.tab === 'new' ? 0 : -1}" data-act="tab:new" data-fk="tab:new">${I('square-edit-outline', 20)}Nova poruka</button>
      <button type="button" role="tab" class="m-tab" id="${uid('tab-sent')}" aria-selected="${inst.ui.tab === 'sent'}" aria-controls="${uid('pane')}" tabindex="${inst.ui.tab === 'sent' ? 0 : -1}" data-act="tab:sent" data-fk="tab:sent">${I('send-outline', 20)}Poslato${n ? `<em>${n}</em>` : ''}</button></div>`;
  };

  // ------------------------------------------------------------ nova poruka
  const catPills = () => M.CAT_ORDER.map((k) => {
    const c = M.CATS[k];
    return `<button type="button" role="radio" class="k-sg" aria-checked="${inst.ui.draft.category === k}" tabindex="${inst.ui.draft.category === k ? 0 : -1}" data-act="cat:${k}" data-fk="cat:${k}" data-cat="${k}">${I(c.icon, 18)}${c.label}</button>`;
  }).join('');

  const composeHTML = () => {
    const d = inst.ui.draft;
    return `
    <div data-r="banner"></div>
    <div class="m-sec"><h2 class="k-gt">Kome</h2><div data-r="aud"></div></div>
    <div class="m-sec">
      <h2 class="k-gt"><span>Poruka</span><span style="position:relative">
        <button type="button" class="m-tplbtn" data-act="tpl" data-fk="tpl" aria-haspopup="menu" aria-expanded="false" data-r="tplbtn">${I('text-box-outline', 18)}Šabloni${I('chevron-down', 18)}</button><span data-r="menu"></span></span></h2>
      <div class="m-form">
        <div class="m-cats" role="radiogroup" aria-label="Kategorija poruke" data-r="cats">${catPills()}</div>
        <div class="k-f"><label for="${uid('title')}">Naslov</label>
          <div class="k-in" data-r="in-title"><input id="${uid('title')}" data-field="title" type="text" enterkeyhint="next" autocomplete="off" value="${esc(d.title)}" aria-describedby="${uid('mt')}"></div>
          <div class="k-msg" id="${uid('mt')}" data-r="msg-title" aria-live="polite"></div></div>
        <div class="k-f"><label class="m-lab" for="${uid('body')}"><span>Tekst poruke</span><span class="m-count" data-r="count"></span></label>
          <div class="k-in k-in--area" data-r="in-body"><textarea id="${uid('body')}" data-field="body" rows="4" aria-describedby="${uid('mb')}">${esc(d.body)}</textarea></div>
          <div class="k-msg" id="${uid('mb')}" data-r="msg-body" aria-live="polite"></div>
          <span class="m-hint">${I('information-outline', 16)}Brojevi telefona i linkovi u tekstu postaju dodirljivi.</span></div>
      </div>
    </div>
    <div class="m-sec"><h2 class="k-gt">Pregled</h2><div class="m-pv" data-r="pv"></div></div>
    <div class="m-foot" data-r="foot"></div>`;
  };

  const patchBanner = () => {
    const b = q$('[data-r=banner]');
    if (!b) return;
    if (inst.ui.restored) b.innerHTML = `<div class="m-draftbar" role="status">${I('content-save-outline', 18)}<span>Vraćen nacrt od ${esc(inst.ui.restored)}.</span><button type="button" data-act="drop-draft" data-fk="drop-draft">Odbaci nacrt</button></div>`;
    else if (inst.ui.undo) b.innerHTML = `<div class="m-draftbar" role="status">${I('information-outline', 18)}<span>Šablon je zamijenio tvoj tekst.</span><button type="button" data-act="undo" data-fk="undo">Vrati moj tekst</button></div>`;
    else b.innerHTML = '';
  };

  const patchAudience = () => {
    const a = q$('[data-r=aud]');
    if (!a) return;
    normalizeSel();
    keepFocus(() => {
      const st = SRV.flags.state;
      if (st === 'loading') { a.innerHTML = `<div class="m-skt m-skeleton">${Array.from({ length: 6 }, () => '<i class="b" style="height:68px;border-radius:16px"></i>').join('')}</div><div class="m-notes"><span class="m-skeleton"><i class="b" style="height:66px;border-radius:14px"></i></span></div>`; return; }
      if (st === 'error' || st === 'empty') {
        a.innerHTML = `<div class="m-notes">${tint(st === 'error' ? 'bad' : 'warn', st === 'error' ? 'cloud-off-outline' : 'account-group-outline', st === 'error' ? 'Spisak kurira nije učitan' : 'Firma nema kurira', st === 'error' ? 'Primaoce ne mogu da izaberem dok se spisak ne učita. Tekst poruke ostaje kakav jeste.' : 'Poruku nema kome da se pošalje.', st === 'error' ? `<button type="button" data-act="retry" data-fk="retry2">Pokušaj ponovo</button>` : '')}</div>`;
        return;
      }
      const list = audience();
      const notes = [];
      if (!SRV.flags.locations) notes.push(tint('warn', 'map-marker-off-outline', 'Stanje uživo trenutno nije dostupno', 'Grupe „U dostavi“, „Slobodni“ i „Offline“ su isključene dok se pozicije ne vrate. Ostalo radi.'));
      if (!SRV.flags.balances) notes.push(tint('warn', 'cash-multiple', 'Dugovanja trenutno nisu dostupna', 'Grupa „Duguju gotovinu“ je isključena dok se podaci o novcu ne vrate.'));
      a.innerHTML = `<div class="m-tiles" role="radiogroup" aria-label="Grupa primalaca" data-r="tiles">${tilesHTML(inst, counts())}</div>${sumHTML(inst, list)}${notes.length ? `<div class="m-notes">${notes.join('')}</div>` : ''}`;
    });
  };

  const fieldMsg = (key) => {
    const d = inst.ui.draft;
    const bad = key === 'title' ? !d.title.trim() : !d.body.trim();
    return bad && (inst.ui.touched[key] || inst.ui.submitted) ? (key === 'title' ? 'Upiši naslov.' : 'Upiši tekst poruke.') : '';
  };
  const patchFields = () => {
    ['title', 'body'].forEach((k) => {
      const msg = fieldMsg(k);
      const m = q$(`[data-r=msg-${k}]`), box = q$(`[data-r=in-${k}]`);
      if (m) m.innerHTML = msg ? `${I('alert-circle-outline', 16)}<span>${msg}</span>` : '';
      if (m) m.className = `k-msg${msg ? ' bad' : ''}`;
      if (box) box.classList.toggle('bad', !!msg);
      const inp = q$(`[data-field=${k}]`); if (inp) inp.setAttribute('aria-invalid', msg ? 'true' : 'false');
    });
    const ct = q$('[data-r=count]');
    if (ct) { const n = inst.ui.draft.body.length; ct.textContent = n ? `${n} znakova` : ''; }
  };
  const patchPreview = () => { const p = q$('[data-r=pv]'); if (p) keepFocus(() => { p.innerHTML = previewHTML(inst); }); };
  const patchFooter = () => {
    const f = q$('[data-r=foot]');
    if (!f) return;
    const p = plan();
    const chk = M.checkDraft(inst.ui.draft, p.count);
    const label = inst.sending ? 'Šaljem…' : p.count ? `Pošalji ${M.couriersText(p.count)}` : 'Pošalji';
    const hint = inst.sending ? '' : !ok() ? 'Spisak kurira nije učitan.' : chk.valid ? (p.confirm ? 'Prije slanja tražimo još jednu potvrdu.' : 'Kurir vidi poruku kad otvori aplikaciju.') : chk.hint;
    keepFocus(() => {
      f.innerHTML = `${inst.ui.sendError ? tint('bad', 'alert-circle-outline', 'Ne mogu da pošaljem', esc(inst.ui.sendError)) : ''}
        <button type="button" class="k-ab${inst.sending ? ' k-ab--busy' : ''}" data-act="send" data-fk="send" data-r="send" ${!chk.valid || inst.sending || !ok() ? 'disabled' : ''} ${inst.sending ? 'aria-busy="true"' : ''}>${inst.sending ? `<svg class="ic k-spin" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${ICONS.refresh}"/></svg>` : I('send-outline', 20)}${label}</button>
        <p aria-live="polite">${esc(hint)}</p>`;
    });
  };
  const patchMenu = () => {
    const m = q$('[data-r=menu]'), b = q$('[data-r=tplbtn]');
    if (!m || !b) return;
    b.setAttribute('aria-expanded', String(inst.ui.menu));
    if (!inst.ui.menu) { m.innerHTML = ''; return; }
    const item = (t, custom) => {
      const c = M.catOf(t.category);
      return `<div style="display:grid;grid-template-columns:minmax(0,1fr) ${custom ? '40px' : ''}"><button type="button" class="m-mi" role="menuitem" data-act="tplpick:${t.id}" data-fk="tplpick:${t.id}" style="--tint:${c.tint};--ink-c:${c.color}"><span class="ic0">${I(c.icon, 20)}</span><span style="min-width:0"><b>${esc(t.label)}</b><small>${esc(t.title)}</small></span><span></span></button>${custom ? `<button type="button" class="m-mi del" role="menuitem" data-act="tpldel:${t.id}" data-fk="tpldel:${t.id}" aria-label="Obriši šablon ${esc(t.label)}" style="grid-template-columns:36px;padding:0 2px">${I('trash-can-outline', 20)}</button>` : ''}</div>`;
    };
    const d = inst.ui.draft, canSave = d.title.trim() && d.body.trim();
    m.innerHTML = `<div class="m-menu" role="menu" aria-label="Šabloni">
      <div class="m-mh">Početni tekstovi</div>${M.TEMPLATES.map((t) => item(t, false)).join('')}
      ${SRV.tpl.length ? `<div class="m-mdiv"></div><div class="m-mh">Tvoji šabloni</div>${SRV.tpl.map((t) => item(t, true)).join('')}` : ''}
      <div class="m-mdiv"></div>
      <button type="button" class="m-mi" role="menuitem" data-act="tplsave" data-fk="tplsave" ${canSave ? '' : 'disabled style="opacity:.5;cursor:not-allowed"'}><span class="ic0" style="--tint:#eef4ff;--ink-c:#2459c7">${I('content-save-outline', 20)}</span><span><b>Sačuvaj ovu poruku kao šablon</b><small>${canSave ? 'Ostaje u ovom pregledaču' : 'Prvo upiši naslov i tekst'}</small></span><span></span></button></div>`;
  };
  inst.patch = { audience: patchAudience, fields: patchFields, preview: patchPreview, footer: patchFooter, menu: patchMenu, banner: patchBanner };
  const patchAll = () => { patchBanner(); patchAudience(); patchFields(); patchPreview(); patchFooter(); patchMenu(); };

  const buildCompose = () => {
    const pane = $('[data-r=pane]', root);
    if (!pane) return;
    pane.innerHTML = composeHTML();
    inst.built = true;
    patchAll();
  };

  // ------------------------------------------------------------ poslato
  const allSentBatches = () => {
    const list = [...inst.batches].sort((a, b) => b.sentAt - a.sentAt);
    return list;
  };
  const serverBatchObjs = () =>
    SRV.serverBatches().map((s) => ({
      id: `srv-${s.key}`, key: s.key, server: true, category: s.category, title: s.title, body: s.body, sentAt: s.sentAt, audience: s.rows.length === roster().length ? 'Svi kuriri' : 'Izabrani',
      recipients: s.rows.map((r) => r.courierId), results: new Map(s.rows.map((r) => [r.courierId, { state: r.read ? 'read' : 'unread', inboxId: r.inboxId }])), checkedAt: nowMs(), checking: false, status: 'sent',
    }));
  inst.serverBatchObjs = serverBatchObjs;

  const renderSent = () => {
    const pane = $('[data-r=pane]', root);
    if (!pane) return;
    const mine = allSentBatches();
    let html = '';
    if (!SRV.flags.phase2) {
      if (!mine.length) {
        html = `<div class="m-empty">${I('send-outline', 34)}<b>Još ništa nije poslato u ovoj sesiji</b><p>Poruke koje pošalješ pojavljuju se ovdje, pa možeš da provjeriš ko ih je pročitao i da podsjetiš one koji nisu. Starije poruke se još ne čuvaju na serveru (B1); poruke pojedinog kurira nađi preko ikone <b>Poruke kurira</b> u listi.</p><button type="button" class="k-btn k-btn--p" data-act="tab:new" data-fk="tab-new2">${I('square-edit-outline', 18)}Nova poruka</button></div>`;
      } else {
        html = `<div class="m-sent" aria-label="Poslato"><div class="m-day">Poslato u ovoj sesiji</div>${mine.map((b) => sentCardHTML(inst, b)).join('')}</div>`;
      }
    } else {
      const all = [...mine, ...serverBatchObjs()].sort((a, b) => b.sentAt - a.sentAt);
      let last = '';
      const parts = all.map((b) => {
        const day = M.dayLabel(b.sentAt, nowMs());
        const head = day !== last ? `<div class="m-day">${day}</div>` : '';
        last = day;
        return head + sentCardHTML(inst, b);
      }).join('');
      html = `<div class="m-p2"><div class="m-p2h"><div class="m-day" style="padding:0">Poslato</div><span class="m-ribbon">${I('timer-sand', 14)}Faza 2 · čeka backend (B1)</span></div>${parts}</div>`;
    }
    keepFocus(() => { pane.innerHTML = html; });
  };
  inst.renderSent = renderSent;

  // ------------------------------------------------------------ cijela instanca
  const renderRight = () => {
    renderTabs();
    const pane = $('[data-r=pane]', root);
    pane.setAttribute('role', 'tabpanel');
    pane.setAttribute('id', uid('pane'));
    pane.setAttribute('aria-labelledby', uid(inst.ui.tab === 'new' ? 'tab-new' : 'tab-sent'));
    $('[data-r=scroll]', root).classList.toggle('m-card', inst.ui.tab === 'new');
    if (inst.ui.tab === 'new') { if (!inst.built) buildCompose(); else patchAll(); } else { inst.built = false; renderSent(); }
  };
  inst.renderRight = renderRight;
  inst.refresh = () => {
    renderHeader();
    renderRight();
    if (inst.mode === 'desk') {
      if (!$('[data-r=lbody]', inst.el.list)) inst.el.list.innerHTML = listShell();
      renderList();
    } else if (inst.sheet && inst.sheet.kind === 'pick') renderList();
  };
  inst.renderHeader = renderHeader;
  inst.patchAll = patchAll;
  inst.buildCompose = buildCompose;
  inst.q$ = q$;
  inst.toast = (text, tone = 'ok') => {
    const t = document.createElement('div');
    t.className = `k-toast${tone === 'bad' ? ' k-toast--bad' : tone === 'info' ? ' k-toast--info' : ''}`;
    t.setAttribute('role', tone === 'bad' ? 'alert' : 'status');
    t.innerHTML = `${I(tone === 'bad' ? 'alert-circle-outline' : tone === 'info' ? 'information-outline' : 'check-circle-outline', 22)}<span>${esc(text)}</span>`;
    inst.el.toasts.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  };
  inst.flash = (ids, key = 'flash') => {
    ids.forEach((id) => inst.ui.flash.add(id));
    setTimeout(() => { ids.forEach((id) => inst.ui.flash.delete(id)); }, 1800);
  };

  attachFlows(inst);
  attachEvents(inst);
  SRV.insts.push(inst);
  inst.refresh();
  return inst;
}
