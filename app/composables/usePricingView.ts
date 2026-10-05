import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "nuxt/app";

export type PricingTab = "price" | "surcharges" | "rules";

// Računarski raspored (rad | Primjer narudžbe 372 px, razmak 20 px) traži radnu kolonu od najmanje 480 px.
// Izmjereno u pravom Chrome-u na stranici /dispatcher/pricing (bez klasične trake za skrol); radna kolona u px:
//   prozor   912  960  1000  1100  1144 | 1145  1180  1199  1200  1216  1279  1366  1440
//   kolona   480  528  544   644   688  | 425   460   479   480   496   559   646   720
//   traka    privremena (v-navigation-drawer temporary)          | stalna (264 px)
// Bočna traka postaje stalna na Vuetify `lg` = 1145 px (Vuetify 4; ne 1280), pa je kolona najuža odmah poslije
// toga i upit nije jedan prag: širok je u rasponu 960 do 1144 px (privremena traka) i od 1216 px. Klasična traka za
// skrol (15 px) oduzima od sadržaja, pa se pragovi podižu sa 912 na 960 i sa 1200 na 1216 (kolona tada ima
// najmanje 481 px). Izvan toga je jedna kolona, a Primjer je traka na dnu koja otvara donji list. 1144,98 umjesto
// 1144 da nema pukotine za prozore sa razlomljenom širinom.
export const PRICING_WIDE_QUERY = "(min-width: 960px) and (max-width: 1144.98px), (min-width: 1216px)";

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
