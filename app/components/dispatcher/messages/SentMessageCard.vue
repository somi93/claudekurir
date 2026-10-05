<template>
  <article
    class="sc"
    :class="{ 'is-flash': flash }"
    :data-batch="batch.id"
    :style="{ '--tint': cat.tint, '--ink': cat.color }"
    :aria-label="toLatin(batch.title)"
  >
    <header class="sc-h">
      <span class="ic1"><v-icon :icon="cat.icon" size="22" /></span>
      <span class="sc-t">
        <b ref="titleEl" tabindex="-1">{{ toLatin(batch.title) }}</b>
        <small>{{ cat.label }} · {{ batch.audience }} · {{ couriersText(batch.recipients.length) }}</small>
      </span>
      <span class="tm">{{ when }}</span>
    </header>

    <div v-if="batch.sentCount !== batch.intended" class="sc-pad">
      <TintAlert tone="warn" title="Server je javio manje">
        Poruka je poslata {{ batch.sentCount }} od {{ batch.intended }} kurira.
        {{ trackable ? "Provjeri čitanje da vidiš ko je nije dobio." : "" }}
      </TintAlert>
    </div>

    <div v-if="batch.status === 'retracted' || batch.status === 'partial'" class="sc-pad">
      <TintAlert
        :tone="batch.status === 'retracted' ? 'info' : 'bad'"
        :title="batch.status === 'retracted' ? 'Poruka je uklonjena iz sandučića' : 'Poruka je uklonjena djelimično'"
      >
        Uklonjena iz {{ batch.retracted?.ok ?? 0 }} od {{ batch.retracted?.total ?? batch.recipients.length
        }}{{ batch.retracted?.fail ? `; ${batch.retracted.fail} nije uspjelo.` : " sandučića." }}
      </TintAlert>
    </div>

    <div v-if="running" class="sc-prog" role="status">
      <div class="row">
        <b>Provjeravam sandučiće…</b><span>{{ check?.done ?? 0 }} od {{ t.total }}</span>
      </div>
      <div class="bar"><i :style="{ width: `${Math.round(((check?.done ?? 0) / Math.max(1, t.total)) * 100)}%`, background: '#0b1220' }" /></div>
    </div>
    <div v-else-if="!trackable && batch.status !== 'retracted'" class="sc-pad">
      <TintAlert tone="warn" title="Čitanje se ne prati">
        Za više od {{ CHECK_MAX }} kurira provjera po sandučićima bi bila preveliki nalet na server. „Povuci“
        ostaje. Čeka paket poruke sa brojem pročitanih (B1).
      </TintAlert>
    </div>
    <div v-else-if="!batch.checkedAt && batch.status !== 'retracted'" class="sc-prog">
      <div class="row">
        <b>Čitanje još nije provjereno</b><span>{{ batch.recipients.length }} sandučića</span>
      </div>
      <div class="bar" />
    </div>
    <div v-else-if="batch.checkedAt && batch.status !== 'retracted'" class="sc-prog">
      <div class="row">
        <b>Pročitalo {{ t.read }} od {{ t.total }}</b>
        <span>Provjereno {{ agoMs(batch.checkedAt, now) }}</span>
      </div>
      <div
        class="bar"
        role="img"
        :aria-label="`Pročitalo ${t.read}, nije pročitalo ${t.unread}, bez poruke ${t.missing + t.error}`"
      >
        <i class="rd" :style="{ width: pct(t.read) }" />
        <i class="un" :style="{ width: pct(t.unread) }" />
        <i class="er" :style="{ width: pct(t.missing + t.error) }" />
      </div>
      <div class="leg">
        <span><i style="background: #00b37e" />Pročitalo {{ t.read }}</span>
        <span><i style="background: #f0b45a" />Nije pročitalo {{ t.unread }}</span>
        <span v-if="t.missing + t.error">
          <i style="background: #e5484d" />
          <template v-if="t.missing">Nema poruke {{ t.missing }}</template>
          <template v-if="t.missing && t.error"> · </template>
          <template v-if="t.error">Provjera nije uspjela {{ t.error }}</template>
        </span>
      </div>
    </div>

    <div v-if="check?.busy" class="sc-pad">
      <TintAlert tone="warn" role="alert" title="Server je zauzet">
        Provjera je stala jer je pala više od trećine zahtjeva. Pokušaj za minut.
      </TintAlert>
    </div>

    <div class="sc-acts">
      <button
        v-if="batch.status !== 'retracted' && trackable"
        type="button"
        class="btn"
        data-sent="check"
        :disabled="running"
        @click="emit('check')"
      >
        <v-icon icon="mdi-refresh" size="18" />{{ batch.checkedAt ? "Provjeri ponovo" : "Provjeri čitanje" }}
      </button>
      <button
        v-if="batch.status !== 'retracted' && t.unread > 0"
        type="button"
        class="btn btn--p"
        data-sent="remind"
        @click="emit('remind')"
      >
        <v-icon icon="mdi-bell-ring-outline" size="18" />Podseti {{ t.unread }}
        {{ pluralizeSr(t.unread, "nepročitanog", "nepročitana", "nepročitanih") }}
      </button>
      <button
        v-if="batch.checkedAt || batch.status !== 'sent'"
        type="button"
        class="btn"
        data-sent="recipients"
        :aria-expanded="open"
        @click="toggle"
      >
        <v-icon :icon="open ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="18" />Primaoci
      </button>
      <span class="gap" />
      <button
        v-if="batch.status !== 'retracted'"
        type="button"
        class="btn btn--danger"
        data-sent="retract"
        :disabled="running"
        @click="emit('retract')"
      >
        <v-icon icon="mdi-delete-outline" size="18" />Povuci
      </button>
    </div>

    <div v-if="open && (batch.checkedAt || batch.status !== 'sent')" class="sc-rl">
      <div class="sc-rlf" role="group" aria-label="Filter primalaca">
        <button
          v-for="p in pills"
          :key="p.key"
          type="button"
          class="pill"
          :aria-pressed="active === p.key"
          :data-filter="p.key"
          @click="filter = p.key"
        >
          {{ p.label }} <b>{{ p.n }}</b>
        </button>
      </div>
      <p v-if="rows.length === 0" class="sc-none">Nema kurira u ovom filteru.</p>
      <div v-for="row in rows.slice(0, shown)" :key="row.id" class="sc-rr">
        <b>
          <span>{{ row.name }}</span><i>#{{ row.id }}</i>
        </b>
        <span class="sp" :class="`sp--${STATE_META[row.state].cls}`">
          <v-icon :icon="STATE_META[row.state].icon" size="14" />{{ STATE_META[row.state].label }}
        </span>
        <a
          v-if="row.phone && row.state !== 'read'"
          class="call"
          :href="telHref(row.phone)"
          :aria-label="`Pozovi ${row.name}`"
        >
          <v-icon icon="mdi-phone-outline" size="22" />
        </a>
        <span v-else />
      </div>
      <div v-if="rows.length > shown" class="sc-more">
        <button type="button" class="btn" data-sent="more" @click="shown += PAGE">
          Prikaži još {{ Math.min(PAGE, rows.length - shown) }}
        </button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import type { CheckState } from "~/composables/useMessageTracking";
import { couriersText, telHref, type RosterCourier } from "~/utils/courierRoster";
import { pluralizeSr } from "~/utils/datetime";
import { getCategoryMeta } from "~/utils/inbox";
import { agoMs, clock, dayClock, dayLabel } from "~/utils/messageTime";
import { CHECK_MAX, canTrack, tally, type ReadState, type SentBatch } from "~/utils/messageTracking";
import { toLatin } from "~/utils/toLatin";

// Kartica jedne poslate poruke: kategorija, naslov, grupa i broj, sat; traka "Pročitalo 19 od 25";
// Provjeri čitanje, Podseti nepročitane, Primaoci (filter, poziv) i Povuci. Vrijedi za ovu sesiju.
// Greška provjere nije isto što i "nije pročitao": ti kuriri imaju svoj natpis.
const props = defineProps<{
  batch: SentBatch;
  check: CheckState | undefined;
  couriers: ReadonlyMap<number, RosterCourier>;
  now: number;
  flash: boolean;
}>();

const emit = defineEmits<{ check: []; remind: []; retract: [] }>();

const PAGE = 10;

const STATE_META: Record<ReadState, { cls: string; label: string; icon: string }> = {
  read: { cls: "rd", label: "Pročitano", icon: "mdi-check-all" },
  unread: { cls: "un", label: "Nije pročitano", icon: "mdi-clock-outline" },
  missing: { cls: "mi", label: "Nema poruke", icon: "mdi-alert-circle-outline" },
  error: { cls: "mi", label: "Provjera nije uspjela", icon: "mdi-cloud-off-outline" },
  pending: { cls: "pe", label: "Nije provjereno", icon: "mdi-timer-sand" },
};

const titleEl = ref<HTMLElement | null>(null);
const open = ref(false);
const filter = ref<"unread" | "read" | "missing" | "all" | null>(null);
const shown = ref(PAGE + 2);

const cat = computed(() => getCategoryMeta(props.batch.category));
const t = computed(() => tally(props.batch));
const trackable = computed(() => canTrack(props.batch));
const running = computed(() => Boolean(props.check?.running));
const when = computed(() =>
  dayLabel(props.batch.sentAt, props.now) === "Danas"
    ? clock(props.batch.sentAt)
    : dayClock(props.batch.sentAt, props.now)
);
const pct = (n: number) => `${(n / Math.max(1, t.value.total)) * 100}%`;

// Zadani filter: nepročitani, a ako ih nema, svi.
const active = computed(() => filter.value ?? (t.value.unread > 0 ? "unread" : "all"));

const pills = computed(() => {
  const x = t.value;
  const all: { key: "unread" | "read" | "missing" | "all"; label: string; n: number }[] = [
    { key: "unread", label: "Nije pročitalo", n: x.unread },
    { key: "read", label: "Pročitalo", n: x.read },
    { key: "missing", label: "Nema poruke", n: x.missing + x.error },
    { key: "all", label: "Svi", n: x.total },
  ];
  return all.filter((p) => p.n > 0 || p.key === "all" || p.key === active.value);
});

const ORDER: Record<ReadState, number> = { unread: 0, missing: 1, error: 1, pending: 2, read: 3 };

const rows = computed(() =>
  props.batch.recipients
    .map((id) => {
      const c = props.couriers.get(id);
      return {
        id,
        name: c?.name ?? `Kurir #${id}`,
        phone: c?.phone ?? null,
        state: (props.batch.results[id]?.state ?? "pending") as ReadState,
      };
    })
    .filter((r) => {
      const f = active.value;
      return f === "all" || r.state === f || (f === "missing" && r.state === "error");
    })
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.name.localeCompare(b.name, "sr"))
);

const toggle = () => {
  open.value = !open.value;
};

defineExpose({ focusTitle: () => titleEl.value?.focus() });
</script>

<style scoped>
.sc {
  min-width: 0;
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.sc.is-flash {
  animation: sc-flash 1.6s ease-out;
}

@keyframes sc-flash {
  0% {
    background: #fff6d6;
  }
  100% {
    background: #fff;
  }
}

.sc-h {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  padding: 14px 14px 10px;
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

.sc-t b {
  display: block;
  font-size: 0.98rem;
  font-weight: 800;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.sc-t b:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
  border-radius: 4px;
}

.sc-t small {
  display: block;
  margin-top: 2px;
  font-size: 0.78rem;
  color: #5b6676;
}

.tm {
  font-size: 0.76rem;
  color: #657083;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.sc-pad {
  padding: 0 14px 10px;
}

.sc-prog {
  display: grid;
  gap: 6px;
  padding: 0 14px 10px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.84rem;
}

.row b {
  font-weight: 800;
}

.row span {
  font-size: 0.78rem;
  font-weight: 700;
  color: #5b6676;
}

.bar {
  display: flex;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e5e8ed;
}

.bar i {
  display: block;
  height: 100%;
}

.bar .rd {
  background: #00b37e;
}

.bar .un {
  background: #f0b45a;
}

.bar .er {
  background: #e5484d;
}

.leg {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 0.78rem;
  color: #5b6676;
}

.leg span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.leg i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.sc-acts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 2px 14px 14px;
}

.gap {
  flex: 1;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 14px;
  border: 1.5px solid #dfe3ea;
  border-radius: 12px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.btn:active {
  background: #f1f4f9;
}

.btn:focus-visible,
.pill:focus-visible,
.call:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--p {
  border-color: #0b1220;
  background: #0b1220;
  color: #fff;
  box-shadow: 0 6px 16px -8px rgba(11, 18, 32, 0.5);
}

.btn--p:active {
  background: #1b2638;
}

.btn--danger {
  border-color: #f0c9c5;
  color: #b42318;
}

.btn--danger:hover {
  background: #fde8e6;
}

.sc-rl {
  padding: 6px 0 4px;
  border-top: 1px solid #eceef2;
}

.sc-rlf {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 14px;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 14px;
  border: 1.5px solid #dfe3ea;
  border-radius: 999px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
}

.pill[aria-pressed="true"] {
  border-color: #2f6fed;
  background: #eef4ff;
  color: #2459c7;
}

.sc-none {
  margin: 0;
  padding: 8px 14px 12px;
  font-size: 0.84rem;
  color: #5b6676;
}

.sc-rr {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 44px;
  gap: 10px;
  align-items: center;
  min-height: 52px;
  padding: 4px 6px 4px 14px;
  border-top: 1px solid #eceef2;
}

.sc-rr b {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 6px;
  font-size: 0.9rem;
  font-weight: 800;
}

.sc-rr b span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sc-rr b i {
  font-size: 0.74rem;
  font-style: normal;
  font-weight: 700;
  color: #657083;
}

.sp {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
  white-space: nowrap;
}

.sp--rd {
  background: #e3f8ef;
  color: #00734f;
}

.sp--un {
  background: #fff2df;
  color: #9a4a07;
}

.sp--mi {
  background: #fde8e6;
  color: #b42318;
}

.sp--pe {
  background: #eceff3;
  color: #5b6676;
}

.call {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  color: #5b6676;
}

.call:hover {
  background: #f1f3f6;
}

.sc-more {
  display: flex;
  justify-content: center;
  padding: 8px 14px 12px;
}

@media (prefers-reduced-motion: reduce) {
  .sc.is-flash {
    animation: none;
  }
}
</style>
