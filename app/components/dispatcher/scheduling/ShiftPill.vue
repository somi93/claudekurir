<template>
  <span class="sp" :class="`sp--${tone}`"><v-icon v-if="icon" :icon="icon" size="14" /><slot /></span>
</template>

<script setup lang="ts">
// Oznaka stanja (status smjene, stanje zone, broj smjena): tamni tekst na blagom tonu, uvijek sa riječju,
// nikad samo boja.
defineProps<{ tone: "bad" | "warn" | "ok" | "blue" | "idle"; icon?: string }>();
</script>

<style scoped>
.sp {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 800;
  white-space: nowrap;
}

.sp--bad {
  background: #fde8e6;
  color: #9a1b11;
}

.sp--warn {
  background: #fff2df;
  color: #8f4406;
}

.sp--ok {
  background: #e3f8ef;
  color: #04694a;
}

.sp--blue {
  background: #eef4ff;
  color: #2459c7;
}

.sp--idle {
  background: #eceff3;
  color: #46505f;
}
</style>
