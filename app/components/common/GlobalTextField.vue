<template>
  <v-text-field
    class="global-field"
    :variant="variant"
    :flat="flat"
    :density="density"
    v-bind="$attrs"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </v-text-field>
</template>

<script setup lang="ts">
import type { GlobalFieldStyleProps } from "./globalField";

// Transparentan wrapper: svi ostali propovi/eventi/slotovi/v-model idu kroz
// $attrs na v-text-field. Ovdje se samo forsira jednoobrazan sivi izgled
// (vidi .global-field .v-field u app.vue) uz mogućnost lokalnog override-a.
defineOptions({ inheritAttrs: false });

withDefaults(defineProps<GlobalFieldStyleProps>(), {
  variant: "solo",
  flat: true,
  density: "comfortable",
});
</script>
