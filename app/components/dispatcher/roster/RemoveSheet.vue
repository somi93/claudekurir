<template>
  <AppSheet
    ref="sheet"
    :open="open"
    title="Ukloni sa liste firme"
    :subtitle="`${courier.name} · #${courier.id}`"
    :dirty="false"
    focus="cancel"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <TintAlert
      v-if="courier.cash != null && courier.cash > 0"
      tone="warn"
      icon="mdi-cash-multiple"
      :title="`Duguje ${formatAmount(courier.cash, currency)}`"
    >
      Poslije uklanjanja dug ostaje vidljiv samo u Finansijama, u balansima. Bolje je prvo evidentirati
      predaju.
    </TintAlert>
    <TintAlert v-if="delivering" tone="warn" icon="mdi-moped-outline" title="Trenutno je u dostavi" />

    <div class="rm-grp">
      <div class="rm-row">
        <span class="rm-ic warn"><v-icon icon="mdi-account-off-outline" size="20" /></span>
        <span>
          <small>Suspenduj</small>
          <b>Privremeno</b>
          <em>Ostaje na listi, samo ne prima narudžbe.</em>
        </span>
      </div>
      <div class="rm-row">
        <span class="rm-ic bad"><v-icon icon="mdi-account-remove-outline" size="20" /></span>
        <span>
          <small>Ukloni (ovo)</small>
          <b>Nestaje sa liste ove firme</b>
          <em>Ostaje u sistemu, pa može biti vezan za drugu firmu.</em>
        </span>
      </div>
    </div>

    <TintAlert v-if="error" tone="bad" role="alert" title="Ne mogu da uklonim">{{ error }}</TintAlert>

    <template #footer>
      <AppButton variant="danger" submit :loading="saving">
        {{ saving ? "Uklanjam…" : "Ukloni kurira" }}
      </AppButton>
      <AppButton variant="ghost" data-field="cancel" @click="emit('update:open', false)">Odustani</AppButton>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { useSheetDraft } from "~/composables/useSheetDraft";
import { useSheetSave } from "~/composables/useSheetSave";
import type { ActionResult } from "~/composables/useCourierRoster";
import { liveOf, type RosterCourier } from "~/utils/courierRoster";
import { formatAmount } from "~/utils/currency";

// List "Ukloni sa liste firme": objašnjava tri nivoa (suspenzija je privremena, uklanjanje skida
// kurira sa liste ove firme, brisanje naloga je van ovog ekrana) i upozorava na dug i dostavu u
// toku. Opasna radnja nikad nije prva u fokusu: fokus je na "Odustani".
const props = defineProps<{
  open: boolean;
  courier: RosterCourier;
  now: number;
  currency: string;
  remove: () => Promise<ActionResult>;
}>();

const emit = defineEmits<{ "update:open": [value: boolean]; removed: [] }>();

const sheet = ref<InstanceType<typeof AppSheet> | null>(null);

const { saving, submitted, error, serverFields } = useSheetDraft(toRef(props, "open"), () => ({}));

const delivering = computed(() => liveOf(props.courier, props.now) === "delivering");

const submit = useSheetSave({
  sheet,
  saving,
  submitted,
  error,
  serverFields,
  ready: () => true,
  run: () => props.remove(),
  success: "Kurir je uklonjen sa liste firme.",
  onDone: () => emit("removed"),
});
</script>

<style scoped>
.rm-grp {
  display: grid;
  overflow: hidden;
  border: 1px solid #eceef2;
  border-radius: 14px;
}

.rm-row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
}

.rm-row + .rm-row {
  border-top: 1px solid #eceef2;
}

.rm-row span:last-child {
  display: grid;
  gap: 1px;
}

.rm-ic {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
}

.rm-ic.warn {
  background: #fff2df;
  color: #9a4a07;
}

.rm-ic.bad {
  background: #fde8e6;
  color: #b42318;
}

.rm-row small {
  font-size: 0.76rem;
  font-weight: 700;
  color: #5b6676;
}

.rm-row b {
  font-size: 0.98rem;
}

.rm-row em {
  font-size: 0.8rem;
  font-style: normal;
  color: #5b6676;
}
</style>
