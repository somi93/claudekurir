<template>
  <FormDialog
    v-model:open="open"
    title="Pozovi prijatelja"
    :saving="saving"
    save-text="Dodaj"
    max-width="380"
    @save="submit"
  >
    <GlobalTextField
      v-model="friendName"
      label="Ime prijatelja"
      prepend-inner-icon="mdi-account-outline"
      :rules="[rules.required()]"
      hide-details="auto"
    />
  </FormDialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import FormDialog from "~/components/common/FormDialog.vue";
import { useValidationRules } from "~/composables/useValidationRules";

defineProps<{ saving: boolean }>();
const emit = defineEmits<{ save: [name: string] }>();

const open = defineModel<boolean>("open", { required: true });

const rules = useValidationRules();
const friendName = ref("");

watch(open, (isOpen) => {
  if (isOpen) friendName.value = "";
});

const submit = () => emit("save", friendName.value.trim());
</script>
