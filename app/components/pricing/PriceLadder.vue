<template>
  <section class="pl" data-pricing="ladder-card" :aria-labelledby="titleId">
    <h2 :id="titleId" class="pl-h">Šta kupac plaća po udaljenosti</h2>
    <p class="pl-s">
      Sa doplatama koje su sada na snazi{{ ws.price.dirty ? ", po nesačuvanim iznosima" : "" }}.
    </p>

    <!-- Tabela je tri uske kolone i staje u 320 px (zaglavlja se prelamaju), pa vodoravnog skrola nema;
         overflow-x je samo rezerva za jako uvećan tekst. -->
    <div v-if="rows" class="pl-w">
      <table class="pl-t" data-pricing="ladder">
        <caption class="sr">
          Cijena za nekoliko udaljenosti, sa doplatama koje su sada na snazi{{
            ws.price.dirty ? ", po nesačuvanim iznosima" : ""
          }}. Red najbliži udaljenosti iz Primjera narudžbe je označen.
        </caption>
        <thead>
          <tr>
            <th scope="col">Udaljenost</th>
            <th scope="col">Startna + km</th>
            <th scope="col">Sa doplatama</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.dist"
            :class="{ cur: row.current }"
            :aria-current="row.current ? 'true' : undefined"
            :data-ladder-row="row.dist"
          >
            <td class="pl-d">{{ formatKmShort(row.dist) }} km</td>
            <td>{{ formatNum2(row.startPlusKm) }}</td>
            <td class="pl-t2" :class="{ up: row.changed && row.up, dn: row.changed && !row.up }">
              <span v-if="row.changed" class="pl-v">
                <span class="sr">bilo </span><s>{{ formatNum2(row.before) }}</s>
                <span class="sr">, sada </span><strong>{{ formatMoney(row.after, currency) }}</strong>
                <span class="sr">, {{ row.up ? "poskupljenje" : "pojeftinjenje" }}</span>
              </span>
              <template v-else>{{ formatMoney(row.after, currency) }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Doplate nisu stigle: tabela bez njih bi lagala ("Sa doplatama"). -->
    <div v-else-if="ws.surcharges.loadFailed" class="pl-na" data-pricing="ladder-na">
      <TintAlert tone="warn" role="alert" title="Tabela nije dostupna">
        Doplate se nisu učitale, a tabela ih uračunava u cijenu. Ništa nije izgubljeno.
      </TintAlert>
      <AppButton
        variant="ghost"
        icon="mdi-refresh"
        class="pl-retry"
        data-pricing="ladder-retry"
        @click="ws.actions.reloadAll()"
      >
        Pokušaj ponovo
      </AppButton>
    </div>

    <div
      v-else
      class="pl-skel"
      role="status"
      aria-busy="true"
      aria-label="Učitavam tabelu cijena"
      data-pricing="ladder-loading"
    >
      <i v-for="n in 6" :key="n" class="sk" aria-hidden="true" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, useId } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import type { PricingWorkspace } from "~/composables/usePricingWorkspace";
import { formatKmShort, formatMoney, formatNum2 } from "~/utils/pricing";

// Tabela "Šta kupac plaća po udaljenosti": isti obračun za nekoliko udaljenosti, sa doplatama koje su
// sada na snazi. Dok se kuca nova cijena, red pokazuje staro precrtano i novo (poskupljenje crveno,
// pojeftinjenje zeleno), pa se posljedica izmjene vidi na cijeloj skali, ne samo za jedan primjer.
// Red najbliži udaljenosti iz Primjera narudžbe je istaknut. Redove daje radni prostor (calc.ladder).
const props = defineProps<{ ws: PricingWorkspace }>();

const titleId = `pl-${useId()}`;
const currency = computed(() => props.ws.company.currency);
const rows = computed(() => props.ws.calc?.ladder ?? null);
</script>

<style scoped>
.pl {
  min-width: 0;
  padding: 20px 22px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
  color: #0b1220;
}

.pl-h {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.25;
}

.pl-s {
  margin: 2px 0 0;
  font-size: 0.84rem;
  line-height: 1.4;
  color: #5b6676;
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.pl-w {
  margin-top: 10px;
  overflow-x: auto;
}

.pl-t {
  position: relative;
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
  font-variant-numeric: tabular-nums;
}

.pl-t th {
  padding: 8px 10px;
  border-bottom: 1px solid #eceef2;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  line-height: 1.25;
  text-align: right;
  text-transform: uppercase;
  color: #5b6676;
}

.pl-t td {
  padding: 11px 10px;
  border-bottom: 1px solid #eceef2;
  text-align: right;
  color: #0b1220;
}

.pl-t th:first-child,
.pl-t td:first-child {
  text-align: left;
}

.pl-t tr:last-child td {
  border-bottom: 0;
}

.pl-d {
  font-weight: 700;
}

.pl-t2 {
  font-weight: 800;
}

.pl-t2.up {
  color: #b42318;
}

.pl-t2.dn {
  color: #00734f;
}

/* Staro i novo: u širem prostoru jedno do drugog, u uskom jedno ispod drugog. */
.pl-v {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0 6px;
}

.pl-v s {
  font-size: 0.82rem;
  font-weight: 600;
  color: #5b6676;
}

/* Istaknut red: pozadina, a uz nju i lijeva crta, da oznaka ne zavisi samo od boje. */
.pl-t tr.cur td {
  background: #eef4ff;
}

.pl-t tr.cur td:first-child {
  box-shadow: inset 3px 0 0 #2f6fed;
}

.pl-na {
  display: grid;
  justify-items: start;
  gap: 10px;
  margin-top: 12px;
}

.pl-retry {
  width: auto;
}

.pl-skel {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.sk {
  display: block;
  height: 16px;
  border-radius: 8px;
  background: linear-gradient(90deg, #eceff3 0%, #f6f7f9 50%, #eceff3 100%);
  background-size: 200% 100%;
  animation: pl-shimmer 1.3s linear infinite;
}

@keyframes pl-shimmer {
  to {
    background-position: -200% 0;
  }
}

/* 320 px: uži razmaci i zaglavlja bez velikih slova, da se tri kolone prelome umjesto da skrolaju. */
@media (max-width: 400px) {
  .pl {
    padding: 16px;
  }

  .pl-t {
    font-size: 0.84rem;
  }

  .pl-t th {
    padding: 8px 6px;
    letter-spacing: 0;
    text-transform: none;
    font-size: 0.74rem;
  }

  .pl-t td {
    padding: 11px 6px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sk {
    animation: none;
  }
}
</style>
