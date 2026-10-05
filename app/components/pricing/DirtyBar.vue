<template>
  <!-- Omot je uvijek u DOM-u: aria-live polje mora postojati prije nego što dobije tekst, inače čitač
       ekrana ne objavi ono što se pojavi zajedno sa njim. Sama traka se pokazuje tek kad ima nacrta. -->
  <div class="db-wrap">
    <p class="db-sr" role="status" aria-live="polite" aria-atomic="true" data-pricing="dirty-live">
      {{ announced }}
    </p>

    <div
      v-if="ws.price.dirty"
      class="db"
      role="group"
      aria-label="Nesačuvane izmjene cijene"
      data-pricing="dirty-bar"
    >
      <div class="db-t">
        <b class="db-h">Nesačuvane izmjene</b>
        <ul class="db-d" role="list">
          <li v-if="ws.price.dirtyFields.base">
            Startna cijena <s>{{ formatNum2(ws.price.savedNumbers.base) }}</s> →
            <strong v-if="ws.price.rawErrors.base" class="db-bad"
              ><span aria-hidden="true">?</span><span class="sr">neispravan iznos</span></strong
            >
            <strong v-else>{{ formatMoney(ws.price.numbers.base, currency) }}</strong>
          </li>
          <li v-if="ws.price.dirtyFields.km">
            Po kilometru <s>{{ formatNum2(ws.price.savedNumbers.km) }}</s> →
            <strong v-if="ws.price.rawErrors.km" class="db-bad"
              ><span aria-hidden="true">?</span><span class="sr">neispravan iznos</span></strong
            >
            <strong v-else>{{ formatNum2(ws.price.numbers.km) }} {{ currency }}/km</strong>
          </li>
          <li v-if="example" data-pricing="dirty-example">
            Za {{ formatKm(ws.sim.dist) }} km:
            <template v-if="example.same">
              <strong>{{ formatMoney(example.after, currency) }}</strong> (bez promjene)
            </template>
            <template v-else>
              <s>{{ formatNum2(example.before) }}</s> →
              <strong>{{ formatMoney(example.after, currency) }}</strong>
            </template>
          </li>
        </ul>
        <span class="db-n">Čim sačuvaš, važi za nove narudžbe.</span>
      </div>

      <div class="db-r">
        <AppButton
          variant="ghost"
          data-pricing="reset-price"
          :disabled="ws.price.saving"
          @click="onReset"
        >
          Poništi
        </AppButton>
        <AppButton
          ref="saveBtn"
          data-pricing="save-price"
          :disabled="hasErrors"
          :loading="ws.price.saving"
          @click="onSave"
        >
          {{ ws.price.saving ? "Čuvam…" : "Sačuvaj cijenu" }}
        </AppButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import type { PriceKey } from "~/composables/usePricingDraft";
import type { PricingWorkspace } from "~/composables/usePricingWorkspace";
import { formatKm, formatMoney, formatNum2, round2 } from "~/utils/pricing";
import { SANITY_TITLE } from "~/utils/pricingDrafts";

// Traka "Nesačuvane izmjene" uz dno sadržaja taba Cijena. Pokazuje šta se mijenja (staro precrtano, novo)
// i šta to znači za primjer od izabranih kilometara, pa dispečer vidi posljedicu prije nego što sačuva.
// Traka je u lijevoj koloni, pa na računaru nikad ne prelazi preko Primjera narudžbe. Ostaje ljepljiva uz
// dno prozora dok se sadržaj skroluje; stranica može podići (telefon, donja traka Primjera) postavljanjem
// --pricing-bar-bottom na roditelju; bez toga se drži iznad sigurne zone uređaja.
// Čuvanje i poništavanje rade radnje radnog prostora; potvrdu "Cijena je sačuvana." pravi on, ne traka.
const props = defineProps<{ ws: PricingWorkspace }>();

const emit = defineEmits<{
  // Radnja je uspjela i traka je nestala: tab vraća fokus u polja, da ne ostane na nečemu što više ne postoji.
  dismissed: [];
  // Čuvanje nije uspjelo zbog polja: tab fokusira to polje.
  "focus-field": [key: PriceKey];
}>();

const ANNOUNCE_MS = 900;

const currency = computed(() => props.ws.company.currency);
const hasErrors = computed(() => Object.keys(props.ws.price.rawErrors).length > 0);

// Primjer za izabranu udaljenost sa STVARNIM doplatama (ne sa "šta ako" iz Primjera): traka obećava
// šta će kupci plaćati čim se sačuva, a doplata koja je samo isprobana to ne mijenja. Nema ga dok su
// iznosi neispravni (obračun bi tada koristio sačuvanu vrijednost, pa bi poređenje lagalo) ni dok doplate
// nisu učitane.
const example = computed(() => {
  const calc = props.ws.calc;
  if (!calc || hasErrors.value) return null;
  const before = calc.live.before.total;
  const after = calc.live.after.total;
  return { before, after, same: round2(before) === round2(after) };
});

// --- Poruka za čitač ekrana ------------------------------------------------------------------------
// Cijela traka nije živa oblast: svaki pritisak tastera mijenja brojeve i čitač bi ih stalno ponavljao.
// Umjesto toga posebno polje dobija sažetak tek kad se kucanje smiri.
const summary = computed(() => {
  if (hasErrors.value) return "Nesačuvane izmjene. Neki iznos nije ispravan, pa se ne može sačuvati.";
  const parts = ["Nesačuvane izmjene."];
  const ex = example.value;
  const km = formatKm(props.ws.sim.dist);
  if (ex) {
    parts.push(
      ex.same
        ? `Za ${km} km cijena ostaje ${formatMoney(ex.after, currency.value)}.`
        : `Za ${km} km: sa ${formatNum2(ex.before)} na ${formatMoney(ex.after, currency.value)}.`
    );
  }
  const sanity = props.ws.price.sanity;
  if (sanity) parts.push(`${SANITY_TITLE}. ${sanity}`);
  return parts.join(" ");
});

const announced = ref("");
let timer: ReturnType<typeof setTimeout> | null = null;

// Nova serija izmjena: polje se prvo isprazni, da se isti tekst opet pročita.
watch(
  () => props.ws.price.dirty,
  (open) => {
    if (open) announced.value = "";
  }
);

watch(
  () => [props.ws.price.dirty, summary.value] as const,
  ([open, text]) => {
    if (timer) clearTimeout(timer);
    timer = null;
    // Bez prozora (render na serveru) nema ko da čita poruku, a tajmer bi ostao viseći.
    if (!open || typeof window === "undefined") return;
    timer = setTimeout(() => {
      announced.value = text;
      timer = null;
    }, ANNOUNCE_MS);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});

// --- Radnje -----------------------------------------------------------------------------------------
const saveBtn = ref<{ $el?: HTMLElement } | null>(null);

const onReset = async () => {
  props.ws.actions.discardPrice();
  await nextTick();
  announced.value = "Izmjene su poništene.";
  emit("dismissed");
};

const onSave = async () => {
  if (props.ws.price.saving || hasErrors.value) return;
  const result = await props.ws.actions.savePrice();
  await nextTick();
  if (result.ok) {
    emit("dismissed");
    return;
  }
  // Neuspjeh: fokus ide na polje koje je odbijeno, a bez polja nazad na "Sačuvaj cijenu" (dugme je bilo
  // onemogućeno dok je čuvanje trajalo, pa je pretraživač mogao spustiti fokus na stranicu).
  const shown = props.ws.price.shownErrors;
  if (shown.base) emit("focus-field", "base");
  else if (shown.km) emit("focus-field", "km");
  else saveBtn.value?.$el?.focus?.({ preventScroll: true });
};
</script>

<style scoped>
/* Ljepljiv omot: traka i njeno polje za čitač ekrana. Bez trake je visok 0 px. */
.db-wrap {
  position: sticky;
  bottom: var(--pricing-bar-bottom, env(safe-area-inset-bottom, 0px));
  z-index: 4;
}

.sr,
.db-sr {
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

.db {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  padding: 12px 14px;
  border-radius: 18px;
  background: #fff;
  color: #0b1220;
  box-shadow: 0 -1px 0 #e7e9ee, 0 10px 30px rgba(11, 18, 32, 0.18), 0 1px 2px rgba(11, 18, 32, 0.08);
  animation: db-up 0.18s ease-out;
}

@keyframes db-up {
  from {
    transform: translateY(8px);
    opacity: 0;
  }
  to {
    transform: none;
    opacity: 1;
  }
}

.db-t {
  display: grid;
  gap: 2px;
  flex: 1 1 260px;
  min-width: 0;
  font-size: 0.86rem;
}

.db-h {
  font-size: 0.92rem;
  font-weight: 800;
}

/* role="list" u šablonu vraća semantiku liste koju Safari uklanja zbog list-style: none. */
.db-d {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: #5b6676;
  font-variant-numeric: tabular-nums;
}

.db-d s {
  color: #5b6676;
}

.db-d strong {
  color: #0b1220;
}

.db-d strong.db-bad {
  color: #b42318;
}

.db-n {
  color: #5b6676;
  font-size: 0.86rem;
}

.db-r {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  margin-left: auto;
}

.db-r :deep(.ab) {
  width: auto;
  min-height: 48px;
  padding: 0 18px;
  font-size: 0.92rem;
}

/* Uzak ekran: dugmad zauzimaju cijeli red, "Sačuvaj cijenu" je šire. */
@media (max-width: 480px) {
  .db-r {
    flex: 1 1 100%;
  }

  .db-r :deep(.ab:last-child) {
    flex: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .db {
    animation: none;
  }
}
</style>
