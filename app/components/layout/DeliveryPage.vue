<template>
  <div class="delivery-page" :style="pageStyle">
    <slot name="header" />
    <div class="delivery-page-body" :class="{ 'delivery-page-body--roomy': roomy }">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    maxWidth?: number;
    wideMaxWidth?: number;
    roomy?: boolean;
  }>(),
  {
    maxWidth: 760,
    wideMaxWidth: undefined,
    roomy: false,
  }
);

const pageStyle = computed(() => ({
  "--delivery-page-max-width": `${props.maxWidth}px`,
  "--delivery-page-wide-max-width": `${props.wideMaxWidth ?? props.maxWidth}px`,
}));
</script>

<style scoped>
.delivery-page {
  max-width: var(--delivery-page-max-width);
  margin: 0 auto;
}

.delivery-page-body {
  padding: 16px 16px 64px;
}

@media (min-width: 600px) {
  .delivery-page {
    max-width: var(--delivery-page-wide-max-width);
  }

  .delivery-page-body--roomy {
    padding: 4vh 24px 64px;
  }
}
</style>
