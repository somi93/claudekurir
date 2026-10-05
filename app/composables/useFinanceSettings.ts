import { ref, watch, type ComputedRef } from "vue";
import { fetchFinanceSettings, updateFinanceSettings } from "~/services/financeSettingsService";
import { getErrorStatus, getFieldErrors, toFriendlyErrorMessage } from "~/utils/errorMessage";
import { buildFinanceBody } from "~/utils/companySettings";
import type { ActionResult } from "~/composables/useCourierRoster";
import type { FinanceSettings, FinanceSettingsUpdate } from "~/types/finance-settings";

// Finansijske postavke izabrane firme. `settings` je SAČUVANO stanje: editor radi na svom nacrtu i
// ovdje stiže tek kad server prihvati izmjenu (saveSection). PATCH i dalje nosi svih 11 polja
// (sačuvano stanje + izmijenjena polja), jer djelimično tijelo backend nije potvrdio.
//
const NO_ANSWER = "Server ne odgovara.";

// options.enabled - lazy gate: dok je false, composable ne povlači podatke.
export const useFinanceSettings = (
  companyId: ComputedRef<number | null>,
  options: { enabled?: ComputedRef<boolean> } = {}
) => {
  const settings = ref<FinanceSettings | null>(null);
  const loadingSettings = ref(false);
  const savingSettings = ref(false);
  // Pad učitavanja: ekran pokazuje poruku sa "Pokušaj ponovo" umjesto prazne kartice.
  const loadFailed = ref(false);
  // Poruka za stranice koje je pokazuju kao zajedničku grešku (Finansije, Kuriri).
  const errorMessage = ref("");
  // Kratak razlog za mjesto liste ("Server ne odgovara." / nema veze), uz naslov koji kaže šta se desilo.
  const loadReason = ref("");

  // Odgovor za firmu koja više nije izabrana se odbacuje.
  let seq = 0;

  const fetchSettings = async (id: number) => {
    const mine = ++seq;
    loadingSettings.value = true;
    loadFailed.value = false;
    errorMessage.value = "";
    loadReason.value = "";
    try {
      const loaded = await fetchFinanceSettings(id);
      if (mine === seq) settings.value = loaded;
    } catch (error) {
      if (mine !== seq) return;
      loadFailed.value = true;
      const reason = toFriendlyErrorMessage(error, NO_ANSWER);
      loadReason.value = reason;
      errorMessage.value = reason === NO_ANSWER ? "Ne mogu da učitam finansijske postavke." : reason;
    } finally {
      if (mine === seq) loadingSettings.value = false;
    }
  };

  const reload = async () => {
    const id = companyId.value;
    if (id) await fetchSettings(id);
  };

  // Čuva polja jednog editora. Greška stiže kao rezultat (poruka + poruke uz polja), ne kao
  // zajednička poruka stranice, pa je editor pokazuje uz ono što se mijenja.
  const saveSection = async (patch: Partial<FinanceSettingsUpdate>): Promise<ActionResult> => {
    const id = companyId.value;
    const current = settings.value;
    if (!id || !current) return { ok: false, message: "Firma nije izabrana.", fields: {} };
    if (savingSettings.value) return { ok: false, message: "", fields: {} };
    savingSettings.value = true;
    try {
      const saved = await updateFinanceSettings(id, buildFinanceBody(current, patch));
      if (companyId.value === id) settings.value = saved;
      return { ok: true };
    } catch (error) {
      const fields = getFieldErrors(error);
      const rejected = getErrorStatus(error) === 422 && Object.keys(fields).length > 0;
      return {
        ok: false,
        message: toFriendlyErrorMessage(
          error,
          rejected
            ? "Server nije prihvatio izmjenu. Provjeri označeno polje."
            : "Server nije prihvatio izmjenu. Pokušaj ponovo; tvoj unos je ostao u formi."
        ),
        fields,
      };
    } finally {
      savingSettings.value = false;
    }
  };

  // immediate: true - companyId polazi od hardkodovane vrijednosti (vidi
  // useDeliveryCompaniesStore), ne od null-a, pa bez ovoga watch nikad ne bi okinuo prvi fetch.
  // Druga firma: prethodne postavke se odmah uklanjaju da se ne vide uz pogrešnu firmu.
  watch(
    [companyId, () => options.enabled?.value ?? true],
    ([id, enabled], previous) => {
      if (previous && previous[0] !== id) settings.value = null;
      if (!id || !enabled) return;
      void fetchSettings(id);
    },
    { immediate: true }
  );

  return {
    settings,
    loadingSettings,
    savingSettings,
    loadFailed,
    errorMessage,
    loadReason,
    saveSection,
    reload,
  };
};
