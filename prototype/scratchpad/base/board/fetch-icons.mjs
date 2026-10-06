import { writeFileSync } from "node:fs";
const names = [
  "menu","arrow-left","close","chevron-right","chevron-left","chevron-down","chevron-up","refresh",
  "map-marker-radius-outline","account-group-outline","account-search-outline","cash-register","calendar-clock-outline","cash-multiple","domain","bell-outline",
  "cash-plus","cash-minus","cash","wallet-outline","bank-outline","scale-balance","history","magnify","phone-outline","content-copy","check","check-circle-outline",
  "alert-outline","alert-circle-outline","information-outline","account-off-outline","account-outline","account-remove-outline","download-outline","filter-variant",
  "calendar-range","timer-sand","cloud-off-outline","open-in-new","clock-outline","file-delimited-outline","dots-vertical","arrow-right","swap-horizontal","text-box-outline",
  "cash-check","cash-refund","account-cash-outline","wallet","format-list-bulleted","calendar-today","check-all","progress-clock","reload","tray-arrow-down","export-variant",
];
const out = {}; const missing = [];
for (const n of names) {
  const r = await fetch(`https://cdn.jsdelivr.net/npm/@mdi/svg@5.9.55/svg/${n}.svg`);
  if (!r.ok) { missing.push(n); continue; }
  const t = await r.text();
  const m = t.match(/ d="([^"]+)"/);
  if (m) out[n] = m[1]; else missing.push(n + "(bez d)");
}
writeFileSync("icons.js", "/* MDI 5.9.55 (isti set kao aplikacija): putanje ikona */\nwindow.FC_ICONS = " + JSON.stringify(out) + ";\n");
console.log("ok", Object.keys(out).length, "nedostaje:", missing.join(", ") || "-");
