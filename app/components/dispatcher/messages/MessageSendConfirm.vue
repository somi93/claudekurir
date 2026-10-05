<template>
  <AppSheet
    :open="open"
    :title="`Poslati ${couriersText(plan.count)}?`"
    :subtitle="audience"
    @update:open="emit('update:open', $event)"
    @submit="emit('confirm')"
  >
    <div class="cf-who">
      <span class="ic"><v-icon icon="mdi-account-group-outline" size="22" /></span>
      <span class="tx">
        <b>{{ couriersText(plan.count) }}</b>
        <em>{{ names }}{{ suspended ? ` · ${suspendedText(suspended)}` : "" }}</em>
      </span>
    </div>

    <div class="cf-pv">
      <small>Tako kurir vidi poruku</small>
      <div class="row" :style="{ '--tint': cat.tint, '--ink': cat.color }">
        <span class="ic1"><v-icon :icon="cat.icon" size="22" /></span>
        <span class="main">
          <span class="eb" :style="{ color: cat.ink }">{{ cat.label }}</span>
          <span class="tt">{{ toLatin(draft.title.trim()) }}</span>
          <span class="sn">{{ toLatin(draft.body.trim()) }}</span>
        </span>
        <span class="tm">{{ clock(now) }}</span>
      </div>
    </div>

    <TintAlert tone="info" title="Možeš je povući">
      Dok je u „Poslato“, poruku možeš ukloniti iz sandučića primalaca (ko ju je pročitao, pročitao je).
    </TintAlert>

    <template #footer>
      <AppButton submit icon="mdi-send-outline" data-autofocus :loading="sending">
        {{ sending ? "Šaljem…" : `Pošalji ${couriersText(plan.count)}` }}
      </AppButton>
      <AppButton variant="ghost" :disabled="sending" @click="emit('update:open', false)">
        Nazad na poruku
      </AppButton>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { couriersText, type RosterCourier } from "~/utils/courierRoster";
import { getCategoryMeta } from "~/utils/inbox";
import { audienceText, suspendedIn, suspendedText, type SendPlan } from "~/utils/messageAudience";
import type { MessageDraft } from "~/utils/messageDraft";
import { clock } from "~/utils/messageTime";
import { toLatin } from "~/utils/toLatin";

// Potvrda slanja (od 10 primalaca): tačan broj, imena, pregled poruke. Pogrešna poruka svima je
// najskuplja greška: vidi se tek kad je svi prime. Izbor se računa u času otvaranja, pa broj ovdje
// je broj koji stvarno dobija poruku.
const props = defineProps<{
  open: boolean;
  plan: SendPlan;
  audience: string;
  list: RosterCourier[];
  draft: MessageDraft;
  sending: boolean;
  now: number;
}>();

const emit = defineEmits<{ "update:open": [boolean]; confirm: [] }>();

const cat = computed(() => getCategoryMeta(props.draft.category));
const names = computed(() => audienceText(props.list, 4));
const suspended = computed(() => suspendedIn(props.list));
</script>

<style scoped>
.cf-who {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid #eceef2;
  border-radius: 14px;
}

.cf-who .ic {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #eef4ff;
  color: #2459c7;
}

.cf-who b {
  display: block;
  font-size: 0.98rem;
}

.cf-who em {
  display: block;
  font-size: 0.8rem;
  font-style: normal;
  color: #5b6676;
}

.cf-pv {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px dashed #cfd5df;
  border-radius: 16px;
  background: #f7f8fa;
}

.cf-pv small {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5b6676;
}

.row {
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
</style>
