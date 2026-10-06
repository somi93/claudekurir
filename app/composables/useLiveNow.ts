import { computed, onBeforeUnmount, onMounted, ref, watch, type ComputedRef } from "vue";
import { useLiveCoverage } from "~/composables/useLiveCoverage";
import type { LiveCounts } from "~/utils/schedule";

export const LIVE_INTERVAL_MS = 30_000;

// Tab "Sada": stanje uživo po zonama sa osvježavanjem. Podaci se učitaju kad se tab otvori, pa se
// osvježavaju svakih 30 s samo dok je tab otvoren i stranica vidljiva ("Automatski" se može isključiti);
// "Osvježi" radi odmah. Pad osvježavanja ostavlja stare podatke uz upozorenje od kada su, a pad prvog
// učitavanja je greška u mjestu sadržaja (prazan prikaz bi izgledao kao da u zonama nikoga nema).
// `extra` se zove uz svako osvježavanje (npr. smjene u pozadini, da broj potvrđenih ne ostane star).
export const useLiveNow = (
  companyId: ComputedRef<number | null>,
  active: ComputedRef<boolean>,
  options: { interval?: number; extra?: () => Promise<void> | void } = {}
) => {
  const interval = options.interval ?? LIVE_INTERVAL_MS;
  const cov = useLiveCoverage(companyId);

  const auto = ref(true);
  // "Osvježeno prije N s" se računa iznova svake sekunde dok je tab otvoren.
  const tickMs = ref(Date.now());
  const busy = computed(() => cov.loading.value);

  const byZone = computed(() => {
    const map = new Map<number, LiveCounts>();
    for (const c of cov.coverage.value) map.set(c.zoneId, { online: c.online, idle: c.idle, delivering: c.delivering });
    return map;
  });

  const state = computed<"loading" | "firsterror" | "ok">(() =>
    cov.loaded.value ? "ok" : cov.failed.value ? "firsterror" : "loading"
  );
  // Zadnje osvježavanje nije uspjelo, a stari podaci postoje.
  const stale = computed(() => cov.loaded.value && cov.failed.value);
  const secondsAgo = computed(() =>
    cov.updatedAt.value == null ? 0 : Math.max(0, (tickMs.value - cov.updatedAt.value) / 1000)
  );

  const refresh = async () => {
    if (cov.loading.value || !companyId.value) return;
    await Promise.all([cov.load({ silent: true }), options.extra?.()]);
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  let ticker: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const schedule = () => {
    stop();
    if (!active.value || !auto.value) return;
    timer = setTimeout(async () => {
      timer = null;
      if (active.value && auto.value && !document.hidden) await refresh();
      schedule();
    }, interval);
  };

  const onVisible = () => {
    if (document.hidden || !active.value) return;
    // Povratak na stranicu poslije dužeg mirovanja: brojevi su stari, osvježi odmah.
    if (cov.updatedAt.value == null || Date.now() - cov.updatedAt.value >= interval) void refresh().then(schedule);
  };

  watch(active, (on) => {
    if (on) {
      tickMs.value = Date.now();
      void refresh().then(schedule);
    } else stop();
  });
  watch(auto, schedule);
  watch(companyId, () => {
    cov.reset();
    if (active.value) void refresh().then(schedule);
  });

  onMounted(() => {
    ticker = setInterval(() => {
      if (active.value) tickMs.value = Date.now();
    }, 1000);
    document.addEventListener("visibilitychange", onVisible);
    if (active.value) void refresh().then(schedule);
  });
  onBeforeUnmount(() => {
    stop();
    if (ticker) clearInterval(ticker);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
  });

  return { byZone, state, stale, busy, auto, secondsAgo, updatedAt: cov.updatedAt, refresh };
};
