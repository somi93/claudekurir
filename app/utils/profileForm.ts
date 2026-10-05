import type { CourierProfile } from "~/models/CourierProfile";
import type { CourierProfileUpdate } from "~/types/courier";
import type { VehicleKey } from "~/types/vehicle";
import { pluralizeSr } from "~/utils/datetime";

// Čista logika ekrana Profil (bez DOM-a i bez Nuxta, pa se provjerava u običnom Node-u):
// unos datuma i IBAN-a, provjere polja po listu, i - najvažnije - šta se šalje serveru.

// --- Vrijednosti profila ---------------------------------------------------------------

// Sačuvano stanje profila u obliku koji koriste listovi (datum je ISO ili "", IBAN kako je
// sačuvan). Pravi se iz CourierProfile modela.
export type ProfileValues = {
  name: string;
  lastname: string;
  phone: string;
  dob: string;
  iban: string;
  ecName: string;
  ecPhone: string;
  vehicle: VehicleKey | null;
  vehicleNote: string;
};

export const toProfileValues = (p: CourierProfile): ProfileValues => ({
  name: p.name,
  lastname: p.lastname,
  phone: p.phone,
  dob: p.dateOfBirth,
  iban: p.iban,
  ecName: p.emergencyContactName,
  ecPhone: p.emergencyContactPhone,
  vehicle: p.vehicle,
  vehicleNote: p.vehicleNote,
});

// Profil kakav će biti kad server prihvati ovo tijelo: red na ekranu se osvježi odmah, a
// zatim se pročita pravo stanje. Izostavljeno polje ostaje kakvo je bilo.
export const applyPayload = (p: CourierProfile, payload: CourierProfileUpdate): CourierProfile => {
  const has = (key: keyof CourierProfileUpdate) => Object.prototype.hasOwnProperty.call(payload, key);
  return {
    ...p,
    name: payload.name ?? p.name,
    lastname: payload.lastname ?? p.lastname,
    phone: payload.phone ?? p.phone,
    dateOfBirth: has("date_of_birth") ? (payload.date_of_birth ?? "") : p.dateOfBirth,
    iban: has("iban") ? (payload.iban ?? "") : p.iban,
    emergencyContactName: has("emergency_contact_name")
      ? (payload.emergency_contact_name ?? "")
      : p.emergencyContactName,
    emergencyContactPhone: has("emergency_contact_phone")
      ? (payload.emergency_contact_phone ?? "")
      : p.emergencyContactPhone,
    vehicle: has("vehicle_type") ? (payload.vehicle_type ?? null) : p.vehicle,
    vehicleNote:
      has("vehicle_type") && payload.vehicle_type === null
        ? ""
        : has("vehicle_note")
          ? (payload.vehicle_note ?? "")
          : p.vehicleNote,
  };
};

// --- Datum rođenja ---------------------------------------------------------------------

const p2 = (n: number) => String(n).padStart(2, "0");

const MONTHS_GEN = [
  "januara",
  "februara",
  "marta",
  "aprila",
  "maja",
  "juna",
  "jula",
  "augusta",
  "septembra",
  "oktobra",
  "novembra",
  "decembra",
];

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export const digitsOnly = (value: string | null | undefined): string =>
  String(value ?? "").replace(/\D/g, "");

// "14031996" -> "14.03.1996": tačke se dodaju same dok se kuca, najviše 8 cifara.
export const formatDobDigits = (raw: string): string => {
  const d = digitsOnly(raw).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`;
};

// ISO dan (YYYY-MM-DD) -> tekst u polju (DD.MM.GGGG).
export const isoToText = (iso: string | null | undefined): string => {
  const m = ISO_DAY.exec(iso ?? "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
};

// "14. marta 1996." (mjesec u genitivu, kao u govoru).
export const isoLong = (iso: string | null | undefined): string => {
  const m = ISO_DAY.exec(iso ?? "");
  return m ? `${Number(m[3])}. ${MONTHS_GEN[Number(m[2]) - 1]} ${m[1]}.` : "";
};

export const ageOn = (iso: string | null | undefined, now: Date): number | null => {
  const m = ISO_DAY.exec(iso ?? "");
  if (!m) return null;
  let age = now.getFullYear() - Number(m[1]);
  const month = now.getMonth() + 1;
  const before = month < Number(m[2]) || (month === Number(m[2]) && now.getDate() < Number(m[3]));
  if (before) age -= 1;
  return age;
};

export const ageText = (age: number): string =>
  `${age} ${pluralizeSr(age, "godina", "godine", "godina")}`;

const MIN_AGE = 14;
const MAX_AGE = 90;

export type DobResult =
  | { ok: true; iso: string; age: number }
  | { ok: false; reason: "empty" | "incomplete" | "invalid" | "future" | "young" | "old" };

// text: "DD.MM.GGGG" kako se kuca (dozvoljena je i jedna cifra za dan/mjesec i završna tačka).
export const parseDob = (text: string, now: Date): DobResult => {
  const t = String(text ?? "").trim();
  if (!t) return { ok: false, reason: "empty" };
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/.exec(t);
  if (!m) return { ok: false, reason: "incomplete" };
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    return { ok: false, reason: "invalid" };
  }
  const iso = `${y}-${p2(mo)}-${p2(d)}`;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date > today) return { ok: false, reason: "future" };
  const age = ageOn(iso, now) ?? 0;
  if (age < MIN_AGE) return { ok: false, reason: "young" };
  if (age > MAX_AGE) return { ok: false, reason: "old" };
  return { ok: true, iso, age };
};

export const DOB_MESSAGES = {
  incomplete: "Upiši dan, mjesec i godinu, npr. 14.03.1996.",
  invalid: "Taj datum ne postoji. Provjeri dan i mjesec.",
  future: "Datum je u budućnosti.",
  young: "Datum je netačan: najmlađi kurir ima 14 godina.",
  old: "Datum je netačan: provjeri godinu.",
} as const;

// --- IBAN ------------------------------------------------------------------------------

export const ibanClean = (value: string | null | undefined): string =>
  String(value ?? "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();

// Grupe po 4 radi čitljivosti: "BA39 1290 0794 0102 8494".
export const formatIban = (value: string | null | undefined): string =>
  ibanClean(value)
    .replace(/(.{4})/g, "$1 ")
    .trim();

const mod97 = (iban: string): boolean => {
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const v = ch >= "A" && ch <= "Z" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of v) rem = (rem * 10 + Number(digit)) % 97;
  }
  return rem === 1;
};

export type IbanState =
  | { state: "empty"; len: 0 }
  | { state: "ok" | "short"; len: number }
  | { state: "bad"; len: number; why: "format" | "long" | "len" | "check" };

// BiH IBAN ima 20 znakova (BA + 2 kontrolne + 16 cifara). Ovo je UPOZORENJE, nikad zabrana:
// ne znamo da li backend prima i lokalne brojeve računa (stavka 11).
export const ibanState = (value: string | null | undefined): IbanState => {
  const c = ibanClean(value);
  if (!c) return { state: "empty", len: 0 };
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]*$/.test(c)) return { state: "bad", len: c.length, why: "format" };
  if (c.startsWith("BA") && c.length < 20) return { state: "short", len: c.length };
  if (c.startsWith("BA") && c.length > 20) return { state: "bad", len: c.length, why: "long" };
  if (c.length < 15 || c.length > 34) return { state: "bad", len: c.length, why: "len" };
  return mod97(c) ? { state: "ok", len: c.length } : { state: "bad", len: c.length, why: "check" };
};

// --- Telefon i ime ---------------------------------------------------------------------

// Isto pravilo kao useValidationRules().phone. Dozvoljava i "/" i ".", jer se tako pišu telefoni
// ("062/519-315", "065.123.456"); ranije pravilo ih je odbijalo pa se takav broj nije mogao sačuvati.
export const PHONE_PATTERN = /^[+]?[\d\s()./-]{6,20}$/;
export const phoneOk = (value: string | null | undefined): boolean =>
  !value ? true : PHONE_PATTERN.test(value);

export const initials = (
  name: string | null | undefined,
  last: string | null | undefined,
  email?: string | null
): string => {
  const a = String(name ?? "").trim().charAt(0);
  const b = String(last ?? "").trim().charAt(0);
  return (a + b).toUpperCase() || String(email ?? "?").trim().charAt(0).toUpperCase();
};

export const fullName = (name: string | null | undefined, last: string | null | undefined): string =>
  `${String(name ?? "").trim()} ${String(last ?? "").trim()}`.trim();

// --- Vozilo ----------------------------------------------------------------------------

// Registraciono vozilo + "Pješice" (= vehicle: null, pravo stanje - ne greška). Boje su iz
// jezika aplikacije (tamni tekst na blagom tonu, ≥ 4.5 : 1), ne iz VEHICLE_META (jarke).
export type VehicleChoice = VehicleKey | "foot";

export const VEHICLE_CHOICES: Record<
  VehicleChoice,
  { label: string; icon: string; ink: string; tint: string }
> = {
  car: { label: "Automobil", icon: "mdi-car", ink: "#2459c7", tint: "#eef4ff" },
  motorbike: { label: "Motor", icon: "mdi-motorbike", ink: "#9a4a07", tint: "#fff2df" },
  scooter: { label: "Skuter", icon: "mdi-moped", ink: "#5b6676", tint: "#eceff3" },
  bicycle: { label: "Bicikl", icon: "mdi-bike", ink: "#00734f", tint: "#e3f8ef" },
  foot: { label: "Pješice", icon: "mdi-walk", ink: "#5b6676", tint: "#eceff3" },
};

export const VEHICLE_ORDER: VehicleChoice[] = ["car", "motorbike", "scooter", "bicycle", "foot"];

export const choiceOf = (vehicle: VehicleKey | null | undefined): VehicleChoice => vehicle ?? "foot";
export const vehicleOf = (choice: VehicleChoice): VehicleKey | null =>
  choice === "foot" ? null : choice;

// --- Šta se šalje: samo ono što je izmijenjeno -----------------------------------------

const same = (a: unknown, b: unknown): boolean =>
  String(a == null ? "" : a).trim() === String(b == null ? "" : b).trim();

// Razlika sačuvanog i unesenog u obliku tijela za PUT /couriers/{id}.
//  - Vozilo ide samo kad je izmijenjeno (tip ili napomena). Napomena bez tipa ne dira vozilo
//    (28.08), pa uz napomenu ide i tip koji već važi; "Pješice" je vehicle_type: null.
//  - IBAN se šalje bez razmaka i velikim slovima, prazno je null (briše).
//  - Neizmijenjeno ne ulazi u tijelo: ništa se ne prepisuje starom kopijom.
export const buildPayload = (saved: ProfileValues, draft: ProfileValues): CourierProfileUpdate => {
  const out: CourierProfileUpdate = {};
  if (!same(saved.name, draft.name)) out.name = String(draft.name).trim();
  if (!same(saved.lastname, draft.lastname)) out.lastname = String(draft.lastname).trim();
  if (!same(saved.phone, draft.phone)) out.phone = String(draft.phone).trim();
  if (!same(saved.dob, draft.dob)) out.date_of_birth = draft.dob || null;
  if (!same(ibanClean(saved.iban), ibanClean(draft.iban))) out.iban = ibanClean(draft.iban) || null;
  if (!same(saved.ecName, draft.ecName)) {
    out.emergency_contact_name = String(draft.ecName).trim() || null;
  }
  if (!same(saved.ecPhone, draft.ecPhone)) {
    out.emergency_contact_phone = String(draft.ecPhone).trim() || null;
  }
  const typeChanged = (saved.vehicle ?? null) !== (draft.vehicle ?? null);
  const noteChanged = !same(saved.vehicleNote, draft.vehicleNote);
  if (typeChanged && !draft.vehicle) {
    out.vehicle_type = null;
  } else if (draft.vehicle && (typeChanged || noteChanged)) {
    out.vehicle_type = draft.vehicle;
    out.vehicle_note = String(draft.vehicleNote ?? "").trim();
  }
  return out;
};

// --- Provjere po listu -----------------------------------------------------------------

export type FieldMsg = { tone: "bad" | "warn" | "ok" | "hint"; text: string };

export type Check<K extends string> = {
  fields: Partial<Record<K, FieldMsg>>;
  // Smije li se snimiti (neispravno polje blokira, upozorenje ne).
  valid: boolean;
  // Ima li izmjena u odnosu na sačuvano.
  dirty: boolean;
  payload: CourierProfileUpdate;
};

// Da li je greška polja već vidljiva: tek kad je polje napušteno ili je pokušano snimanje
// (da ne vrijeđa dok kurir tek kuca).
export type ShowFn = (key: string) => boolean;

export type ContactDraft = { name: string; lastname: string; phone: string };

export const checkContact = (
  draft: ContactDraft,
  saved: ProfileValues,
  show: ShowFn
): Check<keyof ContactDraft> => {
  const fields: Check<keyof ContactDraft>["fields"] = {};
  let valid = true;
  const bad = (k: keyof ContactDraft, text: string) => {
    fields[k] = { tone: "bad", text };
    valid = false;
  };

  if (!draft.name.trim()) {
    if (show("name")) bad("name", "Upiši ime.");
    else valid = false;
  }
  if (!draft.lastname.trim()) {
    if (show("lastname")) bad("lastname", "Upiši prezime.");
    else valid = false;
  }
  const phone = draft.phone.trim();
  if (!phone) {
    if (show("phone")) bad("phone", "Upiši broj telefona.");
    else valid = false;
  } else if (!phoneOk(phone)) {
    if (show("phone")) bad("phone", "Unesi ispravan broj telefona, npr. 065 123 456.");
    else valid = false;
  }

  const payload = buildPayload(saved, {
    ...saved,
    name: draft.name,
    lastname: draft.lastname,
    phone: draft.phone,
  });
  return { fields, valid, dirty: Object.keys(payload).length > 0, payload };
};

export type PersonalDraft = { dob: string; iban: string; ecName: string; ecPhone: string };

export const checkPersonal = (
  draft: PersonalDraft,
  saved: ProfileValues,
  now: Date,
  show: ShowFn
): Check<keyof PersonalDraft> => {
  const fields: Check<keyof PersonalDraft>["fields"] = {};
  let valid = true;
  const bad = (k: keyof PersonalDraft, text: string) => {
    fields[k] = { tone: "bad", text };
    valid = false;
  };
  const info = (k: keyof PersonalDraft, tone: FieldMsg["tone"], text: string) => {
    fields[k] = { tone, text };
  };

  // Datum: prazno je u redu (briše), neispravno blokira snimanje i ne mijenja sačuvano.
  const dob = parseDob(draft.dob, now);
  let dobIso = "";
  if (!draft.dob.trim()) {
    dobIso = "";
  } else if (dob.ok) {
    dobIso = dob.iso;
    info("dob", "ok", `${ageText(dob.age)} · ${isoLong(dob.iso)}`);
  } else {
    dobIso = saved.dob;
    if (dob.reason === "incomplete") {
      if (show("dob") || draft.dob.length >= 10) {
        bad("dob", DOB_MESSAGES.incomplete);
      } else {
        info("dob", "hint", "Upiši cifre: dan, mjesec, godina.");
        valid = false;
      }
    } else if (dob.reason !== "empty") {
      bad("dob", DOB_MESSAGES[dob.reason]);
    }
  }

  // IBAN: samo upozorenje, snimanje je uvijek dozvoljeno.
  const ib = ibanState(draft.iban);
  if (ib.state === "ok") {
    info("iban", "ok", "Format IBAN-a je ispravan.");
  } else if (ib.state === "short") {
    info("iban", "warn", `BiH IBAN ima 20 znakova, upisano ih je ${ib.len}. Provjeri prije čuvanja.`);
  } else if (ib.state === "bad") {
    info(
      "iban",
      "warn",
      ib.why === "check"
        ? "Kontrolni broj se ne poklapa. Provjeri cifre."
        : ib.why === "long"
          ? "BiH IBAN ima 20 znakova, ovaj je duži. Provjeri cifre."
          : "IBAN počinje sa dva slova države i dvije cifre, npr. BA39…"
    );
  }

  // Hitni kontakt: neispravan telefon blokira, nepotpun par samo upozorava.
  const ecPhone = draft.ecPhone.trim();
  const ecName = draft.ecName.trim();
  if (ecPhone && !phoneOk(ecPhone)) {
    bad("ecPhone", "Unesi ispravan broj telefona, npr. 066 987 654.");
  } else if (ecName && !ecPhone) {
    info("ecPhone", "warn", "Bez broja telefona kontakt se ne može pozvati.");
  }
  if (ecPhone && !ecName && !fields.ecName) info("ecName", "warn", "Dodaj i ime osobe.");

  const payload = buildPayload(saved, {
    ...saved,
    dob: dobIso,
    iban: draft.iban,
    ecName: draft.ecName,
    ecPhone: draft.ecPhone,
  });
  return { fields, valid, dirty: Object.keys(payload).length > 0, payload };
};

export type VehicleDraft = { vehicle: VehicleKey | null; vehicleNote: string };

export const checkVehicle = (draft: VehicleDraft, saved: ProfileValues): Check<"vehicleNote"> => {
  const payload = buildPayload(saved, {
    ...saved,
    vehicle: draft.vehicle,
    vehicleNote: draft.vehicle ? draft.vehicleNote : "",
  });
  return { fields: {}, valid: true, dirty: Object.keys(payload).length > 0, payload };
};

export const MIN_PASSWORD = 8;

export type PasswordDraft = { cur: string; nw: string; conf: string };

export type PasswordCheck = {
  fields: Partial<Record<keyof PasswordDraft, FieldMsg>>;
  valid: boolean;
  dirty: boolean;
};

// serverError: poruka servera uz "trenutna lozinka" (npr. pogrešna); briše se čim kurir nešto upiše.
export const checkPassword = (
  draft: PasswordDraft,
  serverError: string,
  show: ShowFn
): PasswordCheck => {
  const fields: PasswordCheck["fields"] = {};
  let valid = true;
  const bad = (k: keyof PasswordDraft, text: string) => {
    fields[k] = { tone: "bad", text };
    valid = false;
  };

  if (!draft.cur) {
    if (show("cur")) bad("cur", "Upiši trenutnu lozinku.");
    else valid = false;
  } else if (serverError) {
    bad("cur", serverError);
  }

  if (!draft.nw) {
    if (show("nw")) bad("nw", "Upiši novu lozinku.");
    else valid = false;
  } else if (draft.nw.length < MIN_PASSWORD) {
    if (show("nw")) {
      bad("nw", `Najmanje ${MIN_PASSWORD} znakova (sada ${draft.nw.length}).`);
    } else {
      fields.nw = { tone: "hint", text: `Najmanje ${MIN_PASSWORD} znakova (${draft.nw.length} od ${MIN_PASSWORD})` };
      valid = false;
    }
  } else {
    fields.nw = { tone: "ok", text: "Dovoljno dugačka." };
  }

  if (!draft.conf) {
    if (show("conf")) bad("conf", "Ponovi novu lozinku.");
    else valid = false;
  } else if (draft.conf !== draft.nw) {
    if (show("conf") || draft.conf.length >= draft.nw.length) bad("conf", "Lozinke se ne poklapaju.");
    else valid = false;
  }

  return {
    fields,
    valid: valid && draft.nw.length >= MIN_PASSWORD && draft.conf === draft.nw && Boolean(draft.cur),
    dirty: Boolean(draft.cur || draft.nw || draft.conf),
  };
};

// --- Maske pri kucanju -----------------------------------------------------------------

// Pozicija kursora poslije formatiranja: iza istog broja "značajnih" znakova (cifre / slova i
// cifre) koji je bio ispred kursora, pa kucanje usred broja ne baca kursor na početak ili kraj.
export const caretAfter = (
  formatted: string,
  significantBefore: number,
  isSignificant: (ch: string) => boolean
): number => {
  if (significantBefore <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (isSignificant(formatted.charAt(i))) {
      seen += 1;
      if (seen === significantBefore) return i + 1;
    }
  }
  return formatted.length;
};

export const countSignificant = (
  text: string,
  isSignificant: (ch: string) => boolean
): number => {
  let n = 0;
  for (const ch of text) if (isSignificant(ch)) n += 1;
  return n;
};
