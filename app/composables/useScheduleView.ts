import { computed } from "vue";
import { useRoute, useRouter } from "nuxt/app";
import { FILTERS, addDays, iso, mondayOf, parseIso, weekIsos, type ShiftFilter } from "~/utils/schedule";

export type ScheduleTabKey = "schedule" | "now" | "zones" | "rules";

const TAB_QUERY: Record<ScheduleTabKey, string | null> = {
  schedule: null,
  now: "sada",
  zones: "zone",
  rules: "pravila",
};

const queryString = (raw: unknown): string | null => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value ? value : null;
};

const validIso = (s: string | null): string | null => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = parseIso(s);
  return Number.isNaN(d.getTime()) || iso(d) !== s ? null : s;
};

// Pogled stranice "Raspored i zone" u adresi: tab (?t), sedmica (?w, ponedjeljak), filter zone (?z),
// filter statusa (?f) i dan na telefonu (?d). Sve se upisuje sa replace (istorija pregledača ostaje
// čista), a veza se može poslati dalje. Prazna vrijednost = zadano i ne piše se u adresu.
export const useScheduleView = (todayIso: () => string) => {
  const route = useRoute();
  const router = useRouter();

  const tab = computed<ScheduleTabKey>(() => {
    const t = queryString(route.query.t);
    const found = (Object.keys(TAB_QUERY) as ScheduleTabKey[]).find((k) => TAB_QUERY[k] === t);
    return found ?? "schedule";
  });

  const currentMonday = computed(() => iso(mondayOf(parseIso(todayIso()))));
  // Ponedjeljak prikazane sedmice (bilo koji datum u ?w se svodi na ponedjeljak te sedmice).
  const weekMon = computed(() => {
    const w = validIso(queryString(route.query.w));
    return w ? iso(mondayOf(parseIso(w))) : currentMonday.value;
  });
  const isCurrentWeek = computed(() => weekMon.value === currentMonday.value);
  const dates = computed(() => weekIsos(parseIso(weekMon.value)));

  const zoneId = computed<number | null>(() => {
    const n = Number(queryString(route.query.z));
    return Number.isInteger(n) && n > 0 ? n : null;
  });
  const filter = computed<ShiftFilter>(() => {
    const f = queryString(route.query.f);
    return FILTERS.includes(f as ShiftFilter) ? (f as ShiftFilter) : "all";
  });
  // Dan na telefonu: iz adrese ako je u prikazanoj sedmici, inače danas (ako je u njoj) ili ponedjeljak.
  const day = computed(() => {
    const d = validIso(queryString(route.query.d));
    if (d && dates.value.includes(d)) return d;
    return dates.value.includes(todayIso()) ? todayIso() : (dates.value[0] ?? weekMon.value);
  });

  const setQuery = (patch: Record<string, string | null>) => {
    const next: Record<string, unknown> = { ...route.query };
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") delete next[key];
      else next[key] = value;
    }
    void router.replace({ query: next as Record<string, string | string[]> });
  };

  const setTab = (t: ScheduleTabKey) => setQuery({ t: TAB_QUERY[t] });
  // Sedmica: null = ova sedmica. Promjena sedmice briše izabrani dan (telefon bira zadani).
  const setWeek = (mondayIso: string | null) =>
    setQuery({ w: mondayIso && mondayIso !== currentMonday.value ? mondayIso : null, d: null });
  const shiftWeek = (delta: number) => setWeek(iso(addDays(parseIso(weekMon.value), delta * 7)));
  const setZone = (id: number | null) => setQuery({ z: id ? String(id) : null });
  const setFilter = (f: ShiftFilter) => setQuery({ f: f === "all" ? null : f });
  const setDay = (d: string) => setQuery({ d: d === (dates.value.includes(todayIso()) ? todayIso() : dates.value[0]) ? null : d });
  // Skok na smjenu (npr. "Sljedeći problem"): sedmica i dan odjednom.
  const goTo = (dateIso: string, withDay = true) => {
    const mon = iso(mondayOf(parseIso(dateIso)));
    setQuery({ w: mon !== currentMonday.value ? mon : null, d: withDay ? dateIso : null });
  };

  return { tab, weekMon, isCurrentWeek, currentMonday, dates, zoneId, filter, day, setTab, setWeek, shiftWeek, setZone, setFilter, setDay, goTo };
};

export type ScheduleView = ReturnType<typeof useScheduleView>;
