// ofetch baca FetchError sa .response kad server odgovori (pa i sa statusom
// npr. 500) - takva greška ima čitljiv .message oblika `[POST] "url": 500 ...`
// koji ne treba nikad prikazivati korisniku. Kad .response nedostaje, poziv
// nije ni stigao do servera (offline / CORS / timeout).
const hasServerResponse = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "response" in error && Boolean((error as { response?: unknown }).response);

// Pravi mrežni fail: ofetch svejedno napravi FetchError (ima .request), samo bez
// .response. Sve OSTALO bez .response (TypeError iz našeg koda, npr. čitanje
// response.data kad je odgovor prazan, bug u .then, itd.) NIJE "nema interneta"
// - to je greška u kodu i ne smije da se maskira u lažnu offline poruku.
const isNetworkFailure = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "request" in error &&
  !hasServerResponse(error);

export const toFriendlyErrorMessage = (error: unknown, fallback: string): string => {
  if (hasServerResponse(error)) return fallback;
  if (isNetworkFailure(error)) {
    return "Nema veze sa serverom. Proveri internet konekciju i pokušaj ponovo.";
  }
  // Nije ni HTTP odgovor ni mrežni fail => bug u frontu. Loguj ga (da se ne
  // krije iza generičke poruke) i vrati fallback umjesto lažnog "offline".
  console.error("[toFriendlyErrorMessage] neočekivana greška (nije mrežna):", error);
  return fallback;
};

// ofetch kači parsirano telo 422/403/... odgovora na error.data (vidi
// FetchError.data u ofetch izvoru) - koristi se za Laravel validation format
// { message, errors: { polje: ["poruka"] } }.
export const getErrorStatus = (error: unknown): number | null => {
  if (typeof error !== "object" || error === null) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
};

export const getServerMessage = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null) return null;
  const data = (error as { data?: { message?: unknown } }).data;
  return typeof data?.message === "string" ? data.message : null;
};

// Vrati proizvoljno string polje iz tela greške (npr. `order_status` na 409 sa
// /orders/{id}/accept - odgovor 2.4). ofetch kači parsirano telo na error.data.
export const getServerField = (error: unknown, field: string): string | null => {
  if (typeof error !== "object" || error === null) return null;
  const data = (error as { data?: Record<string, unknown> }).data;
  const value = data?.[field];
  return typeof value === "string" ? value : null;
};

export const getValidationMessage = (error: unknown, field: string): string | null => {
  if (typeof error !== "object" || error === null) return null;
  const data = (error as { data?: { errors?: Record<string, unknown> } }).data;
  const messages = data?.errors?.[field];
  return Array.isArray(messages) && typeof messages[0] === "string" ? messages[0] : null;
};
