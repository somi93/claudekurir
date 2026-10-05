import { onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";

// Ekran ostaje upaljen dok traje dostava ili stoji ponuda. Bez ovoga se GPS
// prestaje slati čim telefon ugasi ekran (pregledač zaustavlja stranicu), pa
// dispečer gubi kurira, a ponuda zvuči tek kao push. Wake Lock se gubi kad se
// stranica sakrije (drugi tab, zaključan telefon) - zato ga na povratku tražimo
// ponovo. Nepodržano (stariji iOS, nesiguran kontekst) = tiho preskačemo.
// Kratko kašnjenje prije puštanja: prelaz ponuda -> dostava -> "Dostavljeno" ne smije da
// pusti i odmah ponovo zatraži ekran (svaki zahtjev je poziv ka sistemu).
const RELEASE_GRACE_MS = 1500;

export const useWakeLock = (shouldHold: Readonly<Ref<boolean>>) => {
  const supported = ref(false);
  const active = ref(false);

  let sentinel: WakeLockSentinel | null = null;
  let requesting = false;
  let releaseTimer: ReturnType<typeof setTimeout> | null = null;

  const acquire = async () => {
    if (!supported.value || sentinel || requesting) return;
    if (document.visibilityState !== "visible") return;
    requesting = true;
    try {
      const lock = await navigator.wakeLock.request("screen");
      // Ako je u međuvremenu prestala potreba (odgovor kasni), odmah pusti.
      if (!shouldHold.value) {
        await lock.release().catch(() => undefined);
        return;
      }
      sentinel = lock;
      active.value = true;
      lock.addEventListener("release", () => {
        if (sentinel === lock) sentinel = null;
        active.value = false;
      });
    } catch {
      // Odbijeno (štednja baterije, nema dozvole) - ekran se gasi kao i inače.
      active.value = false;
    } finally {
      requesting = false;
    }
  };

  const release = async () => {
    const lock = sentinel;
    sentinel = null;
    active.value = false;
    if (lock) await lock.release().catch(() => undefined);
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible" && shouldHold.value) void acquire();
  };

  watch(shouldHold, (hold) => {
    if (releaseTimer) clearTimeout(releaseTimer);
    releaseTimer = null;
    if (hold) {
      void acquire();
      return;
    }
    releaseTimer = setTimeout(() => {
      releaseTimer = null;
      if (!shouldHold.value) void release();
    }, RELEASE_GRACE_MS);
  });

  onMounted(() => {
    supported.value = typeof navigator !== "undefined" && "wakeLock" in navigator;
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (shouldHold.value) void acquire();
  });

  onBeforeUnmount(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (releaseTimer) clearTimeout(releaseTimer);
    void release();
  });

  return { supported, active };
};
