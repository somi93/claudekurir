<template>
  <v-bottom-sheet
    :model-value="open"
    inset
    max-width="560"
    :aria-label="label ?? title"
    @update:model-value="onModel"
  >
    <v-card :id="uid" class="as" rounded="t-xl" tabindex="-1" :aria-label="label ?? title">
      <div class="as-grip" aria-hidden="true"><i /></div>

      <header class="as-head">
        <div class="as-head-text">
          <h2 class="as-title">{{ title }}</h2>
          <p v-if="subtitle" class="as-sub">{{ subtitle }}</p>
        </div>
        <button type="button" class="as-ib" aria-label="Zatvori" @click="requestClose">
          <v-icon icon="mdi-close" size="20" />
        </button>
      </header>

      <form class="as-form" novalidate @submit.prevent="emit('submit')">
        <div ref="body" class="as-body" @input="onBodyInput">
          <div v-if="discard" class="as-discard">
            <TintAlert tone="warn" role="alert" title="Imaš nesačuvane izmjene">
              Ako zatvoriš, izmjene se gube.
            </TintAlert>
            <div class="as-discard-row">
              <AppButton variant="ghost" data-discard="keep" @click="keepEditing">
                Nastavi uređivanje
              </AppButton>
              <AppButton variant="ghost" data-discard="drop" @click="dropChanges">
                Odbaci izmjene
              </AppButton>
            </div>
          </div>
          <slot />
        </div>

        <div v-if="$slots.footer" class="as-foot"><slot name="footer" /></div>
      </form>
    </v-card>
  </v-bottom-sheet>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { registerSheetGuard } from "~/composables/useSheetGuard";

// Ljuska donjeg lista (Profil: kontakt, lični podaci, vozilo, lozinka, odjava): isti izgled kao
// u Novčaniku i detalju dostave - ručka, naslov sa podnaslovom, X, tijelo koje se skroluje, a
// ispod njega podnožje sa dugmetom koje ostaje na mjestu. Donji list jer je na telefonu u dosegu
// palca.
//
//  - Fokus: na polje koje je otvorio red (`focus` = data-field), pa element sa data-autofocus,
//    pa prvo polje ili izabrano dugme izbora; inače na "Zatvori". Po zatvaranju se vraća na ono
//    što je list otvorilo. Tab ostaje u listu, Esc zatvara.
//  - Zaštita unosa: dok je `dirty`, X, pozadina, Esc i dugme Nazad ne zatvaraju list nego pitaju
//    "Imaš nesačuvane izmjene" (vidi useSheetGuard).
//  - Forma: tijelo i podnožje su jedna <form>, pa dugme tipa submit u podnožju šalje `submit`
//    (Enter u polju radi isto).
const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    subtitle?: string;
    // Naziv za čitač ekrana ako se razlikuje od naslova.
    label?: string;
    // Ima li neosnimljenog unosa.
    dirty?: boolean;
    // data-field polja koje treba fokusirati pri otvaranju.
    focus?: string | null;
  }>(),
  { subtitle: undefined, label: undefined, dirty: false, focus: null }
);

const emit = defineEmits<{ "update:open": [value: boolean]; submit: [] }>();

const uid = `as-${useId()}`;
const body = ref<HTMLElement | null>(null);
const discard = ref(false);
// "Odbaci izmjene": list se zatvara i ne smije ga zaustaviti vlastita zaštita.
const skipGuard = ref(false);

let returnFocusTo: HTMLElement | null = null;
let unregister: (() => void) | null = null;

const pickTarget = (): HTMLElement | null => {
  const root = document.getElementById(uid);
  if (!root) return null;
  return (
    (props.focus
      ? root.querySelector<HTMLElement>(`[data-field="${props.focus}"]`)
      : null) ??
    root.querySelector<HTMLElement>("[data-autofocus]") ??
    root.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]):not([readonly]), [role="radio"][aria-checked="true"]'
    ) ??
    root.querySelector<HTMLElement>(".as-ib")
  );
};

// Sadržaj bottom sheet-a se pravi tek pri otvaranju, pa se meta traži i nekoliko frejmova.
const focusInitial = async () => {
  await nextTick();
  for (let i = 0; i < 12; i++) {
    const target = pickTarget();
    if (target) {
      target.focus({ preventScroll: true });
      return;
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
};

const askDiscard = async () => {
  discard.value = true;
  await nextTick();
  body.value?.scrollTo({ top: 0 });
  document
    .getElementById(uid)
    ?.querySelector<HTMLElement>('[data-discard="keep"]')
    ?.focus({ preventScroll: true });
};

const requestClose = () => {
  if (props.dirty && !skipGuard.value) {
    void askDiscard();
    return;
  }
  emit("update:open", false);
};

const keepEditing = () => {
  discard.value = false;
  void focusInitial();
};

const dropChanges = () => closeNow();

const onModel = (value: boolean) => {
  if (value) emit("update:open", true);
  else requestClose();
};

// Zatvaranje bez pitanja: poslije uspješnog snimanja (unos je tada već u sačuvanom stanju, ali
// prop `dirty` možda još nije stigao da se osvježi).
const closeNow = () => {
  skipGuard.value = true;
  discard.value = false;
  emit("update:open", false);
};

const focusField = (name: string) => {
  document
    .getElementById(uid)
    ?.querySelector<HTMLElement>(`[data-field="${name}"]`)
    ?.focus({ preventScroll: true });
};

defineExpose({ closeNow, focusField });

// Kurir nastavlja da kuca: pitanje nestaje.
const onBodyInput = () => {
  if (discard.value) discard.value = false;
};

watch(
  () => props.open,
  (open) => {
    if (typeof document === "undefined") return;
    if (open) {
      skipGuard.value = false;
      discard.value = false;
      returnFocusTo = document.activeElement as HTMLElement | null;
      unregister?.();
      unregister = registerSheetGuard({
        dirty: () => props.dirty && !skipGuard.value,
        ask: () => void askDiscard(),
      });
      void focusInitial();
    } else {
      unregister?.();
      unregister = null;
      discard.value = false;
      returnFocusTo?.focus?.({ preventScroll: true });
      returnFocusTo = null;
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => unregister?.());
</script>

<style scoped>
.as {
  display: flex;
  flex-direction: column;
  color: #0b1220;
  max-height: 90vh;
  max-height: 90dvh;
  overflow: hidden;
  outline: none;
  box-shadow: 0 -10px 34px rgba(11, 18, 32, 0.16), 0 -1px 2px rgba(11, 18, 32, 0.06);
}

.as-grip {
  display: flex;
  justify-content: center;
  padding: 10px 0 4px;
}

.as-grip i {
  display: block;
  width: 40px;
  height: 4px;
  border-radius: 999px;
  background: #d5d9e0;
}

.as-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 14px 12px 20px;
}

.as-head-text {
  min-width: 0;
}

.as-title {
  margin: 0;
  font-size: 1.12rem;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}

.as-sub {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: #657083;
}

.as-ib {
  flex: none;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-top: -4px;
  border: 0;
  border-radius: 12px;
  background: #f1f3f6;
  color: #0b1220;
  cursor: pointer;
}

.as-ib:active {
  background: #e5e8ed;
}

.as-ib:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.as-form {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.as-body {
  display: grid;
  gap: 14px;
  align-content: start;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px 20px 12px;
}

.as-discard {
  display: grid;
  gap: 8px;
}

.as-discard-row {
  display: grid;
  gap: 8px;
}

.as-foot {
  display: grid;
  gap: 8px;
  padding: 10px 20px calc(16px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid #eceef2;
  background: #fff;
}

/* Pojašnjenje ispod dugmeta ("Nema izmjena.", "Provjeri polja iznad."). */
.as-foot :slotted(p) {
  margin: 0;
  min-height: 1.1em;
  font-size: 0.78rem;
  line-height: 1.45;
  color: #5b6676;
  text-align: center;
}
</style>
