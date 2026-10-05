import { ref, watch, type Ref } from "vue";
import { broadcastCourierMessage, sendCourierInboxMessage } from "~/services/courierInboxService";
import { getErrorStatus, toFriendlyErrorMessage } from "~/utils/errorMessage";
import { readStored, writeStored } from "~/utils/deviceStorage";
import type { SendPlan } from "~/utils/messageAudience";
import type { MessageDraft } from "~/utils/messageDraft";
import type { SentBatch } from "~/utils/messageTracking";

export type SendOutcome =
  | { ok: true; batch: SentBatch; sent: number; intended: number }
  | { ok: false; message: string };

const MAX_BATCHES = 50;

const parseBatches = (raw: string | null): SentBatch[] => {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(
      (b): b is SentBatch =>
        !!b &&
        typeof b === "object" &&
        typeof (b as SentBatch).id === "string" &&
        Array.isArray((b as SentBatch).recipients) &&
        typeof (b as SentBatch).sentAt === "number" &&
        typeof (b as SentBatch).results === "object" &&
        (b as SentBatch).results !== null
    );
  } catch {
    return [];
  }
};

// "Poslato u ovoj sesiji": poruke poslate sa ovog ekrana dok je tab otvoren (sessionStorage, po firmi).
// Backend ne daje listu poslatog (B1), pa starije poruke nema odakle; ostaju u sandučićima kurira i
// vide se preko "Poruke kurira". Slanje i evidencija su na istom mjestu da kartica nikad ne zaostane za
// zahtjevom.
export const useSentMessages = (companyId: Ref<number | null>) => {
  const batches = ref<SentBatch[]>([]);
  const sending = ref(false);
  let seq = 0;

  const key = () => (companyId.value ? `poruke-poslato-${companyId.value}` : null);

  const persist = () => {
    const k = key();
    if (k) writeStored("session", k, JSON.stringify(batches.value.slice(0, MAX_BATCHES)));
  };

  const load = () => {
    const k = key();
    batches.value = k ? parseBatches(readStored("session", k)) : [];
  };

  watch(companyId, load, { immediate: false });

  const update = (id: string, patch: Partial<SentBatch>) => {
    batches.value = batches.value.map((b) => (b.id === id ? { ...b, ...patch } : b));
    persist();
  };

  const find = (id: string): SentBatch | undefined => batches.value.find((b) => b.id === id);

  // Jednom kuriru ide na njegov inbox, više njih (ili svi) kroz broadcast. Greška slanja ne dira
  // nacrt: tekst i izbor ostaju.
  const send = async (plan: SendPlan, draft: MessageDraft, audience: string): Promise<SendOutcome> => {
    const id = companyId.value;
    if (!id) return { ok: false, message: "Firma nije izabrana." };
    if (plan.count === 0 || sending.value) return { ok: false, message: "" };
    const body = { category: draft.category, title: draft.title.trim(), body: draft.body.trim() };
    sending.value = true;
    try {
      let sent = plan.count;
      if (plan.count === 1) {
        await sendCourierInboxMessage(plan.ids[0] as number, body);
      } else if (plan.everyone) {
        sent = await broadcastCourierMessage(id, { ...body, all_couriers: true });
      } else {
        sent = await broadcastCourierMessage(id, { ...body, all_couriers: false, courier_ids: plan.ids });
      }
      const batch: SentBatch = {
        id: `b${Date.now()}-${++seq}`,
        ...body,
        sentAt: Date.now(),
        recipients: plan.ids.slice(),
        audience,
        intended: plan.count,
        sentCount: sent,
        results: {},
        checkedAt: null,
        status: "sent",
        retracted: null,
      };
      batches.value = [batch, ...batches.value].slice(0, MAX_BATCHES);
      persist();
      return { ok: true, batch, sent, intended: plan.count };
    } catch (error) {
      if (getErrorStatus(error) === 403) {
        return {
          ok: false,
          message: "Nemaš pravo da šalješ poruke ovom kuriru: nije vezan za tvoju firmu.",
        };
      }
      return {
        ok: false,
        message: toFriendlyErrorMessage(
          error,
          "Server nije prihvatio poruku. Pokušaj ponovo; tekst i izbor primalaca su ostali."
        ),
      };
    } finally {
      sending.value = false;
    }
  };

  return { batches, sending, load, update, find, send };
};
