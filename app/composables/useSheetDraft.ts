import { reactive, ref, watch, type Ref } from "vue";

// Stanje jednog lista za izmjenu (Profil): nacrt polja, koja su polja "dotaknuta" (greška se
// pokazuje tek kad je polje napušteno ili je pokušano snimanje), snimanje u toku i greška servera.
// Svako otvaranje počinje iznova iz sačuvanog stanja (`make`).
export const useSheetDraft = <D extends Record<string, unknown>>(
  open: Ref<boolean>,
  make: () => D
) => {
  const draft = reactive(make()) as D;
  const touched = reactive<Record<string, boolean>>({});
  const submitted = ref(false);
  const saving = ref(false);
  // Opšta poruka ispod polja (server nije prihvatio, nema veze).
  const error = ref("");
  // Poruke servera uz polja, po imenu polja u API-ju.
  const serverFields = ref<Record<string, string>>({});

  const reset = () => {
    Object.assign(draft, make());
    for (const key of Object.keys(touched)) delete touched[key];
    submitted.value = false;
    saving.value = false;
    error.value = "";
    serverFields.value = {};
  };

  watch(
    open,
    (isOpen) => {
      if (isOpen) reset();
    },
    { immediate: true }
  );

  const show = (key: string) => Boolean(touched[key]) || submitted.value;
  const touch = (key: string) => {
    touched[key] = true;
  };
  // Polje se opet kuca: nepotpun unos ne smije odmah biti greška (vraća se tek kad se polje napusti).
  const untouch = (key: string) => {
    delete touched[key];
  };

  // Kurir kuca: ono što je server rekao o prethodnom pokušaju više ne važi.
  const edited = () => {
    if (error.value) error.value = "";
    if (Object.keys(serverFields.value).length) serverFields.value = {};
  };

  return { draft, show, touch, untouch, submitted, saving, error, serverFields, reset, edited };
};
