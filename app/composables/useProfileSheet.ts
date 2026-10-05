import { computed, ref } from "vue";
import { useRoute, useRouter } from "nuxt/app";

export const PROFILE_SHEETS = ["kontakt", "licni", "vozilo", "lozinka", "odjava"] as const;
export type ProfileSheetKind = (typeof PROFILE_SHEETS)[number];

const sheetFromQuery = (raw: unknown): ProfileSheetKind | null => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return PROFILE_SHEETS.find((kind) => kind === value) ?? null;
};

// Otvoren list ekrana Profil živi u adresi (?s=kontakt|licni|vozilo|lozinka|odjava): osvježavanje
// i veza ga čuvaju (npr. traka "Promijeni sada" vodi na ?s=lozinka), a dugme Nazad zatvara list.
// Otvaranje je push, kao u Istoriji i Novčaniku; zatvaranje se vraća unazad kad je prethodni zapis
// ista stranica bez lista, inače samo skida ?s= iz adrese.
export const useProfileSheet = () => {
  const route = useRoute();
  const router = useRouter();

  const kind = computed(() => sheetFromQuery(route.query.s));
  // Polje koje list treba da fokusira (red koji ga je otvorio, npr. "phone"); veza ga nema.
  const focus = ref<string | null>(null);

  const setQuery = (value: ProfileSheetKind | null, mode: "push" | "replace") => {
    const next: Record<string, unknown> = { ...route.query };
    if (value) next.s = value;
    else delete next.s;
    void router[mode]({ query: next as Record<string, string | string[]> });
  };

  const open = (next: ProfileSheetKind, field: string | null = null) => {
    focus.value = field;
    setQuery(next, "push");
  };

  const close = () => {
    const back = (window.history.state as { back?: string | null } | null)?.back;
    if (back) {
      const [path = "", search = ""] = back.split("?");
      if (path === route.path && !new URLSearchParams(search).has("s")) {
        router.back();
        return;
      }
    }
    setQuery(null, "replace");
  };

  return { kind, focus, open, close };
};
