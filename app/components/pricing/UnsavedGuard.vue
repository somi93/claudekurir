<template>
  <div class="ug" data-pricing="guard">
    <TintAlert tone="warn" role="alert" title="Imaš nesačuvane izmjene">
      {{ message }}
    </TintAlert>
    <div class="ug-r">
      <AppButton ref="keepBtn" variant="ghost" data-discard="keep" @click="emit('keep')">
        Nastavi uređivanje
      </AppButton>
      <AppButton variant="ghost" data-discard="drop" @click="emit('discard')">Odbaci izmjene</AppButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import TintAlert from "~/components/common/TintAlert.vue";

// Pitanje pri napuštanju nesačuvanog unosa (promjena taba, firme, odlazak sa stranice), isto kao u
// editoru postavke na Firmi. Stoji u mjestu sadržaja, ne u dijalogu; "Nastavi uređivanje" je
// sigurniji izbor pa dobija fokus čim se pitanje pokaže.
withDefaults(defineProps<{ message?: string }>(), {
  message: "Ako pređeš na drugi tab, izmjene se gube.",
});

const emit = defineEmits<{ keep: []; discard: [] }>();

const keepBtn = ref<{ $el?: HTMLElement } | null>(null);
onMounted(() => {
  void nextTick(() => keepBtn.value?.$el?.focus?.({ preventScroll: true }));
});
</script>

<style scoped>
.ug {
  display: grid;
  gap: 10px;
}

.ug-r {
  display: flex;
  gap: 8px;
}

.ug-r :deep(.ab) {
  flex: 1;
}
</style>
