<template>
  <GlobalPage :max-width="1200">
    <template #header>
      <PageHeader :title="ws.header.title" back-to="/" back-label="Nazad na početnu">
        <template v-if="ws.header.subtitle" #subtitle>{{ ws.header.subtitle }}</template>
        <template v-if="ws.saveState" #actions>
          <SaveStateChip :state="ws.saveState" />
        </template>
      </PageHeader>
    </template>

    <PageAlert v-if="ws.company.error" closable class="mb-4" @close="ws.company.error = ''">
      {{ ws.company.error }}
    </PageAlert>

    <div class="pr" data-pricing="page">
      <GlobalTabBar
        variant="pills"
        label="Sekcije cjenovnika"
        id-base="pr"
        panel-id="pr-panel"
        :model-value="ws.view.tab"
        :tabs="ws.tabs"
        @update:model-value="onTab"
      />

      <!-- Jedna struktura za oba prozora: promjena širine ne montira tab iznova. Primjer narudžbe je desna
           kolona samo na računaru; na telefonu ga zamjenjuju traka na dnu i donji list. -->
      <div class="pr-grid" :class="{ 'pr-grid--wide': ws.view.wide }" :style="barStyle">
        <div class="pr-l">
          <div v-if="ws.leave.asking" ref="guardBox" class="pr-guard">
            <UnsavedGuard :message="guardMessage" @keep="onKeep" @discard="onDiscard" />
          </div>

          <div id="pr-panel" role="tabpanel" :aria-labelledby="`pr-tab-${ws.view.tab}`">
            <!-- Samo aktivan tab je montiran: editori se odjavljuju iz nesačuvanog kad se tab zatvori, a
                 ključ po firmi gasi editore kad se firma promijeni. -->
            <PricingPriceTab v-if="ws.view.tab === 'price'" :key="ws.company.id ?? 0" :ws="ws" />
            <SurchargesTab v-else-if="ws.view.tab === 'surcharges'" :key="ws.company.id ?? 0" :ws="ws" />
            <VehicleRulesTab v-else :key="ws.company.id ?? 0" :ws="ws" />
          </div>
        </div>

        <aside v-if="ws.view.wide" class="pr-r" aria-label="Primjer narudžbe">
          <PricingSimulator :ws="ws" />
        </aside>
      </div>

      <!-- Zadnje dijete: traka na telefonu ostavlja prazan prostor svoje visine, pa kraj sadržaja ostaje dostupan. -->
      <SimulatorBar :ws="ws" />
    </div>

    <SimulatorSheet :ws="ws" />
  </GlobalPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Cjenovnik" });

import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "nuxt/app";
import { onBeforeRouteLeave, onBeforeRouteUpdate } from "vue-router";
import { usePricingWorkspace } from "~/composables/usePricingWorkspace";
import type { PricingTab } from "~/composables/usePricingView";
import { interceptLeaving, registerCompanyChangeGuard } from "~/composables/useSheetGuard";
import GlobalPage from "~/components/common/GlobalPage.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import PageAlert from "~/components/common/PageAlert.vue";
import GlobalTabBar from "~/components/common/GlobalTabBar.vue";
import SaveStateChip from "~/components/common/SaveStateChip.vue";
import UnsavedGuard from "~/components/pricing/UnsavedGuard.vue";
import PricingPriceTab from "~/components/pricing/PricingPriceTab.vue";
import SurchargesTab from "~/components/pricing/SurchargesTab.vue";
import VehicleRulesTab from "~/components/pricing/VehicleRulesTab.vue";
import PricingSimulator from "~/components/pricing/PricingSimulator.vue";
import SimulatorBar from "~/components/pricing/SimulatorBar.vue";
import SimulatorSheet from "~/components/pricing/SimulatorSheet.vue";

// Cjenovnik: tri taba (Cijena, Doplate, Vozila) i Primjer narudžbe uz njih. Stranica samo slaže ekran: sve podatke
// i radnje daje radni prostor (usePricingWorkspace), a komponente ga primaju kao jedini prop. Ovdje su još i zaštite
// nesačuvanog unosa (promjena taba, firme i odlazak sa stranice), isto kao na Firmi.
const ws = usePricingWorkspace();
const router = useRouter();

// --- Pitanje pri napuštanju nesačuvanog --------------------------------------------------------------

// Šta je pokrenulo pitanje: tekst kaže šta se gubi ako dispečer ode.
type Cause = "tab" | "company" | "page";
const cause = ref<Cause>("tab");
const CAUSE_TEXT: Record<Cause, string> = {
  tab: "Ako pređeš na drugi tab, izmjene se gube.",
  company: "Ako promijeniš firmu, izmjene se gube.",
  page: "Ako napustiš stranicu, izmjene se gube.",
};
const guardMessage = computed(() => CAUSE_TEXT[cause.value]);
const guardBox = ref<HTMLElement | null>(null);

const reducedMotion = (): boolean =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Pitanje stoji iznad sadržaja taba; ako je dispečer skrolovao (Nazad, firma u ladici), dovedi ga u vidno polje.
watch(
  () => ws.leave.asking,
  (asking) => {
    if (!asking) return;
    // Donji list Primjera ne smije prekriti pitanje.
    ws.view.simOpen = false;
    void nextTick(() =>
      guardBox.value?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" })
    );
  }
);

// Poslije odgovora tipka sa pitanja nestaje, pa fokus ide na aktivan tab da ne ostane na nečemu što više ne postoji.
const focusTab = () => {
  void nextTick(() => document.getElementById(`pr-tab-${ws.view.tab}`)?.focus({ preventScroll: true }));
};
const onKeep = () => {
  ws.leave.keep();
  focusTab();
};
const onDiscard = () => {
  ws.leave.discard();
  focusTab();
};

// Promjena taba dok ima nesačuvanog prvo pita.
const onTab = (next: PricingTab) => {
  if (next === ws.view.tab) return;
  cause.value = "tab";
  ws.leave.run(() => ws.view.setTab(next));
};

// Druga firma u ladici dok ima nesačuvanog: ladica pita ovu stranicu, a firma se mijenja tek poslije
// "Odbaci izmjene". List sa unosom (telefon) pita sam, pa ga treba pitati prije stranice.
const stopCompanyGuard = registerCompanyChangeGuard((next) => {
  if (interceptLeaving()) return true;
  cause.value = "company";
  return ws.leave.stop(() => ws.company.select(next));
});
onBeforeUnmount(stopCompanyGuard);

// Dugme Nazad i odlazak sa stranice. Prvo list sa unosom (telefon), pa nacrt cijene i inline editori.
onBeforeRouteLeave((to) => {
  if (interceptLeaving()) return false;
  cause.value = "page";
  if (ws.leave.stop(() => void router.push(to.fullPath))) return false;
});

// Tab se mijenja i mimo trake sa tabovima ("Otvori pravilo" u Primjeru): isti zaštitni put, pa editor sa unosom
// ne nestaje bez pitanja. Ostale promjene adrese (ista stranica, isti tab) prolaze.
onBeforeRouteUpdate((to, from) => {
  if (to.query.t === from.query.t) return;
  cause.value = "tab";
  if (ws.leave.stop(() => void router.replace(to.fullPath))) return false;
});

// --- Telefon ---------------------------------------------------------------------------------------------

// Ljepljiva traka nesačuvane cijene stoji iznad trake Primjera (64 px + sigurna zona) kad se ona vidi.
const barStyle = computed(() =>
  !ws.view.wide && ws.calc !== null
    ? {
        "--pricing-bar-bottom":
          "calc(64px + max(var(--v-safe-bottom, 0px), env(safe-area-inset-bottom, 0px)))",
      }
    : undefined
);
</script>

<style scoped>
.pr {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.pr > * {
  min-width: 0;
}

/* Jedna kolona; na računaru rad (fleksibilno) | Primjer narudžbe 372 px. Kolone se NE poravnavaju na vrh:
   desna kolona je visoka kao red mreže, pa se kartica Primjera u njoj lijepi uz vrh dok se lijeva strana skroluje. */
.pr-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  min-width: 0;
}

.pr-grid--wide {
  grid-template-columns: minmax(0, 1fr) 372px;
}

.pr-l {
  display: grid;
  gap: 16px;
  align-content: start;
  min-width: 0;
}

.pr-r {
  min-width: 0;
}

/* Skrol do pitanja ne smije ostati ispod ljepljivog zaglavlja. */
.pr-guard {
  scroll-margin-top: 88px;
}

#pr-panel {
  min-width: 0;
}
</style>
