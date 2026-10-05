import { onBeforeUnmount, onMounted, watch, type Ref } from "vue";
import { unlockAudio } from "~/composables/useSoundNotifications";

// Ponuda traje desetak do trideset sekundi, a kurir ne gleda u ekran: zvuk i
// vibracija se okidaju JEDNOM kad se nova ponuda pojavi i ponavljaju se svakih
// REPEAT_MS dok god neka ponuda čeka odgovor.
const REPEAT_MS = 8000;

// `pendingIds` su ponude koje čekaju odgovor (nisu istekle). `play` je
// playNewOrderSound iz useSoundNotifications - sam provjerava da li je zvuk uključen.
export const useOfferAlert = (pendingIds: Readonly<Ref<number[]>>, play: () => void) => {
  const seen = new Set<number>();
  let repeatTimer: ReturnType<typeof setInterval> | null = null;

  const stopRepeat = () => {
    if (repeatTimer) clearInterval(repeatTimer);
    repeatTimer = null;
  };

  const startRepeat = () => {
    if (repeatTimer) return;
    repeatTimer = setInterval(() => {
      if (pendingIds.value.length > 0 && document.visibilityState === "visible") play();
    }, REPEAT_MS);
  };

  watch(
    pendingIds,
    (ids) => {
      const fresh = ids.filter((id) => !seen.has(id));
      fresh.forEach((id) => seen.add(id));
      if (fresh.length > 0) play();
      if (ids.length > 0) startRepeat();
      else stopRepeat();
    },
    { immediate: false }
  );

  // Pregledač pušta zvuk tek poslije dodira na stranicu - prvi dodir ga otključava.
  const unlock = () => unlockAudio();
  const EVENTS = ["pointerdown", "touchstart", "keydown"] as const;

  onMounted(() => {
    for (const name of EVENTS) window.addEventListener(name, unlock, { once: false, passive: true });
    // Ponuda koja već čeka kad se stranica otvori takođe treba da se čuje.
    if (pendingIds.value.length > 0) {
      pendingIds.value.forEach((id) => seen.add(id));
      play();
      startRepeat();
    }
  });

  onBeforeUnmount(() => {
    for (const name of EVENTS) window.removeEventListener(name, unlock);
    stopRepeat();
  });
};
