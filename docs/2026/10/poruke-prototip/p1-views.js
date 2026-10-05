// ---------------------------------------------------------------- prikazi (čisti HTML iz stanja)
const dispName = (c) => M.fullName(c.first, c.last);
const vmeta = (c) => M.VEH[M.vehKey(c.vehicle)];
const lmeta = (c) => M.LIVE[M.liveOf(c)];

const livePill = (c) => {
  if (c.suspended) return `<span class="m-lp" style="--tint:#fde8e6;--ink-c:#b42318;--dot:#e5484d"><i></i>Suspendovan</span>`;
  const l = lmeta(c);
  return `<span class="m-lp" style="--tint:${l.tint};--ink-c:${l.ink};--dot:${l.dot}"><i></i>${l.label}</span>`;
};

const rowAria = (c, picked) => {
  const bits = [dispName(c), `kurir ${c.id}`, c.suspended ? 'suspendovan' : lmeta(c).label.toLowerCase(), picked ? 'izabran' : 'nije izabran'];
  if (c.cash > 0) bits.push(`duguje ${M.money(c.cash, MW.COMPANY.currency)}`);
  return bits.join(', ');
};

// Red liste: kvačica (prva dugme u redu), ime i ID, stanje uživo, "Poruke kurira". Roving: samo aktivni red ima dva Tab zaustavljanja.
const rowHTML = (inst, c, picked, tabbable, flash) => {
  const sub = [c.phone ? M.fmtPhone(c.phone) : 'bez telefona', vmeta(c).label].join(' · ');
  return `<li>
    <div class="m-r${picked ? ' is-pick' : ''}${flash ? ' flash' : ''}" data-id="${c.id}" data-act="toggle:${c.id}">
      <button type="button" class="m-chk" role="checkbox" aria-checked="${picked}" data-row="${c.id}" data-fk="chk:${c.id}" tabindex="${tabbable ? 0 : -1}" aria-label="${esc(rowAria(c, picked))}" data-act="toggle:${c.id}">
        <span>${picked ? I('check', 18) : ''}</span><i class="live" style="--dot:${liveDot(c)}"></i>
      </button>
      <span class="m-rt">
        <span class="m-rn"><b>${esc(dispName(c))}</b><i>#${c.id}</i></span>
        <span class="m-rs">${c.suspended ? '<span class="sus">Suspendovan</span> · ' : ''}${esc(sub)}</span>
      </span>
      ${livePill(c)}
      <button type="button" class="m-hb" data-act="hist:${c.id}" data-fk="hist:${c.id}" tabindex="${tabbable ? 0 : -1}" aria-label="Poruke kurira ${esc(dispName(c))}">${I('history', 22)}</button>
    </div></li>`;
};

const skeletonRows = (n) => Array.from({ length: n }, () => `<li><div class="m-r" style="pointer-events:none"><i class="b" style="width:30px;height:30px;border-radius:50%;margin:7px"></i><span class="m-rt"><i class="b" style="height:14px;width:62%"></i><i class="b" style="height:12px;width:44%"></i></span><i class="b" style="height:24px;width:70px;border-radius:999px"></i><span></span></div></li>`).join('');

// ---------------------------------------------------------------- grupe primalaca
const tilesHTML = (inst, counts) => {
  const sel = inst.ui.sel;
  const tabKey = sel.kind === 'preset' ? sel.key : M.PRESET_ORDER[0];
  return M.PRESET_ORDER.map((k) => {
    const p = preset(k), n = counts[k], [t, ink] = PRESET_TONE[k];
    const off = (p.needs === 'locations' && !SRV.flags.locations) || (p.needs === 'balances' && !SRV.flags.balances);
    const checked = sel.kind === 'preset' && sel.key === k;
    return `<button type="button" class="m-pt" role="radio" aria-checked="${checked}" ${off ? 'aria-disabled="true" title="Izvor podataka trenutno ne radi"' : ''} tabindex="${k === tabKey ? 0 : -1}" aria-label="${p.label}, ${off ? 'nije dostupno' : M.couriersText(n)}" data-act="preset:${k}" data-fk="preset:${k}" data-preset="${k}" style="--tint:${t};--ink-c:${ink}">
      <span class="ic0">${I(p.icon, 18)}</span><span class="n">${off ? '–' : n}</span><b>${p.label}</b></button>`;
  }).join('');
};

const sumHTML = (inst, list) => {
  const sel = inst.ui.sel;
  const n = list.length;
  const names = M.audienceText(list);
  const sus = M.suspendedIn(list);
  const zero = n === 0;
  const head = zero ? 'Nikoga nije izabrano' : M.couriersText(n);
  const sub = zero
    ? (sel.kind === 'preset' ? 'U ovoj grupi trenutno nema kurira.' : 'Izaberi kurire u listi ili uzmi gotovu grupu iznad.')
    : `${names}${sus ? ` · uključuje ${sus} suspendovan${sus === 1 ? 'og' : 'a'}` : ''}`;
  const acts = [];
  if (inst.mode === 'phone') acts.push(`<button type="button" class="m-lnk" data-act="pick" data-fk="pick">Izaberi ručno</button>`);
  if (sel.kind === 'manual' && n) acts.push(`<button type="button" class="m-lnk" data-act="preset:active" data-fk="back-active">Svi aktivni</button>`);
  return `<div class="m-sum${zero ? ' is-zero' : ''}" role="status" aria-live="polite"><span class="ic0">${I(zero ? 'alert-outline' : 'account-group-outline', 22)}</span><span><b>${head}</b><em>${esc(sub)}</em></span><span class="acts">${acts.join('')}</span></div>`;
};

// ---------------------------------------------------------------- pregled: kako kurir vidi poruku (kopija InboxMessageItem / InboxMessageView)
const HAS_CYR = /[Ѐ-ӿ]/;
const previewHTML = (inst) => {
  const d = inst.ui.draft;
  const cat = M.catOf(d.category);
  const tRaw = d.title.trim(), bRaw = d.body.trim();
  const title = tRaw ? M.toLatin(tRaw) : 'Naslov poruke';
  const body = bRaw ? M.toLatin(bRaw) : '';
  const snippet = body && body !== title ? body : '';
  const time = M.clock(nowMs());
  const cyr = HAS_CYR.test(tRaw + bRaw);
  const style = `--tint:${cat.tint};--ink-c:${cat.color}`;
  let inner;
  if (inst.ui.pv === 'open') {
    const segs = M.linkify(snippet);
    const textHTML = segs.length
      ? segs.map((s) => (s.type === 'link' ? `<a href="${esc(s.href)}" ${/^https?:/.test(s.href) ? 'target="_blank" rel="noopener noreferrer"' : ''}>${esc(s.text)}</a>` : esc(s.text))).join('')
      : '';
    inner = `<div class="m-pvopen" style="${style}">
      <span class="tile">${I(cat.icon, 28)}</span>
      <span class="eb" style="color:${cat.ink}">${cat.label}</span>
      <h4 style="${tRaw ? '' : 'color:#657083'}">${esc(title)}</h4>
      <span class="mt">Dispečer · Danas, ${time}</span>
      ${segs.length ? `<div class="card">${textHTML}</div>` : `<div class="card" style="color:#657083">${bRaw ? '' : 'Tekst poruke se vidi ovdje.'}</div>`}
      ${d.category === 'todo' ? `<div class="co">${I('checkbox-marked-circle-outline', 22)}<div><b>Zadatak od dispečera</b>Kad ga završiš, javi dispečeru.</div></div>` : ''}
      <span class="one">${I('information-outline', 16)}Jednosmerna poruka. Odgovor nije moguć.</span></div>`;
  } else {
    inner = `<div class="m-pvrow" style="${style}">
      <span class="ic1">${I(cat.icon, 22)}</span>
      <span style="min-width:0;display:flex;flex-direction:column"><span class="eb" style="color:${cat.ink}">${cat.label}</span><span class="tt" style="${tRaw ? '' : 'color:#657083;font-weight:700'}">${esc(title)}</span><span class="sn">${esc(snippet || (bRaw ? '' : 'Tekst poruke se vidi ovdje.'))}</span></span>
      <span class="tm"><span>${time}</span><i></i></span></div>`;
  }
  return `<div class="m-pvh"><small>Tako kurir vidi poruku</small>
      <span class="m-seg2" role="group" aria-label="Prikaz pregleda"><button type="button" aria-pressed="${inst.ui.pv === 'list'}" data-act="pv:list" data-fk="pv:list">U listi</button><button type="button" aria-pressed="${inst.ui.pv === 'open'}" data-act="pv:open" data-fk="pv:open">Otvorena</button></span></div>
    ${inner}
    ${cyr ? `<span class="m-hint">${I('information-outline', 16)}Ćirilica se kuriru prikazuje latinicom.</span>` : ''}
    <span class="m-hint">${I('information-outline', 16)}Kurir vidi poruku kad otvori aplikaciju.</span>`;
};

// ---------------------------------------------------------------- Poslato
const STATE_META = {
  read: { cls: 'rd', label: 'Pročitano', icon: 'check-all' },
  unread: { cls: 'un', label: 'Nije pročitano', icon: 'clock-outline' },
  missing: { cls: 'mi', label: 'Nema poruke', icon: 'alert-circle-outline' },
  error: { cls: 'mi', label: 'Provjera nije uspjela', icon: 'cloud-off-outline' },
  pending: { cls: 'pe', label: 'Nije provjereno', icon: 'timer-sand' },
};
const audLabel = (batch) => batch.audience;

const recipRows = (inst, batch) => {
  const f = inst.ui.filter[batch.id] || (M.tally(batch, batch.results).unread > 0 ? 'unread' : 'all');
  const rows = batch.recipients
    .map((id) => ({ c: byId(id), r: (batch.results && batch.results.get(id)) || { state: 'pending' } }))
    .filter((x) => x.c)
    .filter((x) => f === 'all' || x.r.state === f || (f === 'missing' && (x.r.state === 'error')));
  const order = { unread: 0, missing: 1, error: 1, pending: 2, read: 3 };
  rows.sort((a, b) => order[a.r.state] - order[b.r.state] || M.byName(a.c, b.c));
  const shown = inst.ui.rshown[batch.id] || RPAGE + 2;
  return { f, rows, shown };
};

const sentCardHTML = (inst, batch) => {
  const cat = M.catOf(batch.category);
  const t = M.tally(batch, batch.results);
  const checked = batch.checkedAt != null;
  const retracted = batch.status === 'retracted';
  const canTrack = batch.server || M.canTrack(batch);
  let prog;
  if (retracted) {
    prog = `<div class="m-prog">${tint('info', 'information-outline', 'Poruka je uklonjena iz sandučića', `Uklonjena iz ${batch.retracted.ok} od ${batch.retracted.total} sandučića${batch.retracted.fail ? `; ${batch.retracted.fail} nije uspjelo.` : '.'}`)}</div>`;
  } else if (batch.checking) {
    const done = batch.progress || 0;
    prog = `<div class="m-prog" role="status"><div class="row"><b>Provjeravam sandučiće…</b><span>${done} od ${t.total}</span></div><div class="m-bar"><i style="width:${Math.round((done / Math.max(1, t.total)) * 100)}%;background:var(--ink)"></i></div></div>`;
  } else if (!canTrack) {
    prog = `<div class="m-prog">${tint('warn', 'alert-outline', 'Čitanje se ne prati', `Za više od ${M.CHECK_MAX} kurira provjera po sandučićima bi bila preveliki nalet na server. Čeka B1 (paket poruke sa brojem pročitanih).`)}</div>`;
  } else if (!checked) {
    prog = `<div class="m-prog"><div class="row"><b>Čitanje još nije provjereno</b><span>${batch.recipients.length} sandučića</span></div><div class="m-bar"></div></div>`;
  } else {
    const pct = (n) => `${(n / Math.max(1, t.total)) * 100}%`;
    prog = `<div class="m-prog"><div class="row"><b>Pročitalo ${t.read} od ${t.total}</b><span>Provjereno ${M.agoMs(batch.checkedAt, nowMs())}</span></div>
      <div class="m-bar" role="img" aria-label="Pročitalo ${t.read}, nije pročitalo ${t.unread}, bez poruke ${t.missing + t.error}"><i class="rd" style="width:${pct(t.read)}"></i><i class="un" style="width:${pct(t.unread)}"></i><i class="er" style="width:${pct(t.missing + t.error)}"></i></div>
      <div class="m-leg"><span><i style="background:var(--green)"></i>Pročitalo ${t.read}</span><span><i style="background:#f0b45a"></i>Nije pročitalo ${t.unread}</span>${t.missing + t.error ? `<span><i style="background:#e5484d"></i>${t.missing ? `Nema poruke ${t.missing}` : ''}${t.missing && t.error ? ' · ' : ''}${t.error ? `Provjera nije uspjela ${t.error}` : ''}</span>` : ''}</div></div>`;
  }
  const open = inst.ui.open === batch.id;
  const acts = [];
  if (!retracted && canTrack) acts.push(`<button type="button" class="k-btn" data-act="bchk:${batch.id}" data-fk="bchk:${batch.id}" ${batch.checking ? 'disabled' : ''}>${I('refresh', 18)}${checked ? (batch.server ? 'Osvježi' : 'Provjeri ponovo') : 'Provjeri čitanje'}</button>`);
  if (!retracted && t.unread > 0) acts.push(`<button type="button" class="k-btn k-btn--p" data-act="bremind:${batch.id}" data-fk="bremind:${batch.id}">${I('bell-ring-outline', 18)}Podseti ${t.unread} ${M.pl(t.unread, 'nepročitanog', 'nepročitana', 'nepročitanih')}</button>`);
  if (checked || batch.status === 'retracted') acts.push(`<button type="button" class="k-btn" data-act="bopen:${batch.id}" data-fk="bopen:${batch.id}" aria-expanded="${open}">${I(open ? 'chevron-up' : 'chevron-down', 18)}Primaoci</button>`);
  if (!retracted) acts.push(`<span class="gap"></span><button type="button" class="k-btn danger" data-act="bretract:${batch.id}" data-fk="bretract:${batch.id}" ${batch.checking ? 'disabled' : ''}>${I('delete-outline', 18)}Povuci</button>`);
  let rl = '';
  if (open && (checked || retracted)) {
    const { f, rows, shown } = recipRows(inst, batch);
    const pills = [['unread', 'Nije pročitalo', t.unread], ['read', 'Pročitalo', t.read], ['missing', 'Nema poruke', t.missing + t.error], ['all', 'Svi', t.total]]
      .filter(([k, , n]) => n > 0 || k === 'all' || k === f)
      .map(([k, label, n]) => `<button type="button" class="k-sg" aria-pressed="${f === k}" data-act="bf:${batch.id}:${k}" data-fk="bf:${batch.id}:${k}">${label} <b style="margin-left:2px">${n}</b></button>`).join('');
    const body = rows.slice(0, shown).map(({ c, r }) => {
      const sm = STATE_META[r.state] || STATE_META.pending;
      const call = c.phone && r.state !== 'read' ? `<a class="m-hb" href="${M.telHref(c.phone)}" aria-label="Pozovi ${esc(dispName(c))}" data-fk="call:${batch.id}:${c.id}">${I('phone-outline', 22)}</a>` : '<span></span>';
      return `<div class="m-rr"><b><span>${esc(dispName(c))}</span><i>#${c.id}</i></b><span class="m-sp m-sp--${sm.cls}">${I(sm.icon, 14)}${sm.label}</span>${call}</div>`;
    }).join('');
    rl = `<div class="m-rl"><div class="m-rlf" role="group" aria-label="Filter primalaca">${pills}</div>${body || '<p style="padding:8px 14px 12px;font-size:.84rem;color:#5b6676">Nema kurira u ovom filteru.</p>'}${rows.length > shown ? `<div class="m-more2"><button type="button" class="k-btn" data-act="bmore:${batch.id}" data-fk="bmore:${batch.id}">Prikaži još ${Math.min(RPAGE, rows.length - shown)}</button></div>` : ''}</div>`;
  }
  const meta = `${esc(audLabel(batch))} · ${M.couriersText(batch.recipients.length)}`;
  return `<article class="m-sc${inst.ui.flash.has(batch.id) ? ' flash' : ''}" data-b="${batch.id}" style="--tint:${cat.tint};--ink-c:${cat.color}" aria-label="${esc(M.toLatin(batch.title))}">
    <header class="m-sch"><span class="ic1">${I(cat.icon, 22)}</span><span style="min-width:0"><b tabindex="-1" data-fk="bt:${batch.id}">${esc(M.toLatin(batch.title))}</b><small>${cat.label} · ${meta}</small></span><span class="tm">${batch.server ? M.dayLabel(batch.sentAt, nowMs()) + ' ' : ''}${M.clock(batch.sentAt)}</span></header>
    ${prog}
    <div class="m-sacts">${acts.join('')}</div>
    ${rl}
  </article>`;
};

// ---------------------------------------------------------------- poruke jednog kurira
const histRowHTML = (inst, m) => {
  const cat = M.catOf(m.category);
  const confirm = inst.ui.hdel === m.id;
  const rd = m.read;
  return `<div class="m-hm" style="--tint:${cat.tint};--ink-c:${cat.color}" data-m="${m.id}">
    <span class="ic1">${I(cat.icon, 20)}</span>
    <span style="min-width:0"><b>${esc(M.toLatin(m.title))}</b><small>${cat.label} · ${M.dayLabel(Date.parse(m.sent_at), nowMs())} ${M.clock(Date.parse(m.sent_at))}</small><p>${esc(M.toLatin(m.body))}</p></span>
    <span class="rt"><span class="m-rdp ${rd ? 'rd' : 'un'}">${I(rd ? 'check-all' : 'clock-outline', 16)}${rd ? 'Pročitano' : 'Nije pročitano'}</span>
      <button type="button" class="m-hb" data-act="hdel:${m.id}" data-fk="hdel:${m.id}" aria-label="Ukloni poruku ${esc(M.toLatin(m.title))}">${I('trash-can-outline', 22)}</button></span>
    ${confirm ? `<div class="m-confirmrow" role="alertdialog" aria-label="Potvrda uklanjanja"><span>Ukloniti ovu poruku iz sandučeta kurira? Ako ju je pročitao, pročitana je.</span><span class="row"><button type="button" class="k-btn" data-act="hdel-ok:${m.id}" data-fk="hdel-ok:${m.id}" style="background:#b42318;border-color:#b42318;color:#fff">Ukloni poruku</button><button type="button" class="k-btn" data-act="hdel-no" data-fk="hdel-no">Odustani</button></span></div>` : ''}
  </div>`;
};

// ---------------------------------------------------------------- donji list
const sheetHTML = ({ id, title, sub, body, foot, label }) => `
  <div class="k-scrim" data-act="sheet-x"></div>
  <div class="k-sheet" id="${id}" role="dialog" aria-modal="true" aria-label="${esc(label || title)}" tabindex="-1">
    <div class="k-grip" aria-hidden="true"><i></i></div>
    <div class="k-sh"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div><button type="button" class="k-sx" data-act="sheet-x" aria-label="Zatvori">${I('close', 20)}</button></div>
    <div class="k-sform"><div class="k-sb" data-r="sbody">${body}</div>${foot ? `<div class="k-sf" data-r="sfoot">${foot}</div>` : ''}</div>
  </div>`;
