<template>
  <v-dialog
    :model-value="open"
    :max-width="maxWidth"
    @update:model-value="emit('update:open', $event)"
  >
    <v-card class="dialog-card" rounded="lg">
      <v-card-title class="dialog-title pa-0">
        <span class="dialog-title-text"><slot name="title">{{ title }}</slot></span>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          class="dialog-close"
          aria-label="Zatvori"
          :disabled="saving"
          @click="emit('update:open', false)"
        />
      </v-card-title>
      <v-form
        v-if="!hideActions"
        ref="formRef"
        class="dialog-body"
        @submit.prevent="onSubmit"
      >
        <slot />
        <div class="dialog-actions">
          <slot name="actions">
            <v-btn variant="text" :disabled="saving" @click="emit('update:open', false)">
              {{ cancelText }}
            </v-btn>
            <GlobalButtonPrimary type="submit" :loading="saving">{{
              resolvedSaveText
            }}</GlobalButtonPrimary>
          </slot>
        </div>
      </v-form>

      <div v-else class="dialog-body dialog-body--plain">
        <slot />
        <div v-if="$slots.actions" class="dialog-actions">
          <slot name="actions" />
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import type { VForm } from "vuetify/components";

// Zajednička "školjka" za sve dijaloge u aplikaciji - v-dialog/v-card/naslov/
// forma/dugmad na jednom mestu, umesto da se to duplira po svakoj stranici.
// Dva režima:
// - podrazumevani: <v-form> + validate-pre-save + Sačuvaj/Ažuriraj dugme
//   (add/edit dijalozi)
// - hideActions: bez forme/validacije, poziva ubacuje potpuno svoje dugmad
//   preko #actions slota (detalji-prikaz dijalozi, npr. "Obriši"/"Izmeni")
const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    saving?: boolean;
    editing?: boolean;
    saveText?: string;
    cancelText?: string;
    maxWidth?: string | number;
    hideActions?: boolean;
  }>(),
  {
    saving: false,
    editing: false,
    saveText: undefined,
    cancelText: "Otkaži",
    maxWidth: 440,
    hideActions: false,
  }
);

const emit = defineEmits<{
  "update:open": [value: boolean];
  save: [];
}>();

const formRef = ref<InstanceType<typeof VForm> | null>(null);

// "od zavisnosti od tipa" - editing=true prebacuje default tekst na
// Ažuriraj umesto Sačuvaj, osim ako pozivalac eksplicitno zada saveText
// (npr. "Kopiraj", "Zatraži").
const resolvedSaveText = computed(
  () => props.saveText ?? (props.editing ? "Ažuriraj" : "Sačuvaj")
);

const onSubmit = async () => {
  const { valid } = (await formRef.value?.validate()) ?? { valid: false };
  if (valid) emit("save");
};
</script>

<style scoped>
.dialog-card {
  padding: 22px;
}

.dialog-title {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 1.1rem;
  margin-bottom: 16px;
  white-space: normal;
}

.dialog-title-text {
  flex: 1 1 auto;
  min-width: 0;
  line-height: 1.4;
}

.dialog-close {
  flex: 0 0 auto;
  margin: -4px -6px 0 0;
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dialog-body--plain {
  gap: 0;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
</style>
