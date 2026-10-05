// Provjera radnog prostora Cjenovnika (usePricingWorkspace i pomoćni composable-i) u običnom Node-u.
// TypeScript se prevodi u privremeni folder, "~/" se preusmjerava, "nuxt/app" je zamijenjen izmišljenim
// (useNuxtApp().$api je lažni server iz pr-fx.mjs), Vue radi sa praznim rendererom (bez DOM-a).
// Pokretanje iz korijena aplikacije: node docs/2026/10/cjenovnik-prototip/e2e/logic-workspace.mjs
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const out = mkdtempSync(join(tmpdir(), "pricing-ws-"));
symlinkSync(join(root, "node_modules"), join(out, "node_modules"));
const ts = createRequire(join(root, "package.json"))("typescript");

writeFileSync(
  join(out, "nuxt-app-stub.mjs"),
  `import { reactive } from "vue";
export const state = { api: null, route: reactive({ query: {} }) };
export const useNuxtApp = () => ({ $api: (...a) => state.api(...a) });
export const useRoute = () => state.route;
export const useRouter = () => ({ replace: async ({ query }) => { state.route.query = query; } });
`
);

const compiled = new Set();
const compile = (rel) => {
  if (compiled.has(rel)) return;
  compiled.add(rel);
  const src = readFileSync(join(root, "app", rel), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
  }).outputText;
  const dest = join(out, rel.replace(/\.ts$/, ".mjs"));
  mkdirSync(dirname(dest), { recursive: true });
  const rel2 = (to) => {
    let r = relative(dirname(dest), to);
    if (!r.startsWith(".")) r = `./${r}`;
    return r;
  };
  const fixed = js
    .replace(/from "~\/([^"]+)"/g, (_, p) => {
      compile(`${p}.ts`);
      return `from "${rel2(join(out, `${p}.mjs`))}"`;
    })
    .replace(/from "nuxt\/app"/g, () => `from "${rel2(join(out, "nuxt-app-stub.mjs"))}"`);
  writeFileSync(dest, fixed);
};
compile("composables/usePricingWorkspace.ts");
compile("composables/usePricingDraft.ts");
compile("composables/usePricingSimulator.ts");
compile("utils/pricingDrafts.ts");
compile("utils/pricing.ts");

const Vue = await import(join(root, "node_modules/vue/index.mjs"));
const { createPinia } = await import(join(root, "node_modules/pinia/dist/pinia.js"));
const stub = await import(join(out, "nuxt-app-stub.mjs"));
const { usePricingWorkspace } = await import(join(out, "composables/usePricingWorkspace.mjs"));
const { usePricingDraft } = await import(join(out, "composables/usePricingDraft.mjs"));
const { usePricingSimulator } = await import(join(out, "composables/usePricingSimulator.mjs"));
const { useAlertStore } = await import(join(out, "stores/alert.mjs"));
const pd = await import(join(out, "utils/pricingDrafts.mjs"));
const { buildPricingWorld, handlePricing } = await import(
  join(root, "docs/2026/10/cjenovnik-prototip/e2e/pr-fx.mjs")
);

globalThis.window = {
  matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, what, ms = 4000) => {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > ms) throw new Error(`Isteklo vrijeme: ${what}`);
    await sleep(10);
  }
};

// --- Lažni server -------------------------------------------------------------------------------------
const COMPANIES = [
  { id: 24, name: "Ordera Dostava Banja Luka", city_id: 1, city_name: "Banja Luka", currency: "KM" },
  { id: 27, name: "Test Dostava", city_id: 1, city_name: "Banja Luka", currency: "KM" },
];

const makeApi = (world) => {
  const calls = [];
  const faults = [];
  const api = (url, opts = {}) =>
    new Promise((resolve, reject) => {
      const method = (opts.method ?? "GET").toUpperCase();
      const u = new URL(url, "http://mock");
      for (const [k, v] of Object.entries(opts.query ?? {})) if (v != null) u.searchParams.set(k, String(v));
      const body = opts.body === undefined ? undefined : JSON.parse(JSON.stringify(opts.body));
      const call = { method, path: u.pathname, search: u.search, body };
      calls.push(call);
      const settle = (status, json) =>
        setTimeout(() => {
          if (opts.signal?.aborted) return reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          if (status === 0) return reject(Object.assign(new Error("net"), { request: {} }));
          if (status >= 400) {
            return reject(Object.assign(new Error(`HTTP ${status}`), { response: { status }, status, data: json }));
          }
          resolve(JSON.parse(JSON.stringify(json)));
        }, 5);
      const fault = faults.find((f) => f.times > 0 && f.match(call));
      if (fault) {
        fault.times -= 1;
        return settle(fault.status, fault.json ?? {});
      }
      if (u.pathname === "/dispatcher/my-companies") return settle(200, { success: true, data: COMPANIES });
      handlePricing({ pr: world }, { pth: u.pathname, method, body, u, fulfill: async (s, j) => settle(s, j) }).then(
        (handled) => {
          if (!handled) settle(404, { message: "Not found" });
        }
      );
    });
  api.calls = calls;
  api.fail = (match, status = 500, json = {}, times = 1) => faults.push({ match, status, json, times });
  api.clearFaults = () => (faults.length = 0);
  return api;
};

const nodeOps = {
  patchProp() {},
  insert() {},
  remove() {},
  createElement: () => ({}),
  createText: () => ({}),
  createComment: () => ({}),
  setText() {},
  setElementText() {},
  parentNode: () => null,
  nextSibling: () => null,
};

// Montira radni prostor u pravoj Vue aplikaciji (bez DOM-a) nad svježim svijetom i lažnim API-jem.
const mount = async ({ ready = true, before } = {}) => {
  const world = buildPricingWorld();
  const api = makeApi(world);
  stub.state.api = api;
  stub.state.route.query = {};
  if (before) before(api, world);
  const pinia = createPinia();
  const { createApp } = Vue.createRenderer(nodeOps);
  let ws;
  const app = createApp({
    setup() {
      ws = usePricingWorkspace();
      return () => null;
    },
  });
  app.use(pinia);
  app.mount({});
  const alert = useAlertStore(pinia);
  const h = { ws: Vue.toRaw(ws), rx: ws, api, world, alert, app };
  if (ready) await settled(h);
  return h;
};

// Sve učitano, a serverska preporuka stigla i važi.
const settled = async (h) => {
  const w = h.ws;
  await until(() => w.price.saved.value && !w.surcharges.loading.value && !w.rules.loading.value, "podaci");
  await until(() => !w.zones.loading.value, "zone");
  await until(() => w.server.fresh.value, "serverska preporuka");
};

let n = 0;
const ok = async (name, fn) => {
  await fn();
  n += 1;
  console.log(`  ok  ${name}`);
};

const lastAlert = (h) => h.alert.messages[h.alert.messages.length - 1];
const fresh = async (h) => {
  h.alert.messages.length = 0;
  h.api.calls.length = 0;
};

// --- Provjere --------------------------------------------------------------------------------------------

await ok("početno stanje: podaci, zaglavlje, tabovi, obračun 7,45 i serverska preporuka", async () => {
  const h = await mount();
  const w = h.ws;
  assert.equal(w.header.value.title, "Cjenovnik");
  assert.equal(w.header.value.subtitle, "Ordera Dostava Banja Luka · valuta KM");
  assert.equal(w.company.currency.value, "KM");
  assert.equal(w.surcharges.list.value.length, 5);
  assert.equal(w.rules.list.value.length, 5);
  assert.equal(w.zones.list.value.length, 4);
  assert.deepEqual(w.tabs.value, [
    { value: "price", label: "Cijena" },
    { value: "surcharges", label: "Doplate", badge: 2 },
    { value: "rules", label: "Vozila", badge: 5 },
  ]);
  assert.equal(w.saveState.value, "saved");
  const c = w.calc.value;
  assert.equal(c.draft.total, 7.45);
  assert.equal(c.saved.total, 7.45);
  assert.equal(c.diff.changed, false);
  assert.equal(c.ladder.length, 6);
  const r = w.recommended.value;
  assert.equal(r.source, "server");
  assert.equal(r.ruleId, 701);
  assert.equal(r.index, 0);
  assert.equal(r.title, "Doplata: Kiša");
  assert.deepEqual(r.vehicles, ["car", "motorbike"]);
  assert.equal(w.priceMismatch.value, null);
  // zone se učitavaju za grad firme, jednom
  const zoneCalls = h.api.calls.filter((c2) => c2.path === "/dispatcher/zones");
  assert.equal(zoneCalls.length, 1);
  assert.equal(zoneCalls[0].search, "?city_id=1");
});

await ok("reaktivni objekat: refovi su razmotani, upis ide kroz proxy", async () => {
  const h = await mount();
  const r = h.rx;
  assert.equal(r.price.saved.base_price, 2.5);
  assert.equal(r.price.loading, false);
  assert.equal(r.counts.rules, 5);
  assert.equal(r.counts.activeSurcharges, 2);
  assert.equal(r.sim.dist, 4.5);
  r.sim.zoneId = 12;
  assert.equal(h.ws.sim.zoneId.value, 12);
  r.price.edit("base", "3,10");
  assert.equal(r.price.draft.base, "3,10");
  assert.equal(r.price.dirty, true);
  assert.equal(r.tabs[0].dot, true);
  assert.equal(r.calc.diff.changed, true);
  assert.equal(r.surcharges.togglingIds.size, 0);
  assert.equal(r.leave.asking, false);
  assert.equal(typeof r.actions.savePrice, "function");
});

await ok("primjer: granice udaljenosti, zona i serverski odgovor važi tek za isti ulaz", async () => {
  const h = await mount();
  const w = h.ws;
  w.sim.setDist(20);
  assert.equal(w.sim.dist.value, 15);
  w.sim.setDist(0);
  assert.equal(w.sim.dist.value, 0.5);
  w.sim.setDist(Number.NaN);
  assert.equal(w.sim.dist.value, 4.5);
  w.sim.step(1);
  assert.equal(w.sim.dist.value, 5);
  w.sim.step(-1);
  // odmah poslije promjene odgovor sa servera je za raniji ulaz: računa se lokalno
  assert.equal(w.server.fresh.value, false);
  assert.equal(w.recommended.value.source, "local");
  assert.equal(w.recommended.value.ruleId, 701);
  w.sim.zoneId.value = 12;
  await sleep(120);
  assert.equal(w.server.fresh.value, false, "odgovor ne smije stići prije debounce-a");
  await until(() => w.server.fresh.value, "novi odgovor servera");
  assert.equal(w.recommended.value.source, "server");
  // Kiša je na snazi, pa je prvo pravilo i dalje 701 (zona 12 je tek drugo)
  assert.equal(w.recommended.value.ruleId, 701);
  // bez zone, Kiša isključena u primjeru: pravilo zone Starčevica (702) sa terenom 1,4 < 1,6
  w.sim.toggleOver(501);
  assert.equal(w.sim.hasOver.value, true);
  assert.equal(w.server.fresh.value, false);
  assert.equal(w.recommended.value.source, "local");
  assert.equal(w.recommended.value.ruleId, 702);
  assert.equal(w.recommended.value.index, 1);
  // zona Lauš (13): nijedno pravilo zone ne važi, pa pravilo udaljenosti 704 ne (4,5 > 4 važi!)
  w.sim.zoneId.value = 13;
  assert.equal(w.recommended.value.ruleId, 704);
  // "šta ako" ulazi u obračun primjera, ne u sačuvano
  w.sim.toggleOver(503);
  assert.ok(w.calc.value.draft.lines.some((l) => l.id === 503));
  assert.ok(!w.calc.value.live.before.lines.some((l) => l.id === 503));
  w.sim.resetOver();
  assert.equal(w.sim.hasOver.value, false);
  await until(() => w.server.fresh.value, "odgovor poslije vraćanja na stvarno");
  assert.equal(w.recommended.value.source, "server");
});

await ok("prekidač doplate: obavijest sa ukupnom cijenom i Poništi, poništavanje, pad", async () => {
  const h = await mount();
  const w = h.ws;
  await fresh(h);
  const res = await w.actions.toggleSurcharge(503);
  assert.deepEqual(res, { ok: true });
  assert.equal(w.surcharges.list.value.find((s) => s.id === 503).active, true);
  const msg = lastAlert(h);
  assert.equal(msg.type, "success");
  assert.equal(msg.text, "„Gužva“ je uključena. Za 4,5 km kupac plaća 8,45 KM.");
  assert.equal(msg.action.label, "Poništi");
  assert.equal(w.view.flashKey.value, "s503");
  assert.deepEqual(h.api.calls.find((c) => c.method === "PUT").body, { active: true });
  assert.equal(w.tabs.value[1].badge, 3);
  // serverski odgovor poslije izmjene se traži ponovo i poklapa se sa klijentom
  await until(() => w.server.fresh.value, "osvježen odgovor");
  assert.equal(w.priceMismatch.value, null);
  h.alert.runAction(msg.id);
  await until(() => w.surcharges.list.value.find((s) => s.id === 503).active === false, "poništeno");
  await until(() => w.surcharges.togglingIds.value.size === 0, "kraj poništavanja");
  assert.equal(h.alert.messages.length, 0);

  // pad: prekidač se vraća, poruka je u rezultatu, nema obavijesti
  h.api.fail((c) => c.method === "PUT" && c.path.endsWith("/surcharges/503"), 500);
  const bad = await w.actions.toggleSurcharge(503);
  assert.equal(bad.ok, false);
  assert.match(bad.message, /Prekidač je vraćen/);
  assert.equal(w.surcharges.list.value.find((s) => s.id === 503).active, false);
  assert.equal(h.alert.messages.length, 0);

  // isključivanje
  const off = await w.actions.toggleSurcharge(501);
  assert.equal(off.ok, true);
  assert.equal(lastAlert(h).text, "„Kiša“ je isključena. Za 4,5 km kupac plaća 6,10 KM.");
  // doplata koje nema
  const none = await w.actions.toggleSurcharge(9999);
  assert.equal(none.ok, false);
  assert.match(none.message, /više ne postoji/);
});

await ok("prekidač: server odgovori suprotnim stanjem (B3) daje upozorenje bez Poništi", async () => {
  const h = await mount({
    before: (api) => api.fail((c) => c.method === "PUT" && c.path.endsWith("/surcharges/502"), 200, { success: true, data: { id: 502, delivery_company_id: 24, name: "Noćna dostava", type: "fixed", value: 1.5, active: false } }),
  });
  const w = h.ws;
  await fresh(h);
  const res = await w.actions.toggleSurcharge(502);
  assert.equal(res.ok, true);
  assert.equal(res.warning, "Server nije uključio doplatu.");
  assert.equal(lastAlert(h).type, "warning");
  assert.equal(lastAlert(h).action, undefined);
  assert.equal(w.surcharges.list.value.find((s) => s.id === 502).active, false);
});

await ok("nacrt cijene: dodir, greške tek poslije blur-a, korak, razlika, serverska preporuka se gasi", async () => {
  const h = await mount();
  const w = h.ws;
  const d = w.price;
  assert.deepEqual({ ...d.draft }, { base: "2,50", km: "0,80" });
  assert.equal(d.dirty.value, false);
  d.edit("base", "3,10");
  assert.equal(d.dirty.value, true);
  assert.deepEqual(d.dirtyFields.value, { base: true, km: false });
  assert.equal(w.saveState.value, "unsaved");
  assert.equal(w.tabs.value[0].dot, true);
  assert.equal(w.dirty.isAnyDirty(), true);
  assert.equal(w.calc.value.diff.changed, true);
  assert.equal(w.calc.value.diff.delta, 0.6);
  assert.equal(w.calc.value.diff.up, true);
  assert.equal(w.calc.value.live.after.total, 8.05);
  assert.equal(w.server.fresh.value, false);
  assert.equal(w.recommended.value.source, "local");
  d.step("km", 1);
  assert.equal(d.draft.km, "0,85");
  d.step("base", -1);
  assert.equal(d.draft.base, "3,00");
  // greška: dok se kuca ne smeta, poslije blur-a se vidi
  d.edit("km", "abc");
  assert.ok(d.rawErrors.value.km);
  assert.equal(d.errors.value.km, undefined);
  d.blur("km");
  assert.match(d.errors.value.km, /Unesi broj/);
  // neispravan nacrt ne ide serveru
  h.api.calls.length = 0;
  const bad = await w.actions.savePrice();
  assert.deepEqual(bad, { ok: false, message: "", fields: {} });
  assert.equal(h.api.calls.filter((c) => c.method === "PUT").length, 0);
  // obračun koristi sačuvanu vrijednost dok je polje neispravno
  assert.equal(w.price.numbers.value.km, 0.8);
  // popravka i snimanje
  d.edit("base", "3,10");
  d.edit("km", "0,90");
  h.alert.messages.length = 0;
  const res = await w.actions.savePrice();
  assert.deepEqual(res, { ok: true });
  assert.deepEqual(h.api.calls.find((c) => c.method === "PUT").body, { base_price: 3.1, price_per_km: 0.9, currency: "KM" });
  assert.equal(lastAlert(h).text, "Cijena je sačuvana. Važi za nove narudžbe.");
  assert.equal(d.dirty.value, false);
  assert.equal(d.draft.base, "3,10");
  assert.equal(w.price.saved.value.base_price, 3.1);
  assert.equal(w.saveState.value, "saved");
  await until(() => w.server.fresh.value, "odgovor poslije snimanja");
  assert.equal(w.priceMismatch.value, null);
  assert.equal(w.calc.value.saved.total, 8.5);
  assert.equal(w.recommended.value.source, "server");
});

await ok("nacrt: '2,5' i '2,50' nije izmjena; poništi vraća; ponovno učitavanje ne gazi nacrt", async () => {
  const h = await mount();
  const w = h.ws;
  const d = w.price;
  d.edit("base", "2,5");
  assert.equal(d.dirty.value, false);
  d.edit("base", "9");
  assert.equal(d.dirty.value, true);
  // isto sačuvano (retry): nacrt ostaje
  await w.price.reload();
  await sleep(20);
  assert.equal(d.draft.base, "9");
  w.actions.discardPrice();
  assert.equal(d.draft.base, "2,50");
  assert.equal(d.dirty.value, false);
  // bez nacrta, nova sačuvana cijena (npr. druga izmjena sa drugog računara) se odmah preuzima
  h.world.pricing[24].base_price = 2.75;
  await w.price.reload();
  await until(() => d.draft.base === "2,75", "preuzeta nova sačuvana cijena");
  // sa nacrtom nova sačuvana cijena ne briše unos
  d.edit("km", "1");
  h.world.pricing[24].base_price = 2.8;
  await w.price.reload();
  await sleep(20);
  assert.equal(d.draft.km, "1");
  assert.equal(d.draft.base, "2,75");
});

await ok("greška servera (422) ide uz polje; kucanje je briše", async () => {
  const h = await mount();
  const w = h.ws;
  const d = w.price;
  d.edit("km", "50");
  h.api.fail(
    (c) => c.method === "PUT" && c.path.endsWith("/pricing"),
    422,
    { message: "The given data was invalid.", errors: { price_per_km: ["Cijena po kilometru je prevelika."], currency: ["Valuta nije dozvoljena."] } }
  );
  const res = await w.actions.savePrice();
  assert.equal(res.ok, false);
  assert.equal(res.message, "Server nije prihvatio izmjenu. Provjeri označeno polje.");
  assert.equal(d.serverErrors.value.km, "Cijena po kilometru je prevelika.");
  assert.deepEqual(d.serverLoose.value, ["Valuta nije dozvoljena."]);
  assert.equal(d.shownErrors.value.km, "Cijena po kilometru je prevelika.");
  assert.equal(w.price.saved.value.price_per_km, 0.8, "sačuvano se ne mijenja dok server ne prihvati");
  assert.equal(d.draft.km, "50", "unos ostaje u formi");
  d.edit("km", "5");
  assert.equal(d.shownErrors.value.km, undefined);
  assert.equal(d.serverMessage.value, "");
  // pad bez odgovora
  h.api.fail((c) => c.method === "PUT" && c.path.endsWith("/pricing"), 0);
  const net = await w.actions.savePrice();
  assert.equal(net.ok, false);
  assert.match(net.message, /Nema veze/);
});

await ok("provjera B5: klijentski obračun se razlikuje od serverskog", async () => {
  const h = await mount();
  const w = h.ws;
  assert.equal(w.priceMismatch.value, null);
  // server tiho primjenjuje drugu cijenu po km nego što je front sačuvao
  h.world.pricing[24].price_per_km = 0.9;
  await w.server.reload();
  await until(() => w.priceMismatch.value !== null, "neslaganje");
  assert.deepEqual(w.priceMismatch.value, { client: 7.45, server: 7.9, distKm: 4.5 });
  // sa nacrtom ili "šta ako" provjera se ne radi
  w.price.edit("base", "3");
  assert.equal(w.priceMismatch.value, null);
});

await ok("pomjeranje pravila: PUT prioriteta, obavijest, Poništi, rubovi", async () => {
  const h = await mount();
  const w = h.ws;
  await fresh(h);
  const ids = () => [...w.rules.ordered.value.list.map((r) => r.id), w.rules.ordered.value.fallback.id];
  assert.deepEqual(ids(), [701, 702, 703, 704, 705]);
  assert.equal(w.rules.canMove(702, -1), true);
  assert.equal(w.rules.canMove(701, -1), false);
  assert.equal(w.rules.canMove(705, 1), false);
  const res = await w.actions.moveRule(702, -1);
  assert.deepEqual(res, { ok: true });
  assert.deepEqual(ids(), [702, 701, 703, 704, 705]);
  const puts = h.api.calls.filter((c) => c.method === "PUT");
  assert.deepEqual(
    puts.map((c) => [c.path.split("/").pop(), c.body.priority]).sort(),
    [["701", 2], ["702", 1]]
  );
  const msg = lastAlert(h);
  assert.equal(msg.text, "Pravilo je pomjereno.");
  assert.equal(msg.action.label, "Poništi");
  assert.equal(w.view.flashKey.value, "r702");
  h.alert.runAction(msg.id);
  await until(() => ids()[0] === 701, "poništeno pomjeranje");
  assert.deepEqual(ids(), [701, 702, 703, 704, 705]);
  await until(() => !w.rules.reordering.value, "kraj poništavanja");
  const top = await w.actions.moveRule(701, -1);
  assert.equal(top.ok, false);
  assert.equal(top.message, "Ovo pravilo se ne može pomjeriti.");
  const def = await w.actions.moveRule(705, -1);
  assert.equal(def.ok, false);
  // pad jednog od dva poziva: lokalno staro stanje i pokušaj vraćanja
  h.api.fail((c) => c.method === "PUT" && c.path.endsWith("/vehicle-rules/702"), 500);
  const bad = await w.actions.moveRule(702, -1);
  assert.equal(bad.ok, false);
  assert.match(bad.message, /redoslijed je vraćen/);
  assert.deepEqual(ids(), [701, 702, 703, 704, 705]);
});

await ok("brisanje doplate: prvo pravila koja je koriste, pa doplata; obavijest sa brojem pravila", async () => {
  const h = await mount();
  const w = h.ws;
  await fresh(h);
  assert.deepEqual(w.rules.usingSurcharge(501).map((r) => r.id), [701]);
  w.sim.toggleOver(502);
  assert.equal(w.sim.over.value[502], true);
  const res = await w.actions.removeSurchargeCascade(501);
  assert.deepEqual(res, { ok: true });
  const dels = h.api.calls.filter((c) => c.method === "DELETE").map((c) => c.path);
  assert.deepEqual(dels, ["/delivery-companies/vehicle-rules/701", "/delivery-companies/surcharges/501"]);
  assert.equal(w.surcharges.list.value.length, 4);
  assert.equal(w.rules.list.value.length, 4);
  assert.equal(lastAlert(h).text, "Doplata „Kiša“ je obrisana zajedno sa 1 pravilom.");
  assert.equal(w.sim.over.value[502], true, "tuđi 'šta ako' ostaje");
  // doplata koju nijedno pravilo ne koristi
  const res2 = await w.actions.removeSurchargeCascade(505);
  assert.deepEqual(res2, { ok: true });
  assert.equal(lastAlert(h).text, "Doplata „Praznik“ je obrisana.");
  assert.equal(w.sim.hasOver.value, true);
});

await ok("brisanje doplate: pad brisanja pravila ne briše doplatu; bez učitanih pravila se ne briše", async () => {
  const h = await mount();
  const w = h.ws;
  // dodaj drugo pravilo koje koristi Kišu, pa pusti da drugo brisanje padne
  const draft = w.rules.makeDraft(null);
  draft.type = "surcharge";
  draft.sur = 501;
  draft.veh = ["car"];
  const created = await w.actions.saveRule(null, draft);
  assert.equal(created.ok, true);
  assert.deepEqual(w.rules.usingSurcharge(501).map((r) => r.id), [701, created.id]);
  await fresh(h);
  h.api.fail((c) => c.method === "DELETE" && c.path.endsWith(`/vehicle-rules/${created.id}`), 500);
  const bad = await w.actions.removeSurchargeCascade(501);
  assert.equal(bad.ok, false);
  assert.match(bad.message, /Doplata nije obrisana\. Već je obrisano 1 od 2 pravila\./);
  assert.equal(w.surcharges.list.value.some((s) => s.id === 501), true);
  assert.equal(h.api.calls.filter((c) => c.path === "/delivery-companies/surcharges/501").length, 0);
  assert.deepEqual(w.rules.usingSurcharge(501).map((r) => r.id), [created.id]);
  // ponovni pokušaj nastavlja
  const again = await w.actions.removeSurchargeCascade(501);
  assert.equal(again.ok, true);
  assert.equal(lastAlert(h).text, "Doplata „Kiša“ je obrisana zajedno sa 1 pravilom.");

  const h2 = await mount({
    ready: false,
    before: (api) => api.fail((c) => c.method === "GET" && c.path.endsWith("/vehicle-rules"), 500, {}, 5),
  });
  await until(() => h2.ws.rules.loadFailed.value && h2.ws.surcharges.list.value.length === 5, "pad pravila");
  const refused = await h2.ws.actions.removeSurchargeCascade(501);
  assert.equal(refused.ok, false);
  assert.match(refused.message, /Pravila za vozila nisu učitana/);
  assert.equal(h2.api.calls.filter((c) => c.method === "DELETE").length, 0);
});

await ok("nova doplata iz kataloga, izmjena, nova pravila ispred zadanog", async () => {
  const h = await mount();
  const w = h.ws;
  await fresh(h);
  assert.ok(w.surcharges.catalog.value.some((c) => c.key === "tag:2"));
  const draft = pd.makeSurchargeDraft(h.world.tags[1]);
  draft.val = "0,50";
  const created = await w.actions.saveSurcharge(null, draft);
  assert.equal(created.ok, true);
  assert.ok(created.id);
  const post = h.api.calls.find((c) => c.method === "POST");
  assert.equal(post.body.active, false);
  assert.equal(post.body.condition_tag_id, 2);
  assert.equal(post.body.unit, "KM/km");
  assert.equal(lastAlert(h).text, "Doplata „Snijeg“ je dodata. Isključena je dok je ne uključiš.");
  assert.equal(w.view.flashKey.value, `s${created.id}`);
  assert.ok(!w.surcharges.catalog.value.some((c) => c.key === "tag:2"));
  // izmjena
  const edit = pd.makeSurchargeDraft(w.surcharges.list.value.find((s) => s.id === 501));
  edit.name = "Jaka kiša";
  edit.val = "0,40";
  h.api.calls.length = 0;
  const upd = await w.actions.saveSurcharge(501, edit);
  assert.equal(upd.ok, true);
  const put = h.api.calls.find((c) => c.method === "PUT");
  assert.equal(put.body.name, "Jaka kiša");
  assert.equal(put.body.value, 0.4);
  assert.equal("active" in put.body, false);
  assert.equal(lastAlert(h).text, "Doplata je sačuvana.");
  assert.equal(w.surcharges.list.value.find((s) => s.id === 501).name, "Jaka kiša");
  // duplikat naziva čuva provjera u nacrtu, ne server: ovdje server odbija
  h.api.fail((c) => c.method === "POST", 422, { message: "invalid", errors: { name: ["Naziv je zauzet."] } });
  const dup = await w.actions.saveSurcharge(null, edit);
  assert.equal(dup.ok, false);
  assert.deepEqual(dup.fields, { name: "Naziv je zauzet." });

  // novo pravilo: zadano pomjereno iza novog, pa POST
  const rd = w.rules.makeDraft(null);
  assert.equal(rd.type, "zone");
  rd.zone = 13;
  rd.veh = ["car", "walk"];
  h.api.calls.length = 0;
  const rule = await w.actions.saveRule(null, rd);
  assert.equal(rule.ok, true);
  const seq = h.api.calls.filter((c) => c.method !== "GET").map((c) => `${c.method} ${c.path.split("/").pop()} ${c.body.priority ?? ""}`);
  assert.deepEqual(seq, ["PUT 705 6", `POST vehicle-rules 5`]);
  assert.equal(lastAlert(h).text, "Pravilo je dodato iznad „Sve ostalo“.");
  assert.equal(w.rules.ordered.value.list.at(-1).id, rule.id);
  assert.equal(w.rules.ordered.value.fallback.id, 705);
  assert.equal(w.rules.titleOf(w.rules.ruleById(rule.id)), "Zona: Lauš");
  assert.equal(w.rules.duplicateOf(rd, null), 5);
  // izmjena i brisanje pravila
  const re = w.rules.makeDraft(w.rules.ruleById(rule.id));
  re.note = "Napomena";
  const ru = await w.actions.saveRule(rule.id, re);
  assert.equal(ru.ok, true);
  assert.equal(lastAlert(h).text, "Pravilo je sačuvano.");
  const del = await w.actions.removeRule(rule.id);
  assert.equal(del.ok, true);
  assert.equal(lastAlert(h).text, "Pravilo je obrisano.");
  assert.equal(w.rules.ruleById(rule.id), null);
  const keep = await w.actions.removeRule(705);
  assert.equal(keep.ok, false);
  assert.match(keep.message, /Zadano pravilo se ne briše/);
  assert.ok(w.rules.ruleById(705));
});

await ok("pitanje pri napuštanju: bez izmjena prolazi, sa izmjenama pita, odbaci vraća nacrt", async () => {
  const h = await mount();
  const w = h.ws;
  let went = 0;
  const go = () => (went += 1);
  assert.equal(w.leave.stop(go), false);
  assert.equal(went, 0, "stop ne izvršava radnju kad nema izmjena");
  w.leave.run(go);
  assert.equal(went, 1);
  w.price.edit("base", "5");
  assert.equal(w.leave.stop(go), true);
  assert.equal(w.leave.asking.value, true);
  w.leave.keep();
  assert.equal(w.leave.asking.value, false);
  assert.equal(went, 1);
  w.leave.run(go);
  assert.equal(w.leave.asking.value, true);
  w.leave.discard();
  assert.equal(went, 2);
  assert.equal(w.leave.asking.value, false);
  assert.equal(w.price.dirty.value, false);
  // editor prijavljuje svoju izmjenu
  const flag = Vue.ref(false);
  const off = w.dirty.registerEditorDirty("surcharge", () => flag.value);
  assert.equal(w.dirty.isAnyDirty(), false);
  flag.value = true;
  assert.equal(w.dirty.isAnyDirty(), true);
  assert.equal(w.dirty.tabs.value.surcharges, true);
  assert.equal(w.tabs.value[1].dot, true);
  assert.equal(w.saveState.value, "unsaved");
  off();
  assert.equal(w.dirty.isAnyDirty(), false);
});

await ok("druga firma: primjer kreće iznova, podaci se zamjenjuju, pitanje se zatvara", async () => {
  const h = await mount();
  const w = h.ws;
  w.sim.setDist(8);
  w.sim.zoneId.value = 12;
  w.sim.toggleOver(503);
  w.price.edit("base", "7");
  w.leave.stop(() => {});
  w.company.select(27);
  await until(() => w.price.saved.value?.delivery_company_id === 27, "cijena firme 27");
  assert.equal(w.sim.dist.value, 4.5);
  assert.equal(w.sim.zoneId.value, null);
  assert.equal(w.sim.hasOver.value, false);
  assert.equal(w.leave.asking.value, false);
  assert.equal(w.price.draft.base, "3,00");
  assert.equal(w.price.dirty.value, false);
  await until(() => !w.surcharges.loading.value && !w.rules.loading.value, "liste firme 27");
  assert.equal(w.surcharges.list.value.length, 0);
  assert.equal(w.rules.list.value.length, 0);
  assert.equal(w.recommended.value, null);
  assert.equal(w.header.value.subtitle, "Test Dostava · valuta KM");
  // zone istog grada se ne učitavaju ponovo
  assert.equal(h.api.calls.filter((c) => c.path === "/dispatcher/zones").length, 1);
});

await ok("pad učitavanja: stanja, calc je null, reloadAll učitava samo ono što je palo", async () => {
  const h = await mount({
    ready: false,
    before: (api) => {
      api.fail((c) => c.method === "GET" && c.path.endsWith("/pricing"), 500);
      api.fail((c) => c.method === "GET" && c.path.endsWith("/surcharges"), 0);
    },
  });
  const w = h.ws;
  await until(() => w.price.loadFailed.value && w.surcharges.loadFailed.value, "padovi");
  assert.equal(w.calc.value, null);
  assert.equal(w.saveState.value, null);
  assert.equal(w.price.loadReason.value, "Server ne odgovara.");
  assert.match(w.surcharges.loadReason.value, /Nema veze/);
  assert.equal(w.tabs.value[1].badge, undefined, "bez broja dok lista nije učitana");
  h.api.calls.length = 0;
  await w.actions.reloadAll();
  const gets = h.api.calls.map((c) => c.path.split("/").pop()).sort();
  assert.ok(gets.includes("pricing") && gets.includes("surcharges"));
  assert.ok(!gets.includes("vehicle-rules"), "pravila nisu padala");
  await until(() => w.calc.value !== null, "obračun");
  assert.equal(w.price.loadFailed.value, false);
  assert.equal(w.tabs.value[1].badge, 2);
});

await ok("pogled: tab u adresi, otvaranje pravila, širina", async () => {
  const h = await mount();
  const w = h.ws;
  assert.equal(w.view.tab.value, "price");
  assert.equal(w.view.wide.value, true);
  w.view.setTab("surcharges");
  assert.equal(stub.state.route.query.t, "doplate");
  assert.equal(w.view.tab.value, "surcharges");
  w.view.setTab("rules");
  assert.equal(stub.state.route.query.t, "vozila");
  w.view.setTab("price");
  assert.equal("t" in stub.state.route.query, false);
  w.view.simOpen.value = true;
  w.view.openRule(702);
  assert.equal(w.view.tab.value, "rules");
  assert.equal(w.view.flashKey.value, "r702");
  assert.equal(w.view.simOpen.value, false);
});

await ok("usePricingSimulator: samostalno, uklanja 'šta ako' za nepostojeće i poklopljene doplate", async () => {
  const list = Vue.ref([
    { id: 1, name: "A", type: "fixed", value: 1, active: false },
    { id: 2, name: "B", type: "per_km", value: 0.3, active: true },
  ]);
  const sim = usePricingSimulator(list);
  sim.toggleOver(1);
  sim.toggleOver(2);
  assert.deepEqual({ ...sim.over.value }, { 1: true, 2: false });
  assert.deepEqual({ ...sim.active.value }, { 1: true, 2: false });
  sim.toggleOver(2);
  assert.deepEqual({ ...sim.over.value }, { 1: true });
  sim.toggleOver(77);
  assert.equal(sim.hasOver.value, true);
  list.value = [{ ...list.value[0], active: true }, list.value[1]];
  await Vue.nextTick();
  assert.equal(sim.hasOver.value, false, "stvarno stanje se poklopilo sa prepisanim");
  sim.toggleOver(1);
  list.value = [list.value[1]];
  await Vue.nextTick();
  assert.equal(sim.hasOver.value, false, "doplate više nema");
  sim.setDist(7.3);
  assert.equal(sim.dist.value, 7.5);
  sim.reset();
  assert.equal(sim.dist.value, 4.5);
});

await ok("usePricingDraft: samostalno, druga firma vraća nacrt na sačuvano", async () => {
  const saved = Vue.ref({ delivery_company_id: 1, base_price: 2.5, price_per_km: 0.8, currency: "KM" });
  const d = usePricingDraft(saved);
  assert.equal(d.draft.base, "2,50");
  d.edit("base", "4");
  saved.value = { delivery_company_id: 2, base_price: 3, price_per_km: 1, currency: "BAM" };
  await Vue.nextTick();
  assert.deepEqual({ ...d.draft }, { base: "3,00", km: "1,00" });
  assert.equal(d.dirty.value, false);
  assert.equal(d.sanity.value, null);
  d.edit("km", "9,5");
  assert.match(d.sanity.value, /Za 10 km to je 98,00 BAM/);
  saved.value = null;
  await Vue.nextTick();
  assert.deepEqual({ ...d.draft }, { base: "", km: "" });
  assert.deepEqual(d.rawErrors.value, {});
  assert.equal(d.dirty.value, false);
});

console.log(`\nSvih ${n} provjera prošlo.`);
process.exit(0);
