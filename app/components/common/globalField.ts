// Zajednički stil-propovi za sve globalne form komponente (GlobalTextField,
// GlobalSelect, GlobalAutocomplete, GlobalTextarea + pickeri koji ih koriste).
// Podrazumijevano je "sivi solo" izgled kao na filter redovima; pozivalac može
// da promijeni variant/density za poseban kontekst.

export type GlobalFieldVariant =
  | "outlined"
  | "plain"
  | "underlined"
  | "filled"
  | "solo"
  | "solo-inverted"
  | "solo-filled";

export type GlobalFieldDensity = "default" | "comfortable" | "compact";

export type GlobalFieldStyleProps = {
  variant?: GlobalFieldVariant;
  flat?: boolean;
  density?: GlobalFieldDensity;
};

export const GLOBAL_FIELD_STYLE_DEFAULTS = {
  variant: "solo",
  flat: true,
  density: "comfortable",
} as const;
