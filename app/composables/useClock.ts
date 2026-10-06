import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { nowOf, type Clock } from "~/utils/schedule";

const TICK_MS = 30_000;

// Sat stranice: "danas" i "sada" se računaju iznova (ne jednom pri učitavanju), pa raspored ne ostane
// zalijepljen za jučerašnji dan ako stranica stoji otvorena preko ponoći. Osvježava se na 30 s i čim se
// stranica opet vidi.
export const useClock = () => {
  const ms = ref(Date.now());
  let timer: ReturnType<typeof setInterval> | null = null;

  const tick = () => {
    ms.value = Date.now();
  };
  const onVisible = () => {
    if (typeof document !== "undefined" && !document.hidden) tick();
  };

  onMounted(() => {
    tick();
    timer = setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", onVisible);
  });
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
  });

  const clock = computed<Clock>(() => nowOf(new Date(ms.value)));
  return { ms, clock };
};
