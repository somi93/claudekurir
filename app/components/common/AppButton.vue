<template>
  <button
    :type="submit ? 'submit' : 'button'"
    class="ab"
    :class="[`ab--${variant}`, { 'ab--busy': loading }]"
    :disabled="disabled || loading"
    :aria-busy="loading ? 'true' : undefined"
  >
    <v-icon v-if="loading" icon="mdi-refresh" class="ab-spin" size="20" />
    <v-icon v-else-if="icon" :icon="icon" :size="variant === 'ghost' ? 18 : 20" />
    <slot />
  </button>
</template>

<script setup lang="ts">
// Dugme listova i ekrana Profil: tamno glavno (52 px, jedno po listu), bijelo sporedno (46 px)
// i crveno za opasnu radnju (odjava; nikad prvo u fokusu). Onemogućeno je sivo i bez sjenke.
// Ostaje pravo <button>, pa Enter / Space rade bez dodatnog koda; `loading` ga onemogućava i
// vrti ikonu (aria-busy).
withDefaults(
  defineProps<{
    variant?: "primary" | "ghost" | "danger";
    icon?: string;
    disabled?: boolean;
    loading?: boolean;
    // Šalje formu u kojoj stoji (Enter u polju radi isto).
    submit?: boolean;
  }>(),
  { variant: "primary", icon: undefined, disabled: false, loading: false, submit: false }
);
</script>

<style scoped>
.ab {
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

.ab:active {
  background: #1b2638;
}

.ab:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.ab:disabled {
  background: #c9ced7;
  box-shadow: none;
  cursor: not-allowed;
}

/* Dok se čuva: tamno ostaje (ne sivo kao "nema šta da se čuva"), samo se ne može dodirnuti. */
.ab--busy:disabled {
  background: #0b1220;
  cursor: progress;
}

.ab--ghost {
  min-height: 46px;
  border: 1.5px solid #dfe3ea;
  background: #fff;
  color: #0b1220;
  font-size: 0.9rem;
  box-shadow: none;
}

.ab--ghost:active {
  background: #f1f4f9;
}

.ab--ghost:disabled {
  background: #f5f6f8;
  color: #5b6676;
}

.ab--danger {
  background: #b42318;
  box-shadow: 0 6px 16px -6px rgba(180, 35, 24, 0.5);
}

.ab--danger:active {
  background: #8f1c12;
}

.ab--danger.ab--busy:disabled {
  background: #b42318;
}

.ab-spin {
  animation: ab-spin 0.8s linear infinite;
}

@keyframes ab-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ab-spin {
    animation: none;
  }
}
</style>
