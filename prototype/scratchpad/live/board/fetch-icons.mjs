import { writeFileSync } from "node:fs";
const names = [
  "menu","arrow-left","close","chevron-right","chevron-left","chevron-down","chevron-up","refresh",
  "map-marker-radius-outline","account-group-outline","account-search-outline","cash-register","calendar-clock-outline","cash-multiple","domain","bell-outline",
  "phone-outline","message-text-outline","content-copy","check","check-circle-outline","alert-outline","alert-circle-outline","information-outline",
  "account-off-outline","account-check-outline","magnify","crosshairs-gps","fit-to-page-outline","layers-outline","plus","minus","fullscreen","fullscreen-exit",
  "map-marker-off-outline","signal-off","moped-outline","motorbike","car","bike","walk","storefront-outline","account-clock-outline","timer-sand","clock-outline","clock-alert-outline",
  "speedometer","navigation-variant-outline","send","history","open-in-new","filter-variant","sort-variant","cloud-off-outline","bullhorn-outline","cash","wallet-outline","map-outline",
  "map-marker-outline","map-marker","help-circle-outline","package-variant-closed","drag-horizontal-variant","target","map-marker-path","cash-check","tray-arrow-down","account-outline",
  "moped","help-circle-outline","gesture-tap","arrow-right","tune-variant","eye-outline","eye-off-outline","backup-restore","play","pause","lock-open-outline",
];
const out = {}; const missing = [];
for (const n of [...new Set(names)]) {
  const r = await fetch(`https://cdn.jsdelivr.net/npm/@mdi/svg@5.9.55/svg/${n}.svg`);
  if (!r.ok) { missing.push(n); continue; }
  const t = await r.text();
  const m = t.match(/ d="([^"]+)"/);
  if (m) out[n] = m[1]; else missing.push(n + "(bez d)");
}
writeFileSync(new URL("./icons.js", import.meta.url), "/* MDI 5.9.55 (isti set kao aplikacija): putanje ikona */\nwindow.LV_ICONS = " + JSON.stringify(out) + ";\n");
console.log("ok", Object.keys(out).length, "nedostaje:", missing.join(", ") || "-");
