/* Prototip "Kuriri uživo": list za poruku kuriru (isti izgled kao donji listovi u aplikaciji: ručka, naslov, X, tijelo, podnožje sa dugmetom). */
(function () {
  "use strict";
  const reg = (window.LVParts = window.LVParts || {});
  const TPL = {
    where: { label: "Gdje si?", title: "Gdje si?", body: "Izgubili smo tvoj signal. Otvori aplikaciju i uključi lokaciju, ili se javi dispečeru." },
    call: { label: "Javi se dispečeru", title: "Javi se dispečeru", body: "Molim te da se javiš dispečeru čim možeš." },
    wait: { label: "Čekamo te", title: "Narudžba te čeka", body: "Narudžba je spremna u restoranu. Javi kad stižeš." },
  };

  reg.sheets = function (ctx) {
    const { esc, ic, st } = ctx;
    const make = (courier, preset) => {
      const t = preset && TPL[preset] ? TPL[preset] : null;
      return { type: "msg", courier, cat: "announcement", title: t ? t.title : "", body: t ? t.body : "", err: "", busy: false, sent: false };
    };
    const valid = (sh) => Boolean(sh.title.trim() && sh.body.trim());
    const send = async (sh) => {
      if (sh.busy || !valid(sh)) return;
      sh.busy = true; sh.err = ""; ctx.refreshSheet();
      try {
        await ctx.api("POST", `/couriers/${sh.courier.id}/inbox`, { category: sh.cat, title: sh.title.trim(), body: sh.body.trim() });
        sh.sent = true; sh.busy = false;
        ctx.closeSheet(true);
        ctx.toast(`Poruka je poslata: ${sh.courier.first || sh.courier.name}.`);
        ctx.msgLog = (ctx.msgLog || []).concat({ id: sh.courier.id, title: sh.title.trim() });
      } catch (e) {
        sh.busy = false; sh.err = "Ne mogu da pošaljem poruku. Pokušaj ponovo; tekst je ostao u listu.";
        ctx.refreshSheet();
      }
    };
    ctx.sheets.msg = {
      make,
      title: (sh) => `Poruka kuriru ${sh.courier.name}`,
      sub: () => "Stiže u sanduče kurira u aplikaciji",
      dirty: (sh) => !sh.sent && Boolean(sh.title.trim() || sh.body.trim()),
      locked: (sh) => sh.busy,
      body: (sh) => `<div class="lv-f"><span class="lb" id="lv-tpl-l">Brzi tekstovi</span><div class="lv-ch" role="group" aria-labelledby="lv-tpl-l">${Object.entries(TPL).map(([k, t]) => `<button type="button" class="lv-ch2" data-act="msg-tpl" data-arg="${k}" data-fk="tpl-${k}">${esc(t.label)}</button>`).join("")}</div></div>
        <div class="lv-f"><span class="lb" id="lv-cat-l">Vrsta</span><div class="lv-ch" role="radiogroup" aria-labelledby="lv-cat-l">${[["announcement", "Obavještenje"], ["todo", "Zadatak"]].map(([k, l]) => `<button type="button" role="radio" class="lv-ch2" aria-checked="${sh.cat === k}" data-act="msg-cat" data-arg="${k}" data-fk="cat-${k}">${l}</button>`).join("")}</div></div>
        <div class="lv-f"><label for="lv-mt">Naslov</label><div class="lv-in"><input id="lv-mt" data-fk="mt" data-autofocus value="${esc(sh.title)}" maxlength="80" autocomplete="off" placeholder="Npr. Javi se dispečeru"></div></div>
        <div class="lv-f"><label for="lv-mb">Poruka</label><div class="lv-in"><textarea id="lv-mb" data-fk="mb" maxlength="500" placeholder="Šta kurir treba da zna ili uradi">${esc(sh.body)}</textarea></div></div>`,
      foot: (sh) => `<button type="button" class="lv-btn lv-btn--pri lv-btn--block" data-act="msg-send" data-fk="send" ${valid(sh) && !sh.busy ? "" : "disabled"} ${sh.busy ? 'aria-busy="true"' : ""}>${ic("send", 20)}${sh.busy ? "Šaljem…" : "Pošalji poruku"}</button><p class="${sh.err ? "bad" : ""}" role="${sh.err ? "alert" : "status"}" style="${sh.err ? "color:#b42318;font-weight:700" : ""}">${esc(sh.err || (valid(sh) ? "Poruka ide samo ovom kuriru." : "Upiši naslov i poruku."))}</p>`,
      input: (sh, ev) => { if (ev.target.id === "lv-mt") sh.title = ev.target.value; else if (ev.target.id === "lv-mb") sh.body = ev.target.value; sh.err = ""; ctx.refreshSheet(); },
      submit: (sh) => send(sh),
    };
    ctx.acts["msg-tpl"] = (k) => { const sh = st.sheet; if (!sh) return; sh.title = TPL[k].title; sh.body = TPL[k].body; ctx.renderSheet(); const i = ctx.root.querySelector("#lv-mb"); if (i) i.focus(); };
    ctx.acts["msg-cat"] = (k) => { const sh = st.sheet; if (!sh) return; sh.cat = k; ctx.renderSheet(); };
    ctx.acts["msg-send"] = () => send(st.sheet);
    return { start() {}, destroy() {} };
  };
})();
