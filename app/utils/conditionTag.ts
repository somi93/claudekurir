import type { ConditionTag } from "~/types/pricing";

// Katalog (GET /condition-tags) vraća Tabler ikone (npr. "ti-cloud-rain") -
// front svuda drugde koristi mdi-* preko Vuetify <v-icon>, pa mapiramo po
// tag.key za prikaz. Sirovi tag.icon i dalje šaljemo backend-u pri kreiranju
// naknade (vidi useSurcharges) - ovo je samo lokalna mapa za render.
const CONDITION_TAG_ICON_BY_KEY: Record<string, string> = {
  rain: "mdi-weather-rainy",
  snow: "mdi-weather-snowy",
  traffic: "mdi-traffic-light",
  night: "mdi-weather-night",
};

const FALLBACK_ICON = "mdi-tag-outline";

export const conditionTagDisplayIcon = (tag: Pick<ConditionTag, "key">) =>
  CONDITION_TAG_ICON_BY_KEY[tag.key] ?? FALLBACK_ICON;
