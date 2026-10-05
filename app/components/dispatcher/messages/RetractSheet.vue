<template>
  <AppSheet
    :open="open"
    title="Ukloniti poruku iz sandučića?"
    :subtitle="batch ? `${toLatin(batch.title)} · ${clock(batch.sentAt)}` : ''"
    @update:open="emit('update:open', $event)"
    @submit="onSubmit"
  >
    <template v-if="batch && state">
      <template v-if="state.phase === 'ask'">
        <div class="rt-pv" :style="{ '--tint': cat.tint, '--ink': cat.color }">
          <span class="ic1"><v-icon :icon="cat.icon" size="22" /></span>
          <span class="main">
            <span class="eb" :style="{ color: cat.ink }">{{ cat.label }}</span>
            <span class="tt">{{ toLatin(batch.title) }}</span>
            <span class="sn">{{ toLatin(batch.body) }}</span>
          </span>
          <span class="tm">{{ clock(batch.sentAt) }}</span>
        </div>
        <TintAlert tone="warn" title="Šta se događa">
          Poruka nestaje iz Poruka kod {{ couriersText(batch.recipients.length) }}. Ko ju je već pročitao,
          pročitao je; ne možemo ga obavijestiti da je povučena.
          <template v-if="!batch.checkedAt && !canTrack(batch)">
            Prvo tražimo poruku u sandučiću svakog kurira, što je {{ batch.recipients.length }}
            zahtjeva uz isto toliko uklanjanja.
          </template>
        </TintAlert>
      </template>

      <div v-else-if="state.phase === 'lookup' || state.phase === 'run'" class="rt-prog" role="status">
        <b>
          {{
            state.phase === "lookup"
              ? "Tražim poruku u sandučićima…"
              : `Uklanjam ${state.done} od ${state.total}…`
          }}
        </b>
        <div class="bar"><i :style="{ width: `${state.phase === 'lookup' ? 8 : pct}%` }" /></div>
      </div>

      <TintAlert v-else-if="state.phase === 'done'" tone="ok" role="status" title="Poruka je uklonjena">
        Uklonjena iz {{ state.ok }} sandučića.
      </TintAlert>

      <TintAlert v-else-if="state.phase === 'none'" tone="info" role="status" title="Poruka nije pronađena">
        U sandučićima primalaca nema ove poruke: možda je već uklonjena, ili je kurir sam obrisao.
      </TintAlert>

      <TintAlert
        v-else
        tone="bad"
        role="alert"
        :title="state.phase === 'fail' ? 'Server nije prihvatio uklanjanje' : 'Uklonjeno djelimično'"
      >
        {{
          state.phase === "fail"
            ? "Nijedna poruka nije uklonjena. Pokušaj ponovo."
            : `Uklonjena iz ${state.ok} sandučića, ${state.fail} nije uspjelo. Ostale možeš ponovo pokušati.`
        }}
      </TintAlert>
    </template>

    <template #footer>
      <template v-if="state?.phase === 'ask'">
        <AppButton submit variant="danger" icon="mdi-delete-outline" data-autofocus>
          Ukloni iz {{ batch?.recipients.length ?? 0 }} sandučića
        </AppButton>
        <AppButton variant="ghost" @click="emit('update:open', false)">Odustani</AppButton>
      </template>
      <template v-else-if="state?.phase === 'lookup' || state?.phase === 'run'">
        <AppButton variant="danger" loading>Uklanjam…</AppButton>
      </template>
      <template v-else-if="state?.phase === 'partial' || state?.phase === 'fail'">
        <AppButton submit data-autofocus>Pokušaj ponovo</AppButton>
        <AppButton variant="ghost" @click="emit('update:open', false)">Zatvori</AppButton>
      </template>
      <template v-else>
        <AppButton data-autofocus @click="emit('update:open', false)">
          {{ state?.phase === "done" ? "Gotovo" : "Zatvori" }}
        </AppButton>
      </template>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import type { RetractState } from "~/composables/useMessageTracking";
import { couriersText } from "~/utils/courierRoster";
import { getCategoryMeta } from "~/utils/inbox";
import { clock } from "~/utils/messageTime";
import { canTrack, type SentBatch } from "~/utils/messageTracking";
import { toLatin } from "~/utils/toLatin";

// Povlačenje poruke iz sandučića primalaca (DELETE /inbox/{id} po sandučiću): pitanje sa objašnjenjem
// da ko je pročitao, pročitao je; napredak; pa potpun ili djelimičan ishod. Ne tvrdi se da je poruka
// povučena kad nije.
const props = defineProps<{ open: boolean; batch: SentBatch | null; state: RetractState | null }>();
const emit = defineEmits<{ "update:open": [boolean]; go: [] }>();

const cat = computed(() => getCategoryMeta(props.batch?.category));
const pct = computed(() => (props.state?.total ? Math.round((props.state.done / props.state.total) * 100) : 0));

// Dugme "Ukloni" / "Pokušaj ponovo" je submit forme lista.
const onSubmit = () => {
  const phase = props.state?.phase;
  if (phase === "ask" || phase === "partial" || phase === "fail") emit("go");
};
</script>

<style scoped>
.rt-pv {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  column-gap: 12px;
  align-items: start;
  padding: 14px 12px;
  border-radius: 14px;
  background: #f5f9ff;
}

.ic1 {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--tint);
  color: var(--ink);
}

.main {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.eb {
  display: block;
  margin: 2px 0 5px;
  font-size: 0.66rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.tt {
  overflow: hidden;
  font-size: 0.96rem;
  font-weight: 800;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sn {
  display: -webkit-box;
  margin-top: 3px;
  overflow: hidden;
  font-size: 0.86rem;
  line-height: 1.4;
  color: #5b6676;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.tm {
  padding-top: 2px;
  font-size: 0.74rem;
  color: #657083;
  font-variant-numeric: tabular-nums;
}

.rt-prog {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f7f8fa;
}

.bar {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e5e8ed;
}

.bar i {
  display: block;
  height: 100%;
  background: #0b1220;
  transition: width 0.2s;
}

@media (prefers-reduced-motion: reduce) {
  .bar i {
    transition: none;
  }
}
</style>
