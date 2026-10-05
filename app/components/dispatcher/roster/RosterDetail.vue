<template>
  <article class="dt" aria-label="Detalji kurira">
    <header class="dt-head">
      <span class="dt-av" aria-hidden="true">
        {{ ini }}
        <span class="dot" :style="{ background: courier.suspended ? '#e5484d' : live.dot }" />
      </span>
      <div class="dt-t">
        <h2 id="roster-detail-title" ref="title" tabindex="-1">{{ courier.name }}</h2>
        <div class="dt-meta">
          <button
            type="button"
            class="dt-id"
            :class="{ done: copied === 'id' }"
            data-detail="copy-id"
            :aria-label="`Kopiraj ID kurira ${courier.id}`"
            @click="copy('id', String(courier.id))"
          >
            <template v-if="copied === 'id'"><v-icon icon="mdi-check" size="16" />Kopirano</template>
            <template v-else>Kurir #{{ courier.id }}<v-icon icon="mdi-content-copy" size="16" /></template>
          </button>
          <span class="dt-st" :style="stStyle"><i />{{ courier.suspended ? "Suspendovan" : live.label }}</span>
        </div>
        <span class="dt-seen">{{ courier.loc ? `Lokacija: ${seenText(courier, now)}` : "Lokacija nije poznata" }}</span>
      </div>
      <button type="button" class="dt-x" data-detail="close" aria-label="Zatvori detalje" @click="emit('close')">
        <v-icon icon="mdi-close" size="20" />
      </button>
    </header>

    <div class="dt-qa">
      <a
        v-if="courier.phone"
        class="qb"
        data-detail="call"
        :href="telHref(courier.phone)"
        :aria-label="`Pozovi ${courier.name}`"
      >
        <v-icon icon="mdi-phone-outline" size="22" />Pozovi
      </a>
      <button v-else type="button" class="qb" disabled title="Kurir nema upisan telefon">
        <v-icon icon="mdi-phone-outline" size="22" />Pozovi
      </button>
      <button
        type="button"
        class="qb"
        data-detail="message"
        :aria-label="`Pošalji poruku ${courier.name}`"
        @click="emit('sheet', 'poruka')"
      >
        <v-icon icon="mdi-message-text-outline" size="22" />Poruka
      </button>
      <NuxtLink
        v-if="courier.loc"
        class="qb"
        data-detail="map"
        :to="`/dispatcher?c=${courier.id}`"
        :aria-label="`Prikaži ${courier.name} na mapi`"
      >
        <v-icon icon="mdi-map-marker-radius-outline" size="22" />Na mapi
      </NuxtLink>
      <button v-else type="button" class="qb" disabled title="Nema poznate lokacije">
        <v-icon icon="mdi-map-marker-radius-outline" size="22" />Na mapi
      </button>
      <button
        type="button"
        class="qb"
        data-detail="suspend"
        :aria-label="`${courier.suspended ? 'Aktiviraj' : 'Suspenduj'} ${courier.name}`"
        @click="emit('sheet', courier.suspended ? 'aktiviraj' : 'suspenduj')"
      >
        <v-icon :icon="courier.suspended ? 'mdi-account-check-outline' : 'mdi-account-off-outline'" size="22" />
        {{ courier.suspended ? "Aktiviraj" : "Suspenduj" }}
      </button>
    </div>

    <div v-if="courier.suspended" class="dt-alert">
      <TintAlert tone="bad" icon="mdi-account-off-outline" :title="`Suspendovan ${isoShort(courier.suspendedAt)}`.trim()">
        {{ courier.reason || "Razlog nije upisan." }} Ne prima nove narudžbe.
        <template #action>
          <button type="button" data-detail="alert-activate" @click="emit('sheet', 'aktiviraj')">Aktiviraj kurira</button>
        </template>
      </TintAlert>
    </div>

    <h3 class="gt">Novac</h3>
    <div class="grp">
      <DetailRow
        v-if="courier.cash == null"
        icon="mdi-cash-multiple"
        label="Gotovina"
        value="Nije dostupno"
        hint="Balansi se trenutno ne učitavaju."
        empty
      />
      <DetailRow
        v-else-if="courier.cash > 0"
        icon="mdi-cash-multiple"
        label="Duguje firmi"
        :value="formatAmount(courier.cash, currency)"
        :tone="level === 'over' ? 'bad' : level === 'near' ? 'warn' : null"
      >
        <template v-if="cashLimit != null" #extra>
          <span class="meter" :class="level">
            <span class="bar" role="img" :aria-label="`${pctRaw}% limita gotovine`"><i :style="{ width: `${pct}%` }" /></span>
            <small>
              {{ pctRaw }}% limita od {{ formatAmount(cashLimit, currency) }}{{ level === "over" ? ", preko limita" : "" }}
            </small>
          </span>
        </template>
      </DetailRow>
      <DetailRow
        v-else
        icon="mdi-cash-multiple"
        :label="courier.cash < 0 ? 'Firma duguje kuriru (gotovina)' : 'Gotovina'"
        :value="courier.cash < 0 ? formatAmount(-courier.cash, currency) : 'Nema duga'"
        :tone="courier.cash < 0 ? 'ok' : null"
      />
      <DetailRow
        v-if="courier.wage != null"
        icon="mdi-wallet-outline"
        label="Firma duguje kuriru (zarada)"
        :value="formatAmount(courier.wage, currency)"
        :tone="courier.wage > 0 ? 'blue' : null"
      />
      <div class="two">
        <button type="button" class="btn" data-detail="receipt" @click="emit('sheet', 'uplata')">
          <v-icon icon="mdi-cash-plus" size="18" />Evidentiraj uplatu
        </button>
        <button type="button" class="btn" data-detail="payout" @click="emit('sheet', 'isplata')">
          <v-icon icon="mdi-cash-minus" size="18" />Isplati zaradu
        </button>
      </div>
    </div>

    <h3 class="gt">Kontakt</h3>
    <div class="grp">
      <DetailRow
        icon="mdi-phone-outline"
        label="Telefon"
        :value="phone || 'Nije upisan'"
        :empty="!phone"
        actionable
        row="kontakt"
        :aria-label="`Telefon: ${phone || 'nije upisan'}. Izmijeni kontakt`"
        @act="emit('sheet', 'kontakt', 'phone')"
      >
        <template v-if="phone" #end>
          <button
            type="button"
            class="ib"
            data-detail="copy-phone"
            :aria-label="`Kopiraj telefon ${phone}`"
            @click="copy('phone', phone)"
          >
            <v-icon :icon="copied === 'phone' ? 'mdi-check' : 'mdi-content-copy'" size="20" />
          </button>
        </template>
      </DetailRow>
      <DetailRow
        icon="mdi-account-outline"
        label="Korisničko ime za prijavu"
        :value="courier.email || 'Nije upisano'"
        :empty="!courier.email"
      >
        <template v-if="courier.email" #end>
          <button
            type="button"
            class="ib"
            data-detail="copy-email"
            aria-label="Kopiraj korisničko ime"
            @click="copy('email', courier.email)"
          >
            <v-icon :icon="copied === 'email' ? 'mdi-check' : 'mdi-content-copy'" size="20" />
          </button>
        </template>
      </DetailRow>
      <DetailRow
        icon="mdi-account-alert-outline"
        label="Hitni kontakt"
        :value="emergency || 'Nije dodat'"
        :empty="!emergency"
        :tone="emergency ? null : 'warn'"
        actionable
        row="kontakt-hitni"
        @act="emit('sheet', 'kontakt', 'ecName')"
      />
    </div>

    <h3 class="gt">Posao</h3>
    <div class="grp">
      <DetailRow
        :icon="vehicle.icon"
        label="Vozilo"
        :value="vehicle.label"
        :tone="courier.vehicle ? null : 'warn'"
        :hint="courier.vehicle ? undefined : 'Bez vozila dispečer ne može da ga predloži za narudžbu.'"
        actionable
        row="vozilo"
        @act="emit('sheet', 'vozilo')"
      />
      <DetailRow
        icon="mdi-bank-outline"
        label="Ugovor i isplata (ova firma)"
        :value="payText(courier, currency) || 'Nije podešeno'"
        :empty="!courier.payType"
        :hint="contractHint || undefined"
        actionable
        row="ugovor"
        @act="emit('sheet', 'ugovor')"
      />
    </div>

    <h3 class="gt">Lični podaci</h3>
    <div class="grp">
      <DetailRow
        icon="mdi-calendar-outline"
        label="Datum rođenja"
        :value="dobText || 'Nije upisan'"
        :empty="!courier.dob"
        actionable
        row="licni"
        @act="emit('sheet', 'licni', 'dob')"
      />
      <DetailRow
        icon="mdi-card-account-details-outline"
        label="IBAN"
        :value="courier.iban ? formatIban(courier.iban) : 'Nije upisan'"
        :empty="!courier.iban"
        actionable
        row="licni-iban"
        @act="emit('sheet', 'licni', 'iban')"
      />
      <DetailRow
        icon="mdi-text-box-outline"
        label="Napomena"
        :value="courier.note || 'Nema napomene'"
        :empty="!courier.note"
        actionable
        row="napomena"
        @act="emit('sheet', 'napomena')"
      />
    </div>

    <h3 class="gt">Poruke</h3>
    <div class="grp">
      <DetailRow
        icon="mdi-message-text-outline"
        label="Zadnja poruka"
        :value="lastTitle || 'Još ništa nije poslato'"
        :empty="!lastTitle"
        :hint="lastHint || undefined"
        tone="blue"
        actionable
        row="poruka"
        :aria-label="`Nova poruka za ${courier.name}`"
        end-text="Nova"
        @act="emit('sheet', 'poruka')"
      />
      <div v-if="messages.loading" class="ml" role="status" aria-label="Učitavam poruke">
        <i class="b" style="height: 44px" /><i class="b" style="height: 44px" />
      </div>
      <div v-else-if="messages.failed" class="ml-fail">
        <TintAlert tone="warn" icon="mdi-cloud-off-outline" title="Ne mogu da učitam poruke">
          Ostatak detalja radi.
          <template #action>
            <button type="button" data-detail="retry-messages" @click="emit('retryMessages')">Pokušaj ponovo</button>
          </template>
        </TintAlert>
      </div>
      <ul v-else-if="messages.items.length" class="ml" aria-label="Zadnje poruke">
        <li v-for="m in messages.items" :key="m.id" class="mi">
          <b>{{ m.title }}</b>
          <small>{{ relativeTime(m.sentAt, now) }} · {{ m.read ? "pročitano" : "nepročitano" }}</small>
        </li>
      </ul>
    </div>

    <h3 class="gt">Nalog</h3>
    <div class="grp">
      <DetailRow icon="mdi-calendar-clock-outline" label="Nalog otvoren" :value="isoLong(courier.created) || '-'" />
      <DetailRow
        icon="mdi-lock-reset"
        label="Lozinka"
        value="Postavi novu lozinku"
        hint="Sistem ne šalje poruku. Podatke za prijavu prosljeđuješ ti."
        actionable
        row="lozinka"
        @act="emit('sheet', 'lozinka')"
      />
    </div>

    <div class="dz">
      <button type="button" class="ghost" data-detail="remove" @click="emit('sheet', 'ukloni')">
        <v-icon icon="mdi-account-remove-outline" size="18" />Ukloni sa liste firme
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import DetailRow from "~/components/dispatcher/roster/DetailRow.vue";
import { useAlertStore } from "~/stores/alert";
import { copyText } from "~/utils/clipboard";
import {
  LIVE_META,
  cashLevel,
  fmtPhone,
  isoShort,
  liveOf,
  payText,
  seenText,
  telHref,
  unreadText,
  vehicleView,
  type RosterCourier,
  type RosterSheetKind,
} from "~/utils/courierRoster";
import { relativeTime } from "~/utils/courierStatus";
import { formatAmount } from "~/utils/currency";
import { ageOn, ageText, formatIban, initials, isoLong } from "~/utils/profileForm";
import { toLatin } from "~/utils/toLatin";
import type { InboxMessage } from "~/types/inbox";

// Detalj izabranog kurira: zaglavlje sa stanjem, brze radnje (poziv, poruka, mapa, suspenzija) i
// šest grupa (novac, kontakt, posao, lični podaci, poruke, nalog). Svaki red sa radnjom otvara list
// za izmjenu te grupe. Isti sadržaj je uz listu na računaru i zasebna stranica na telefonu.
const props = defineProps<{
  courier: RosterCourier;
  now: number;
  currency: string;
  cashLimit: number | null;
  messages: { items: InboxMessage[]; loading: boolean; failed: boolean };
}>();

const emit = defineEmits<{
  close: [];
  sheet: [kind: RosterSheetKind, focus?: string];
  retryMessages: [];
}>();

const alerts = useAlertStore();
const title = ref<HTMLElement | null>(null);

const live = computed(() => LIVE_META[liveOf(props.courier, props.now)]);
const vehicle = computed(() => vehicleView(props.courier.vehicle));
const ini = computed(() =>
  initials(toLatin(props.courier.first), toLatin(props.courier.last), props.courier.email)
);
const phone = computed(() => fmtPhone(props.courier.phone));
const emergency = computed(() =>
  [props.courier.ecName, props.courier.ecPhone ? fmtPhone(props.courier.ecPhone) : ""].filter(Boolean).join(" · ")
);
const stStyle = computed(() =>
  props.courier.suspended
    ? { "--tint": "#fde8e6", "--ink": "#b42318", "--dot": "#e5484d" }
    : { "--tint": live.value.tint, "--ink": live.value.ink, "--dot": live.value.dot }
);

const level = computed(() => cashLevel(props.courier.cash, props.cashLimit));
const pctRaw = computed(() =>
  props.cashLimit ? Math.round((Math.max(0, props.courier.cash ?? 0) / props.cashLimit) * 100) : 100
);
const pct = computed(() => Math.min(100, pctRaw.value));

const contractHint = computed(() =>
  [
    props.courier.bank ? `Žiro račun ${props.courier.bank}` : "",
    props.courier.from ? `Radi od ${isoShort(props.courier.from)}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
);

const dobText = computed(() => {
  if (!props.courier.dob) return "";
  const age = ageOn(props.courier.dob, new Date(props.now));
  return `${isoLong(props.courier.dob)}${age != null ? ` (${ageText(age)})` : ""}`;
});

// Zadnja poruka: iz sažetka (cijela firma jednim pozivom), a ako njega nema, iz učitanih poruka.
const last = computed(() => {
  if (props.courier.lastMsg) return props.courier.lastMsg;
  const m = props.messages.items[0];
  return m ? { title: m.title, sentAt: m.sentAt } : null;
});
const lastTitle = computed(() => last.value?.title ?? "");
const lastHint = computed(() => {
  if (!last.value) return "";
  const unread = props.courier.unread
    ? `, ${unreadText(props.courier.unread)}`
    : props.messages.items.length || props.courier.lastMsg
      ? ", pročitano"
      : "";
  return `${relativeTime(last.value.sentAt, props.now)}${unread}`;
});

const copied = ref<"id" | "phone" | "email" | null>(null);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

const copy = async (kind: "id" | "phone" | "email", text: string) => {
  const ok = await copyText(text);
  if (!ok) {
    alerts.info("Kopiranje nije uspjelo. Označi tekst i kopiraj ručno.");
    return;
  }
  copied.value = kind;
  if (copiedTimer) clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copied.value = null;
  }, 1600);
};

// Drugi kurir: oznaka "kopirano" ne prelazi na njega.
watch(
  () => props.courier.id,
  () => {
    copied.value = null;
  }
);

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer);
});

defineExpose({ focusTitle: () => title.value?.focus({ preventScroll: true }) });
</script>

<style scoped>
.dt {
  min-width: 0;
  padding-bottom: 4px;
}

.dt-head {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 18px 16px 12px;
}

.dt-av {
  position: relative;
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

.dt-av .dot {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 3px solid #fff;
}

.dt-t {
  display: grid;
  gap: 6px;
  justify-items: start;
  min-width: 0;
}

.dt-t h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.dt-t h2:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 3px;
  border-radius: 6px;
}

.dt-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}

.dt-id {
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
}

/* Meta od 44 px, a izgled ostaje 32 px. */
.dt-id::after {
  content: "";
  position: absolute;
  inset: -6px -4px;
}

.dt-id .v-icon {
  color: #5b6676;
}

.dt-id.done {
  background: #e3f8ef;
  color: #00734f;
}

.dt-id.done .v-icon {
  color: #00734f;
}

.dt-st {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--tint);
  color: var(--ink);
  font-size: 0.74rem;
  font-weight: 800;
  white-space: nowrap;
}

.dt-st i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--dot);
}

.dt-seen {
  font-size: 0.78rem;
  color: #5b6676;
  font-variant-numeric: tabular-nums;
}

.dt-x {
  display: grid;
  align-self: start;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: -6px -6px 0 0;
  border: 0;
  border-radius: 12px;
  background: #f1f3f6;
  color: #0b1220;
  cursor: pointer;
}

.dt-qa {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding: 4px 16px 14px;
}

.qb {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 4px;
  min-height: 60px;
  padding: 8px 4px;
  border: 1.5px solid #dfe3ea;
  border-radius: 14px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.74rem;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}

.qb:active {
  background: #f1f4f9;
}

.qb:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.dt-alert {
  padding: 0 16px 10px;
}

.gt {
  margin: 0;
  padding: 14px 16px 6px;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #5b6676;
}

.grp {
  margin: 0 8px;
  overflow: hidden;
  border: 1px solid #eceef2;
  border-radius: 14px;
  background: #fff;
}

.meter {
  display: grid;
  gap: 6px;
  margin-top: 6px;
}

.meter .bar {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e5e8ed;
}

.meter .bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: #00b37e;
}

.meter.near .bar i {
  background: #e08a14;
}

.meter.over .bar i {
  background: #e5484d;
}

.meter small {
  font-size: 0.76rem;
  font-weight: 700;
  color: #5b6676;
}

.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 8px 14px 14px;
  border-top: 1px solid #eceef2;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 12px;
  border: 1.5px solid #dfe3ea;
  border-radius: 12px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 700;
  cursor: pointer;
}

.btn:active {
  background: #f1f4f9;
}

.ib {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: -6px -8px -6px 0;
  border: 0;
  border-radius: 12px;
  background: none;
  color: #5b6676;
  cursor: pointer;
}

.ib:active {
  background: #f1f3f6;
}

.ml {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 10px 14px 14px;
  border-top: 1px solid #eceef2;
  list-style: none;
}

.ml-fail {
  padding: 10px 12px 12px;
  border-top: 1px solid #eceef2;
}

.mi {
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f7f8fa;
}

.mi b {
  font-size: 0.88rem;
}

.mi small {
  font-size: 0.76rem;
  color: #5b6676;
}

.b {
  display: block;
  border-radius: 12px;
  background: linear-gradient(90deg, #eef0f4 0%, #f7f8fa 50%, #eef0f4 100%);
  background-size: 200% 100%;
  animation: dt-sh 1.3s linear infinite;
}

@keyframes dt-sh {
  to {
    background-position: -200% 0;
  }
}

.dz {
  display: grid;
  gap: 8px;
  padding: 14px 16px 18px;
}

.ghost {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 46px;
  border: 1.5px solid #dfe3ea;
  border-radius: 14px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
}

.ghost:active {
  background: #f1f4f9;
}

.dt button:focus-visible,
.dt a:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

/* Na telefonu zatvara strelica u zaglavlju stranice, pa X ne treba. */
@media (max-width: 1099px) {
  .dt-x {
    display: none;
  }

  .dt-head {
    grid-template-columns: 64px minmax(0, 1fr);
  }

  .grp {
    margin: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .b {
    animation: none;
  }
}
</style>
