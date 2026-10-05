import { MONTHS_SHORT_SR, pluralizeSr } from "~/utils/datetime";

// Vrijeme u porukama dispečera (bez DOM-a, pa se provjerava u običnom Node-u). Lokalno vrijeme
// pregledača: backend šalje pravi UTC, a dispečer vidi sat kakav je na njegovom satu.

const p2 = (n: number) => String(n).padStart(2, "0");

// "07:05"
export const clock = (ms: number): string => {
  const d = new Date(ms);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

const startOfDay = (ms: number): number => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

// "Danas", "Juče", "26. sep"
export const dayLabel = (ms: number, now: number): string => {
  const diff = Math.round((startOfDay(now) - startOfDay(ms)) / 86_400_000);
  if (diff === 0) return "Danas";
  if (diff === 1) return "Juče";
  const d = new Date(ms);
  return `${d.getDate()}. ${MONTHS_SHORT_SR[d.getMonth()]}`;
};

// "Danas 14:20", "Juče 09:05", "26. sep 18:30"
export const dayClock = (ms: number, now: number): string => `${dayLabel(ms, now)} ${clock(ms)}`;

// "upravo sad", "prije 12 s", "prije 5 min", "prije 3 h", "prije 2 dana"
export const agoText = (sec: number): string => {
  if (sec < 5) return "upravo sad";
  if (sec < 60) return `prije ${Math.round(sec)} s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `prije ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `prije ${h} h`;
  const d = Math.round(h / 24);
  return `prije ${d} ${pluralizeSr(d, "dan", "dana", "dana")}`;
};

export const agoMs = (ms: number, now: number): string => agoText(Math.max(0, (now - ms) / 1000));
