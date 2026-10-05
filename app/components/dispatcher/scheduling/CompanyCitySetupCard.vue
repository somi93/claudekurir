<template>
  <v-card class="set-city-card mb-4" flat>
    <p class="set-city-title">Ova firma nema podešen grad</p>
    <p class="set-city-copy">
      Zone se vezuju za grad firme - unesi ID grada da bi mogao/la da praviš zone i smjene za ovu
      firmu.
    </p>
    <div class="set-city-row">
      <GlobalTextField
        v-model.number="cityIdDraft"
        label="ID grada"
        type="number"
        density="compact"
        hide-details
        class="set-city-field"
      />
      <GlobalButtonPrimary :loading="saving" :disabled="!cityIdDraft" @click="onSave">
        Sačuvaj grad
      </GlobalButtonPrimary>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";

defineProps<{
  saving: boolean;
}>();

const emit = defineEmits<{
  save: [cityId: number];
}>();

const cityIdDraft = ref<number | null>(null);

const onSave = () => {
  if (!cityIdDraft.value) return;
  emit("save", cityIdDraft.value);
};
</script>

<style scoped>
.set-city-card {
  border-radius: 20px;
  padding: 16px 18px;
  background: #fff4e0;
  border: 1px solid #f0d9a8;
}

.set-city-title {
  margin: 0 0 4px;
  font-weight: 800;
}

.set-city-copy {
  margin: 0 0 12px;
  font-size: 0.85rem;
  color: #6b7685;
}

.set-city-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.set-city-field {
  max-width: 200px;
}
</style>
