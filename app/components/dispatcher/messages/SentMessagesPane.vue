<template>
  <div class="sp">
    <div v-if="batches.length === 0" class="sp-empty">
      <v-icon icon="mdi-send-outline" size="34" />
      <b>Još ništa nije poslato u ovoj sesiji</b>
      <p>
        Poruke koje pošalješ pojavljuju se ovdje, pa možeš da provjeriš ko ih je pročitao i da podsjetiš
        one koji nisu. Starije poruke se još ne čuvaju na serveru (B1); poruke pojedinog kurira nađi preko
        ikone <b>Poruke kurira</b> u listi.
      </p>
      <button type="button" class="btn btn--primary" data-messages="new" @click="emit('new')">
        <v-icon icon="mdi-square-edit-outline" size="18" />Nova poruka
      </button>
    </div>

    <div v-else class="sp-list" aria-label="Poslato">
      <div class="sp-day">Poslato u ovoj sesiji</div>
      <SentMessageCard
        v-for="b in batches"
        :key="b.id"
        :ref="(el) => setRef(b.id, el)"
        :batch="b"
        :check="checks[b.id]"
        :couriers="couriers"
        :now="now"
        :flash="flashId === b.id"
        @check="emit('check', b.id)"
        @remind="emit('remind', b.id)"
        @retract="emit('retract', b.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import SentMessageCard from "~/components/dispatcher/messages/SentMessageCard.vue";
import type { CheckState } from "~/composables/useMessageTracking";
import type { RosterCourier } from "~/utils/courierRoster";
import type { SentBatch } from "~/utils/messageTracking";

// "Poslato u ovoj sesiji": kartice poslatih poruka, najnovija prva. Prazno stanje kaže zašto starijih
// poruka nema (backend ne daje listu poslatog) umjesto da obećava istoriju.
defineProps<{
  batches: SentBatch[];
  checks: Record<string, CheckState>;
  couriers: ReadonlyMap<number, RosterCourier>;
  now: number;
  flashId: string | null;
}>();

const emit = defineEmits<{ new: []; check: [string]; remind: [string]; retract: [string] }>();

const cards = new Map<string, { focusTitle: () => void }>();
const setRef = (id: string, el: unknown) => {
  if (el) cards.set(id, el as { focusTitle: () => void });
  else cards.delete(id);
};

defineExpose({ focusCard: (id: string) => cards.get(id)?.focusTitle() });
</script>

<style scoped>
.sp-list {
  display: grid;
  gap: 12px;
}

.sp-day {
  padding: 6px 4px 0;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #5b6676;
}

.sp-empty {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 30px 20px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
  text-align: center;
}

.sp-empty .v-icon {
  color: #c7ccd6;
}

.sp-empty b {
  font-size: 0.98rem;
  font-weight: 800;
}

.sp-empty p {
  max-width: 360px;
  margin: 0;
  font-size: 0.84rem;
  color: #5b6676;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  margin-top: 6px;
  padding: 0 16px;
  border: 1.5px solid #dfe3ea;
  border-radius: 12px;
  background: #fff;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
}

.btn--primary {
  border-color: #0b1220;
  background: #0b1220;
  color: #fff;
  box-shadow: 0 6px 16px -8px rgba(11, 18, 32, 0.5);
}

.btn:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}
</style>
