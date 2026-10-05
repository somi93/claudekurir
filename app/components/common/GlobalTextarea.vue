<template>
  <v-textarea
    class="global-field"
    :variant="variant"
    :flat="flat"
    :density="density"
    v-bind="$attrs"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </v-textarea>
</template>

<script setup lang="ts">
import type { GlobalFieldStyleProps } from "./globalField";

// Vidi GlobalTextField za obrazac - isto, samo v-textarea.
defineOptions({ inheritAttrs: false });

withDefaults(defineProps<GlobalFieldStyleProps>(), {
  variant: "solo",
  flat: true,
  density: "comfortable",
});
</script>
