<template>
  <div class="ss">
    <div v-for="row in rows" :key="row.label" class="ss-r">
      <span>{{ row.label }}</span>
      <b>{{ row.value }}</b>
    </div>
  </div>
</template>

<script setup lang="ts">
// Sažetak posljedice u listu: red "labela ... vrijednost" ("Dug kurira sada", "Dug poslije potvrde").
defineProps<{ rows: { label: string; value: string }[] }>();
</script>

<style scoped>
.ss {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f5f6f8;
  font-size: 0.86rem;
  color: #5b6676;
}

.ss-r {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.ss-r b {
  color: #0b1220;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
