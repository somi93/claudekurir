/* Tabla: pokretanje prototipa, razmjera okvira računara, prebacivanje računar/telefon, simulacije (nova predaja, pad servera, početno stanje). */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var d = $("#proto-d"), p = $("#proto-p"), wrap = $("#deskwrap");
  var mode = "desk";
  var fit = function () {
    if (!wrap || !d) return;
    var w = wrap.clientWidth || 1440;
    var k = Math.min(1, w / 1440);
    d.style.transform = "scale(" + k + ")";
    wrap.style.height = Math.round(900 * k) + "px";
  };
  // „Izvezi CSV“: <a download> u pregledniku Artifacta ne radi, pa se datoteka nudi kroz mogućnost `downloads` (gledalac potvrđuje); bez nje prototip kaže da ne može
  window.FCHost = {
    saveFile: function (name, text) {
      var no = function (why) { return { ok: false, why: why || "unavailable" }; };
      var c = window.claude;
      if (!c || typeof c.use !== "function") return Promise.resolve(no());
      return c.use("downloads").then(function (dl) {
        if (!dl || typeof dl.save !== "function") return no();
        return dl.save({ filename: name, data: text }).then(function () { return { ok: true }; }, function (e) { return no(e && e.code); });
      }, function () { return no(); });
    }
  };
  window.FCBoot();
  fit();
  if (window.ResizeObserver && wrap) new ResizeObserver(fit).observe(wrap);
  window.addEventListener("resize", fit);

  var current = function () { return mode === "desk" ? d.__fx : p.__fx; };
  var frameOf = function (id) { return id === "d" ? d : p; };
  // pomoćne funkcije za provjeru: nova instanca u okviru "d" ili "p"
  window.fresh = function (id, opts) { var root = frameOf(id); if (root.__fx) root.__fx.destroy(); var app = window.FCApp.create(root, opts || {}); root.__fx = app; return true; };
  window.A = function (id) { return frameOf(id).__fx; };
  $$("[data-mode]").forEach(function (b) {
    b.addEventListener("click", function () {
      mode = b.getAttribute("data-mode");
      $$("[data-mode]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      wrap.hidden = mode !== "desk";
      p.hidden = mode !== "phone";
      fit();
    });
  });
  // na uskom ekranu odmah pokaži okvir telefona: okvir računara bi tu bio smanjen na četvrtinu i nečitljiv
  if (window.matchMedia && window.matchMedia("(max-width: 700px)").matches) { var pb = $('[data-mode="phone"]'); if (pb) pb.click(); }
  var pend = $('[data-sim="pending"]'), fail = $('[data-sim="fail"]'), reset = $('[data-sim="reset"]');
  if (pend) pend.addEventListener("click", function () {
    var app = current(); if (!app) return;
    app.ctx.sim.addPending();
    pend.textContent = "Predaja je poslata (stiže do 8 s)";
    setTimeout(function () { pend.textContent = "Simuliraj novu predaju"; }, 3000);
  });
  if (fail) fail.addEventListener("click", function () {
    var app = current(); if (!app) return;
    // dok je list otvoren padaju upisi, inače čitanja (stranica pokaže staro stanje i „Pokušaj ponovo“)
    app.failNext(app.st.sheet ? /^POST / : /^GET /, 2, "Server ne odgovara.");
    fail.textContent = "Sljedeća 2 poziva će pasti";
    setTimeout(function () { fail.textContent = "Simuliraj pad servera"; }, 3000);
  });
  if (reset) reset.addEventListener("click", function () {
    [d, p].forEach(function (r) { if (r.__fx) { r.__fx.destroy(); r.__fx = null; } });
    window.FCBoot();
    fit();
  });
})();
