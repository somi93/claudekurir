import { nextTick, type Ref } from "vue";
import { useAlertStore } from "~/stores/alert";
import type { ActionResult } from "~/composables/useCourierRoster";

type SheetHandle = { closeNow: () => void; focusField: (name: string) => void };

// Zajednički tok "Sačuvaj" za listove dispečerske liste: ako unos nije spreman, polja pokazuju šta
// fali (i fokus ide na prvo neispravno); inače se radnja izvrši, a na uspjeh list se zatvara uz
// kratku potvrdu. Na neuspjeh list ostaje otvoren sa unosom, a poruka servera stoji uz polje ili
// ispod dugmeta (opšta poruka je naša, poruke servera su na engleskom).
export const useSheetSave = (opts: {
  sheet: Ref<SheetHandle | null>;
  saving: Ref<boolean>;
  submitted: Ref<boolean>;
  error: Ref<string>;
  serverFields: Ref<Record<string, string>>;
  // Smije li se izvršiti (valid i ima šta da se snimi).
  ready: () => boolean;
  // Ime prvog neispravnog polja (za fokus), ako ga ima.
  firstBad?: () => string | null;
  run: () => Promise<ActionResult>;
  success?: string | null | (() => string | null);
  // Poziva se poslije uspjeha, prije zatvaranja (npr. otvara karticu za prijavu).
  onDone?: (result: ActionResult & { ok: true }) => void;
}) => {
  const alerts = useAlertStore();

  return async () => {
    if (opts.saving.value) return;
    if (!opts.ready()) {
      opts.submitted.value = true;
      await nextTick();
      const bad = opts.firstBad?.();
      if (bad) opts.sheet.value?.focusField(bad);
      return;
    }
    opts.saving.value = true;
    opts.error.value = "";
    const result = await opts.run();
    opts.saving.value = false;
    if (result.ok) {
      const text = typeof opts.success === "function" ? opts.success() : opts.success;
      if (text !== null) alerts.success(text ?? "Sačuvano.", 3000);
      if (result.warning) alerts.warning(result.warning);
      opts.onDone?.(result);
      opts.sheet.value?.closeNow();
    } else {
      opts.error.value = result.message;
      opts.serverFields.value = result.fields;
    }
  };
};
