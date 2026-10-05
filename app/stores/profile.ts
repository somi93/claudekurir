import { computed, ref, shallowRef, type Ref, type ShallowRef } from "vue";
import { defineStore } from "pinia";
import { fetchCourierCompanies } from "~/services/courierCompaniesService";
import { fetchCourierProfile, updateCourierProfile } from "~/services/courierProfileService";
import { useSessionStore } from "~/stores/session";
import type { CourierProfile } from "~/models/CourierProfile";
import type { CourierCompany, CourierProfileUpdate } from "~/types/courier";
import { getErrorStatus, getValidationMessage, toFriendlyErrorMessage } from "~/utils/errorMessage";
import { applyPayload } from "~/utils/profileForm";

// Profil kurira - JEDAN izvor za ekran Profil i za Dostave (vozilo za rutu), da se
// GET /couriers/{id} ne zove po ekranu. Dva izvora se učitavaju NEZAVISNO (profil i firme):
//
//  - svaki ima svoje stanje: "učitano", "greška" (samo dok nema ičega za prikaz) i
//    "zastarjelo" (osvježavanje nije uspjelo, a prikazuje se ranije stanje). Firma koja ne
//    stigne ne ruši profil.
//  - osvježavanje ne vraća ekran na skeleton: "učitava se" znači samo dok nema ničega.
//  - podaci mlađi od FRESH_MS se ne traže ponovo pri otvaranju ekrana, stariji se
//    osvježavaju u pozadini.
//  - snimanje odmah osvježi red na ekranu iz poslanog, pa pročita pravo stanje; odgovor koji
//    je krenuo PRIJE snimanja se odbacuje (ne smije da vrati staru vrijednost).

const FRESH_MS = 60_000;

type Source<T> = {
  data: ShallowRef<T>;
  loaded: Ref<boolean>;
  loading: Ref<boolean>;
  error: Ref<string>;
  stale: Ref<boolean>;
  at: Ref<number>;
  load: (fresh?: boolean) => Promise<boolean>;
  // Lokalna izmjena (poslije snimanja): odgovori u letu postaju zastarjeli.
  set: (value: T) => void;
  reset: () => void;
};

// Prvo snimanje tek sa imenom, prezimenom i telefonom: ako server odbije djelimično tijelo
// (zahtijeva ta tri polja - pitanje 10), ovo se pamti na uređaju i dalje ide cijelo.
const PUT_FULL_KEY = "profile-put-sends-identity";

const readPutFull = (): boolean => {
  try {
    return localStorage.getItem(PUT_FULL_KEY) === "1";
  } catch {
    return false;
  }
};
const rememberPutFull = () => {
  try {
    localStorage.setItem(PUT_FULL_KEY, "1");
  } catch {
    // privatni prozor: važi dok je stranica otvorena
  }
};

const IDENTITY_KEYS = ["name", "lastname", "phone"] as const;

// 422 u kome server traži polje koje nismo poslali (ime, prezime ili telefon).
const demandsIdentity = (error: unknown, payload: CourierProfileUpdate): boolean =>
  getErrorStatus(error) === 422 &&
  IDENTITY_KEYS.some((key) => !(key in payload) && Boolean(getValidationMessage(error, key)));

// Poruke servera po polju (Laravel: { errors: { polje: ["poruka"] } }), da list pokaže grešku
// uz pravo polje.
const FIELDS = [
  "name",
  "lastname",
  "phone",
  "date_of_birth",
  "iban",
  "emergency_contact_name",
  "emergency_contact_phone",
  "vehicle_type",
  "vehicle_note",
] as const;

const fieldErrors = (error: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const key of FIELDS) {
    const text = getValidationMessage(error, key);
    if (text) out[key] = text;
  }
  return out;
};

export type SaveResult =
  | { ok: true }
  | { ok: false; message: string; fields: Record<string, string> };

export const useProfileStore = defineStore("profile", () => {
  const courierId = ref<number | null>(null);

  const makeSource = <T>(
    initial: T,
    fetcher: (id: number) => Promise<T>,
    failText: string
  ): Source<T> => {
    const data = shallowRef(initial) as ShallowRef<T>;
    const loaded = ref(false);
    const inFlight = ref(0);
    const loading = computed(() => inFlight.value > 0);
    const error = ref("");
    const stale = ref(false);
    const at = ref(0);
    // Svaka lokalna izmjena podiže broj; odgovor koji je krenuo prije nje se odbacuje.
    let version = 0;
    let run: { id: number; promise: Promise<boolean> } | null = null;

    const start = (id: number): Promise<boolean> => {
      if (!loaded.value) error.value = "";
      inFlight.value += 1;
      const startedAt = version;
      const promise: Promise<boolean> = fetcher(id)
        .then(
          (value) => {
            if (courierId.value !== id || startedAt !== version) return false;
            data.value = value;
            loaded.value = true;
            error.value = "";
            stale.value = false;
            at.value = Date.now();
            return true;
          },
          (cause) => {
            if (courierId.value !== id) return false;
            if (loaded.value) stale.value = true;
            else error.value = toFriendlyErrorMessage(cause, failText);
            return false;
          }
        )
        .finally(() => {
          inFlight.value = Math.max(0, inFlight.value - 1);
          if (run?.promise === promise) run = null;
        });
      run = { id, promise };
      return promise;
    };

    // `fresh`: zahtjev u letu je poslat PRIJE neke promjene, pa njegov odgovor ne smije biti
    // zadnja riječ - sačekaj ga i pošalji novi.
    const load = (fresh = false): Promise<boolean> => {
      const id = courierId.value;
      if (!id) return Promise.resolve(false);
      if (run?.id === id) {
        if (!fresh) return run.promise;
        return run.promise.then(() => start(id));
      }
      return start(id);
    };

    const set = (value: T) => {
      version += 1;
      data.value = value;
      loaded.value = true;
      error.value = "";
      stale.value = false;
    };

    const reset = () => {
      version += 1;
      data.value = initial;
      loaded.value = false;
      inFlight.value = 0;
      error.value = "";
      stale.value = false;
      at.value = 0;
      run = null;
    };

    return { data, loaded, loading, error, stale, at, load, set, reset };
  };

  const profileSource = makeSource<CourierProfile | null>(
    null,
    (id) => fetchCourierProfile(id),
    "Ne mogu da učitam profil."
  );
  const companiesSource = makeSource<CourierCompany[]>(
    [],
    (id) => fetchCourierCompanies(id),
    "Ne mogu da učitam firmu."
  );

  const profile = profileSource.data;
  const companies = companiesSource.data;
  const saving = ref(false);

  // Vozilo za rutu na Dostavama: null = pješice. `vehicleKnown` je tek kad je profil stigao.
  const vehicle = computed(() => profile.value?.vehicle ?? null);

  const reset = () => {
    profileSource.reset();
    companiesSource.reset();
    saving.value = false;
  };

  // --- Ulaz za ekrane ----------------------------------------------------------

  function stop() {
    courierId.value = null;
    reset();
  }

  const start = (id: number) => {
    if (!Number.isFinite(id) || id <= 0) {
      stop();
      return;
    }
    if (courierId.value !== id) {
      reset();
      courierId.value = id;
    }
  };

  const fresh = (source: { at: Ref<number> }) => Date.now() - source.at.value < FRESH_MS;

  // Pri otvaranju ekrana Profil: što je svježe ostaje, staro se osvježava u pozadini, a ono
  // čega nema se učitava.
  const open = () => {
    for (const source of [profileSource, companiesSource]) {
      if (!source.loaded.value || !fresh(source)) void source.load();
    }
  };

  // Samo profil (Dostave, prijava): vrati da li je stigao.
  const touch = async (): Promise<boolean> => {
    if (profileSource.loaded.value && fresh(profileSource)) return true;
    return profileSource.load();
  };

  // "Pokušaj ponovo": samo ono što nije uspjelo (ili sve ako ništa nije palo).
  const retry = async (): Promise<void> => {
    const jobs = [profileSource, companiesSource]
      .filter((source) => Boolean(source.error.value) || source.stale.value)
      .map((source) => source.load());
    if (jobs.length === 0) jobs.push(profileSource.load(true), companiesSource.load(true));
    await Promise.all(jobs);
  };

  const retryCompanies = (): Promise<boolean> => companiesSource.load(true);

  // --- Snimanje ----------------------------------------------------------------

  // Ime i prezime idu i u sesiju (inicijali i ime drugdje ne smiju ostati stari).
  const syncSession = (payload: CourierProfileUpdate) => {
    const session = useSessionStore();
    if (!session.user) return;
    if (payload.name !== undefined) session.user.name = payload.name;
    if (payload.lastname !== undefined) session.user.lastname = payload.lastname;
  };

  const save = async (payload: CourierProfileUpdate): Promise<SaveResult> => {
    const id = courierId.value;
    const current = profileSource.data.value;
    if (!id || !current) {
      return { ok: false, message: "Profil još nije učitan. Pokušaj ponovo.", fields: {} };
    }
    if (saving.value) return { ok: false, message: "", fields: {} };
    if (Object.keys(payload).length === 0) return { ok: true };

    saving.value = true;
    try {
      const identity = { name: current.name, lastname: current.lastname, phone: current.phone };
      try {
        await updateCourierProfile(id, readPutFull() ? { ...identity, ...payload } : payload);
      } catch (error) {
        if (readPutFull() || !demandsIdentity(error, payload)) throw error;
        await updateCourierProfile(id, { ...identity, ...payload });
        rememberPutFull();
      }
    } catch (error) {
      saving.value = false;
      // Opšta poruka je naša (poruke servera su na engleskom); poruke po polju idu uz polje.
      return {
        ok: false,
        message: toFriendlyErrorMessage(
          error,
          "Server nije prihvatio izmjene. Pokušaj ponovo; tvoje izmjene su ostale u listu."
        ),
        fields: fieldErrors(error),
      };
    }

    profileSource.set(applyPayload(current, payload));
    syncSession(payload);
    saving.value = false;

    // Vozilo se provjerava kod servera (da li prima "Pješice" i da li tip prolazi bez
    // vehicle_type - pitanje 10); ostalo se osvježava u pozadini.
    if ("vehicle_type" in payload) {
      const confirmed = await profileSource.load(true);
      const now = profileSource.data.value;
      if (confirmed && now && now.vehicle !== (payload.vehicle_type ?? null)) {
        return {
          ok: false,
          message: "Server nije promijenio vozilo. Pokušaj ponovo ili javi dispečeru.",
          fields: {},
        };
      }
    } else {
      void profileSource.load(true);
    }
    return { ok: true };
  };

  return {
    courierId,
    profile,
    companies,
    loaded: profileSource.loaded,
    loading: profileSource.loading,
    error: profileSource.error,
    stale: profileSource.stale,
    at: profileSource.at,
    companiesLoaded: companiesSource.loaded,
    companiesLoading: companiesSource.loading,
    companiesError: companiesSource.error,
    saving,
    vehicle,
    start,
    stop,
    open,
    touch,
    retry,
    retryCompanies,
    save,
  };
});
