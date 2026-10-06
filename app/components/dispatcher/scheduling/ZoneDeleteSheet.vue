<template>
  <AppSheet :open="open" :title="`Obrisati zonu ${zone?.name ?? ''}?`" :subtitle="`Grad ${city}`" @update:open="emit('update:open', $event)">
    <div class="zx-rows" aria-live="polite">
      <div class="zx-row">
        <span class="zx-a">Smjene u ovoj firmi<small>od danas do {{ dayLong(endIso) }}</small></span>
        <span v-if="loading" class="zx-sk" />
        <ShiftPill v-else-if="shiftCount != null" :tone="shiftCount ? 'warn' : 'ok'">{{ smjena(shiftCount) }}</ShiftPill>
        <ShiftPill v-else tone="idle">nepoznato</ShiftPill>
      </div>
      <div class="zx-row">
        <span class="zx-a">Pravila za vozila<small>Cjenovnik, Vozila i pravila</small></span>
        <span v-if="loading" class="zx-sk" />
        <ShiftPill v-else-if="ruleCount != null" :tone="ruleCount ? 'warn' : 'ok'">{{ ruleCount }}</ShiftPill>
        <ShiftPill v-else tone="idle">nepoznato</ShiftPill>
      </div>
    </div>

    <TintAlert v-if="failed" tone="warn" role="alert" title="Nisam uspio da provjerim šta zona drži">
      Brisanje je i dalje moguće, ali se ne zna koliko smjena i pravila koristi zonu. Server može odbiti brisanje.
    </TintAlert>
    <TintAlert tone="info" title="Zone pripadaju gradu, ne firmi">
      Brisanje važi i za druge firme u gradu. Šta server radi sa smjenama i pravilima koja koriste zonu, nije potvrđeno.
    </TintAlert>

    <template #footer>
      <div class="zx-two">
        <AppButton variant="ghost" data-autofocus data-field="zd-cancel" @click="emit('update:open', false)">Odustani</AppButton>
        <AppButton variant="danger" :loading="saving" data-field="zd-do" @click="emit('confirm')">Obriši zonu</AppButton>
      </div>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import ShiftPill from "~/components/dispatcher/scheduling/ShiftPill.vue";
import { smjena } from "~/composables/useShiftBatch";
import { fetchVehicleRules } from "~/services/vehicleRulesService";
import { fetchShiftTemplates } from "~/services/shiftTemplatesService";
import { addDays, dayLong, iso, parseIso, type Clock } from "~/utils/schedule";
import type { GeoZone } from "~/utils/zoneGeo";

// Brisanje zone: prije potvrde kaže šta zona drži - koliko smjena ove firme u narednih 28 dana i koliko pravila za
// vozila je koristi (jedan poziv za smjene te zone i jedan za pravila). Zone pripadaju gradu, pa brisanje važi i
// za druge firme u gradu; šta server radi sa smjenama i pravilima nije potvrđeno. Ako provjera padne, brisanje
// ostaje moguće uz upozorenje.
const DAYS = 28;

const props = defineProps<{
  open: boolean;
  zone: GeoZone | null;
  city: string;
  companyId: number | null;
  now: Clock;
  saving: boolean;
}>();

const emit = defineEmits<{ "update:open": [value: boolean]; confirm: [] }>();

const loading = ref(false);
const failed = ref(false);
const shiftCount = ref<number | null>(null);
const ruleCount = ref<number | null>(null);

const endIso = computed(() => iso(addDays(parseIso(props.now.date), DAYS - 1)));

let seq = 0;
watch(
  () => [props.open, props.zone?.id] as const,
  async ([open]) => {
    if (!open || !props.zone || !props.companyId) return;
    const mine = ++seq;
    const zoneId = props.zone.id;
    loading.value = true;
    failed.value = false;
    shiftCount.value = null;
    ruleCount.value = null;
    const [shifts, rules] = await Promise.allSettled([
      fetchShiftTemplates(props.companyId, props.now.date, endIso.value, zoneId),
      fetchVehicleRules(props.companyId),
    ]);
    if (mine !== seq) return;
    if (shifts.status === "fulfilled") shiftCount.value = shifts.value.filter((s) => s.zone.id === zoneId || !s.zone.id).length;
    if (rules.status === "fulfilled") ruleCount.value = rules.value.filter((r) => r.zone_id === zoneId).length;
    failed.value = shifts.status === "rejected" || rules.status === "rejected";
    loading.value = false;
  },
  { immediate: true }
);
</script>

<style scoped>
.zx-rows {
  display: grid;
  overflow: hidden;
  border: 1px solid #eceef2;
  border-radius: 14px;
}

.zx-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 8px 12px;
}

.zx-row + .zx-row {
  border-top: 1px solid #eceef2;
}

.zx-a {
  font-weight: 800;
}

.zx-a small {
  display: block;
  font-size: 0.76rem;
  font-weight: 600;
  color: #5b6676;
}

.zx-sk {
  width: 72px;
  height: 26px;
  border-radius: 999px;
  background: #eceef2;
}

.zx-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.zx-two :deep(.ab) {
  min-height: 52px;
}
</style>
