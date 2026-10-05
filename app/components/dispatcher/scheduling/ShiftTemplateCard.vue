<template>
  <div
    class="shift-chip"
    :class="`shift-chip--${template.status}`"
    role="button"
    tabindex="0"
    :aria-label="cardLabel"
    :title="detailText"
    @click="emit('edit', template)"
    @keyup.enter="emit('edit', template)"
  >
    <div class="chip-top">
      <span class="chip-time">{{ template.startTime }}–{{ template.endTime }}</span>
      <v-icon
        v-if="template.highDemand"
        icon="mdi-fire"
        size="14"
        color="warning"
        title="Hitna smjena"
        class="chip-fire"
      />
      <GlobalButtonDelete
        size="x-small"
        :iconSize="15"
        class="chip-del"
        ariaLabel="Obriši smjenu"
        :disabled="saving"
        @click.stop="emit('delete', template)"
      />
    </div>

    <span v-if="!hideZone" class="chip-zone">{{ zoneName }}</span>

    <div class="chip-bottom">
      <span class="chip-count">
        <strong>{{ template.currentBookings }}</strong
        >/{{ template.targetCouriers }}
      </span>
      <span class="chip-status">
        <i class="chip-dot" aria-hidden="true" />{{ statusMeta.label }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ShiftTemplate, ShiftTemplateStatus } from "~/types/shiftTemplate";
import GlobalButtonDelete from "~/components/common/GlobalButtonDelete.vue";

const props = withDefaults(
  defineProps<{
    template: ShiftTemplate;
    saving: boolean;
    // U rota tabeli red već nosi ime zone, pa ga na čipu skrivamo.
    hideZone?: boolean;
  }>(),
  { hideZone: false }
);

const emit = defineEmits<{
  edit: [template: ShiftTemplate];
  delete: [template: ShiftTemplate];
}>();

const STATUS_META: Record<ShiftTemplateStatus, { color: string; label: string }> = {
  understaffed: { color: "#e5484d", label: "Ispod minimuma" },
  below_target: { color: "#f5a524", label: "Ispod cilja" },
  target_reached: { color: "#30a46c", label: "Cilj dostignut" },
  full: { color: "#2f6fed", label: "Popunjeno" },
};

const FALLBACK_STATUS_META = { color: "#9aa4b2", label: "Nepoznat status" };

const statusMeta = computed(
  () => STATUS_META[props.template.status] ?? FALLBACK_STATUS_META
);

const zoneName = computed(() => toLatin(props.template.zone?.name ?? ""));

const detailText = computed(() => {
  const t = props.template;
  const range =
    t.maxCouriers !== null
      ? `min ${t.minCouriers} · cilj ${t.targetCouriers} · maks ${t.maxCouriers}`
      : `min ${t.minCouriers} · cilj ${t.targetCouriers}`;
  return `${range} kurira`;
});

// Čitač ekrana inače pročita samo "dugme" - dajemo mu zonu, vrijeme,
// popunjenost i status u jednoj rečenici.
const cardLabel = computed(() => {
  const t = props.template;
  return (
    `Smjena ${zoneName.value || "bez zone"}, ${t.startTime}–${t.endTime}. ` +
    `${t.currentBookings} od ${t.targetCouriers} kurira. ${statusMeta.value.label}.`
  );
});
</script>

<style scoped>
.shift-chip {
  --status-color: #9aa4b2;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px 7px;
  border: 1px solid #e5e7eb;
  border-left: 3px solid var(--status-color);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}

.shift-chip--understaffed {
  --status-color: #e5484d;
}
.shift-chip--below_target {
  --status-color: #f5a524;
}
.shift-chip--target_reached {
  --status-color: #30a46c;
}
.shift-chip--full {
  --status-color: #2f6fed;
}

.shift-chip:hover {
  border-color: #cbd2da;
  border-left-color: var(--status-color);
  box-shadow: 0 3px 10px rgba(11, 18, 32, 0.08);
}

.shift-chip:focus-visible {
  outline: 2px solid #2f6fed;
  outline-offset: 2px;
}

.chip-top {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 18px;
}

.chip-time {
  flex: 1;
  min-width: 0;
  font-weight: 700;
  font-size: 0.78rem;
  color: #0b1220;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip-fire {
  flex-shrink: 0;
}

.chip-del {
  flex-shrink: 0;
  margin: -2px -4px 0 0;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.shift-chip:hover .chip-del,
.shift-chip:focus-within .chip-del {
  opacity: 1;
}

@media (hover: none) {
  .chip-del {
    opacity: 1;
  }
}

.chip-zone {
  font-size: 0.72rem;
  font-weight: 600;
  color: #6b7685;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip-bottom {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 1px;
}

.chip-count {
  font-size: 0.74rem;
  color: #6b7685;
}

.chip-count strong {
  font-size: 0.95rem;
  color: #0b1220;
}

.chip-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.62rem;
  font-weight: 700;
  color: #6b7685;
  line-height: 1.3;
}

.chip-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--status-color);
}

.shift-chip--understaffed .chip-status {
  color: #d1383d;
}
.shift-chip--below_target .chip-status {
  color: #b26a00;
}
.shift-chip--target_reached .chip-status {
  color: #1f8f5f;
}
.shift-chip--full .chip-status {
  color: #2f6fed;
}
</style>
