<template>
  <div class="group-header" :class="{ aligned }">
    <div class="group-label">
      <!-- "Izaberi sve" za grupu: tri stanja (sve / neki / niko). -->
      <v-checkbox
        v-if="selection"
        class="select-all"
        :model-value="selection.all"
        :indeterminate="selection.some"
        :disabled="selection.disabled"
        density="compact"
        hide-details
        title="Izaberi sve u ovoj grupi"
        @update:model-value="emit('toggle-all')"
      />
      <span class="n">{{ number }}</span>
      <span class="title">{{ title }}</span>
      <span class="tag">{{ count }} od {{ total }} kandidata</span>
    </div>
    <div v-if="hint" class="group-hint">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
// Zaglavlje sekcije kandidata - isto u "Listi" i u "Toku" (numerisan krug,
// naziv grupe, koliko ih je od ukupnog broja, opcioni pojašnjavajući tekst i
// opcioni "izaberi sve" checkbox).
defineProps<{
  number: number;
  title: string;
  count: number;
  total: number;
  hint?: string;
  // Stanje "izaberi sve" checkboxa; bez njega checkbox se ne prikazuje.
  selection?: { all: boolean; some: boolean; disabled: boolean } | null;
  // Uvlači zaglavlje da checkbox stoji u koloni sa checkboxovima redova ("Lista").
  aligned?: boolean;
}>();

const emit = defineEmits<{ "toggle-all": [] }>();
</script>

<style scoped>
/* Isto uvlačenje kao red liste (1px okvir + 16px padding), da "izaberi sve"
   stoji tačno iznad checkboxova redova. */
.group-header.aligned {
  padding-left: 17px;
}

.group-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  color: #9aa2b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 10px;
}
.group-label .select-all {
  flex: none;
}
.group-label .n {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid #d3d7e2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  font-size: 10px;
  color: #6b7685;
}
.group-label .title {
  color: #6b7685;
}
.group-label .tag {
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  color: #9aa2b8;
}
.group-hint {
  font-size: 11px;
  color: #9aa2b8;
  margin-top: 2px;
}
</style>
