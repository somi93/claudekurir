import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { fetchOutboxStatus, syncOutbox } from "~/services/outboxService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";

const POLL_MS = 60_000;
// oldest_pending_age_sec preko ovoga -> žuto upozorenje (backend spec §1).
const STALE_PENDING_SEC = 300;

// Status knjiženja dostava u glavnu knjigu (outbox relay) - dispečerski panel,
// backend odgovor 16.09.2026 §1. Globalan (nije po firmi), zato composable
// nema companyId parametar. Polling na 60s je dovoljan (spec).
export const useOutboxStatus = () => {
  const status = ref<Awaited<ReturnType<typeof fetchOutboxStatus>> | null>(null);
  const loading = ref(true);
  const syncing = ref(false);
  const errorMessage = ref("");

  const load = async () => {
    try {
      status.value = await fetchOutboxStatus();
      errorMessage.value = "";
    } catch (error) {
      // Tiho - ovo je pozadinski health-check banner, ne blokira dispečera.
      // Ne prikazujemo grešku ako je već imamo prethodno uspješno stanje.
      if (!status.value) {
        errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da učitam status knjiženja.");
      }
    } finally {
      loading.value = false;
    }
  };

  const sync = async () => {
    syncing.value = true;
    try {
      const result = await syncOutbox();
      status.value = result;
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Sinhronizacija nije uspjela.");
    } finally {
      syncing.value = false;
    }
  };

  let timer: ReturnType<typeof setInterval> | null = null;
  onMounted(() => {
    load();
    timer = setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS);
  });
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
  });

  const relayDown = computed(() => status.value?.relay_alive === false);
  const hasStalePending = computed(
    () =>
      (status.value?.pending ?? 0) > 0 &&
      (status.value?.oldest_pending_age_sec ?? 0) > STALE_PENDING_SEC
  );
  const hasDead = computed(() => (status.value?.dead ?? 0) > 0);

  // Prikazuj banner samo kad ima nešto da se vidi (spec §1: "sve nule i
  // relay_alive: true -> ništa ne prikazivati").
  const visible = computed(
    () => Boolean(status.value) && (relayDown.value || hasStalePending.value || hasDead.value)
  );

  return {
    status,
    loading,
    syncing,
    errorMessage,
    relayDown,
    hasStalePending,
    hasDead,
    visible,
    sync,
    refresh: load,
  };
};
