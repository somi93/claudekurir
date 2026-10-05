export const formatDate = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString("sr-RS", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

// Srpska pravila za brojeve: ...1 (osim ...11) → jednina, ...2-4 (osim
// ...12-14) → "few" oblik, sve ostalo → "many" oblik (isti kao genitiv množine).
export const pluralizeSr = (n: number, one: string, few: string, many: string) => {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

// Kombinovan format sa dvije susjedne jedinice (ne kolabira na jednu kao
// formatRelativeTime) - koristi se za "Aktivno ..." podsetnik na kartici
// naknade. Iznad 24h prelazi na puno ispisane "D dana i X sati" - naknade
// znaju da ostanu uključene danima (npr. sezonske), pa "267h 44min" nije
// čitljivo, a mešanje "dana" sa "h" nije po srpskom.
export const formatElapsedDuration = (isoDateTime: string) => {
  const diffMs = Math.max(0, Date.now() - new Date(isoDateTime).getTime());
  const totalMinutes = Math.floor(diffMs / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (totalHours < 1) return `${minutes}min`;
  if (totalHours < 24) return `${totalHours}h ${minutes}min`;

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const dayLabel = `${days} ${pluralizeSr(days, "dan", "dana", "dana")}`;
  if (hours === 0) return dayLabel;
  return `${dayLabel} i ${hours} ${pluralizeSr(hours, "sat", "sata", "sati")}`;
};

// "Xh Ymin" iz gotovog broja minuta (za razliku od formatElapsedDuration,
// koji sam računa razliku od ISO vremena) - koristi se za backend-om vec
// izračunate vrednosti kao minutes_until_delivery (Dodela narudžbi ekran).
// Uzima apsolutnu vrednost - pozivalac odlučuje o predznaku (npr. "kasni").
export const formatMinutesDuration = (totalMinutes: number) => {
  const abs = Math.round(Math.abs(totalMinutes));
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;

  if (hours < 1) return `${minutes} min`;
  return `${hours}h ${minutes}min`;
};

// "Čeka X" iz sirovih minuta (waiting_minutes na "Čeka restoran" tabu) -
// skalira jedinicu: <1h minuti, <24h sati, <365 dana dani, dalje godine. Stare
// test narudžbe (od 2024.) inače prikažu besmislenih "18000h".
export const formatWaitingDuration = (totalMinutes: number) => {
  const mins = Math.max(0, Math.round(totalMinutes));
  if (mins < 60) return `${mins} min`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    const rem = mins % 60;
    return rem > 0 ? `${hours}h ${rem}min` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  if (days < 365) return `${days} ${pluralizeSr(days, "dan", "dana", "dana")}`;

  const years = Math.floor(days / 365);
  return `${years} ${pluralizeSr(years, "godina", "godine", "godina")}`;
};

export const MONTHS_SHORT_SR = [
  "jan", "feb", "mar", "apr", "maj", "jun",
  "jul", "avg", "sep", "okt", "nov", "dec",
];

// Backend šalje pravi UTC (npr. "2026-08-27T13:17:13.000000Z" za narudžbu
// napravljenu u 15:17 lokalno) - potvrđeno ground-truth testom 30.08 (odgovor
// §2.2), globalna Europe/Belgrade ispravka radi na svim putevima. Zato svuda
// koristimo standardni new Date() parsing; raniji "wall-clock" workaround je
// uklonjen.

// Goli sat "HH:MM" iz backend timestamp-a - za "Naručeno u ..." na Dodela
// narudžbi ekranu.
export const formatClockTime = (isoDateTime: string | null | undefined) => {
  if (!isoDateTime) return "";
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// "12. avg" ako datum nije današnji, "" ako jeste - u listi gde je većina stavki
// od danas pa datum samo smeta, a rijetke starije treba jasno označiti.
export const formatShortDateIfNotToday = (isoDateTime: string | null | undefined) => {
  if (!isoDateTime) return "";
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return isToday ? "" : `${d.getDate()}. ${MONTHS_SHORT_SR[d.getMonth()]}`;
};

// Milisekunde iz backend timestamp-a, za sortiranje stavki koje stižu u različitim
// formatima: pravi UTC ("2026-09-30T11:58:00.000000Z", npr. predaje gotovine) i
// lokalno vrijeme bez zone ("2026-09-30 15:14:33", npr. /earnings). Poređenje
// stringova miješa formate ('T' > ' ', pa predaja uvijek ispadne ispred dostave
// istog dana bez obzira na sat). Razmak se mijenja u 'T' jer Safari ne parsira
// "YYYY-MM-DD HH:MM:SS". Neprepoznat oblik = 0.
export const toTimestamp = (value: string | null | undefined): number =>
  parseTimestamp(value) ?? 0;

// Isto čitanje vremena, ali "nema / ne mogu da pročitam" je null, a ne 1970. Za
// dostavu bez vremena (delivered_at prazan ili neprepoznat) - ona ne smije ni da
// sruši stranicu (new Date(x).toISOString() baca RangeError) ni da se pojavi kao
// "pre 20 729 dana".
export const parseTimestamp = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const ms = new Date(String(value).trim().replace(" ", "T")).getTime();
  return Number.isNaN(ms) ? null : ms;
};

// "YYYY-MM-DD" po LOKALNOM datumu. toISOString() daje UTC datum, pa bi između
// ponoći i 02:00 "danas" bilo jučerašnji dan.
export const toLocalDayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Početak perioda u lokalnoj ponoći: danas, ova sedmica (od ponedjeljka) ili
// zadnjih 30 dana.
export const periodStart = (period: "today" | "week" | "month", now = new Date()): Date => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (period === "month") d.setDate(d.getDate() - 30);
  return d;
};

// "12. avg 15:30" - datum + sat sa standardnom tz konverzijom (new Date).
export const formatDateTime = (isoDateTime: string | null | undefined) => {
  if (!isoDateTime) return "";
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()}. ${MONTHS_SHORT_SR[d.getMonth()]} ${hh}:${mm}`;
};

// "Danas" / "Juče" / "3. sep" / "3. sep 2025." - separator dana u chat prikazu
// obaveštenja. Prošlogodišnje poruke dobijaju i godinu.
export const formatDayLabel = (isoDateTime: string | null | undefined) => {
  if (!isoDateTime) return "";
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return "";

  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diffDays = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(d).getTime()) / 86400000
  );
  if (diffDays === 0) return "Danas";
  if (diffDays === 1) return "Juče";

  const base = `${d.getDate()}. ${MONTHS_SHORT_SR[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}.`;
};

export const formatRelativeTime = (isoDateTime: string) => {
  const diffMs = Date.now() - new Date(isoDateTime).getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "upravo sada";
  if (diffMin < 60) return `pre ${diffMin} min`;

  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `pre ${diffHours}h`;

  // Srpska množina: "pre 1 dan", "pre 21 dan", ali "pre 2 dana", "pre 11 dana".
  const diffDays = Math.round(diffHours / 24);
  return `pre ${diffDays} ${pluralizeSr(diffDays, "dan", "dana", "dana")}`;
};
