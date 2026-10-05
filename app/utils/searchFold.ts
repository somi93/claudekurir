import { toLatin } from "~/utils/toLatin";

// Pretraga bez razlike u veličini slova i bez dijakritika: "karadzica" nalazi
// "Karadžića", "djoko" nalazi "Đoko". I tekst koji se pretražuje i upit idu kroz
// istu funkciju, pa se uvijek porede na istom "ravnom" obliku.
export const foldForSearch = (value: string | null | undefined): string =>
  String(value ?? "")
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// Upit kurira: ćirilica se prebaci u latinicu (kao i prikaz), pa se svede na ravan
// oblik; vodeće "#" se ignoriše ("4258" i "#4258" su isto).
export const searchNeedle = (query: string | null | undefined): string =>
  foldForSearch(toLatin(query)).replace(/^\s*#/, "").trim();
