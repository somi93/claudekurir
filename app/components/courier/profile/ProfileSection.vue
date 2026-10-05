<template>
  <section class="ps" :aria-labelledby="uid">
    <h2 :id="uid" class="ps-eyebrow">{{ title }}</h2>
    <div class="ps-list"><slot /></div>
    <p v-if="$slots.foot" class="ps-foot"><slot name="foot" /></p>
    <slot name="after" />
  </section>
</template>

<script setup lang="ts">
import { useId } from "vue";

// Grupa redova na ekranu Profil: sitan naslov iznad (kontrast 5.4 : 1, danas 2.33 : 1), bijela
// kartica sa radijusom 20 i sjenkom kao u Porukama i Novčaniku, opciona napomena ispod (`foot`)
// i sadržaj izvan kartice (`after`, npr. dugme Odjavi se).
defineProps<{ title: string }>();

const uid = `ps-${useId()}`;
</script>

<style scoped>
.ps {
  display: grid;
  gap: 8px;
}

.ps-eyebrow {
  margin: 0;
  padding: 0 4px;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #5b6676;
}

.ps-list {
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.ps-foot {
  margin: 0;
  padding: 0 4px;
  font-size: 0.78rem;
  line-height: 1.45;
  color: #5b6676;
}
</style>
