<template>
  <AppSheet :open="open" title="Izaberi kurira" subtitle="Promet se prikazuje samo za njega" focus="query" @update:open="emit('update:open', $event)">
    <SheetField v-model="query" name="query" label="Pretraga" type="search" placeholder="Ime, telefon ili #ID" enterkeyhint="search" />
    <div class="cp-list" role="group" aria-label="Kuriri">
      <button type="button" class="cp-row" :aria-current="current == null ? 'true' : undefined" data-pick="all" @click="emit('pick', null)">
        <span class="cp-av cp-av--ink" aria-hidden="true"><v-icon icon="mdi-account-group-outline" size="20" /></span>
        <span class="cp-tx"><b>Svi kuriri</b></span>
      </button>
      <button
        v-for="r in list"
        :key="r.id"
        type="button"
        class="cp-row"
        :aria-current="current === r.id ? 'true' : undefined"
        :data-pick="r.id"
        @click="emit('pick', r.id)"
      >
        <span class="cp-av" aria-hidden="true">{{ r.initials }}</span>
        <span class="cp-tx">
          <b>{{ r.name }}</b>
          <small>#{{ r.id }}</small>
        </span>
      </button>
      <div v-if="list.length === 0" class="cp-none"><b>Nema kurira za pretragu</b></div>
    </div>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppSheet from "~/components/common/AppSheet.vue";
import SheetField from "~/components/common/SheetField.vue";
import { fold, type CashRow } from "~/utils/cashDesk";
import { matchCourier } from "~/utils/courierRoster";

// List za izbor kurira kojem se Promet ograničava: pretraga kao na Kuriri (ime sa i bez dijakritika,
// ćirilica, telefon, #ID); bez upita su kuriri abecedno, najviše 40.
const props = defineProps<{ open: boolean; rows: CashRow[]; current: number | null }>();
const emit = defineEmits<{ "update:open": [value: boolean]; pick: [id: number | null] }>();

const query = ref("");
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) query.value = "";
  }
);

const list = computed(() => {
  const q = query.value.trim();
  const all = q ? props.rows.filter((r) => matchCourier(r, q)) : props.rows.slice().sort((a, b) => fold(a.name).localeCompare(fold(b.name), "sr"));
  return all.slice(0, 40);
});
</script>

<style scoped>
.cp-list {
  display: grid;
  gap: 2px;
}

.cp-row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  min-height: 56px;
  padding: 8px 10px;
  border: 0;
  border-radius: 12px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.cp-row:active {
  background: #f1f4f9;
}

.cp-row[aria-current="true"] {
  background: #eef4ff;
  box-shadow: inset 0 0 0 2px #2f6fed;
}

.cp-row:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.cp-av {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #eceff3;
  color: #2a3342;
  font-size: 0.8rem;
  font-weight: 800;
}

.cp-av--ink {
  background: #0b1220;
  color: #fff;
}

.cp-tx {
  display: grid;
  min-width: 0;
}

.cp-tx b {
  overflow: hidden;
  font-size: 0.92rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cp-tx small {
  font-size: 0.78rem;
  font-weight: 600;
  color: #5b6676;
  font-variant-numeric: tabular-nums;
}

.cp-none {
  padding: 18px;
  text-align: center;
  color: #5b6676;
}
</style>
