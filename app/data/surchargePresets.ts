import type { SurchargePreset } from "~/types/pricing";

// Gužva/Kiša/Sneg/Noćna dostava uklonjeni 14.08 - sad dolaze iz
// condition_tags kataloga (vidi useSurcharges.conditionTags), ne odavde.
// Ostaju samo lokalni predlozi koji nisu deo kataloga.
export const SURCHARGE_PRESETS: SurchargePreset[] = [
  {
    name: "Centar grada",
    description: "Poseban obračun — prednost biciklistima zbog gužve i parkinga.",
    icon: "mdi-city",
    type: "note",
    value: 0,
    unit: "prilagođeno vozilo",
  },
  {
    name: "Brdovit teren",
    description: "Faktor visinske razlike — motor/automobil imaju prednost nad biciklom.",
    icon: "mdi-image-filter-hdr",
    type: "note",
    value: 0,
    unit: "prilagođeno vozilo",
  },
];
