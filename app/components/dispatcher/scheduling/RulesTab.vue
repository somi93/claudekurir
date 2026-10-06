<template>
  <div class="rt">
    <div v-if="enforcement.loading.value && !enforcement.known.value && !enforcement.loadFailed.value" class="rt-card" aria-busy="true" aria-label="Učitavam podešavanje">
      <div class="rt-sk" style="height: 24px; width: 60%" />
      <div class="rt-sk" style="height: 54px" />
      <div class="rt-sk" style="height: 80px" />
    </div>

    <section v-else class="rt-card" aria-labelledby="rt-h">
      <div>
        <h2 id="rt-h">Dodjela narudžbi samo potvrđenim kuririma</h2>
        <p>
          Kad je uključeno, sistem dodjeljuje narudžbe samo kuririma koji su trenutno <b>potvrđeni</b> po ovom rasporedu. Dok je
          isključeno, dodjela radi kao i do sada.
        </p>
      </div>

      <TintAlert v-if="!enforcement.known.value" tone="bad" role="alert" title="Ne mogu da pročitam stanje">
        Prekidač je zaključan dok se stanje ne učita, da ne bi pokazivao stanje druge firme.
        <template #action>
          <button type="button" data-field="rules-retry" @click="enforcement.retry()">Pokušaj ponovo</button>
        </template>
      </TintAlert>

      <SettingSwitch
        :model-value="enforcement.known.value && enforcement.enabled.value"
        label="Provjera dostupnosti"
        name="enf"
        :disabled="!enforcement.known.value || enforcement.saving.value"
        :hint="hint"
        @update:model-value="onToggle"
      />

      <template v-if="enforcement.known.value && !enforcement.enabled.value">
        <TintAlert v-if="shiftsState !== 'ok'" tone="warn" title="Procjenu ne mogu da izračunam">
          Smjene nisu učitane, pa se ne zna koliko je kurira sada potvrđeno.
        </TintAlert>
        <EnforceImpact v-else :impact="impact" />
      </template>
    </section>

    <div class="rt-list">
      <SettingRow
        v-if="!hasCity"
        interactive
        icon="mdi-home-city-outline"
        tone="warn"
        label="Grad firme"
        value="Nije postavljen"
        empty
        :chip="{ tone: 'warn', text: 'Zone i smjene čekaju', icon: 'mdi-alert-outline' }"
        end-text="Postavi"
        data-field="city"
        @click="emit('open-city')"
      />
      <SettingRow v-else icon="mdi-home-city-outline" label="Grad firme" :value="city" hint="Zone se vezuju za grad firme." locked />
    </div>

    <EnforceSheet
      :open="confirmOpen"
      :impact="impact"
      :state="shiftsState"
      :saving="enforcement.saving.value"
      @update:open="confirmOpen = $event"
      @confirm="enable"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import SettingRow from "~/components/common/SettingRow.vue";
import SettingSwitch from "~/components/common/SettingSwitch.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import EnforceImpact from "~/components/dispatcher/scheduling/EnforceImpact.vue";
import EnforceSheet from "~/components/dispatcher/scheduling/EnforceSheet.vue";
import type { useAvailabilityEnforcement } from "~/composables/useAvailabilityEnforcement";
import { enforceImpact, type Clock, type NamedZone, type SchedShift } from "~/utils/schedule";

// Tab "Pravila": provjera dostupnosti pri dodjeli narudžbi i grad firme. Uključivanje traži potvrdu sa procjenom iz
// smjena koje sada traju (jedan dodir više nego ranije), isključivanje je odmah. Stanje se ne pokazuje dok nije
// učitano sa servera za izabranu firmu: poslije pada ili promjene firme je prekidač zaključan uz "Pokušaj ponovo".
const props = defineProps<{
  enforcement: ReturnType<typeof useAvailabilityEnforcement>;
  zones: NamedZone[];
  // Današnje smjene (iz njih je procjena) i stanje njihovog učitavanja.
  shifts: SchedShift[];
  shiftsState: "loading" | "error" | "ok";
  now: Clock;
  hasCity: boolean;
  city: string;
}>();

const emit = defineEmits<{ "open-city": [] }>();

const confirmOpen = ref(false);

const impact = computed(() => enforceImpact({ shifts: props.shifts, now: props.now, zones: props.zones }));
const hint = computed(() =>
  !props.enforcement.known.value
    ? "Stanje se ne zna dok se ne učita."
    : props.enforcement.enabled.value
      ? "Uključeno: narudžbe dobijaju samo kuriri potvrđeni po rasporedu."
      : "Isključeno: dodjela radi kao do sada."
);

const onToggle = (next: boolean) => {
  if (!props.enforcement.known.value || props.enforcement.saving.value) return;
  if (next) confirmOpen.value = true;
  else void props.enforcement.setEnabled(false);
};

const enable = async () => {
  if (await props.enforcement.setEnabled(true)) confirmOpen.value = false;
};

</script>

<style scoped>
.rt {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.rt-card {
  display: grid;
  gap: 14px;
  padding: 18px 20px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.rt-card h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
}

.rt-card p {
  margin: 4px 0 0;
  font-size: 0.9rem;
  color: #5b6676;
}

.rt-list {
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.rt-sk {
  border-radius: 12px;
  background: linear-gradient(90deg, #eceef2 25%, #f6f7f9 37%, #eceef2 63%);
  background-size: 400% 100%;
  animation: rt-sh 1.4s ease infinite;
}

@keyframes rt-sh {
  0% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rt-sk {
    animation: none;
  }
}
</style>
