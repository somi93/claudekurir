<template>
  <span class="pc" :class="`is-${tone}`"><slot /></span>
</template>

<script setup lang="ts">
// Čip sa stanjem uz red (npr. "Radi", "Privremena"): stanje je u riječi, ne samo u boji.
withDefaults(defineProps<{ tone?: "neutral" | "ok" | "warn" | "bad" }>(), { tone: "neutral" });
</script>

<style scoped>
.pc {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: #eceff3;
  color: #5b6676;
  font-size: 0.74rem;
  font-weight: 800;
  white-space: nowrap;
}

.pc.is-ok {
  background: #e3f8ef;
  color: #00734f;
}

.pc.is-warn {
  background: #fff2df;
  color: #9a4a07;
}

.pc.is-bad {
  background: #fde8e6;
  color: #b42318;
}
</style>
