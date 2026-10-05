<template>
  <v-select
    class="global-field"
    :variant="variant"
    :flat="flat"
    :density="density"
    v-bind="$attrs"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </v-select>
</template>

<script setup lang="ts">
import type { GlobalFieldStyleProps } from "./globalField";

// Vidi GlobalTextField za obrazac - isto, samo v-select.
defineOptions({ inheritAttrs: false });

withDefaults(defineProps<GlobalFieldStyleProps>(), {
  variant: "solo",
  flat: true,
  density: "comfortable",
});
</script>
