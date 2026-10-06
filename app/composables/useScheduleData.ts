import { computed, onMounted, watch, type ComputedRef } from "vue";
import { useShiftTemplates } from "~/composables/useShiftTemplates";
import { addDays, fromTemplate, iso, parseIso, type Clock, type SchedShift } from "~/utils/schedule";

type Range = { from: string; to: string };

const covers = (range: Range | null, a: string, b: string): boolean => !!range && range.from <= a && b <= range.to;

// Prozor smjena: ponedjeljak prethodne sedmice do nedjelje treće naredne (5 sedmica, 35 dana), jedan poziv.
// "Sljedeći problem", brojevi na danu i procjena provjere dostupnosti se računaju iz njega. Pregled druge
// sedmice u prozoru ne zove server; izlazak iz prozora i povratak poslije greške zovu ga iznova.
export const windowFor = (mondayIso: string): Range => {
  const mon = parseIso(mondayIso);
  return { from: iso(addDays(mon, -7)), to: iso(addDays(mon, 27)) };
};

// Podaci rasporeda za jednu firmu: prozor smjena oko prikazane sedmice + (samo ako prozor ne obuhvata
// danas) posebno današnje smjene za "Sada" i "Pravila". Stanje je "loading" dok prikazana sedmica nije
// u učitanom prozoru, a "error" poslije pada: prazna mreža bi izgledala kao sedmica bez smjena.
export const useScheduleData = (
  companyId: ComputedRef<number | null>,
  weekMon: ComputedRef<string>,
  clock: ComputedRef<Clock>
) => {
  const main = useShiftTemplates(companyId);
  const home = useShiftTemplates(companyId);

  const weekEnd = computed(() => iso(addDays(parseIso(weekMon.value), 6)));
  const covered = computed(() => covers(main.loadedRange.value, weekMon.value, weekEnd.value));

  const shifts = computed<SchedShift[]>(() => main.templates.value.map(fromTemplate));
  const state = computed<"loading" | "error" | "ok">(() =>
    main.loadFailed.value ? "error" : covered.value ? "ok" : "loading"
  );

  // --- današnje smjene (za Sada i Pravila) ---
  const today = computed(() => clock.value.date);
  const todayInMain = computed(() => covers(main.loadedRange.value, today.value, today.value));
  const todayInHome = computed(() => covers(home.loadedRange.value, today.value, today.value));
  const todayShifts = computed<SchedShift[]>(() => {
    const source = todayInMain.value ? main.templates.value : todayInHome.value ? home.templates.value : [];
    return source.map(fromTemplate).filter((s) => s.date === today.value);
  });
  const todayState = computed<"loading" | "error" | "ok">(() => {
    if (todayInMain.value || todayInHome.value) return "ok";
    return main.loadFailed.value || home.loadFailed.value ? "error" : "loading";
  });

  let mounted = false;
  let wanted = "";
  let homeWanted = "";

  const request = (force = false) => {
    if (!mounted || !companyId.value) return;
    const w = windowFor(weekMon.value);
    const key = `${companyId.value}|${w.from}|${w.to}`;
    if (!force && key === wanted && !main.loadFailed.value) return;
    wanted = key;
    void main.load(w.from, w.to, { silent: true });
  };

  // Današnje smjene van prozora: poseban poziv (jedan dan), samo kad prozor već stigne i ne obuhvata danas.
  const requestHome = () => {
    if (!mounted || !companyId.value || !main.loadedRange.value || todayInMain.value) return;
    const key = `${companyId.value}|${today.value}`;
    if (key === homeWanted && !home.loadFailed.value) return;
    homeWanted = key;
    void home.load(today.value, today.value, { silent: true });
  };

  onMounted(() => {
    mounted = true;
    request(true);
  });

  watch(companyId, (id, old) => {
    if (id === old) return;
    main.reset();
    home.reset();
    wanted = "";
    homeWanted = "";
    request(true);
  });
  watch(weekMon, () => {
    if (!covered.value) request();
  });
  watch([() => main.loadedRange.value, today, companyId], requestHome);

  // "Pokušaj ponovo" i osvježavanje poslije kopiranja sedmice: isti prozor iznova.
  const retry = () => request(true);
  // Osvježavanje u pozadini (tab "Sada"): bez treptanja i bez poruke o padu.
  const refreshQuiet = async () => {
    if (!companyId.value) return;
    const w = main.loadedRange.value ?? windowFor(weekMon.value);
    await main.load(w.from, w.to, { silent: true, quiet: true });
    if (!todayInMain.value && home.loadedRange.value) await home.load(today.value, today.value, { silent: true, quiet: true });
  };

  return {
    shifts,
    range: main.loadedRange,
    state,
    errorReason: main.loadReason,
    todayShifts,
    todayState,
    saving: main.saving,
    retry,
    refreshQuiet,
    createMany: main.createMany,
    updateCapacity: main.updateCapacity,
    remove: main.remove,
    duplicateWeek: main.duplicateWeek,
    reloadWindow: main.reload,
  };
};

export type ScheduleData = ReturnType<typeof useScheduleData>;
