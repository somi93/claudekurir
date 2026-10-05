// ---------------------------------------------------------------- događaji
function attachEvents(inst) {
  const root = inst.root, ui = inst.ui;
  const q$ = inst.q$;

  const focusRow = (id) => {
    ui.tabId = id;
    inst.renderList();
    const n = root.querySelector(`[data-fk="chk:${id}"]`);
    if (n) n.focus({ preventScroll: false });
  };

  const act = async (key, el, ev) => {
    const [name, a, b] = key.split(':');
    switch (name) {
      case 'tab': inst.switchTab(a); {
        const t = q$(`[data-fk="tab:${a}"]`); if (t && ev && ev.detail === 0) t.focus({ preventScroll: true });
      } break;
      case 'preset': inst.setPreset(a); break;
      case 'toggle': inst.togglePick(Number(a)); ui.tabId = Number(a); break;
      case 'hist': inst.openHist(Number(a)); break;
      case 'more': ui.shown += PAGE; inst.renderList(); break;
      case 'selshown': inst.selShown(); break;
      case 'selnone': inst.selNone(); break;
      case 'clearq': ui.q = ''; ui.shown = PAGE; inst.renderList(); { const s = root.querySelector('[data-field=q]'); if (s) s.focus({ preventScroll: true }); } break;
      case 'refresh': inst.toast('Lista je osvježena.', 'info'); break;
      case 'retry': SRV.flags.state = 'ok'; syncControls(); emitAll('flags'); break;
      case 'pick': inst.openSheet('pick'); break;
      case 'cat': inst.setCat(a); break;
      case 'pv': ui.pv = a; inst.patch.preview(); break;
      case 'tpl': inst.openMenu(!ui.menu); break;
      case 'tplpick': inst.applyTemplate(a); break;
      case 'tpldel': inst.deleteTemplate(a); break;
      case 'tplsave': ui.menu = false; inst.patch.menu(); inst.openSheet('savetpl'); break;
      case 'tpl-save-go': inst.saveTemplateGo(); break;
      case 'undo': inst.undoTemplate(); break;
      case 'drop-draft': inst.dropDraft(); break;
      case 'send': inst.trySend(); break;
      case 'confirm-send': inst.doSend(inst.plan()); break;
      case 'sheet-x': inst.closeSheet(); break;
      case 'bchk': { const bt = findBatch(a); if (bt) inst.check(bt); } break;
      case 'bremind': { const bt = findBatch(a); if (bt) inst.remind(bt); } break;
      case 'bretract': { const bt = findBatch(a); if (bt) inst.openRetract(bt); } break;
      case 'retract-go': { const bt = inst.sheet && inst.sheet.batch; if (bt) { inst.sheet.rt.phase = 'ask'; inst.runRetract(bt); } } break;
      case 'bopen': ui.open = ui.open === a ? null : a; { const bt = findBatch(a); if (bt) inst.renderCard(bt); } break;
      case 'bf': ui.filter[a] = b; { const bt = findBatch(a); if (bt) inst.renderCard(bt); } break;
      case 'bmore': ui.rshown[a] = (ui.rshown[a] || RPAGE + 2) + RPAGE; { const bt = findBatch(a); if (bt) inst.renderCard(bt); } break;
      case 'hf': inst.setHistCat(a); break;
      case 'hmore': inst.loadHist(true); break;
      case 'hretry': inst.loadHist(false); break;
      case 'hdel': ui.hdel = Number(a); inst.paintHist(); { const n = inst.el.ov.querySelector('[data-fk="hdel-ok:' + a + '"]'); if (n) n.focus({ preventScroll: true }); } break;
      case 'hdel-no': { const m = ui.hdel; ui.hdel = null; inst.paintHist(); const n = inst.el.ov.querySelector('[data-fk="hdel:' + m + '"]'); if (n) n.focus({ preventScroll: true }); } break;
      case 'hdel-ok': inst.delHist(Number(a)); break;
      case 'hsend': {
        const id = ui.hist && ui.hist.id;
        inst.closeSheet(true);
        ui.sel = { kind: 'manual', ids: new Set([id]) };
        ui.tab = 'new'; inst.built = false; inst.refresh();
        const tf = q$('[data-field=title]'); if (tf) tf.focus({ preventScroll: true });
      } break;
      default: break;
    }
  };
  const findBatch = (id) => inst.batches.find((b) => b.id === id) || inst.serverBatchObjs().find((b) => b.id === id) || null;
  inst.findBatch = findBatch;

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (ui.menu && !e.target.closest('.m-menu') && !(el && el.getAttribute('data-act') === 'tpl')) { ui.menu = false; inst.patch.menu(); }
    if (!el || !root.contains(el)) return;
    if (el.tagName === 'A') return;
    if (el.matches('[data-act="sheet-x"]') && el.classList.contains('k-scrim') && e.target !== el) return;
    act(el.getAttribute('data-act'), el, e);
  });

  root.addEventListener('input', (e) => {
    const f = e.target.closest('[data-field]');
    if (!f) return;
    const k = f.getAttribute('data-field');
    if (k === 'title' || k === 'body') inst.setField(k, f.value);
    else if (k === 'q') { ui.q = f.value; ui.shown = PAGE; inst.renderList(); }
    else if (k === 'tplname') { const m = $('[data-r=tnmsg]', inst.el.ov); if (m) { m.className = 'k-msg'; m.textContent = ''; } }
  });
  root.addEventListener('focusout', (e) => {
    const f = e.target.closest && e.target.closest('[data-field]');
    if (f && (f.getAttribute('data-field') === 'title' || f.getAttribute('data-field') === 'body')) {
      ui.touched[f.getAttribute('data-field')] = true;
      inst.patch.fields();
    }
  });

  const radioArrows = (e, selector, apply) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return false;
    const items = $$(selector, root).filter((n) => n.getAttribute('aria-disabled') !== 'true' && n.offsetParent !== null);
    const at = items.indexOf(e.target.closest(selector));
    if (at < 0) return false;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (at + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    apply(items[next]);
    return true;
  };

  root.addEventListener('keydown', (e) => {
    const t = e.target;
    // Ctrl/Cmd+Enter u poljima poruke: pošalji (sa potvrdom kad treba)
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && t.closest && t.closest('[data-field=title],[data-field=body]')) { e.preventDefault(); inst.trySend(); return; }
    // Enter u naslovu ide na tekst; ne šalje
    if (e.key === 'Enter' && t.matches && t.matches('[data-field=title]')) { e.preventDefault(); const b = q$('[data-field=body]'); if (b) b.focus(); return; }
    if (e.key === 'Escape') {
      if (ui.menu) { e.preventDefault(); ui.menu = false; inst.patch.menu(); const b = q$('[data-r=tplbtn]'); if (b) b.focus(); return; }
      if (inst.sheet) { e.preventDefault(); inst.closeSheet(); return; }
      if (t.matches && t.matches('[data-field=q]') && ui.q) { e.preventDefault(); ui.q = ''; inst.renderList(); return; }
    }
    // grupe primalaca: strelice mijenjaju izbor (radiogroup)
    if (t.closest && t.closest('.m-pt')) {
      if (radioArrows(e, '.m-pt', (n) => { inst.setPreset(n.getAttribute('data-preset')); const f = q$(`[data-preset="${n.getAttribute('data-preset')}"]`); if (f) f.focus({ preventScroll: true }); })) return;
    }
    if (t.closest && t.closest('[data-cat]')) {
      if (radioArrows(e, '[data-cat]', (n) => { inst.setCat(n.getAttribute('data-cat')); n.focus({ preventScroll: true }); })) return;
    }
    if (t.closest && t.closest('.m-tab')) {
      if (radioArrows(e, '.m-tab', (n) => { const k = n.getAttribute('data-fk').split(':')[1]; inst.switchTab(k); const f = q$(`[data-fk="tab:${k}"]`); if (f) f.focus({ preventScroll: true }); })) return;
    }
    // meni šablona
    if (t.closest && t.closest('.m-menu')) {
      const items = $$('.m-menu [role=menuitem]:not([disabled])', root);
      const at = items.indexOf(t.closest('[role=menuitem]'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]; if (n) n.focus(); return; }
    }
    // lista kurira: strelice mijenjaju aktivni red (roving), Space/Enter na kvačici već rade kao dugme
    const chk = t.closest && t.closest('.m-chk');
    if (chk && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      const ids = $$('.m-chk', root).filter((n) => n.offsetParent !== null).map((n) => Number(n.getAttribute('data-row')));
      const at = ids.indexOf(Number(chk.getAttribute('data-row')));
      const next = e.key === 'ArrowDown' ? Math.min(ids.length - 1, at + 1) : e.key === 'ArrowUp' ? Math.max(0, at - 1) : e.key === 'Home' ? 0 : ids.length - 1;
      focusRow(ids[next]);
    }
  });
  // prečica "/" traži kurira (kao na Kuriri): sluša na prozoru, jer fokus može biti na tijelu stranice
  if (inst.mode === 'desk') {
    window.addEventListener('keydown', (e) => {
      if (e.key !== '/' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || inst.sheet) return;
      const t = e.target;
      if (t && t.matches && t.matches('input,textarea,select,[contenteditable]')) return;
      const s = root.querySelector('[data-field=q]');
      if (s) { e.preventDefault(); s.focus(); }
    });
  }
  // pretraga: strelica dolje ide na prvi red
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && e.target.matches && e.target.matches('[data-field=q]')) {
      const n = root.querySelector('.m-chk[tabindex="0"]') || root.querySelector('.m-chk');
      if (n) { e.preventDefault(); n.focus(); }
    }
  });
}
