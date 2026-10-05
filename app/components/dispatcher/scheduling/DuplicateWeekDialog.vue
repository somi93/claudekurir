<template>
  <FormDialog
    v-model:open="open"
    title="Kopiraj sedmični plan"
    :saving="saving"
    save-text="Kopiraj"
    max-width="420"
    @save="submit"
  >
    <GlobalDatePicker
      v-model="sourceWeekStart"
      label="Izvorna sedmica (ponedjeljak)"
      :rules="[rules.required()]"
      hide-details="auto"
    />

    <GlobalDatePicker
      v-model="targetWeekStart"
      label="Ciljna sedmica (ponedjeljak)"
      :rules="[rules.required()]"
      hide-details="auto"
    />

    <GlobalSelect
      v-model="zoneId"
      label="Zona"
      :items="zoneItems"
      item-title="title"
      item-value="value"
      hide-details="auto"
    />
  </FormDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import FormDialog from "~/components/common/FormDialog.vue";
import GlobalDatePicker from "~/components/common/GlobalDatePicker.vue";
import { useValidationRules } from "~/composables/useValidationRules";
import type { DispatcherZone } from "~/types/dispatcherZone";

const props = defineProps<{
  saving: boolean;
  zones: DispatcherZone[];
  defaultSourceWeekStart: string;
  defaultTargetWeekStart: string;
}>();

const emit = defineEmits<{
  duplicate: [payload: { sourceWeekStart: string; targetWeekStart: string; zoneId: number | null }];
}>();

const open = defineModel<boolean>("open", { required: true });

const rules = useValidationRules();

const sourceWeekStart = ref(props.defaultSourceWeekStart);
const targetWeekStart = ref(props.defaultTargetWeekStart);
const zoneId = ref<number | null>(null);

const zoneItems = computed(() => [
  { title: "Sve zone", value: null },
  ...props.zones.map((zone) => ({ title: toLatin(zone.name), value: zone.id })),
]);

watch(open, (isOpen) => {
  if (!isOpen) return;
  sourceWeekStart.value = props.defaultSourceWeekStart;
  targetWeekStart.value = props.defaultTargetWeekStart;
  zoneId.value = null;
});

const submit = () => {
  emit("duplicate", {
    sourceWeekStart: sourceWeekStart.value,
    targetWeekStart: targetWeekStart.value,
    zoneId: zoneId.value,
  });
};
</script>
