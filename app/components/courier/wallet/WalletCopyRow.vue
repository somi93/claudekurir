<template>
  <div class="dt-code">
    <span>{{ label }}</span>
    <b>{{ value }}</b>
    <button type="button" class="dt-copy" @click="copy">
      <v-icon icon="mdi-content-copy" size="16" />
      {{ copied ? "Kopirano" : "Kopiraj" }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { copyText } from "~/utils/clipboard";

// Broj predaje / referenca isplate sa dugmetom za kopiranje: kurir ga šalje dispečeru kad iznos
// nije tačan.
const props = defineProps<{ label: string; value: string }>();

const copied = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

const copy = async () => {
  if (!(await copyText(props.value))) return;
  copied.value = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => (copied.value = false), 1600);
};

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>

<style scoped>
.dt-code {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: #f5f6f8;
  font-size: 0.84rem;
  color: #5b6676;
}

.dt-code > span {
  flex: none;
}

.dt-code b {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.84rem;
  letter-spacing: 0.02em;
  color: #0b1220;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dt-copy {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 13px;
  border: 1.5px solid #dfe3ea;
  border-radius: 999px;
  background: #fff;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;
  color: #0b1220;
  cursor: pointer;
}

.dt-copy:active {
  background: #f1f4f9;
}

.dt-copy:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}
</style>
