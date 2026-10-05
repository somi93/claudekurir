<template>
  <div class="hf-wrap">
    <div class="hf">
      <label class="hf-search">
        <v-icon icon="mdi-magnify" size="22" />
        <input
          :value="modelValue"
          type="text"
          inputmode="search"
          enterkeyhint="search"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="Restoran, ulica ili #broj"
          aria-label="Pretraga dostava"
          @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
        <button
          v-if="modelValue"
          type="button"
          class="hf-x"
          aria-label="Očisti pretragu"
          @click.prevent="emit('update:modelValue', '')"
        >
          <v-icon icon="mdi-close" size="18" />
        </button>
      </label>

      <v-menu v-model="menuOpen" location="bottom end" :offset="6">
        <template #activator="{ props: menuProps }">
          <button
            v-bind="menuProps"
            type="button"
            class="hf-sort"
            :class="{ 'hf-sort--on': sort !== 'new' || menuOpen }"
            aria-label="Sortiranje"
          >
            <v-icon icon="mdi-sort" size="24" />
          </button>
        </template>
        <div class="hf-menu" role="menu" aria-label="Sortiranje">
          <button
            v-for="option in sortOptions"
            :key="option.value"
            type="button"
            class="hf-item"
            role="menuitemradio"
            :aria-checked="sort === option.value"
            @click="pick(option.value)"
          >
            <v-icon icon="mdi-check" size="18" class="hf-check" />
            {{ option.label }}
          </button>
        </div>
      </v-menu>
    </div>

    <div v-if="bucketLabel || result" class="hf-active">
      <span v-if="bucketLabel" class="hf-tag">
        {{ bucketLabel }}
        <button type="button" aria-label="Poništi izbor" @click="emit('clear-bucket')">
          <v-icon icon="mdi-close" size="16" />
        </button>
      </span>
      <span v-if="result" class="hf-result" aria-live="polite">
        <b>{{ deliveriesLabel(result.count) }}</b
        ><template v-if="result.wage != null"> · +{{ money(result.wage) }} KM</template>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  deliveriesLabel,
  money,
  type HistorySort,
} from "~/utils/historyGroups";

// Pretraga (restoran, ulica, grad, #broj - bez dijakritika), sortiranje i red sa
// onim što je trenutno suženo: izabrani stubić i rezultat ("3 dostave · +6.00 KM").
defineProps<{
  modelValue: string;
  sort: HistorySort;
  sortOptions: { value: HistorySort; label: string }[];
  // Naziv izabranog stubića (ili null).
  bucketLabel: string | null;
  // Koliko je dostava ostalo kad je lista sužena (ili null kad nije).
  result: { count: number; wage: number | null } | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "update:sort": [value: HistorySort];
  "clear-bucket": [];
}>();

const menuOpen = ref(false);

const pick = (value: HistorySort) => {
  menuOpen.value = false;
  emit("update:sort", value);
};
</script>

<style scoped>
.hf-wrap {
  display: grid;
  gap: 12px;
}

.hf {
  display: flex;
  gap: 8px;
}

.hf-search {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 6px 0 14px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 8px 20px rgba(11, 18, 32, 0.05);
}

.hf-search :deep(.v-icon) {
  color: #657083;
}

.hf-search:focus-within {
  box-shadow: 0 0 0 2px #2f6fed;
}

.hf-search input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  background: none;
  font: inherit;
  font-size: 0.95rem;
  color: #0b1220;
}

.hf-search input::placeholder {
  color: #657083;
  opacity: 1;
}

.hf-x {
  flex: none;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: none;
  color: #657083;
  cursor: pointer;
}

.hf-x:active {
  background: #eceff3;
}

.hf-x:focus-visible {
  outline: 2px solid #2f6fed;
}

.hf-sort {
  flex: none;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 0;
  border-radius: 14px;
  background: #fff;
  color: #0b1220;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 8px 20px rgba(11, 18, 32, 0.05);
}

.hf-sort--on {
  color: #2459c7;
  box-shadow: 0 0 0 2px #2f6fed;
}

.hf-sort:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.hf-menu {
  min-width: 210px;
  padding: 6px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 12px 32px rgba(11, 18, 32, 0.2), 0 1px 2px rgba(11, 18, 32, 0.08);
}

.hf-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 12px;
  border: 0;
  border-radius: 10px;
  background: none;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  color: #0b1220;
  text-align: left;
  cursor: pointer;
}

.hf-item:hover,
.hf-item:focus-visible {
  background: #f3f5f8;
  outline: none;
}

.hf-item[aria-checked="true"] {
  color: #2459c7;
  font-weight: 800;
}

.hf-check {
  visibility: hidden;
}

.hf-item[aria-checked="true"] .hf-check {
  visibility: visible;
}

.hf-active {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.hf-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 32px;
  padding: 0 4px 0 12px;
  border-radius: 999px;
  background: #eef4ff;
  color: #2459c7;
  font-size: 0.8rem;
  font-weight: 700;
}

.hf-tag button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: none;
  color: inherit;
  cursor: pointer;
}

.hf-tag button:focus-visible {
  outline: 2px solid #2f6fed;
}

.hf-result {
  font-size: 0.8rem;
  color: #5b6676;
  font-variant-numeric: tabular-nums;
}

.hf-result b {
  color: #0b1220;
}
</style>
