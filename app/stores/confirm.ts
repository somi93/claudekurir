import { defineStore } from "pinia";
import { ref } from "vue";

export type ConfirmOptions = {
  color?: string;
  confirmText?: string;
  cancelText?: string;
};

// Jedan globalni confirm dijalog (montiran u app.vue, vidi GlobalConfirmDialog.vue)
// umjesto da svaki ekran koji briše nešto duplira svoj v-dialog + pendingDelete
// ref. Poziva se kao Promise - resolve na potvrdu, reject na otkazivanje, isto
// ponašanje kao stari .open().then().catch() obrazac.
export const useConfirmStore = defineStore("confirm", () => {
  const open = ref(false);
  const title = ref("");
  const message = ref("");
  const color = ref("primary");
  const confirmText = ref("Potvrdi");
  const cancelText = ref("Otkaži");

  let resolvePending: (() => void) | null = null;
  let rejectPending: (() => void) | null = null;

  const settle = () => {
    resolvePending = null;
    rejectPending = null;
  };

  const confirm = (
    confirmTitle: string,
    confirmMessage: string,
    options: ConfirmOptions = {}
  ): Promise<void> => {
    // Ako je već otvoren jedan confirm kad se zatraži novi, stari se tretira
    // kao otkazan - ne mogu dva istovremeno da dijele isti dijalog.
    rejectPending?.();

    title.value = confirmTitle;
    message.value = confirmMessage;
    color.value = options.color ?? "primary";
    confirmText.value = options.confirmText ?? "Potvrdi";
    cancelText.value = options.cancelText ?? "Otkaži";
    open.value = true;

    return new Promise((resolve, reject) => {
      resolvePending = resolve;
      rejectPending = reject;
    });
  };

  const accept = () => {
    open.value = false;
    resolvePending?.();
    settle();
  };

  const cancel = () => {
    open.value = false;
    rejectPending?.();
    settle();
  };

  return { open, title, message, color, confirmText, cancelText, confirm, accept, cancel };
});
