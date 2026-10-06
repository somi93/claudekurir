<template>
  <AppSheet :open="open" title="Uključiti provjeru dostupnosti?" subtitle="Dodjela samo potvrđenim kuririma" @update:open="emit('update:open', $event)">
    <p class="en-p">Od sada sistem dodjeljuje narudžbe samo kuririma koji su trenutno potvrđeni po rasporedu.</p>
    <TintAlert v-if="state !== 'ok'" tone="warn" title="Procjenu ne mogu da izračunam">
      Smjene nisu učitane, pa se ne zna koliko je kurira sada potvrđeno. Uključi samo ako to znaš.
    </TintAlert>
    <EnforceImpact v-else :impact="impact" />

    <template #footer>
      <div class="en-two">
        <AppButton variant="ghost" :data-autofocus="zero || undefined" data-field="enf-cancel" @click="emit('update:open', false)">
          Ne uključuj
        </AppButton>
        <AppButton
          :variant="zero ? 'danger' : 'primary'"
          :loading="saving"
          :data-autofocus="!zero || undefined"
          data-field="enf-do"
          @click="emit('confirm')"
        >
          {{ zero ? "Ipak uključi" : "Uključi" }}
        </AppButton>
      </div>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import EnforceImpact from "~/components/dispatcher/scheduling/EnforceImpact.vue";
import type { EnforceImpact as Impact } from "~/utils/schedule";

// Potvrda pri uključivanju provjere dostupnosti: procjena iz smjena koje sada traju. Ako nijedan kurir nije potvrđen,
// uključivanje je crveno ("Ipak uključi") i fokus je na "Ne uključuj", jer firma tada ne bi mogla da dodijeli nijednu
// narudžbu. Isključivanje je odmah, bez potvrde.
const props = defineProps<{ open: boolean; impact: Impact; state: "loading" | "error" | "ok"; saving: boolean }>();
const emit = defineEmits<{ "update:open": [value: boolean]; confirm: [] }>();

const zero = computed(() => props.state === "ok" && props.impact.level === "zero");
</script>

<style scoped>
.en-p {
  margin: 0;
  font-size: 0.9rem;
  color: #5b6676;
}

.en-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.en-two :deep(.ab) {
  min-height: 52px;
}
</style>
