<template>
  <div class="pv" aria-live="polite">
    <div class="pv-h">
      <small>Tako kurir vidi poruku</small>
      <span class="pv-seg" role="group" aria-label="Prikaz pregleda">
        <button type="button" :aria-pressed="mode === 'list'" data-preview="list" @click="mode = 'list'">
          U listi
        </button>
        <button type="button" :aria-pressed="mode === 'open'" data-preview="open" @click="mode = 'open'">
          Otvorena
        </button>
      </span>
    </div>

    <div v-if="mode === 'list'" class="pv-row" :style="style">
      <span class="ic"><v-icon :icon="cat.icon" size="22" /></span>
      <span class="main">
        <span class="eb" :style="{ color: cat.ink }">{{ cat.label }}</span>
        <span class="tt" :class="{ 'is-empty': !hasTitle }">{{ title }}</span>
        <span class="sn">{{ snippet || (hasBody ? "" : "Tekst poruke se vidi ovdje.") }}</span>
      </span>
      <span class="tm"><span>{{ time }}</span><i /></span>
    </div>

    <div v-else class="pv-open" :style="style">
      <span class="tile"><v-icon :icon="cat.icon" size="28" /></span>
      <span class="eb" :style="{ color: cat.ink }">{{ cat.label }}</span>
      <h4 :class="{ 'is-empty': !hasTitle }">{{ title }}</h4>
      <span class="mt">Dispečer · Danas, {{ time }}</span>
      <div class="card" :class="{ 'is-empty': !segments.length }">
        <template v-if="segments.length">
          <template v-for="(seg, i) in segments" :key="i">
            <a
              v-if="seg.type === 'link'"
              :href="seg.href"
              :target="seg.href?.startsWith('http') ? '_blank' : undefined"
              :rel="seg.href?.startsWith('http') ? 'noopener noreferrer' : undefined"
              >{{ seg.text }}</a
            >
            <template v-else>{{ seg.text }}</template>
          </template>
        </template>
        <template v-else>{{ hasBody ? "" : "Tekst poruke se vidi ovdje." }}</template>
      </div>
      <div v-if="draft.category === 'todo'" class="co">
        <v-icon icon="mdi-checkbox-marked-circle-outline" size="22" />
        <div><b>Zadatak od dispečera</b>Kad ga završiš, javi dispečeru.</div>
      </div>
      <span class="one">
        <v-icon icon="mdi-information-outline" size="16" />Jednosmerna poruka. Odgovor nije moguć.
      </span>
    </div>

    <span v-if="cyrillic" class="hint">
      <v-icon icon="mdi-information-outline" size="16" />Ćirilica se kuriru prikazuje latinicom.
    </span>
    <span class="hint">
      <v-icon icon="mdi-information-outline" size="16" />Kurir vidi poruku kad otvori aplikaciju.
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { getCategoryMeta } from "~/utils/inbox";
import { linkify } from "~/utils/linkify";
import { clock } from "~/utils/messageTime";
import type { MessageDraft } from "~/utils/messageDraft";
import { toLatin } from "~/utils/toLatin";

// "Tako kurir vidi poruku": red iz kurirskog sandučića ("U listi") i otvorena poruka ("Otvorena"),
// iste kao kod kurira (InboxMessageItem / InboxMessageView): kategorija, naslov, tekst latinicom,
// sat, telefon i link dodirljivi. Poruka je jednosmjerna. Push nije potvrđen (B7), pa natpis kaže samo
// ono što je sigurno: kurir poruku vidi kad otvori aplikaciju.
const props = defineProps<{ draft: MessageDraft; now: number }>();

const mode = ref<"list" | "open">("list");

const HAS_CYR = /[Ѐ-ӿ]/;

const cat = computed(() => getCategoryMeta(props.draft.category));
const rawTitle = computed(() => props.draft.title.trim());
const rawBody = computed(() => props.draft.body.trim());
const hasTitle = computed(() => !!rawTitle.value);
const hasBody = computed(() => !!rawBody.value);
const title = computed(() => (hasTitle.value ? toLatin(rawTitle.value) : "Naslov poruke"));
// Ako je tekst isti kao naslov, ne ponavlja se u listi (kao kod kurira).
const snippet = computed(() => {
  const body = toLatin(rawBody.value);
  return body && body !== title.value ? body : "";
});
const segments = computed(() => linkify(snippet.value));
const time = computed(() => clock(props.now));
const cyrillic = computed(() => HAS_CYR.test(rawTitle.value + rawBody.value));
const style = computed(() => ({ "--tint": cat.value.tint, "--ink": cat.value.color }));
</script>

<style scoped>
.pv {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px dashed #cfd5df;
  border-radius: 16px;
  background: #f7f8fa;
}

.pv-h {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.pv-h small {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5b6676;
}

.pv-seg {
  display: inline-flex;
  padding: 3px;
  border-radius: 12px;
  background: #e9ecf1;
}

.pv-seg button {
  min-height: 44px;
  margin: -3px 0;
  padding: 0 14px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #5b6676;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;
  cursor: pointer;
}

.pv-seg button[aria-pressed="true"] {
  background: #fff;
  color: #0b1220;
  box-shadow: 0 1px 3px rgba(11, 18, 32, 0.14);
}

.pv-seg button:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 1px;
}

.pv-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  column-gap: 12px;
  align-items: start;
  padding: 14px 12px;
  border-radius: 14px;
  background: #f5f9ff;
}

.pv-row .ic {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--tint);
  color: var(--ink);
}

.pv-row .main {
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

.pv-row .tt {
  display: block;
  overflow: hidden;
  font-size: 0.96rem;
  font-weight: 800;
  line-height: 1.25;
  color: #0b1220;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pv-row .tt.is-empty {
  color: #657083;
}

.pv-row .sn {
  display: -webkit-box;
  margin-top: 3px;
  overflow: hidden;
  font-size: 0.86rem;
  line-height: 1.4;
  color: #5b6676;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.pv-row .tm {
  display: flex;
  min-width: 34px;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  padding-top: 2px;
  font-size: 0.74rem;
  color: #657083;
  font-variant-numeric: tabular-nums;
}

.pv-row .tm i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2f6fed;
}

.pv-open {
  display: grid;
  gap: 12px;
  padding: 16px 14px;
  border-radius: 14px;
  background: #f5f6f8;
}

.pv-open .tile {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: var(--tint);
  color: var(--ink);
}

.pv-open .eb {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
}

.pv-open h4 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}

.pv-open h4.is-empty {
  color: #657083;
}

.pv-open .mt {
  font-size: 0.82rem;
  color: #5b6676;
}

.pv-open .card {
  padding: 14px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
  font-size: 0.95rem;
  line-height: 1.55;
  color: #1b2431;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.pv-open .card.is-empty {
  color: #657083;
}

.pv-open .card a {
  color: #2459c7;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.pv-open .co {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  background: #fff2df;
  color: #5c3305;
  font-size: 0.84rem;
  line-height: 1.4;
}

.pv-open .co .v-icon {
  color: #9a4a07;
}

.pv-open .co b {
  display: block;
}

.pv-open .one {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 0.74rem;
  color: #5b6676;
}

.hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 0.78rem;
  line-height: 1.4;
  color: #5b6676;
}
</style>
