import { defineStore } from "pinia";
import { ref } from "vue";

export type AlertType = "success" | "error" | "warning" | "info";

// Radnja uz obavijest (npr. "Poništi"). Klik izvrši run() i zatvori obavijest.
export interface AlertAction {
  label: string;
  run: () => void;
}

export interface AlertMessage {
  id: number;
  type: AlertType;
  text: string;
  action?: AlertAction;
}

const DEFAULT_TIMEOUT = 10000;
// Obavijest sa radnjom ("Poništi") traje kraće: prozor za poništavanje je kratak, a poruka
// ne smije ostati i poslije nego što poništavanje više nema smisla.
const ACTION_TIMEOUT = 6000;

export const useAlertStore = defineStore("alert", () => {
  const messages = ref<AlertMessage[]>([]);
  let nextId = 1;

  const dismiss = (id: number) => {
    messages.value = messages.value.filter((message) => message.id !== id);
  };

  // `timeout` izostavljen: 10 s, a sa radnjom 6 s. 0 znači da ostaje dok je korisnik ne zatvori.
  const push = (type: AlertType, text: string, timeout?: number, action?: AlertAction) => {
    if (!text) return null;
    const id = nextId++;
    messages.value.push(action ? { id, type, text, action } : { id, type, text });
    const ms = timeout ?? (action ? ACTION_TIMEOUT : DEFAULT_TIMEOUT);
    if (ms > 0) {
      setTimeout(() => dismiss(id), ms);
    }
    return id;
  };

  const success = (text: string, timeout?: number, action?: AlertAction) =>
    push("success", text, timeout, action);
  // Greške ostaju dok ih korisnik sam ne zatvori - toast koji nestane za 10s se
  // lako propusti (npr. na mobilnom, ili ako korisnik u tom trenutku ne gleda
  // ekran), a poruka o grešci je jedina povratna informacija da akcija nije prošla.
  const error = (text: string, timeout = 0, action?: AlertAction) =>
    push("error", text, timeout, action);
  const warning = (text: string, timeout?: number, action?: AlertAction) =>
    push("warning", text, timeout, action);
  const info = (text: string, timeout?: number, action?: AlertAction) =>
    push("info", text, timeout, action);

  // Obavijest sa radnjom bez "undefined" na mjestu roka: withAction("success", "Uključeno.", { label: "Poništi", run }).
  const withAction = (type: AlertType, text: string, action: AlertAction, timeout?: number) =>
    push(type, text, timeout, action);

  // Klik na radnju: obavijest se prvo ukloni pa se radnja izvrši tačno jednom, čak i kad je
  // dugme kliknuto dvaput dok obavijest nestaje (prelaz traje 0,2 s).
  const runAction = (id: number) => {
    const message = messages.value.find((m) => m.id === id);
    if (!message?.action) return;
    const { run } = message.action;
    dismiss(id);
    run();
  };

  return { messages, push, success, error, warning, info, withAction, runAction, dismiss };
});
