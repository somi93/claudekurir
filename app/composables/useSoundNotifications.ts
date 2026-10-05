import { computed, onMounted, ref, watch, type ComputedRef } from "vue";

// Zvuk i vibracija za novu ponudu. Jedno podešavanje (localStorage, po kuriru),
// UKLJUČENO po defaultu: propuštena ponuda kurira košta novca, a isključiti se
// može u jednom dodiru (Podešavanja ili "Spremnost" na ekranu Dostave).
//
// Zvuk se pravi Web Audio API-jem (nema audio fajla). Pregledač ga pušta tek
// poslije prvog dodira na stranicu, zato `unlockAudio` otključava kontekst na
// prvi dodir (vidi useOfferAlert). Vibracija radi samo na Android pregledačima.

let sharedContext: AudioContext | null = null;

const getContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedContext) sharedContext = new Ctor();
  return sharedContext;
};

// Zove se iz rukovaoca dodira/klika. Bez ovoga je kontekst "suspended" i zvuk ćuti.
export const unlockAudio = () => {
  try {
    const context = getContext();
    if (context && context.state === "suspended") void context.resume().catch(() => undefined);
  } catch {
    // zvuk nije dostupan
  }
};

// Tri uzlazna tona (A5, D6, G6) - prepoznatljivo i različito od sistemskih zvukova.
const CHIME: ReadonlyArray<readonly [frequency: number, delay: number]> = [
  [880, 0],
  [1174.66, 0.17],
  [1567.98, 0.34],
];
const VIBRATION_PATTERN = [250, 120, 250];

export const playChime = () => {
  try {
    const context = getContext();
    if (!context) return;
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    const now = context.currentTime;
    for (const [frequency, delay] of CHIME) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.22, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.3);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + delay);
      oscillator.stop(now + delay + 0.32);
    }
  } catch {
    // zvuk nije dostupan
  }
};

export const vibrateAlert = () => {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(VIBRATION_PATTERN);
    }
  } catch {
    // vibracija nije dostupna
  }
};

export const useSoundNotifications = (courierId: ComputedRef<number | null>) => {
  const enabled = ref(true);

  const storageKey = computed(() => `sound-notifications-${courierId.value ?? "guest"}`);

  const load = () => {
    try {
      const stored = localStorage.getItem(storageKey.value);
      enabled.value = stored === null ? true : stored === "1";
    } catch {
      enabled.value = true;
    }
  };

  const setEnabled = (value: boolean) => {
    enabled.value = value;
    try {
      localStorage.setItem(storageKey.value, value ? "1" : "0");
    } catch {
      // privatni prozor: podešavanje važi dok je stranica otvorena
    }
    // Dodir na prekidač je korisnikova radnja - dobar trenutak da se zvuk otključa.
    if (value) unlockAudio();
  };

  onMounted(load);
  watch(courierId, load);

  // Test: isti zvuk i vibracija kao za pravu ponudu.
  const playTestSound = () => {
    unlockAudio();
    playChime();
    vibrateAlert();
  };

  const playNewOrderSound = () => {
    if (!enabled.value) return;
    playChime();
    vibrateAlert();
  };

  return {
    enabled,
    setEnabled,
    playTestSound,
    playNewOrderSound,
  };
};
