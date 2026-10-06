<template>
  <AppSheet :open="open" :title="title" :subtitle="subtitle" @update:open="emit('update:open', $event)">
    <div v-if="row" class="je-kv">
      <div v-for="kv in rows" :key="kv.label">
        <small>{{ kv.label }}</small>
        <b>{{ kv.value }}</b>
        <button
          v-if="kv.copy"
          type="button"
          class="je-cp"
          data-sheet="copy-ref"
          :aria-label="`Kopiraj ${kv.label.toLowerCase()}`"
          @click="copy(kv.copy)"
        >
          <v-icon :icon="copied ? 'mdi-check' : 'mdi-content-copy'" size="20" />
        </button>
        <span v-else />
      </div>
    </div>
    <p class="je-note">Referenca je broj za razgovor sa kurirom kad se iznos ne slaže.</p>

    <template v-if="row" #footer>
      <AppButton data-sheet="open-courier" @click="emit('courier', row.courierId)">Otvori kurira</AppButton>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import { copyText } from "~/utils/clipboard";
import { METHOD_LABELS, dateTimeShort, money, signed, type JournalRow } from "~/utils/cashDesk";

// List sa svim poljima jedne stavke prometa (predaja ili isplata) i referencom za kopiranje. Isplata piše
// "Ko je isplatio: Server to ne vraća" (B2 u dokumentu od 06.10.), a način isplate se čita iz napomene.
const props = defineProps<{ open: boolean; row: JournalRow | null; currency: string }>();
const emit = defineEmits<{ "update:open": [value: boolean]; courier: [id: number] }>();

const title = computed(() => {
  const r = props.row;
  if (!r) return "Stavka";
  return r.kind === "payout" ? "Isplata zarade" : r.status === "confirmed" ? "Predaja gotovine" : "Predaja čeka potvrdu";
});
const subtitle = computed(() => (props.row ? `${props.row.name} · ${dateTimeShort(props.row.at)}` : ""));

const rows = computed(() => {
  const x = props.row;
  if (!x) return [];
  const cur = props.currency;
  const out: { label: string; value: string; copy?: string }[] = [{ label: "Kurir", value: `${x.name} (#${x.courierId})` }];
  if (x.kind === "handover") {
    out.push({ label: "Prijavljeno", value: money(x.reported ?? 0, cur) });
    if (x.status === "confirmed") {
      out.push({ label: "Potvrđeno", value: money(x.confirmed ?? 0, cur) });
      out.push({ label: "Razlika", value: x.diff === 0 ? "Nema" : signed(x.diff, cur) });
    }
    if (x.reportedAt) out.push({ label: "Prijavljeno u", value: dateTimeShort(x.reportedAt) });
    if (x.status === "confirmed") {
      if (x.confirmedAt) out.push({ label: "Potvrđeno u", value: dateTimeShort(x.confirmedAt) });
      out.push({ label: "Potvrdio", value: x.by || "Nije poznato" });
    }
  } else {
    out.push({ label: "Iznos", value: money(x.amount, cur) });
    out.push({ label: "Način isplate", value: x.method ? METHOD_LABELS[x.method] : "Nije upisan u napomeni" });
    out.push({ label: "Ko je isplatio", value: "Server to ne vraća" });
  }
  if (x.note) out.push({ label: "Napomena", value: x.note });
  out.push({ label: "Referenca", value: x.ref, copy: x.ref });
  return out;
});

const copied = ref(false);
const copy = async (text: string) => {
  if (!(await copyText(text))) return;
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1600);
};
</script>

<style scoped>
.je-kv {
  display: grid;
  overflow: hidden;
  border: 1px solid #eceef2;
  border-radius: 14px;
}

.je-kv > div {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 44px;
  padding: 8px 12px;
}

.je-kv > div + div {
  border-top: 1px solid #eceef2;
}

.je-kv small {
  font-size: 0.76rem;
  font-weight: 700;
  color: #5b6676;
}

.je-kv b {
  font-size: 0.9rem;
  font-weight: 700;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.je-cp {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: -8px -8px -8px 0;
  border: 0;
  border-radius: 12px;
  background: none;
  color: #5b6676;
  cursor: pointer;
}

.je-cp:active {
  background: #f1f4f9;
}

.je-cp:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.je-note {
  margin: 0;
  font-size: 0.78rem;
  color: #5b6676;
}

@media (max-width: 420px) {
  .je-kv > div {
    grid-template-columns: 96px minmax(0, 1fr) auto;
  }
}
</style>
