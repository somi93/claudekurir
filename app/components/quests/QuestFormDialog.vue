<template>
  <FormDialog
    v-model:open="open"
    :title="quest ? 'Izmeni kvest' : 'Dodaj kvest'"
    :saving="saving"
    :editing="!!quest"
    @save="submit"
  >
    <GlobalTextField
      v-model="form.title"
      label="Naslov"
      prepend-inner-icon="mdi-flag-outline"
      :rules="[rules.required()]"
      hide-details="auto"
    />
    <GlobalTextarea v-model="form.description" label="Opis" rows="2" auto-grow hide-details="auto" />
    <div class="dialog-row">
      <GlobalTextField
        v-model.number="form.goal"
        label="Cilj"
        type="number"
        inputmode="numeric"
        :rules="[rules.required(), rules.positiveInteger()]"
        hide-details="auto"
      />
      <GlobalTextField
        v-model="form.unit"
        label="Jedinica (npr. dostava)"
        :rules="[rules.required()]"
        hide-details="auto"
      />
    </div>
    <GlobalTextField
      v-model="form.reward"
      label="Nagrada (npr. 20 KM bonus)"
      prepend-inner-icon="mdi-gift-outline"
      :rules="[rules.required()]"
      hide-details="auto"
    />
    <GlobalDatePicker
      v-model="form.deadline"
      label="Rok"
      :rules="[rules.required()]"
      hide-details="auto"
    />
  </FormDialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import FormDialog from "~/components/common/FormDialog.vue";
import GlobalDatePicker from "~/components/common/GlobalDatePicker.vue";
import { useValidationRules } from "~/composables/useValidationRules";
import type { Quest, QuestCreate } from "~/types/quest";

const props = defineProps<{
  saving: boolean;
  quest: Quest | null;
}>();

const emit = defineEmits<{
  save: [payload: QuestCreate];
}>();

const open = defineModel<boolean>("open", { required: true });

const rules = useValidationRules();

const form = ref({
  title: "",
  description: "",
  goal: 1,
  unit: "",
  reward: "",
  deadline: "",
});

// Svako otvaranje kreće od čistih vrijednosti (dodavanje) ili od vrijednosti
// kvesta koji se izmjenjuje - dijalog ne pamti prethodni unos.
watch(open, (isOpen) => {
  if (!isOpen) return;
  if (props.quest) {
    form.value = {
      title: props.quest.title,
      description: props.quest.description,
      goal: props.quest.goal,
      unit: props.quest.unit,
      reward: props.quest.reward,
      deadline: props.quest.deadline.slice(0, 10),
    };
  } else {
    form.value = { title: "", description: "", goal: 1, unit: "", reward: "", deadline: "" };
  }
});

const submit = () => {
  emit("save", {
    title: form.value.title,
    description: form.value.description || undefined,
    goal: Number(form.value.goal),
    unit: form.value.unit,
    reward: form.value.reward,
    deadline: form.value.deadline,
  });
};
</script>

<style scoped>
.dialog-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
</style>
