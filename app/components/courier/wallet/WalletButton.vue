<template>
  <button :type="submit ? 'submit' : 'button'" class="wb" :class="`wb--${variant}`" :disabled="disabled">
    <v-icon v-if="icon" :icon="icon" :size="variant === 'primary' ? 22 : 18" />
    <slot />
  </button>
</template>

<script setup lang="ts">
// Dugme ekrana Novčanik: tamno glavno (52 px, jedno po panelu) i bijelo sporedno (46 px).
// Onemogućeno je sivo i bez sjenke. Ostaje pravo <button>, pa Enter / Space rade bez dodatnog koda.
withDefaults(
  defineProps<{
    variant?: "primary" | "ghost";
    icon?: string;
    disabled?: boolean;
    // Šalje formu u kojoj stoji (Enter u polju radi isto).
    submit?: boolean;
  }>(),
  { variant: "primary", icon: undefined, disabled: false, submit: false }
);
</script>

<style scoped>
.wb {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 52px;
  padding: 0 18px;
  border: 0;
  border-radius: 14px;
  background: #0b1220;
  color: #fff;
  font: inherit;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.005em;
  cursor: pointer;
  box-shadow: 0 6px 16px -6px rgba(11, 18, 32, 0.5);
}

.wb:active {
  background: #1b2638;
}

.wb:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.wb:disabled {
  background: #c9ced7;
  box-shadow: none;
  cursor: not-allowed;
}

.wb--ghost {
  min-height: 46px;
  border: 1.5px solid #dfe3ea;
  background: #fff;
  color: #0b1220;
  font-size: 0.9rem;
  box-shadow: none;
}

.wb--ghost:active {
  background: #f1f4f9;
}
</style>
