// Valuta firme za dostavu je slobodan string (npr. "KM", "BAM", "EUR", "RSD") -
// backend ju je 01.09 dodao na finance-settings (settings->currency JSON, isti
// obrazac kao restaurant.settings.price; NIJE ISO-4217). "KM" je fallback dok
// firma ne sačuva svoj izbor i za starije odgovore bez polja.
export const DEFAULT_CURRENCY = "KM";

// Normalizuje valutu iz odgovora (trim, fallback na "KM" za null / prazan string).
export const resolveCurrency = (currency?: string | null): string =>
  currency?.trim() || DEFAULT_CURRENCY;

// currency izostavljen / null → "KM" (kurirske stranice nemaju valutu firme u
// kontekstu - kurir radi za više firmi; one koriste tvrdi "KM" string).
export const formatAmount = (value: number, currency?: string | null) =>
  `${value.toFixed(2)} ${resolveCurrency(currency)}`;

// Iznosi stižu kao broj ili kao string ("12.50", Laravel decimal; ponekad i sa zarezom);
// prazno / nevažeće = null. Number("") i Number(" ") su 0, pa se prazan string
// izdvaja prije pretvaranja - inače bi nevažeća cijena izgledala kao prava nula.
export const toAmount = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const text = value.trim().replace(",", ".");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};
