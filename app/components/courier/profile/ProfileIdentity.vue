<template>
  <section class="pi" aria-label="Moj nalog">
    <div class="pi-top">
      <span class="pi-av" aria-hidden="true">{{ avatar }}</span>
      <div class="pi-text">
        <h2 class="pi-name">{{ displayName }}</h2>
        <button
          type="button"
          class="pi-idchip"
          :class="{ done: copied }"
          :aria-label="`Kopiraj ID kurira ${profile.id}`"
          @click="copyId"
        >
          <template v-if="copied">
            <v-icon icon="mdi-check" size="16" />
            Kopirano
          </template>
          <template v-else>
            Kurir #{{ profile.id }}
            <v-icon icon="mdi-content-copy" size="16" />
          </template>
        </button>
        <span class="pi-sr" role="status">{{ copied ? "ID kurira je kopiran." : "" }}</span>
      </div>
    </div>

    <div class="pi-facts">
      <button
        type="button"
        class="pi-fact"
        :style="{ '--ink': vehicle.ink, '--tint': vehicle.tint }"
        :aria-label="`Vozilo: ${vehicle.label}. Promijeni`"
        @click="emit('vehicle')"
      >
        <span class="vi"><v-icon :icon="vehicle.icon" size="16" /></span>
        <span class="tx">{{ vehicle.label }}</span>
      </button>
      <span v-for="company in companyNames" :key="company" class="pi-fact">
        <span class="vi" style="--ink: #5b6676; --tint: #eceff3">
          <v-icon icon="mdi-domain" size="16" />
        </span>
        <span class="tx">{{ company }}</span>
      </span>
    </div>

    <TintAlert
      v-if="showNudge"
      tone="info"
      icon="mdi-account-alert-outline"
      title="Dodaj hitni kontakt"
    >
      Osoba koju dispečer može pozvati ako ti se nešto desi na dostavi.
      <template #action>
        <button type="button" class="pi-act" @click="emit('nudge')">Dodaj kontakt</button>
      </template>
    </TintAlert>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import type { CourierProfile } from "~/models/CourierProfile";
import type { CourierCompany } from "~/types/courier";
import { copyText } from "~/utils/clipboard";
import { VEHICLE_CHOICES, choiceOf, fullName, initials } from "~/utils/profileForm";
import { toLatin } from "~/utils/toLatin";

// Zaglavlje identiteta: avatar sa inicijalima (mjesto za fotografiju čeka odgovor backenda,
// stavka 14), ime, ID koji se kopira dodirom i čipovi sa vozilom i firmom. Zamjenjuje
// onemogućeno polje "Id" (kontrast 2.02 : 1, nije u redoslijedu tastature) i konačno drži
// obećanje pločice "Rider ID" sa početne. Vozilo je dugme (otvara list), firma je podatak.
// Hitni kontakt je jedino što traži pažnju.
const props = defineProps<{
  profile: CourierProfile;
  companies: CourierCompany[];
  showNudge: boolean;
}>();

const emit = defineEmits<{ vehicle: []; nudge: [] }>();

const displayName = computed(
  () => fullName(toLatin(props.profile.name), toLatin(props.profile.lastname)) || props.profile.email
);
const avatar = computed(() =>
  initials(toLatin(props.profile.name), toLatin(props.profile.lastname), props.profile.email)
);
const vehicle = computed(() => VEHICLE_CHOICES[choiceOf(props.profile.vehicle)]);
const companyNames = computed(() =>
  props.companies.map((company) => toLatin(company.name)).filter(Boolean)
);

const copied = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

const copyId = async () => {
  if (!(await copyText(String(props.profile.id)))) return;
  copied.value = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => (copied.value = false), 1600);
};

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>

<style scoped>
.pi {
  display: grid;
  gap: 14px;
  padding: 18px 16px 16px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.pi-top {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
}

.pi-av {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #0b1220;
  color: #fff;
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  box-shadow: 0 0 0 4px #eceff3;
}

.pi-text {
  display: grid;
  gap: 6px;
  min-width: 0;
  justify-items: start;
}

.pi-name {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.pi-idchip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 11px 0 12px;
  border: 0;
  border-radius: 999px;
  background: #f1f3f6;
  color: #0b1220;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

/* Meta od 44 px, a izgled ostaje 32 px. */
.pi-idchip::after {
  content: "";
  position: absolute;
  inset: -6px -4px;
}

.pi-idchip :deep(.v-icon) {
  color: #5b6676;
}

.pi-idchip:active {
  background: #e5e8ed;
}

.pi-idchip:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.pi-idchip.done {
  background: #e3f8ef;
  color: #00734f;
}

.pi-idchip.done :deep(.v-icon) {
  color: #00734f;
}

.pi-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.pi-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pi-fact {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  min-height: 44px;
  padding: 0 14px 0 8px;
  border: 1.5px solid #dfe3ea;
  border-radius: 999px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  text-align: left;
}

button.pi-fact {
  cursor: pointer;
}

button.pi-fact:active {
  background: #f1f4f9;
}

button.pi-fact:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.pi-fact .vi {
  flex: none;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--tint, #eceff3);
  color: var(--ink, #5b6676);
}

.pi-fact .tx {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Radnja u tonu mora biti meta od 44 px (TintAlert je ostavlja nižom). */
.pi-act {
  min-height: 44px;
  margin: -8px 0;
}

@media (prefers-reduced-motion: reduce) {
  .pi-idchip {
    transition: none;
  }
}
</style>
