<template>
  <div ref="root" class="pt" tabindex="-1" data-pricing="price-tab">
    <template v-if="ws.price.saved">
      <section class="pt-card pt-gap" data-pricing="price-card" :aria-labelledby="titleId">
        <div class="pt-head">
          <h2 :id="titleId">Cijena dostave</h2>
          <p>Šta kupac plaća prije doplata. Važi za nove narudžbe čim sačuvaš.</p>
        </div>

        <div class="pt-body">
          <div class="pt-two">
            <MoneyField
              name="base"
              label="Startna cijena"
              :unit="currency"
              hint="Plaća se uvijek."
              :model-value="ws.price.draft.base"
              :error="ws.price.shownErrors.base"
              :disabled="ws.price.saving"
              @update:model-value="ws.price.edit('base', $event)"
              @blur="ws.price.blur('base')"
              @step="(dir) => ws.price.step('base', dir)"
            />
            <MoneyField
              name="km"
              label="Cijena po kilometru"
              :unit="`${currency}/km`"
              hint="Množi se pređenim kilometrima."
              :model-value="ws.price.draft.km"
              :error="ws.price.shownErrors.km"
              :disabled="ws.price.saving"
              @update:model-value="ws.price.edit('km', $event)"
              @blur="ws.price.blur('km')"
              @step="(dir) => ws.price.step('km', dir)"
            />
          </div>

          <!-- Poruke servera: uz polje stoji ono što se tiče polja, ovdje opšta poruka i ono bez polja. -->
          <TintAlert
            v-if="serverMessages.length > 0"
            tone="bad"
            role="alert"
            title="Ne mogu da sačuvam"
            data-pricing="price-server-error"
          >
            <p v-for="message in serverMessages" :key="message" class="pt-msg">{{ message }}</p>
          </TintAlert>

          <!-- Provjera iznosa ne blokira snimanje (D5). Nije živa oblast: tekst se mijenja uz svaki taster,
               pa čitač ekrana dobija sažetak iz trake nesačuvanog kad se kucanje smiri. -->
          <TintAlert
            v-if="ws.price.sanity"
            tone="warn"
            :title="SANITY_TITLE"
            data-pricing="sanity"
          >
            {{ ws.price.sanity }}
          </TintAlert>

          <!-- D9: valuta se ne mijenja ovdje, jedan izvor istine je Firma. -->
          <div class="pt-cur" data-pricing="currency-row">
            <span class="pt-cur-ic"><v-icon icon="mdi-cash" size="20" /></span>
            <span class="pt-cur-t">
              <small>Valuta firme</small>
              <b>{{ currency }}</b>
            </span>
            <NuxtLink to="/dispatcher/company" class="pt-cur-a">Mijenja se u Firmi</NuxtLink>
          </div>
        </div>
      </section>

      <PriceLadder :ws="ws" class="pt-gap" />

      <DirtyBar :ws="ws" @dismissed="focusField('base')" @focus-field="focusField" />
    </template>

    <!-- Pad učitavanja: poruka u mjestu forme, ništa nije izgubljeno. Nula kao cijena se ne prikazuje. -->
    <section
      v-else-if="ws.price.loadFailed"
      class="pt-card pt-empty"
      role="alert"
      data-pricing="price-error"
    >
      <span class="pt-empty-ic"><v-icon icon="mdi-cloud-off-outline" size="30" /></span>
      <h2>Ne mogu da učitam cjenovnik</h2>
      <p>Provjeri vezu i pokušaj ponovo. Ništa nije izgubljeno.</p>
      <AppButton
        variant="ghost"
        icon="mdi-refresh"
        class="pt-retry"
        data-pricing="retry"
        @click="onRetry"
      >
        Pokušaj ponovo
      </AppButton>
    </section>

    <!-- Učitavanje: skeleton oblika stranice (forma i tabela), ne tekst. -->
    <div
      v-else
      class="pt-skel"
      role="status"
      aria-busy="true"
      aria-label="Učitavam cijenu"
      data-pricing="price-loading"
    >
      <div class="pt-card" aria-hidden="true">
        <i class="sk" style="width: 40%; height: 18px" />
        <i class="sk" style="width: 62%; height: 12px; margin-top: 8px" />
        <div class="pt-body">
          <div class="pt-two">
            <i class="sk" style="height: 56px" />
            <i class="sk" style="height: 56px" />
          </div>
          <i class="sk" style="height: 56px" />
        </div>
      </div>
      <div class="pt-card" aria-hidden="true">
        <i class="sk" style="width: 50%; height: 18px" />
        <div class="pt-skl">
          <i v-for="n in 4" :key="n" class="sk" style="height: 14px" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import MoneyField from "~/components/common/MoneyField.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import DirtyBar from "~/components/pricing/DirtyBar.vue";
import PriceLadder from "~/components/pricing/PriceLadder.vue";
import type { PriceKey } from "~/composables/usePricingDraft";
import type { PricingWorkspace } from "~/composables/usePricingWorkspace";
import { SANITY_TITLE } from "~/utils/pricingDrafts";

// Tab Cijena: kartica "Cijena dostave" (startna cijena i cijena po kilometru), tabela cijena po udaljenosti
// i traka nesačuvanih izmjena. Nacrt cijene je u radnom prostoru (ws.price): komponenta ga samo prikazuje i
// šalje mu ono što dispečer radi, a mreže ne dotiče. Potvrdu "Cijena je sačuvana." pravi radni prostor.
// Stanja: učitavanje (skeleton), pad učitavanja ("Pokušaj ponovo"), nacrt (traka, provjera iznosa),
// greška servera (uz polje i iznad provjere). Dok cijena nije stigla, polja se ne prikazuju.
const props = defineProps<{ ws: PricingWorkspace }>();

const titleId = `pt-${useId()}`;
const root = ref<HTMLElement | null>(null);

const currency = computed(() => props.ws.company.currency);

// Opšta poruka servera i poruke bez polja; ista poruka se ne ponavlja.
const serverMessages = computed(() => {
  const all = [props.ws.price.serverMessage, ...props.ws.price.serverLoose].filter((m) => m.length > 0);
  return [...new Set(all)];
});

const focusField = (key: PriceKey) => {
  root.value?.querySelector<HTMLInputElement>(`input[data-field="${key}"]`)?.focus({ preventScroll: true });
};

// Dugme nestaje čim učitavanje krene (skeleton), pa fokus prelazi na tab da ne ostane na nečemu što
// više ne postoji.
const onRetry = () => {
  root.value?.focus({ preventScroll: true });
  void props.ws.actions.reloadAll();
};

defineExpose({ focusField });
</script>

<style scoped>
.pt {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Fokus na tab postavlja kod, ne korisnik; prsten bi tu samo smetao. */
.pt:focus {
  outline: none;
}

.pt-gap {
  margin-bottom: 14px;
}

.pt-card {
  min-width: 0;
  padding: 20px 22px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
  color: #0b1220;
}

.pt-head h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.25;
}

.pt-head p {
  margin: 2px 0 0;
  font-size: 0.84rem;
  line-height: 1.4;
  color: #5b6676;
}

/* Kontejner određuje kad se polja slažu jedno ispod drugog: zavisi od širine kartice, ne prozora
   (na računaru je radna kolona uža od prozora, na telefonu je kartica cijela širina). */
.pt-body {
  display: grid;
  gap: 16px;
  min-width: 0;
  margin-top: 16px;
  container: ptbody / inline-size;
}

.pt-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

@container ptbody (max-width: 439px) {
  .pt-two {
    grid-template-columns: minmax(0, 1fr);
  }
}

.pt-msg {
  margin: 0;
}

.pt-msg + .pt-msg {
  margin-top: 4px;
}

/* Valuta firme: samo za čitanje, uz vezu do mjesta gdje se mijenja. */
.pt-cur {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f5f6f8;
}

.pt-cur-ic {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #f1f3f6;
  color: #46505f;
}

.pt-cur-t small {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  color: #5b6676;
}

.pt-cur-t b {
  font-size: 0.94rem;
  font-weight: 800;
}

.pt-cur-a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 4px;
  font-size: 0.82rem;
  font-weight: 800;
  color: #2459c7;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.pt-cur-a:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
  border-radius: 6px;
}

/* Pad učitavanja. */
.pt-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 34px 24px 24px;
  text-align: center;
}

.pt-empty h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
}

.pt-empty p {
  max-width: 320px;
  margin: 0;
  font-size: 0.86rem;
  color: #5b6676;
}

.pt-empty-ic {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin-bottom: 4px;
  border-radius: 20px;
  background: #fde8e6;
  color: #c4281c;
}

.pt-retry {
  width: auto;
  margin-top: 8px;
}

/* Skeleton. */
.pt-skel {
  display: grid;
  gap: 14px;
}

.pt-skl {
  display: grid;
  gap: 14px;
  margin-top: 16px;
}

.sk {
  display: block;
  border-radius: 8px;
  background: linear-gradient(90deg, #eceff3 0%, #f6f7f9 50%, #eceff3 100%);
  background-size: 200% 100%;
  animation: pt-shimmer 1.3s linear infinite;
}

@keyframes pt-shimmer {
  to {
    background-position: -200% 0;
  }
}

@media (max-width: 400px) {
  .pt-card {
    padding: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sk {
    animation: none;
  }
}
</style>
