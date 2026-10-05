<template>
  <v-card class="draft-card" flat>
    <p class="draft-title">{{ draft.id ? "Izmijeni zonu" : "Nova zona" }}</p>

    <v-form ref="formRef" class="draft-form" @submit.prevent="submit">
      <GlobalTextField
        v-model="draft.name"
        label="Naziv zone"
        :rules="[rules.required()]"
        hide-details="auto"
      />

      <GlobalSelect
        v-if="cities.length > 0"
        v-model="draft.cityId"
        label="Grad"
        :items="cities"
        item-title="title"
        item-value="value"
        :rules="[rules.required()]"
        hide-details="auto"
      />
      <GlobalTextField
        v-else
        v-model.number="draft.cityId"
        label="ID grada"
        type="number"
        hint="Nijedna od tvojih firmi još nema podešen grad, pa nema liste - unesi ID ručno."
        persistent-hint
        :rules="[rules.required(), rules.positiveInteger()]"
      />

      <GlobalTextField
        v-model.number="draft.terrainFactor"
        label="Faktor terena"
        type="number"
        step="0.1"
        :rules="[rules.required(), rules.positiveNumber()]"
        hint="1.0 = ravnica, veći broj = brdovitiji teren (npr. 1.5 za umjereno brdo)"
        persistent-hint
      />

      <div class="coords-fields">
        <GlobalTextField
          v-model.number="draft.centerLat"
          label="Geografska širina"
          type="number"
          step="0.00001"
          :rules="[rules.required(), rules.range(-90, 90)]"
          hide-details="auto"
          @blur="emit('coords-input')"
        />
        <GlobalTextField
          v-model.number="draft.centerLng"
          label="Geografska dužina"
          type="number"
          step="0.00001"
          :rules="[rules.required(), rules.range(-180, 180)]"
          hide-details="auto"
          @blur="emit('coords-input')"
        />
      </div>

      <div class="radius-field">
        <p class="radius-label">Radijus: {{ draft.radiusMeters }} m</p>
        <v-slider
          v-model="draft.radiusMeters"
          :min="100"
          :max="5000"
          :step="50"
          color="primary"
          hide-details
        />
      </div>

      <p class="coords-hint">Klikni na mapu da pomjeriš centar zone.</p>

      <div class="draft-actions">
        <v-btn class="draft-btn" variant="text" :disabled="saving" @click="emit('cancel')"
          >Otkaži</v-btn
        >
        <GlobalButtonPrimary class="draft-btn" type="submit" :loading="saving">Sačuvaj</GlobalButtonPrimary>
      </div>
    </v-form>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import { useValidationRules } from "~/composables/useValidationRules";
import type { VForm } from "vuetify/components";

export type ZoneDraftState = {
  id: number | null;
  cityId: number | null;
  name: string;
  terrainFactor: number;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
};

defineProps<{
  saving: boolean;
  cities: { title: string; value: number }[];
}>();

const emit = defineEmits<{
  save: [];
  cancel: [];
  "coords-input": [];
}>();

const draft = defineModel<ZoneDraftState>("draft", { required: true });

const rules = useValidationRules();
const formRef = ref<InstanceType<typeof VForm> | null>(null);

const submit = async () => {
  const { valid } = (await formRef.value?.validate()) ?? { valid: false };
  if (!valid) return;
  emit("save");
};
</script>

<style scoped>
.draft-card {
  border-radius: 24px;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
  padding: 20px;
}

@media (max-width: 600px) {
  .draft-card {
    padding: 16px;
  }
}

.draft-title {
  margin: 0 0 14px;
  font-weight: 800;
  font-size: 1.05rem;
  color: #0b1220;
}

.draft-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.coords-fields {
  display: flex;
  gap: 12px;
}

.coords-fields > * {
  flex: 1;
  min-width: 0;
}

.radius-field {
  margin-top: -4px;
}

.radius-label {
  margin: 0 0 4px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #0b1220;
}

.coords-hint {
  margin: -4px 0 0;
  font-size: 0.78rem;
  color: #9aa4b2;
}

.draft-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
  padding-top: 14px;
  border-top: 1px solid #e7e9ee;
}

@media (max-width: 480px) {
  .draft-actions {
    flex-direction: column-reverse;
  }

  .draft-btn {
    width: 100%;
  }
}
</style>
