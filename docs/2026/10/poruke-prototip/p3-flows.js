// ---------------------------------------------------------------- tokovi: izbor, nacrt, slanje, praćenje, povlačenje, istorija
const HPAGE = 8;
const CONC = 6;

function attachFlows(inst) {
  const ui = inst.ui;
  const q$ = inst.q$;
  const roster = () => SRV.data.roster;

  // ------------------------------------------------------------ izbor primalaca
  inst.afterSel = () => { inst.patch.audience(); inst.patch.footer(); inst.renderList(); inst.saveDraft(); };
  inst.setPreset = (key) => {
    const p = preset(key);
    if ((p.needs === 'locations' && !SRV.flags.locations) || (p.needs === 'balances' && !SRV.flags.balances)) { inst.toast('Taj izvor podataka trenutno ne radi.', 'info'); return; }
    ui.sel = { kind: 'preset', key };
    inst.afterSel();
  };
  inst.togglePick = (id) => {
    const cur = new Set(inst.audience().map((c) => c.id));
    if (cur.has(id)) cur.delete(id); else cur.add(id);
    ui.sel = { kind: 'manual', ids: cur };
    inst.afterSel();
  };
  inst.selShown = () => {
    const cur = new Set(inst.audience().map((c) => c.id));
    inst.matched().forEach((c) => cur.add(c.id));
    ui.sel = { kind: 'manual', ids: cur };
    inst.afterSel();
  };
  inst.selNone = () => { ui.sel = { kind: 'manual', ids: new Set() }; inst.afterSel(); };

  // ------------------------------------------------------------ nacrt (sam se čuva; nema upozorenja pri izlasku)
  let draftTimer = null;
  inst.saveDraft = () => {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      if (M.isBlankDraft(ui.draft)) { delete SRV.drafts[inst.id]; return; }
      SRV.drafts[inst.id] = { draft: { ...ui.draft }, sel: ui.sel.kind === 'preset' ? { kind: 'preset', key: ui.sel.key } : { kind: 'manual', ids: [...ui.sel.ids] }, at: nowMs() };
    }, 250);
  };
  inst.restoreDraft = () => {
    const s = SRV.drafts[inst.id];
    if (!s) return false;
    ui.draft = { ...s.draft };
    ui.sel = s.sel.kind === 'preset' ? { kind: 'preset', key: s.sel.key } : { kind: 'manual', ids: new Set(s.sel.ids) };
    ui.restored = M.clock(s.at);
    return true;
  };
  inst.dropDraft = () => {
    delete SRV.drafts[inst.id];
    ui.draft = { category: 'announcement', title: '', body: '' };
    ui.touched = {}; ui.submitted = false; ui.restored = null; ui.undo = null; ui.sendError = '';
    inst.buildCompose();
  };
  inst.setField = (key, value) => {
    ui.draft[key] = value;
    if (ui.sendError) { ui.sendError = ''; }
    if (ui.restored) { ui.restored = null; inst.patch.banner(); }
    if (ui.undo) { ui.undo = null; inst.patch.banner(); }
    inst.patch.fields(); inst.patch.preview(); inst.patch.footer();
    inst.saveDraft();
  };
  inst.setCat = (k) => {
    ui.draft.category = k;
    const cats = q$('[data-r=cats]');
    if (cats) $$('[data-cat]', cats).forEach((b) => { const on = b.getAttribute('data-cat') === k; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
    inst.patch.preview(); inst.patch.footer(); inst.saveDraft();
  };
  const setFieldValues = () => {
    const t = q$('[data-field=title]'), b = q$('[data-field=body]');
    if (t) t.value = ui.draft.title;
    if (b) b.value = ui.draft.body;
  };

  // ------------------------------------------------------------ šabloni
  inst.openMenu = (open) => { ui.menu = open; inst.patch.menu(); if (open) { const f = q$('.m-menu [role=menuitem]'); if (f) f.focus({ preventScroll: true }); } };
  inst.applyTemplate = (id) => {
    const t = [...M.TEMPLATES, ...SRV.tpl].find((x) => x.id === id);
    if (!t) return;
    ui.undo = M.isBlankDraft(ui.draft) ? null : { ...ui.draft };
    ui.draft = { category: t.category, title: t.title, body: t.body };
    ui.touched = {}; ui.submitted = false; ui.menu = false;
    setFieldValues();
    inst.buildCompose();
    const tf = q$('[data-field=title]'); if (tf) tf.focus({ preventScroll: true });
    inst.saveDraft();
  };
  inst.undoTemplate = () => {
    if (!ui.undo) return;
    ui.draft = { ...ui.undo }; ui.undo = null;
    inst.buildCompose();
  };
  inst.deleteTemplate = (id) => {
    SRV.tpl = SRV.tpl.filter((x) => x.id !== id);
    saveTpl();
    inst.patch.menu();
    inst.toast('Šablon je obrisan.', 'info');
  };

  // ------------------------------------------------------------ slanje
  const audienceLabel = (p) => {
    if (p.count === 1) return dispNameOf(p.ids[0]);
    if (ui.sel.kind === 'preset') return preset(ui.sel.key).label;
    return p.everyone ? 'Svi kuriri' : 'Ručno izabrani';
  };
  const dispNameOf = (id) => { const c = byId(id); return c ? M.fullName(c.first, c.last) : `#${id}`; };

  inst.trySend = async () => {
    if (inst.sending) return;
    const p = inst.plan();
    const chk = M.checkDraft(ui.draft, p.count);
    if (!chk.valid || !ok()) {
      ui.submitted = true;
      inst.patch.fields();
      const bad = !ui.draft.title.trim() ? 'title' : !ui.draft.body.trim() ? 'body' : null;
      if (bad) { const f = q$(`[data-field=${bad}]`); if (f) f.focus({ preventScroll: false }); }
      return;
    }
    if (p.confirm) { inst.openSheet('confirm'); return; }
    await inst.doSend(p);
  };
  const ok = () => SRV.flags.state === 'ok';

  inst.doSend = async (p) => {
    inst.sending = true; ui.sendError = '';
    inst.patch.footer();
    const confirmBtn = q$('[data-act="confirm-send"]'); if (confirmBtn) { confirmBtn.disabled = true; }
    try {
      const d = { ...ui.draft };
      const label = audienceLabel(p);
      const res = await SRV.send(p, d);
      const batch = {
        id: `b${++inst.seq}`, key: res.key, category: d.category, title: d.title.trim(), body: d.body.trim(), sentAt: res.created, recipients: p.ids.slice(),
        audience: label, results: new Map(), status: 'sent', checking: false, checkedAt: null, progress: 0, intended: p.count, sentCount: res.sent_to_count,
      };
      inst.batches.unshift(batch);
      ui.draft = { category: 'announcement', title: '', body: '' };
      ui.touched = {}; ui.submitted = false; ui.restored = null; ui.undo = null;
      delete SRV.drafts[inst.id];
      const st = M.sentText(res.sent_to_count, p.count);
      inst.toast(st.text, st.tone === 'ok' ? 'ok' : 'info');
      if (inst.sheet) inst.closeSheet(true);
      ui.tab = 'sent'; ui.open = null;
      inst.flash([batch.id]);
      inst.built = false;
      inst.refresh();
      const card = q$(`[data-fk="bt:${batch.id}"]`); if (card) card.focus({ preventScroll: false });
      if (M.canTrack(batch)) {
        inst.timers.push(setTimeout(() => inst.check(batch, { auto: true }), 20_000));
        inst.timers.push(setTimeout(() => inst.check(batch, { auto: true }), 120_000));
      }
    } catch (e) {
      ui.sendError = 'Server nije prihvatio poruku. Pokušaj ponovo; tekst i izbor primalaca su ostali.';
      if (inst.sheet) inst.closeSheet(true);
    } finally {
      inst.sending = false;
      if (ui.tab === 'new') inst.patch.footer();
    }
  };

  // ------------------------------------------------------------ praćenje čitanja (po sandučiću svakog primaoca)
  inst.renderCard = (batch) => {
    const el = q$(`[data-b="${batch.id}"]`);
    if (!el) return;
    inst.keepFocus(() => { el.outerHTML = sentCardHTML(inst, batch); });
  };
  const claimedByOthers = (batch) => {
    const taken = new Set();
    inst.batches.forEach((b) => {
      if (b === batch || b.category !== batch.category || b.title !== batch.title || b.body !== batch.body || !b.results) return;
      b.results.forEach((r) => { if (r.inboxId != null) taken.add(r.inboxId); });
    });
    return taken;
  };
  inst.check = async (batch, { auto = false } = {}) => {
    if (batch.checking || batch.status === 'retracted') return;
    if (batch.server) {
      logReq('GET', `/dispatcher/delivery-companies/24/messages/${batch.key}/recipients`, null, 'Faza 2 (B1)');
      batch.checking = true; inst.renderCard(batch);
      await lat(120, 260);
      const fresh = SRV.serverBatches().find((s) => s.key === batch.key);
      if (fresh) batch.results = new Map(fresh.rows.map((r) => [r.courierId, { state: r.read ? 'read' : 'unread', inboxId: r.inboxId }]));
      batch.checking = false; batch.checkedAt = nowMs(); inst.renderCard(batch);
      return;
    }
    if (!M.canTrack(batch)) return;
    batch.checking = true; batch.progress = 0; inst.renderCard(batch);
    const results = new Map();
    const taken = claimedByOthers(batch);
    const query = M.checkQuery(batch);
    const queue = batch.recipients.slice();
    const failIds = SRV.flags.check === 'fail' ? new Set(batch.recipients.slice(0, 3)) : new Set();
    let done = 0;
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift();
        try {
          const res = await SRV.inbox(id, { category: query.category, page: query.page, perPage: query.per_page, fail: failIds.has(id) });
          const row = M.matchSent(batch, res.data, taken);
          results.set(id, row ? { state: row.read ? 'read' : 'unread', inboxId: row.id } : { state: 'missing' });
        } catch (e) {
          results.set(id, { state: 'error' });
        }
        done += 1;
        batch.progress = done;
        if (done % 3 === 0 || done === batch.recipients.length) inst.renderCard(batch);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONC, queue.length) }, worker));
    batch.results = results; batch.checking = false; batch.checkedAt = nowMs();
    if (ui.tab === 'sent') inst.renderCard(batch);
  };

  inst.remind = (batch) => {
    const ids = M.unreadIds(batch, batch.results);
    if (!ids.length) return;
    const d = M.reminderDraft(batch);
    ui.draft = d; ui.touched = {}; ui.submitted = false; ui.undo = null; ui.restored = null;
    ui.sel = { kind: 'manual', ids: new Set(ids) };
    ui.tab = 'new'; inst.built = false;
    inst.refresh();
    const tf = q$('[data-field=title]'); if (tf) tf.focus({ preventScroll: true });
    inst.toast(`Podsjetnik je spreman za ${M.couriersText(ids.length)}. Pregledaj i pošalji.`, 'info');
    inst.saveDraft();
  };

  // ------------------------------------------------------------ povlačenje (uklanjanje iz sandučića)
  inst.runRetract = async (batch) => {
    const rt = inst.sheet && inst.sheet.rt;
    if (!rt || rt.phase === 'run') return;
    rt.phase = 'run'; rt.done = 0; rt.ok = 0; rt.fail = 0;
    inst.paintRetract();
    if (batch.server) {
      logReq('DELETE', `/dispatcher/delivery-companies/24/messages/${batch.key}`, null, 'Faza 2 (B1)');
      await lat(200, 340);
      if (SRV.flags.retract === 'fail') { rt.phase = 'fail'; rt.fail = batch.recipients.length; inst.paintRetract(); return; }
      let n = 0;
      for (const [, arr] of SRV.data.inbox) { for (let i = arr.length - 1; i >= 0; i--) if (arr[i]._batch === batch.key) { arr.splice(i, 1); n++; } }
      batch.status = 'retracted'; batch.retracted = { ok: n, fail: 0, total: batch.recipients.length };
      rt.phase = 'done'; rt.ok = n; inst.paintRetract(); inst.finishRetract(batch);
      return;
    }
    if (!batch.checkedAt) {
      rt.phase = 'lookup'; inst.paintRetract();
      await inst.check(batch, { auto: true });
      rt.phase = 'run';
    }
    const targets = M.retractTargets(batch, batch.results);
    rt.total = targets.length;
    inst.paintRetract();
    const queue = targets.slice();
    const worker = async () => {
      while (queue.length) {
        const t = queue.shift();
        try { await SRV.del(t.inboxId, { fail: SRV.flags.retract === 'fail' && t.inboxId % 4 === 0 }); rt.ok += 1; const r = batch.results.get(t.courierId); if (r) { r.state = 'missing'; r.inboxId = null; } }
        catch (e) { rt.fail += 1; }
        rt.done += 1;
        inst.paintRetract();
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONC, queue.length || 1) }, worker));
    batch.retracted = { ok: rt.ok, fail: rt.fail, total: batch.recipients.length };
    batch.status = rt.fail ? 'partial' : 'retracted';
    rt.phase = rt.fail ? 'partial' : 'done';
    inst.paintRetract();
    inst.finishRetract(batch);
  };
  inst.finishRetract = (batch) => {
    if (ui.tab === 'sent') inst.renderCard(batch);
    inst.toast(batch.retracted.fail ? `Uklonjeno iz ${batch.retracted.ok} sandučića, ${batch.retracted.fail} nije uspjelo.` : `Poruka je uklonjena iz ${batch.retracted.ok} sandučića.`, batch.retracted.fail ? 'bad' : 'ok');
  };

  // ------------------------------------------------------------ poruke jednog kurira (bez ponuda)
  const histSrcs = (cat) => (cat === 'all' ? M.CAT_ORDER : [cat]).map((key) => ({ key, buf: [], done: false, page: 0 }));
  inst.loadHist = async (more) => {
    const h = ui.hist;
    if (!h || h.loading) return;
    h.loading = true; h.error = false;
    inst.paintHist();
    try {
      const n = more ? HPAGE : HPAGE;
      const out = [];
      for (let guard = 0; guard < 60; guard++) {
        const r = M.takeNext(h.srcs, n - out.length);
        out.push(...r.out);
        if (r.need.length) {
          await Promise.all(r.need.map(async (key) => {
            const s = h.srcs.find((x) => x.key === key);
            s.page += 1;
            const res = await SRV.inbox(h.id, { category: key, page: s.page, perPage: 10 });
            s.buf.push(...res.data);
            if (res.meta.current_page >= res.meta.last_page) s.done = true;
          }));
          continue;
        }
        h.end = r.end;
        break;
      }
      h.items.push(...out);
    } catch (e) {
      h.error = true;
    }
    h.loading = false; h.loaded = true;
    inst.paintHist();
  };
  inst.openHist = (id) => {
    ui.hist = { id, cat: 'all', srcs: histSrcs('all'), items: [], loading: false, loaded: false, end: false, error: false };
    inst.openSheet('courier');
    inst.loadHist(false);
  };
  inst.setHistCat = (cat) => {
    const h = ui.hist; if (!h) return;
    ui.hdel = null;
    Object.assign(h, { cat, srcs: histSrcs(cat), items: [], loading: false, loaded: false, end: false, error: false });
    inst.loadHist(false);
  };
  inst.delHist = async (mid) => {
    const h = ui.hist; if (!h) return;
    try { await SRV.del(mid, { fail: SRV.flags.retract === 'fail' && mid % 4 === 0 }); h.items = h.items.filter((m) => m.id !== mid); ui.hdel = null; inst.toast('Poruka je uklonjena iz sandučeta kurira.'); }
    catch (e) { ui.hdel = null; inst.toast('Ne mogu da uklonim poruku. Pokušaj ponovo.', 'bad'); }
    inst.paintHist();
  };

  // ------------------------------------------------------------ donji listovi
  const trapKeys = (e, sheetEl) => {
    if (e.key !== 'Tab') return;
    const f = $$('button:not([disabled]),input:not([disabled]),textarea,[tabindex]:not([tabindex="-1"]),a[href]', sheetEl).filter((n) => n.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  inst.openSheet = (kind, extra = {}) => {
    // list preko lista (telefon: Izaberi ručno -> Poruke kurira) pamti prvobitni element za povratak fokusa
    if (!inst.sheet) inst.opener = document.activeElement;
    inst.sheet = { kind, ...extra };
    const id = inst.uid('sheet');
    let spec;
    if (kind === 'pick') {
      spec = { title: 'Izaberi kurire', sub: '', body: inst.listShell(), foot: '<button type="button" class="k-ab" data-act="sheet-x" data-r="pickdone">Gotovo</button>' };
    } else if (kind === 'confirm') {
      spec = { title: 'Poslati poruku?', sub: '', body: '', foot: '' };
    } else if (kind === 'retract') {
      spec = { title: 'Ukloniti poruku iz sandučića?', sub: '', body: '', foot: '' };
    } else if (kind === 'courier') {
      spec = { title: 'Poruke kurira', sub: '', body: '', foot: '' };
    } else {
      spec = { title: 'Sačuvaj šablon', sub: 'Ostaje u ovom pregledaču.', body: '', foot: '' };
    }
    inst.el.ov.innerHTML = sheetHTML({ id, ...spec });
    inst.el.ov.hidden = false;
    const sheetEl = $(`#${id}`, inst.el.ov);
    sheetEl.addEventListener('keydown', (e) => trapKeys(e, sheetEl));
    if (kind === 'pick') {
      // lista u listu: isti prikaz kao lijeva lista na računaru
      const sb = $('[data-r=sbody]', inst.el.ov);
      sb.style.padding = '0'; sb.style.gap = '0';
      inst.renderList();
      $('[data-r=sfoot]', inst.el.ov);
    }
    if (kind === 'confirm') inst.paintConfirm();
    if (kind === 'retract') inst.paintRetract();
    if (kind === 'courier') inst.paintHist();
    if (kind === 'savetpl') inst.paintSaveTpl();
    requestAnimationFrame(() => {
      const target = $('[data-autofocus]', inst.el.ov) || $('input:not([type=hidden]),button.k-ab:not([disabled])', sheetEl) || $('.k-sx', sheetEl);
      if (target) target.focus({ preventScroll: true });
    });
  };
  inst.closeSheet = (silent) => {
    if (!inst.sheet) return;
    const kind = inst.sheet.kind;
    inst.sheet = null;
    inst.el.ov.innerHTML = '';
    inst.el.ov.hidden = true;
    if (kind === 'courier') { ui.hist = null; ui.hdel = null; }
    if (!silent && inst.opener && document.contains(inst.opener)) inst.opener.focus({ preventScroll: true });
    inst.opener = null;
    if (kind === 'pick') { inst.patch.audience(); inst.patch.footer(); }
  };
  const sheetBody = () => $('[data-r=sbody]', inst.el.ov);
  const sheetFoot = () => $('[data-r=sfoot]', inst.el.ov);
  const sheetHead = () => $('.k-sh', inst.el.ov);
  const setHead = (title, sub) => { const h = sheetHead(); if (h) { $('h2', h).textContent = title; let p = $('p', h); if (sub) { if (!p) { p = document.createElement('p'); $('div', h).appendChild(p); } p.textContent = sub; } else if (p) p.remove(); } };
  const ensureFoot = () => {
    let f = sheetFoot();
    if (!f) { const form = $('.k-sform', inst.el.ov); f = document.createElement('div'); f.className = 'k-sf'; f.setAttribute('data-r', 'sfoot'); form.appendChild(f); }
    return f;
  };

  inst.paintConfirm = () => {
    if (!inst.sheet || inst.sheet.kind !== 'confirm') return;
    const p = inst.plan(), d = ui.draft;
    const list = inst.audience();
    setHead(`Poslati ${M.couriersText(p.count)}?`, audienceLabel(p));
    const cat = M.catOf(d.category);
    sheetBody().innerHTML = `<div class="m-cf">
      <div class="who"><span class="ic0">${I('account-group-outline', 22)}</span><span><b>${M.couriersText(p.count)}</b><em>${esc(M.audienceText(list, 4))}${M.suspendedIn(list) ? ` · uključuje ${M.suspendedIn(list)} suspendovan${M.suspendedIn(list) === 1 ? 'og' : 'a'}` : ''}</em></span></div>
      <div class="m-pv" style="margin:0"><div class="m-pvh"><small>Tako kurir vidi poruku</small></div><div class="m-pvrow" style="--tint:${cat.tint};--ink-c:${cat.color}"><span class="ic1">${I(cat.icon, 22)}</span><span style="min-width:0;display:flex;flex-direction:column"><span class="eb" style="color:${cat.ink}">${cat.label}</span><span class="tt">${esc(M.toLatin(d.title.trim()))}</span><span class="sn">${esc(M.toLatin(d.body.trim()))}</span></span><span class="tm"><span>${M.clock(nowMs())}</span><i></i></span></div></div>
      ${tint('info', 'information-outline', 'Možeš je povući', 'Dok je u Poslato, poruku možeš ukloniti iz sandučića primalaca (ko ju je pročitao, pročitao je).')}
    </div>`;
    const f = ensureFoot();
    f.innerHTML = `<button type="button" class="k-ab" data-act="confirm-send" data-autofocus ${inst.sending ? 'disabled' : ''}>${I('send-outline', 20)}Pošalji ${M.couriersText(p.count)}</button><button type="button" class="k-ab k-ab--ghost" data-act="sheet-x">Nazad na poruku</button>`;
  };

  inst.openRetract = (batch) => {
    inst.openSheet('retract');
    inst.sheet.batch = batch;
    inst.sheet.rt = { phase: 'ask', done: 0, ok: 0, fail: 0, total: batch.recipients.length };
    inst.paintRetract();
  };
  inst.paintRetract = () => {
    if (!inst.sheet || inst.sheet.kind !== 'retract') return;
    const batch = inst.sheet.batch, rt = inst.sheet.rt;
    if (!batch) return;
    const cat = M.catOf(batch.category);
    setHead('Ukloniti poruku iz sandučića?', `${M.toLatin(batch.title)} · ${M.clock(batch.sentAt)}`);
    const f = ensureFoot();
    const pct = rt.total ? Math.round((rt.done / rt.total) * 100) : 0;
    let body = '';
    if (rt.phase === 'ask') {
      body = `<div class="m-cf"><div class="m-pv" style="margin:0"><div class="m-pvrow" style="--tint:${cat.tint};--ink-c:${cat.color}"><span class="ic1">${I(cat.icon, 22)}</span><span style="min-width:0;display:flex;flex-direction:column"><span class="eb" style="color:${cat.ink}">${cat.label}</span><span class="tt">${esc(M.toLatin(batch.title))}</span><span class="sn">${esc(M.toLatin(batch.body))}</span></span><span class="tm"><span>${M.clock(batch.sentAt)}</span></span></div></div>
        ${tint('warn', 'alert-outline', 'Šta se događa', `Poruka nestaje iz Poruka kod ${M.couriersText(batch.recipients.length)}. Ko ju je već pročitao, pročitao je; ne možemo ga obavijestiti da je povučena.`)}</div>`;
      f.innerHTML = `<button type="button" class="k-ab k-ab--danger" data-act="retract-go" data-autofocus>${I('delete-outline', 20)}Ukloni iz ${batch.recipients.length} sandučića</button><button type="button" class="k-ab k-ab--ghost" data-act="sheet-x">Odustani</button>`;
    } else if (rt.phase === 'lookup' || rt.phase === 'run') {
      body = `<div class="m-cf"><div class="m-prog2" role="status"><b>${rt.phase === 'lookup' ? 'Tražim poruku u sandučićima…' : `Uklanjam ${rt.done} od ${rt.total}…`}</b><div class="bar"><i style="width:${rt.phase === 'lookup' ? 8 : pct}%"></i></div></div></div>`;
      f.innerHTML = `<button type="button" class="k-ab k-ab--danger k-ab--busy" disabled aria-busy="true">${I('refresh', 20, 'k-spin')}Uklanjam…</button>`;
    } else if (rt.phase === 'done') {
      body = `<div class="m-cf">${tint('ok', 'check-circle-outline', 'Poruka je uklonjena', `Uklonjena iz ${rt.ok} sandučića.`)}</div>`;
      f.innerHTML = `<button type="button" class="k-ab" data-act="sheet-x" data-autofocus>Gotovo</button>`;
    } else {
      body = `<div class="m-cf">${tint('bad', 'alert-circle-outline', rt.phase === 'fail' ? 'Server nije prihvatio uklanjanje' : 'Uklonjeno djelimično', rt.phase === 'fail' ? 'Nijedna poruka nije uklonjena. Pokušaj ponovo.' : `Uklonjena iz ${rt.ok} sandučića, ${rt.fail} nije uspjelo. Ostale možeš ponovo pokušati.`)}</div>`;
      f.innerHTML = `<button type="button" class="k-ab" data-act="retract-go" data-autofocus>Pokušaj ponovo</button><button type="button" class="k-ab k-ab--ghost" data-act="sheet-x">Zatvori</button>`;
    }
    sheetBody().innerHTML = body;
  };

  inst.paintHist = () => {
    if (!inst.sheet || inst.sheet.kind !== 'courier' || !ui.hist) return;
    const h = ui.hist, c = byId(h.id);
    if (!c) return;
    setHead(`Poruke · ${M.fullName(c.first, c.last)}`, `#${c.id}${c.phone ? ` · ${M.fmtPhone(c.phone)}` : ''}`);
    const offers = SRV.data.offers.get(h.id) || 0;
    const pills = [['all', 'Sve'], ...M.CAT_ORDER.map((k) => [k, M.CATS[k].chip])].map(([k, label]) => `<button type="button" class="k-sg" aria-pressed="${h.cat === k}" data-act="hf:${k}" data-fk="hf:${k}">${label}</button>`).join('');
    const rows = h.items.map((m) => histRowHTML(inst, m)).join('');
    let list;
    if (h.error) list = tint('warn', 'cloud-off-outline', 'Ne mogu da učitam poruke', 'Ostalo radi.', `<button type="button" data-act="hretry" data-fk="hretry">Pokušaj ponovo</button>`);
    else if (!h.loaded && h.loading) list = `<div class="m-skeleton" role="status" aria-label="Učitavam poruke">${'<i class="b" style="height:64px;margin:8px 0;border-radius:12px"></i>'.repeat(3)}</div>`;
    else if (!h.items.length) list = `<div class="k-empty" style="padding:24px 8px">${I('message-text-outline', 34)}<b>${h.cat === 'all' ? 'Ovom kuriru još ništa nije poslato' : 'Nema poruka u ovoj kategoriji'}</b><p>Poruke koje pošalješ pojavljuju se ovdje.</p></div>`;
    else list = `<div>${rows}</div>${h.end ? '' : `<div class="m-more2"><button type="button" class="k-btn" data-act="hmore" data-fk="hmore" ${h.loading ? 'disabled' : ''}>${h.loading ? 'Učitavam…' : 'Prikaži starije'}</button></div>`}`;
    sheetBody().innerHTML = `<div class="m-filt" role="group" aria-label="Kategorija">${pills}</div>${list}${offers ? `<p class="m-note2">${I('information-outline', 16)}<span>Ponude za dostavu (${offers}) se ovdje ne prikazuju: to je trag ponude, a ne poruka dispečera.</span></p>` : ''}`;
    const f = ensureFoot();
    f.innerHTML = `<button type="button" class="k-ab" data-act="hsend" data-fk="hsend">${I('message-text-outline', 20)}Pošalji poruku ${esc(M.shortName(c.first, c.last))}</button>`;
  };
  inst.paintSaveTpl = () => {
    if (!inst.sheet || inst.sheet.kind !== 'savetpl') return;
    sheetBody().innerHTML = `<div class="k-f"><label for="${inst.uid('tn')}">Naziv šablona</label><div class="k-in"><input id="${inst.uid('tn')}" data-field="tplname" data-autofocus type="text" maxlength="40" value="${esc(ui.draft.title.trim().slice(0, 40))}" autocomplete="off"></div><div class="k-msg" data-r="tnmsg"></div></div>`;
    const f = ensureFoot();
    f.innerHTML = `<button type="button" class="k-ab" data-act="tpl-save-go">Sačuvaj šablon</button><button type="button" class="k-ab k-ab--ghost" data-act="sheet-x">Odustani</button>`;
  };
  inst.saveTemplateGo = () => {
    const inp = $('[data-field=tplname]', inst.el.ov);
    const label = (inp ? inp.value : '').trim();
    if (!label) { const m = $('[data-r=tnmsg]', inst.el.ov); if (m) { m.className = 'k-msg bad'; m.textContent = 'Upiši naziv šablona.'; } return; }
    SRV.tpl.push({ id: `u${Date.now()}`, label, category: ui.draft.category, title: ui.draft.title.trim(), body: ui.draft.body.trim() });
    saveTpl();
    inst.closeSheet();
    inst.toast('Šablon je sačuvan.');
  };

  // ------------------------------------------------------------ prebacivanje taba
  inst.switchTab = (tab, { focus = true } = {}) => {
    if (ui.tab === tab) return;
    ui.tab = tab; ui.menu = false; inst.built = false;
    inst.refresh();
  };
  inst.onWorld = (what) => {
    normalizeSelPublic();
    if (what === 'flags' || what === 'data') { inst.built = false; inst.refresh(); if (ui.tab === 'new') inst.patchAll(); }
    else if (what === 'phase2' || what === 'time') { if (ui.tab === 'sent') inst.renderSent(); }
    inst.refresh();
  };
  const normalizeSelPublic = () => {
    const s = ui.sel;
    if (s.kind === 'preset') {
      const p = preset(s.key);
      if ((p.needs === 'locations' && !SRV.flags.locations) || (p.needs === 'balances' && !SRV.flags.balances)) ui.sel = { kind: 'preset', key: 'active' };
    }
  };
  // simulacija "ponovo otvorena stranica": stanje ekrana kreće iznova, sačuvani nacrt se vraća
  inst.reopen = () => {
    inst.timers.forEach(clearTimeout); inst.timers = [];
    inst.closeSheet(true);
    Object.assign(ui, { tab: 'new', q: '', shown: PAGE, sel: { kind: 'preset', key: 'active' }, draft: { category: 'announcement', title: '', body: '' }, touched: {}, submitted: false, pv: 'list', menu: false, tabId: null, restored: null, undo: null, open: null, hist: null, hdel: null, sendError: '' });
    inst.batches = []; inst.built = false;
    inst.restoreDraft();
    inst.refresh();
  };
}
