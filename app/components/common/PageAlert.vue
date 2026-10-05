<template>
  <v-alert
    :type="type"
    :variant="variant"
    density="comfortable"
    class="page-alert"
    :closable="closable"
    @click:close="emit('close')"
  >
    <slot />
  </v-alert>
</template>

<script setup lang="ts">
// Alert ugrađen u sadržaj stranice (za razliku od GlobalAlerts - plutajući
// toast stek vezan za alert store). Ranije je isti v-alert (type/variant/
// density, uz ".alert-card{border-radius:16px !important}" ili bez njega -
// scheduling.vue je imao verziju BEZ !important, pa se ugao tamo tiho nije
// zaokruživao) bio ručno ponovljen u 17 poziva kroz 13 fajlova, sa sitnim
// razlikama (neki bez density, neki bez border-radius) - sada je jedan izvor
// izgleda za sve. `variant` ostaje prop jer CourierMap overlay-alert namerno
// koristi "flat" (čitljivost preko mape), ne "tonal".
withDefaults(
  defineProps<{
    type?: "error" | "warning" | "success" | "info";
    variant?: "tonal" | "flat";
    closable?: boolean;
  }>(),
  {
    type: "error",
    variant: "tonal",
    closable: false,
  }
);

const emit = defineEmits<{
  close: [];
}>();
</script>

<style scoped>
.page-alert {
  border-radius: 16px !important;
}
</style>
