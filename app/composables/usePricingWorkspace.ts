import { computed, reactive, ref, shallowReactive, watch } from "vue";
import { storeToRefs } from "pinia";
import { useAlertStore } from "~/stores/alert";
import { useDeliveryCompaniesStore } from "~/stores/deliveryCompanies";
import { useDeliveryPricing } from "~/composables/useDeliveryPricing";
import { useDispatcherZones } from "~/composables/useDispatcherZones";
import { usePricingDraft } from "~/composables/usePricingDraft";
import { usePricingSimulator } from "~/composables/usePricingSimulator";
import { usePricingView, type PricingTab } from "~/composables/usePricingView";
import { useSurcharges } from "~/composables/useSurcharges";
import { useVehicleRecommendation } from "~/composables/useVehicleRecommendation";
import { useVehicleRules } from "~/composables/useVehicleRules";
import type { ActionResult } from "~/composables/useCourierRoster";
import type { Pricing, VehicleRule } from "~/types/pricing";
import { resolveCurrency, toAmount } from "~/utils/currency";
import {
  activeOf,
  calcPrice,
  formatKm,
  formatMoney,
  formatNum2,
  ladderRows,
  round2,
  ruleVehicles,
  sampleDistances,
  type LadderRow,
  type PriceBreakdown,
  type PriceConfig,
  type RuleTitleLookup,
  type ZoneLike,
} from "~/utils/pricing";
import { toPricingBody, type RuleDraft, type SurchargeDraft } from "~/utils/pricingDrafts";
import { toLatin } from "~/utils/toLatin";

// Radni prostor stranice Cjenovnik: sklapa sve što ekran koristi i drži ga na jednom mjestu, da komponente
// ne moraju da se dogovaraju među sobom. Povratna vrijednost je jedan objekat sa grupama:
//   company, header, saveState   firma i valuta; naslov i podnaslov; oznaka "Nesačuvano" / "Sve je sačuvano"
//   tabs, counts, view           pilule sa brojačima i tačkom za nesačuvano; sirovi brojevi; tab, širina, isticanje
//   price                        sačuvana cijena + nacrt cijene (usePricingDraft) na istom objektu
//   surcharges, rules, zones     podaci i pomoćnici (bez radnji koje čuvaju: njih daje actions)
//   sim, server                  ulaz Primjera narudžbe (udaljenost, zona, "šta ako"); stanje serverske preporuke
//   calc, recommended            obračun za primjer; preporučena vozila
//   priceMismatch                provjera klijentskog obračuna sa serverskim `price` (B5)
//   dirty, leave                 nesačuvano (isAnyDirty, registerEditorDirty) i pitanje pri napuštanju
//   actions                      radnje koje čuvaju, brišu i pomjeraju, sa obavijestima ("Poništi" 6 s)
// Greška direktne radnje (prekidač, pomjeranje, snimanje) se vraća kao ActionResult da je ekran pokaže uz ono
// što se mijenja; obavijest pravi radni prostor samo za uspjeh, upozorenje i "Poništi".

export type PricingSaveState = "saved" | "unsaved" | "saving";

export type PricingTabItem = { value: PricingTab; label: string; badge?: number; dot?: boolean };

// Čiji je editor otvoren: doplate ili pravila (cijena ima nacrt u radnom prostoru).
export type PricingEditorSource = "surcharge" | "rule";

// Obračun za Primjer narudžbe. `draft` je nacrt cijene sa doplatama iz primjera ("šta ako" uključeno),
// `saved` sačuvana cijena sa istim doplatama; `diff` njihova razlika. `live` je isti par sa STVARNIM
// doplatama (traka nesačuvanog), a `ladder` tabela po udaljenosti (stvarne doplate, nacrt prema sačuvanom).
export type PricingCalc = {
  draft: PriceBreakdown;
  saved: PriceBreakdown;
  diff: { changed: boolean; before: number; after: number; delta: number; up: boolean };
  live: { before: PriceBreakdown; after: PriceBreakdown };
  ladder: LadderRow[];
};

// Preporučena vozila za primjer. `index`: mjesto pravila u listi (od 0), -1 je zadano pravilo "Sve ostalo",
// null kad se pravilo sa servera ne nalazi u učitanoj listi.
export type RecommendedView = {
  source: "server" | "local";
  vehicles: string[];
  rule: VehicleRule | null;
  ruleId: number | null;
  index: number | null;
  title: string;
  note: string | null;
};

// Klijentski i serverski obračun za isti primjer se ne poklapaju (provjera B5).
export type PriceMismatch = { client: number; server: number; distKm: number };

// Koliko se čeka serverska preporuka poslije promjene primjera: isto kao DEBOUNCE_MS u
// useVehicleRecommendation (300 ms), s malo tolerancije. Odgovor koji stigne ranije je za prethodni ulaz.
const SERVER_DEBOUNCE_MS = 300;
const SERVER_TOLERANCE_MS = 5;

const UNDO_MS = 6000;

const gone = (what: string): ActionResult => ({
  ok: false,
  message: `${what} više ne postoji. Osvježi listu.`,
  fields: {},
});

export const usePricingWorkspace = () => {
  const alertStore = useAlertStore();

  const companiesStore = useDeliveryCompaniesStore();
  const { selectedCompanyId, selectedCompany, errorMessage: companiesError } = storeToRefs(companiesStore);
  void companiesStore.ensureLoaded();
  const companyId = computed(() => selectedCompanyId.value);

  const pricingApi = useDeliveryPricing(companyId);
  // Valuta firme: iz cijene (isti pojam kao finance-settings, vidi B9), dok se ne učita sa liste firmi.
  const currency = computed(() =>
    resolveCurrency(pricingApi.pricing.value?.currency || selectedCompany.value?.currency)
  );
  const priceDraft = usePricingDraft(pricingApi.pricing, currency);

  const surchargesApi = useSurcharges(companyId, { currency });

  // Zone su vezane za grad firme (bez grada se učitavaju sve). Trebaju primjeru na svim tabovima, pa se
  // učitavaju odmah; pad se pokazuje uz primjer ("Pokušaj ponovo"), ne kao zajednička obavijest.
  const zonesApi = useDispatcherZones();
  watch(
    () => (companyId.value == null ? undefined : (selectedCompany.value?.cityId ?? null)),
    (cityId) => {
      if (cityId !== undefined) void zonesApi.load(cityId, { silent: true });
    },
    { immediate: true }
  );
  // Nazivi zona latinicom: isti tekst ide u naslov pravila i u condition_text koji se šalje serveru.
  const zoneList = computed<ZoneLike[]>(() =>
    zonesApi.zones.value.map((z) => ({ id: z.id, name: toLatin(z.name), terrainFactor: z.terrainFactor }))
  );
  const lookup = computed<RuleTitleLookup>(() => ({
    zones: zoneList.value,
    surcharges: surchargesApi.surcharges.value,
  }));

  const rulesApi = useVehicleRules(companyId, { lookup });

  const sim = usePricingSimulator(surchargesApi.surcharges);

  const view = usePricingView();

  // --- Serverska preporuka (za SAČUVANO stanje) -------------------------------------------------------
  // Traži se samo kad nema nacrta ni "šta ako": inače odgovor ne bi bio za ono što primjer pokazuje.
  const recGate = computed(
    () => companyId.value != null && !priceDraft.dirty.value && !sim.hasOver.value
  );
  const recApi = useVehicleRecommendation(companyId, {
    enabled: recGate,
    zoneId: sim.zoneId,
    distanceKm: sim.dist,
  });

  // Izmjena u toku (snimanje cijene, doplate, pravila, prekidač, pomjeranje, brisanje). Dok traje, serverski
  // odgovor ne važi; kad se završi, traži se novi.
  const mutating = ref(0);
  const track = async <T>(fn: () => Promise<T>): Promise<T> => {
    mutating.value += 1;
    try {
      return await fn();
    } finally {
      mutating.value -= 1;
    }
  };
  const busy = computed(
    () =>
      mutating.value > 0 ||
      pricingApi.savingPricing.value ||
      surchargesApi.savingSurcharge.value ||
      surchargesApi.togglingIds.value.size > 0 ||
      rulesApi.savingRule.value ||
      rulesApi.reordering.value
  );

  // Je li zadnji serverski odgovor za ISTI ulaz kao primjer sada. Hook ne kaže za šta je odgovor, pa se
  // procjenjuje po vremenu: svaki novi ulaz (firma, zona, udaljenost, nacrt, izmjena) pokreće traženje tek
  // poslije SERVER_DEBOUNCE_MS, pa je odgovor koji stigne ranije od toga za prethodni ulaz. Odgovor poslije
  // izmjene dolazi iz reload() koji ide odmah, pa se tada vrijeme ne čeka.
  let lastChange = 0;
  const serverFresh = ref(false);
  const markChange = (immediate: boolean) => {
    lastChange = immediate ? Number.NEGATIVE_INFINITY : Date.now();
    serverFresh.value = false;
  };
  watch([companyId, sim.zoneId, sim.dist, recGate], () => markChange(false), { flush: "sync" });
  watch(
    busy,
    (on) => {
      markChange(!on);
      if (!on) void recApi.reload();
    },
    { flush: "sync" }
  );
  watch(
    recApi.recommendation,
    (rec) => {
      serverFresh.value =
        rec !== null && Date.now() - lastChange >= SERVER_DEBOUNCE_MS - SERVER_TOLERANCE_MS;
    },
    { flush: "sync" }
  );

  // --- Izvedeni podaci --------------------------------------------------------------------------------

  const company = computed(() => selectedCompany.value);

  const header = computed(() => {
    const name = toLatin(selectedCompany.value?.name);
    return {
      title: "Cjenovnik",
      subtitle: name ? `${name} · valuta ${currency.value}` : "",
    };
  });

  const counts = {
    activeSurcharges: computed(() => surchargesApi.activeSurcharges.value.length),
    surcharges: computed(() => surchargesApi.surcharges.value.length),
    rules: computed(() => rulesApi.vehicleRules.value.length),
  };

  // Stanje podataka: broj uz tab se ne pokazuje dok se lista nije učitala (nula bi lagala).
  const surchargesLoaded = computed(
    () => !surchargesApi.loadingSurcharges.value && !surchargesApi.loadFailed.value
  );
  const rulesLoaded = computed(
    () => !rulesApi.loadingVehicleRules.value && !rulesApi.loadFailed.value
  );

  // Editori doplate i pravila prijavljuju svoju nesačuvanu izmjenu (fn čita reaktivno stanje editora);
  // nacrt cijene je u radnom prostoru.
  const editors = shallowReactive(new Map<PricingEditorSource, () => boolean>());
  const registerEditorDirty = (source: PricingEditorSource, fn: () => boolean): (() => void) => {
    editors.set(source, fn);
    return () => {
      if (editors.get(source) === fn) editors.delete(source);
    };
  };
  const editorDirty = (source: PricingEditorSource): boolean => editors.get(source)?.() ?? false;

  const dirtyTabs = computed<Record<PricingTab, boolean>>(() => ({
    price: priceDraft.dirty.value,
    surcharges: editorDirty("surcharge"),
    rules: editorDirty("rule"),
  }));
  const anyDirty = computed(
    () => dirtyTabs.value.price || dirtyTabs.value.surcharges || dirtyTabs.value.rules
  );
  // Za stranicu: zaštita pri promjeni firme i odlasku (registerCompanyChangeGuard, interceptLeaving).
  const isAnyDirty = (): boolean =>
    priceDraft.dirty.value || editorDirty("surcharge") || editorDirty("rule");

  const tabs = computed<PricingTabItem[]>(() => {
    const surcharges: PricingTabItem = { value: "surcharges", label: "Doplate" };
    if (surchargesLoaded.value) surcharges.badge = counts.activeSurcharges.value;
    if (dirtyTabs.value.surcharges) surcharges.dot = true;
    const rules: PricingTabItem = { value: "rules", label: "Vozila" };
    if (rulesLoaded.value) rules.badge = counts.rules.value;
    if (dirtyTabs.value.rules) rules.dot = true;
    const price: PricingTabItem = { value: "price", label: "Cijena" };
    if (dirtyTabs.value.price) price.dot = true;
    return [price, surcharges, rules];
  });

  // Oznaka u zaglavlju: nema je dok se cijena ne učita (kao u prototipu, samo kad je ekran u redu).
  // "Čuvam…" samo dok traje snimanje forme; prekidač i pomjeranje su trenutne radnje i ne trepere oznakom.
  const saveState = computed<PricingSaveState | null>(() => {
    if (!pricingApi.pricing.value) return null;
    if (pricingApi.savingPricing.value || surchargesApi.savingSurcharge.value || rulesApi.savingRule.value) {
      return "saving";
    }
    return anyDirty.value ? "unsaved" : "saved";
  });

  // Obračun za primjer: tek kad su učitane cijena i doplate (bez doplata bi ukupno lagalo).
  const calc = computed<PricingCalc | null>(() => {
    const saved = pricingApi.pricing.value;
    if (!saved || !surchargesLoaded.value) return null;
    const list = surchargesApi.surcharges.value;
    const was = priceDraft.savedNumbers.value;
    const now = priceDraft.numbers.value;
    const dist = sim.dist.value;
    const simActive = sim.active.value;
    const liveActive = activeOf(list);
    const draft = calcPrice(dist, now, list, simActive);
    const savedCalc = calcPrice(dist, was, list, simActive);
    const delta = round2(draft.total - savedCalc.total);
    return {
      draft,
      saved: savedCalc,
      diff: {
        changed: round2(draft.total) !== round2(savedCalc.total),
        before: savedCalc.total,
        after: draft.total,
        delta,
        up: delta > 0,
      },
      live: {
        before: calcPrice(dist, was, list, liveActive),
        after: calcPrice(dist, now, list, liveActive),
      },
      ladder: ladderRows(sampleDistances, was, now, list, liveActive, dist),
    };
  });

  const serverAuthoritative = computed(
    () => serverFresh.value && recApi.recommendation.value !== null && recGate.value
  );

  // Preporučena vozila. Dok nema nacrta ni "šta ako" i server je odgovorio za isti primjer, mjerodavan je
  // server (PRETPOSTAVKA B1: klijent bira isto, ali nije potvrđeno); inače se računa nad lokalnim stanjem.
  const recommended = computed<RecommendedView | null>(() => {
    const server = serverAuthoritative.value ? recApi.recommendation.value : null;
    if (server) {
      const matchedId = server.matchedRule?.id ?? null;
      const rule = matchedId === null ? null : rulesApi.ruleById(matchedId);
      const vehicles =
        server.recommendedVehicles.length > 0
          ? [...server.recommendedVehicles]
          : rule
            ? ruleVehicles(rule)
            : [];
      if (vehicles.length === 0 && matchedId === null) return null;
      const { list, fallback } = rulesApi.ordered.value;
      const index = !rule
        ? null
        : fallback?.id === rule.id
          ? -1
          : (() => {
              const at = list.findIndex((r) => r.id === rule.id);
              return at < 0 ? null : at;
            })();
      return {
        source: "server",
        vehicles,
        rule,
        ruleId: matchedId,
        index,
        title: rule ? rulesApi.titleOf(rule) : (server.matchedRule?.conditionText ?? ""),
        note: rule ? rule.note : (server.matchedRule?.note ?? null),
      };
    }
    const hit = rulesApi.recommend({
      zoneId: sim.zoneId.value,
      distKm: sim.dist.value,
      active: sim.active.value,
    });
    if (!hit) return null;
    return {
      source: "local",
      vehicles: ruleVehicles(hit.rule),
      rule: hit.rule,
      ruleId: hit.rule.id,
      index: hit.index,
      title: rulesApi.titleOf(hit.rule),
      note: hit.rule.note,
    };
  });

  // Provjera B5: sačuvana cijena i stvarne doplate, klijentski obračun naspram serverskog `price` za isti
  // primjer. Samo kad nema nacrta ni "šta ako", kad je odgovor za ISTU udaljenost i kad su podaci učitani.
  const priceMismatch = computed<PriceMismatch | null>(() => {
    if (!serverAuthoritative.value || sim.hasOver.value || priceDraft.dirty.value) return null;
    const mine = calc.value;
    const price = recApi.recommendation.value?.price;
    if (!mine || !price) return null;
    const distKm = toAmount(price.distance_km);
    const server = toAmount(price.total);
    if (distKm === null || server === null || Math.abs(distKm - sim.dist.value) > 0.001) return null;
    const client = mine.saved.total;
    return Math.abs(client - server) > 0.005 ? { client, server, distKm } : null;
  });

  // --- Pitanje pri napuštanju nesačuvanog ---------------------------------------------------------------
  // Isto kao na Firmi: promjena taba ili firme sa nesačuvanim unosom pita "Imaš nesačuvane izmjene".
  // stop(go) vraća true kad je radnja zaustavljena (pitanje je pokazano) i NE izvršava go kad nema izmjena,
  // pa odgovara registerCompanyChangeGuard; run(go) izvršava go ako nema izmjena. "Odbaci izmjene" vraća
  // nacrt cijene na sačuvano i izvršava zaustavljenu radnju; editori se ugase sa tabom ili firmom.
  const asking = ref(false);
  let pending: (() => void) | null = null;

  const stop = (go: () => void): boolean => {
    if (!isAnyDirty()) return false;
    pending = go;
    asking.value = true;
    return true;
  };
  const run = (go: () => void) => {
    if (!stop(go)) go();
  };
  const keep = () => {
    asking.value = false;
    pending = null;
  };
  const discard = () => {
    asking.value = false;
    priceDraft.reset();
    // Editori se gase zajedno sa radnjom (tab, firma); da je ne zaustave ponovo, odjavljuju se odmah.
    editors.clear();
    const go = pending;
    pending = null;
    go?.();
  };

  // Druga firma: primjer kreće iznova, pitanje se zatvara. Editori se gase jer su vezani za firmu.
  watch(companyId, () => {
    sim.reset();
    asking.value = false;
    pending = null;
  });

  // Zona koje više nema (druga lista zona) ne smije ostati izabrana u primjeru.
  watch(zoneList, (list) => {
    const id = sim.zoneId.value;
    if (id !== null && !list.some((z) => z.id === id)) sim.zoneId.value = null;
  });

  // --- Radnje -----------------------------------------------------------------------------------------

  // Server je zaokružio ili promijenio iznos koji je primio (granice i zaokruživanje: B5).
  const serverChangedAmount = (body: { base_price: number; price_per_km: number }, now: Pricing | null) => {
    if (!now) return null;
    const base = toAmount(now.base_price);
    const km = toAmount(now.price_per_km);
    if (base === null || km === null) return null;
    if (round2(base) === body.base_price && round2(km) === body.price_per_km) return null;
    return `Cijena je sačuvana, ali je server promijenio iznos: startna ${formatNum2(base)}, po kilometru ${formatNum2(km)}.`;
  };

  // Čuva nacrt cijene (BROJEVI, ne tekst). Neispravan nacrt ne ide serveru: greške postaju vidljive uz
  // polja i vraća se prazna poruka. Greška servera se upisuje u nacrt (polja, poruka) i vraća ekranu.
  const savePrice = async (): Promise<ActionResult> => {
    const saved = pricingApi.pricing.value;
    if (!saved) return { ok: false, message: "Cijena nije učitana.", fields: {} };
    if (!priceDraft.submit()) return { ok: false, message: "", fields: {} };
    return track(async () => {
      const body = toPricingBody(priceDraft.draft, saved.currency);
      const result = await pricingApi.savePrice(body);
      if (!result.ok) {
        if (result.message || Object.keys(result.fields).length > 0) priceDraft.setServerFailure(result);
        return result;
      }
      priceDraft.setSaved();
      const warning = serverChangedAmount(body, pricingApi.pricing.value);
      if (warning) {
        alertStore.warning(warning);
        return { ok: true, warning } as const;
      }
      alertStore.success("Cijena je sačuvana. Važi za nove narudžbe.");
      return result;
    });
  };

  // "Poništi" nacrt cijene: nazad na sačuvano.
  const discardPrice = () => priceDraft.reset();

  const toggleText = (name: string, next: boolean): string => {
    const head = `„${name}“ je ${next ? "uključena" : "isključena"}.`;
    const cfg: PriceConfig | null = pricingApi.pricing.value ? priceDraft.savedNumbers.value : null;
    if (!cfg) return head;
    const total = calcPrice(sim.dist.value, cfg, surchargesApi.surcharges.value, activeOf(surchargesApi.surcharges.value)).total;
    return `${head} Za ${formatKm(sim.dist.value)} km kupac plaća ${formatMoney(total, currency.value)}.`;
  };

  const undoToggle = async (id: number, was: boolean) => {
    const result = await track(() => surchargesApi.setActive(id, was));
    if (!result.ok && result.message) alertStore.error(result.message);
    else view.flash(`s${id}`);
  };

  // Prekidač doplate važi odmah (optimistično). Uspjeh: obavijest sa ukupnom cijenom za primjer i "Poništi" 6 s.
  // Pad: prekidač je vraćen, poruka stiže u rezultatu (ekran je piše uz red). Ako server odgovori suprotnim
  // stanjem (B3), rezultat je ok sa `warning`, a obavijest je upozorenje bez "Poništi".
  const toggleSurcharge = async (id: number): Promise<ActionResult> => {
    const s = surchargesApi.surcharges.value.find((x) => x.id === id);
    if (!s) return gone("Doplata");
    const was = s.active;
    const name = s.name;
    const result = await track(() => surchargesApi.setActive(id, !was));
    if (!result.ok) return result;
    view.flash(`s${id}`);
    if (result.warning) {
      alertStore.warning(result.warning);
      return result;
    }
    alertStore.success(toggleText(name, !was), UNDO_MS, { label: "Poništi", run: () => void undoToggle(id, was) });
    return result;
  };

  // Čuva doplatu iz nacrta: `id` null je nova doplata (isključena dok je dispečer ne uključi, D2).
  const saveSurcharge = async (id: number | null, draft: SurchargeDraft): Promise<ActionResult> => {
    const name = draft.name.trim();
    const result = await track(() =>
      id === null ? surchargesApi.createFromDraft(draft) : surchargesApi.updateFromDraft(id, draft)
    );
    if (!result.ok) return result;
    const key = id ?? result.id;
    if (key !== undefined) view.flash(`s${key}`);
    if (result.warning) {
      alertStore.warning(result.warning);
    } else if (id === null) {
      alertStore.success(
        `Doplata „${name}“ je dodata${draft.on ? " i važi odmah." : ". Isključena je dok je ne uključiš."}`
      );
    } else {
      alertStore.success("Doplata je sačuvana.");
    }
    return result;
  };

  // Briše doplatu: prvo pravila koja je koriste (po jedno, redom primjene), pa doplatu (B4/D7: ponašanje
  // servera nije potvrđeno, pa se ne oslanja na kaskadu). Bez učitanih pravila se ne briše, jer se ne zna
  // koja je koriste. Pad usred posla vraća poruku sa onim što je već obrisano; ponovni pokušaj nastavlja.
  const removeSurchargeCascade = async (id: number): Promise<ActionResult> => {
    const s = surchargesApi.surcharges.value.find((x) => x.id === id);
    if (!s) return gone("Doplata");
    if (rulesApi.loadFailed.value || (rulesApi.loadingVehicleRules.value && rulesApi.vehicleRules.value.length === 0)) {
      return {
        ok: false,
        message: "Pravila za vozila nisu učitana, pa se ne zna koja koriste ovu doplatu. Učitaj ih ponovo i pokušaj.",
        fields: {},
      };
    }
    const name = s.name;
    return track(async () => {
      const using = rulesApi.usingSurcharge(id);
      let removed = 0;
      for (const rule of using) {
        const result = await rulesApi.removeOnly(rule.id);
        if (!result.ok) {
          const done = removed > 0 ? ` Već je obrisano ${removed} od ${using.length} pravila.` : "";
          return { ok: false, message: `${result.message} Doplata nije obrisana.${done}`, fields: {} };
        }
        removed += 1;
      }
      const result = await surchargesApi.removeOnly(id);
      if (!result.ok) {
        const done = removed > 0 ? ` Pravila koja je koristila (${removed}) su već obrisana.` : "";
        return { ok: false, message: `${result.message}${done}`, fields: {} };
      }
      const tail =
        removed === 0 ? "." : ` zajedno sa ${removed} ${removed === 1 ? "pravilom" : "pravila"}.`;
      alertStore.success(`Doplata „${name}“ je obrisana${tail}`);
      return { ok: true };
    });
  };

  // Čuva pravilo iz nacrta: `id` null je novo pravilo (ide iza ostalih, a ispred "Sve ostalo").
  const saveRule = async (id: number | null, draft: RuleDraft): Promise<ActionResult> => {
    const hadFallback = rulesApi.hasFallback.value;
    const result = await track(() =>
      id === null ? rulesApi.createFromDraft(draft) : rulesApi.updateFromDraft(id, draft)
    );
    if (!result.ok) return result;
    const key = id ?? result.id;
    if (key !== undefined) view.flash(`r${key}`);
    if (result.warning) {
      alertStore.warning(result.warning);
    } else if (id !== null) {
      alertStore.success("Pravilo je sačuvano.");
    } else if (draft.type === "default") {
      alertStore.success("Zadano pravilo je dodato.");
    } else {
      alertStore.success(hadFallback ? "Pravilo je dodato iznad „Sve ostalo“." : "Pravilo je dodato.");
    }
    return result;
  };

  // Zadano pravilo ("Sve ostalo") se ne briše, samo mijenja; ranije zadano pravilo koje je API ostavio u listi
  // (više njih sa condition_type default) se briše kao i svako drugo.
  const removeRule = async (id: number): Promise<ActionResult> => {
    if (rulesApi.ordered.value.fallback?.id === id) {
      return { ok: false, message: "Zadano pravilo se ne briše. Izmijeni ga umjesto toga.", fields: {} };
    }
    const result = await track(() => rulesApi.removeOnly(id));
    if (result.ok) alertStore.success("Pravilo je obrisano.");
    return result;
  };

  const undoMove = async (id: number, undo: () => Promise<ActionResult>) => {
    const result = await track(undo);
    if (!result.ok && result.message) alertStore.error(result.message);
    else view.flash(`r${id}`);
  };

  // Pomjera pravilo za jedno mjesto (-1 gore, 1 dolje). Uspjeh: obavijest "Pravilo je pomjereno." sa
  // "Poništi" 6 s (poništavanje radi samo dok se redoslijed nije mijenjao). Pad se vraća u rezultatu.
  const moveRule = async (id: number, dir: -1 | 1): Promise<ActionResult> => {
    const result = await track(() => rulesApi.move(id, dir));
    if (!result.ok) return result;
    view.flash(`r${id}`);
    const undo = result.undo;
    if (undo) {
      alertStore.success("Pravilo je pomjereno.", UNDO_MS, { label: "Poništi", run: () => void undoMove(id, undo) });
    } else {
      alertStore.success("Pravilo je pomjereno.");
    }
    return { ok: true };
  };

  // "Pokušaj ponovo": ponovo učitava samo ono što je palo.
  const reloadAll = async (): Promise<void> => {
    const jobs: Promise<unknown>[] = [];
    if (pricingApi.loadFailed.value) jobs.push(pricingApi.reload());
    if (surchargesApi.loadFailed.value) jobs.push(surchargesApi.reload());
    if (rulesApi.loadFailed.value) jobs.push(rulesApi.reload());
    if (zonesApi.loadFailed.value) jobs.push(zonesApi.reload());
    if (recApi.loadFailed.value) jobs.push(recApi.reload());
    await Promise.all(jobs);
  };

  // Reaktivan objekat: refovi su razmotani (ws.price.loading je boolean, ne Ref), pa predložak i skripta ne
  // pišu .value. Listove ne razlagati (const { loading } = ws.price gubi reaktivnost): koristiti ws.price.loading ili toRef.
  return reactive({
    company: {
      id: companyId,
      current: company,
      currency,
      error: companiesError,
      select: (id: number) => {
        selectedCompanyId.value = id;
      },
    },
    header,
    saveState,
    tabs,
    counts,
    view,
    // Nacrt cijene je spojen sa sačuvanim stanjem: price.draft.base / price.draft.km su tekst polja,
    // a edit, blur, step, shownErrors, dirty, sanity, numbers... su iz usePricingDraft.
    price: {
      ...priceDraft,
      saved: pricingApi.pricing,
      loading: pricingApi.loadingPricing,
      saving: pricingApi.savingPricing,
      loadFailed: pricingApi.loadFailed,
      loadReason: pricingApi.loadReason,
      reload: pricingApi.reload,
    },
    surcharges: {
      list: surchargesApi.surcharges,
      loading: surchargesApi.loadingSurcharges,
      loadFailed: surchargesApi.loadFailed,
      loadReason: surchargesApi.loadReason,
      reload: surchargesApi.reload,
      saving: surchargesApi.savingSurcharge,
      togglingIds: surchargesApi.togglingIds,
      catalog: surchargesApi.catalog,
    },
    rules: {
      list: rulesApi.vehicleRules,
      ordered: rulesApi.ordered,
      hasFallback: rulesApi.hasFallback,
      loading: rulesApi.loadingVehicleRules,
      loadFailed: rulesApi.loadFailed,
      loadReason: rulesApi.loadReason,
      reload: rulesApi.reload,
      saving: rulesApi.savingRule,
      reordering: rulesApi.reordering,
      makeDraft: rulesApi.makeDraft,
      titleOf: rulesApi.titleOf,
      duplicateOf: rulesApi.duplicateOf,
      usingSurcharge: rulesApi.usingSurcharge,
      canMove: rulesApi.canMove,
      ruleById: rulesApi.ruleById,
    },
    zones: {
      list: zoneList,
      loading: zonesApi.loading,
      loadFailed: zonesApi.loadFailed,
      loadReason: zonesApi.loadReason,
      reload: zonesApi.reload,
    },
    sim,
    server: {
      fresh: serverAuthoritative,
      loading: recApi.loading,
      loadFailed: recApi.loadFailed,
      loadReason: recApi.loadReason,
      reload: recApi.reload,
    },
    calc,
    recommended,
    priceMismatch,
    dirty: {
      tabs: dirtyTabs,
      any: anyDirty,
      isAnyDirty,
      registerEditorDirty,
    },
    leave: { asking, stop, run, keep, discard },
    actions: {
      savePrice,
      discardPrice,
      toggleSurcharge,
      saveSurcharge,
      removeSurchargeCascade,
      saveRule,
      removeRule,
      moveRule,
      reloadAll,
    },
  });
};

export type PricingWorkspace = ReturnType<typeof usePricingWorkspace>;
