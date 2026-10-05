import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "nuxt/app";

export type PricingTab = "price" | "surcharges" | "rules";

// Računarski raspored (rad | Primjer narudžbe) počinje na prvom prozoru gdje radna kolona, a to je
// širina minus bočna traka (264), ivice (64), Primjer (372) i razmak (20), ima najmanje 480 px.
// Taj račun daje 1200; 1180 je polazna vrijednost koju integracija mjeri i podešava. Bočna traka je stalna
// tek od 1280 (lgAndUp), pa ispod toga stvarna granica može biti niža. Ispod granice je jedna kolona,
// a Primjer je traka na dnu koja otvara donji list.
export const PRICING_WIDE_QUERY = "(min-width: 1180px)";

// Naziv taba u adresi (?t=). Cijena je zadani tab pa nema parametra.
const TAB_QUERY: Record<PricingTab, string | null> = {
  price: null,
  surcharges: "doplate",
  rules: "vozila",
};

const queryValue = (raw: unknown): string | null => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value ? value : null;
};

const tabFromQuery = (raw: unknown): PricingTab => {
  const value = queryValue(raw);
  return value === TAB_QUERY.surcharges ? "surcharges" : value === TAB_QUERY.rules ? "rules" : "price";
};

// Koliko dugo red ostaje istaknut poslije izmjene (uključivanje, pomjeranje, snimanje).
const FLASH_MS = 1700;

// Pogled na stranicu Cjenovnik: tab u adresi (?t=doplate, ?t=vozila), širina i kratko isticanje reda.
// Tab je u adresi da povratak sa druge stranice vrati isti tab, a dugme Nazad ne vodi kroz tabove
// (promjena taba je replace, kao na Firmi).
export const usePricingView = () => {
  const route = useRoute();
  const router = useRouter();

  const tab = computed<PricingTab>(() => tabFromQuery(route.query.t));

  const setTab = (next: PricingTab) => {
    const query: Record<string, unknown> = { ...route.query };
    const value = TAB_QUERY[next];
    if (value === null) delete query.t;
    else query.t = value;
    void router.replace({ query: query as Record<string, string | string[]> });
  };

  // Računar je zadano stanje (dispečeri rade uglavnom na računaru), pa se prije mjerenja pretpostavlja široko.
  const wide = ref(true);
  let mq: MediaQueryList | null = null;
  const sync = () => {
    wide.value = mq?.matches ?? true;
  };
  onMounted(() => {
    mq = window.matchMedia(PRICING_WIDE_QUERY);
    sync();
    mq.addEventListener("change", sync);
  });
  onBeforeUnmount(() => mq?.removeEventListener("change", sync));

  // Telefon: donji list sa Primjerom narudžbe. Na računaru primjer stoji uz sadržaj, pa list nema smisla.
  const simOpen = ref(false);
  watch(wide, (isWide) => {
    if (isWide) simOpen.value = false;
  });

  // Ključ istaknutog reda: "s<id>" za doplatu, "r<id>" za pravilo. Red ga čita da bi kratko pozelenio.
  const flashKey = ref<string | null>(null);
  let flashTimer: ReturnType<typeof setTimeout> | null = null;
  const flash = (key: string) => {
    flashKey.value = key;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      flashKey.value = null;
    }, FLASH_MS);
  };
  onBeforeUnmount(() => {
    if (flashTimer) clearTimeout(flashTimer);
  });

  // "Otvori pravilo" iz Primjera: tab Vozila i istaknuto pravilo (skrol do reda radi komponenta).
  const openRule = (id: number) => {
    simOpen.value = false;
    setTab("rules");
    flash(`r${id}`);
  };

  return { tab, setTab, wide, simOpen, flashKey, flash, openRule };
};

export type PricingViewApi = ReturnType<typeof usePricingView>;
