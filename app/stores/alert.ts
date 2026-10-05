import { defineStore } from "pinia";
import { ref } from "vue";

export type AlertType = "success" | "error" | "warning" | "info";

export interface AlertMessage {
  id: number;
  type: AlertType;
  text: string;
}

const DEFAULT_TIMEOUT = 10000;

export const useAlertStore = defineStore("alert", () => {
  const messages = ref<AlertMessage[]>([]);
  let nextId = 1;

  const dismiss = (id: number) => {
    messages.value = messages.value.filter((message) => message.id !== id);
  };

  const push = (type: AlertType, text: string, timeout = DEFAULT_TIMEOUT) => {
    if (!text) return null;
    const id = nextId++;
    messages.value.push({ id, type, text });
    if (timeout > 0) {
      setTimeout(() => dismiss(id), timeout);
    }
    return id;
  };

  const success = (text: string, timeout = DEFAULT_TIMEOUT) => push("success", text, timeout);
  // Greške ostaju dok ih korisnik sam ne zatvori - toast koji nestane za 10s se
  // lako propusti (npr. na mobilnom, ili ako korisnik u tom trenutku ne gleda
  // ekran), a poruka o grešci je jedina povratna informacija da akcija nije prošla.
  const error = (text: string, timeout = 0) => push("error", text, timeout);
  const warning = (text: string, timeout = DEFAULT_TIMEOUT) => push("warning", text, timeout);
  const info = (text: string, timeout = DEFAULT_TIMEOUT) => push("info", text, timeout);

  return { messages, push, success, error, warning, info, dismiss };
});
