<template>
  <FormDialog
    :open="open"
    title="Suspenduj saradnju"
    save-text="Suspenduj"
    @update:open="emit('update:open', $event)"
    @save="submit"
  >
    <p class="suspend-copy">
      Narudžbe restorana {{ toLatin(restaurant?.restaurant_name) }} neće biti vidljive
      kuririma dok saradnju ponovo ne uključiš.
    </p>
    <GlobalTextarea
      v-model="reason"
      label="Razlog (opciono)"
      rows="2"
      auto-grow
      hide-details="auto"
    />
  </FormDialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import FormDialog from "~/components/common/FormDialog.vue";
import GlobalTextarea from "~/components/common/GlobalTextarea.vue";
import type { RestaurantCooperation } from "~/types/restaurant-cooperation";

const props = defineProps<{ open: boolean; restaurant: RestaurantCooperation | null }>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  confirm: [reason: string | undefined];
}>();

const reason = ref("");
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) reason.value = "";
  }
);

const submit = () => {
  emit("confirm", reason.value.trim() || undefined);
  emit("update:open", false);
};
</script>

<style scoped>
.suspend-copy {
  margin: 0 0 4px;
  font-size: 0.88rem;
  color: #495260;
}
</style>
