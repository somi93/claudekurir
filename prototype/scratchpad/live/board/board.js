/* Tabla: pokretanje prototipa, razmjera okvira računara, prebacivanje računar/telefon, simulacije (pomjeri kurire, ugasi aplikaciju, nova narudžba, pad servera, sat, početno stanje). */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var d = $("#d"), p = $("#p"), wrap = $("#deskwrap");
  var mode = "desk";
  var fit = function () {
    if (!wrap || !d) return;
    var w = wrap.clientWidth || 1440;
    var k = Math.min(1, w / 1440);
    d.style.transform = "scale(" + k + ")";
    wrap.style.height = Math.round(900 * k) + "px";
  };
  // pomoćne funkcije za provjeru: nova instanca u okviru "d" ili "p"
  window.fresh = function (id, opts) { var root = document.getElementById(id); if (root.__fx) root.__fx.destroy(); var app = window.LVApp.create(root, opts || {}); root.__fx = app; return true; };
  window.A = function (id) { return document.getElementById(id).__fx; };
  window.LVBoot();
  fit();
  if (window.ResizeObserver && wrap) new ResizeObserver(fit).observe(wrap);
  window.addEventListener("resize", fit);

  var current = function () { return mode === "desk" ? d.__fx : p.__fx; };
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

  var label = function (btn, text, ms) { var old = btn.getAttribute("data-label") || btn.textContent; btn.setAttribute("data-label", old); btn.textContent = text; setTimeout(function () { btn.textContent = old; }, ms || 3200); };
  var LOSE = [30189, 30195, 30242, 30244, 30259, 30253];
  var loseI = 0;
  $$("[data-sim]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var kind = btn.getAttribute("data-sim");
      if (kind === "reset") {
        [d, p].forEach(function (r) { if (r.__fx) { r.__fx.destroy(); r.__fx = null; } });
        window.LVBoot(); fit(); loseI = 0;
        return;
      }
      var app = current(); if (!app) return;
      if (kind === "move") { app.world.move(15); app.load("locs"); label(btn, "Kuriri su se pomjerili"); }
      else if (kind === "lose") {
        var id = LOSE[loseI % LOSE.length]; loseI++;
        var c = app.ctx.V.byId.get(id);
        app.world.loseSignal(id, 6 * 60000); app.load("locs");
        label(btn, (c ? c.name : "Kurir") + " više ne šalje signal (ime iznad: Bez signala)");
      } else if (kind === "order") { var oid = app.world.addWaitingOrder(); app.load("orders"); label(btn, "Nova narudžba #" + oid + " čeka kurira"); }
      else if (kind === "fail") { app.failNext(/^GET /, 2, "Server ne odgovara."); app.load("locs"); app.load("orders"); label(btn, "Sljedeća 2 čitanja su pala"); }
      else if (kind === "clock") { app.shiftClock(10 * 60000); label(btn, "Sat je pomjeren: " + window.LV.clock(app.nowMs())); }
    });
  });
})();
