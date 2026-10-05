<template>
  <Transition name="msg-slide">
    <section
      v-if="message"
      class="msg-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="`Poruka: ${title}`"
    >
      <header class="msg-header">
        <button
          ref="closeBtn"
          type="button"
          class="msg-icon-btn"
          aria-label="Nazad na poruke"
          @click="emit('close')"
        >
          <v-icon icon="mdi-arrow-left" size="20" />
        </button>
        <span class="msg-header-title">Poruka</span>
        <span class="msg-header-spacer" />
        <div class="msg-menu-wrap">
          <button
            type="button"
            class="msg-icon-btn"
            aria-label="Više opcija"
            aria-haspopup="menu"
            :aria-expanded="menuOpen"
            @click="menuOpen = !menuOpen"
          >
            <v-icon icon="mdi-dots-vertical" size="20" />
          </button>
          <template v-if="menuOpen">
            <div class="msg-menu-backdrop" @click="menuOpen = false" />
            <div class="msg-menu" role="menu">
              <button type="button" class="msg-menu-item" role="menuitem" @click="markUnread">
                <v-icon icon="mdi-email-outline" size="20" />
                Označi kao nepročitano
              </button>
            </div>
          </template>
        </div>
      </header>

      <div class="msg-scroll">
        <div class="msg-hero">
          <span class="msg-tile" :style="{ background: category.tint, color: category.color }">
            <v-icon :icon="category.icon" size="28" />
          </span>
          <span class="msg-eyebrow" :style="{ color: category.ink }">{{ category.label }}</span>
          <h2 class="msg-title">{{ title }}</h2>
          <p class="msg-meta">
            <span>{{ senderLabel }} · {{ when }}</span>
            <span v-if="message.read" class="msg-read">
              <v-icon icon="mdi-check-all" size="16" /> Pročitano
            </span>
          </p>
        </div>

        <article v-if="segments.length > 0" class="msg-card">
          <p class="msg-text">
            <template v-for="(segment, index) in segments" :key="index">
              <a
                v-if="segment.type === 'link'"
                class="msg-link"
                :href="segment.href"
                :target="isWebLink(segment.href) ? '_blank' : undefined"
                rel="noopener noreferrer"
                >{{ segment.text }}</a
              >
              <template v-else>{{ segment.text }}</template>
            </template>
          </p>
        </article>

        <div v-if="isTodo" class="msg-callout msg-callout--amber">
          <v-icon icon="mdi-checkbox-marked-circle-outline" size="22" />
          <div>
            <strong>Zadatak od dispečera</strong>
            Kad ga završiš, javi dispečeru.
          </div>
        </div>

        <template v-if="isOffer">
          <div class="msg-callout msg-callout--gray">
            <v-icon icon="mdi-information-outline" size="22" />
            <div>
              <strong>Ponuda je zatvorena</strong>
              Ponude se prihvataju dok teče odbrojavanje. Aktivne ponude vidiš na ekranu Dostave.
            </div>
          </div>
          <NuxtLink to="/courier/deliveries" class="msg-cta">
            <v-icon icon="mdi-moped-outline" size="20" />
            Otvori dostave
          </NuxtLink>
        </template>

        <p class="msg-oneway">
          <v-icon icon="mdi-information-outline" size="16" />
          Jednosmerna poruka. Odgovor nije moguć.
        </p>
      </div>

      <footer v-if="total > 1" class="msg-bar">
        <button type="button" class="msg-bar-btn" :disabled="!hasPrev" @click="emit('prev')">
          <v-icon icon="mdi-chevron-left" size="20" />
          Novija
        </button>
        <span class="msg-bar-pos">{{ position }} od {{ total }}</span>
        <button type="button" class="msg-bar-btn" :disabled="!hasNext" @click="emit('next')">
          Starija
          <v-icon icon="mdi-chevron-right" size="20" />
        </button>
      </footer>
    </section>
  </Transition>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { InboxMessage } from "~/types/inbox";
import { SENDER_META, getCategoryMeta, splitOfferBody } from "~/utils/inbox";
import { formatClockTime, formatDayLabel } from "~/utils/datetime";
import { linkify } from "~/utils/linkify";
import { toLatin } from "~/utils/toLatin";

// Otvorena poruka. Nije čet - odgovor nije moguć - nego članak: kategorija,
// naslov, ko i kad, tekst (telefon i linkovi su dodirljivi) i akcija koja zavisi
// od kategorije. Prikaz je preko cijelog ekrana; otvaranjem upravlja stranica
// (?m=ID u adresi), pa dugme Nazad na telefonu zatvara poruku.
const props = defineProps<{
  message: InboxMessage | null;
  // 1-based mjesto u nizu poruka kroz koje se kreće i njihov ukupan broj.
  position: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
}>();

const emit = defineEmits<{
  close: [];
  prev: [];
  next: [];
  "mark-unread": [];
}>();

const menuOpen = ref(false);
const closeBtn = ref<HTMLButtonElement | null>(null);

const category = computed(() => getCategoryMeta(props.message?.category));
const isOffer = computed(() => props.message?.category === "offer");
const isTodo = computed(() => props.message?.category === "todo");

// Ponuda: naslov je restoran, a ostatak ("adresa · cijena") je tekst. Ako tekst
// nema razdvajač, cijeli tekst je naslov (oblik treba potvrditi uživo).
const offerParts = computed(() =>
  props.message ? splitOfferBody(toLatin(props.message.body)) : { headline: "", details: "" }
);

const title = computed(() => {
  const m = props.message;
  if (!m) return "";
  if (isOffer.value) return offerParts.value.headline || toLatin(m.title);
  return toLatin(m.title);
});

// Naslov je čest "subject" (npr. "Kišni test"), ali kad je identičan tekstu
// poruke nema smisla duplirati ga u kartici.
const bodyText = computed(() => {
  const m = props.message;
  if (!m) return "";
  if (isOffer.value) return offerParts.value.details;
  const body = toLatin(m.body).trim();
  return body === title.value.trim() ? "" : body;
});

const segments = computed(() => linkify(bodyText.value));

const senderLabel = computed(() =>
  isOffer.value ? "Sistem" : (SENDER_META[props.message?.sender ?? "dispatcher"]?.label ?? "Dispečer")
);

const when = computed(() => {
  const iso = props.message?.sentAt;
  return `${formatDayLabel(iso)}, ${formatClockTime(iso)}`;
});

const isWebLink = (href: string | undefined) => Boolean(href && /^https?:\/\//i.test(href));

const markUnread = () => {
  menuOpen.value = false;
  emit("mark-unread");
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Escape") return;
  if (menuOpen.value) menuOpen.value = false;
  else emit("close");
};

// Poruka se promijenila (prethodna / sljedeća) - meni ne ostaje otvoren.
watch(
  () => props.message?.id,
  () => {
    menuOpen.value = false;
  }
);

let previouslyFocused: HTMLElement | null = null;

// Zaključaj scroll pozadine + Esc zatvara dok je poruka otvorena. Fokus ide na
// dugme Nazad, a po zatvaranju se vraća na red koji je poruku otvorio.
watch(
  () => Boolean(props.message),
  async (open) => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      window.addEventListener("keydown", onKeydown);
      await nextTick();
      closeBtn.value?.focus({ preventScroll: true });
    } else {
      window.removeEventListener("keydown", onKeydown);
      menuOpen.value = false;
      previouslyFocused?.focus?.({ preventScroll: true });
      previouslyFocused = null;
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (typeof document !== "undefined") document.body.style.overflow = "";
  if (typeof window !== "undefined") window.removeEventListener("keydown", onKeydown);
});
</script>

<style scoped>
.msg-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  background: #f5f6f8;
}

/* Na širem ekranu ista centrirana kolona kao ostatak aplikacije (bez
   transform-a - da ne smeta slide tranziciji). */
@media (min-width: 792px) {
  .msg-overlay {
    left: 50%;
    right: auto;
    width: 760px;
    margin-left: -380px;
    border-left: 1px solid #e2e5ea;
    border-right: 1px solid #e2e5ea;
  }
}

.msg-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  padding-top: max(14px, var(--v-safe-top, 0px));
  background: rgba(245, 246, 248, 0.94);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid #e7e9ee;
}

.msg-header-title {
  font-weight: 800;
  font-size: 1.05rem;
  letter-spacing: -0.01em;
  color: #0b1220;
}

.msg-header-spacer {
  flex: 1;
}

.msg-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 12px;
  background: #fff;
  color: #0b1220;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.06);
}

.msg-icon-btn:active {
  background: #eceff3;
}

.msg-icon-btn:focus-visible,
.msg-bar-btn:focus-visible,
.msg-menu-item:focus-visible,
.msg-cta:focus-visible,
.msg-link:focus-visible {
  outline: 2px solid #2f6fed;
  outline-offset: 2px;
}

.msg-menu-wrap {
  position: relative;
}

.msg-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3;
}

.msg-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 4;
  min-width: 232px;
  padding: 6px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 12px 32px rgba(11, 18, 32, 0.2), 0 1px 2px rgba(11, 18, 32, 0.08);
}

.msg-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 12px;
  border: none;
  border-radius: 10px;
  background: none;
  font-size: 0.88rem;
  font-weight: 600;
  text-align: left;
  color: #0b1220;
  cursor: pointer;
}

.msg-menu-item:hover,
.msg-menu-item:active {
  background: #f3f5f8;
}

.msg-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 16px 24px;
}

.msg-hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.msg-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  margin-bottom: 8px;
  border-radius: 18px;
}

.msg-eyebrow {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.msg-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: #0b1220;
  text-wrap: balance;
  overflow-wrap: anywhere;
}

.msg-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin: 2px 0 0;
  font-size: 0.84rem;
  color: #657083;
}

.msg-read {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 700;
  color: #2459c7;
}

.msg-card {
  padding: 18px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.msg-text {
  margin: 0;
  font-size: 1rem;
  line-height: 1.6;
  color: #1b2431;
  white-space: pre-wrap;
  word-break: break-word;
}

.msg-link {
  color: #2459c7;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.msg-callout {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  padding: 14px;
  border-radius: 16px;
  font-size: 0.88rem;
  line-height: 1.45;
}

.msg-callout strong {
  display: block;
  margin-bottom: 2px;
  font-size: 0.9rem;
}

.msg-callout--amber {
  background: #fff2df;
  color: #5c3305;
}

.msg-callout--amber :deep(.v-icon) {
  color: #9a4a07;
}

.msg-callout--gray {
  background: #eceff3;
  color: #3b4554;
}

.msg-callout--gray :deep(.v-icon) {
  color: #5b6676;
}

.msg-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 46px;
  border-radius: 12px;
  background: #0b1220;
  color: #fff;
  font-size: 0.92rem;
  font-weight: 700;
  text-decoration: none;
}

.msg-cta:active {
  background: #1b2433;
}

.msg-oneway {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: auto 0 0;
  padding-top: 8px;
  font-size: 0.76rem;
  text-align: center;
  color: #657083;
}

.msg-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px calc(8px + var(--v-safe-bottom, 0px));
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(8px);
  border-top: 1px solid #e7e9ee;
}

.msg-bar-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 0 14px;
  border: none;
  border-radius: 12px;
  background: transparent;
  font-size: 0.88rem;
  font-weight: 700;
  color: #2459c7;
  cursor: pointer;
}

.msg-bar-btn:active:not(:disabled) {
  background: #eef4ff;
}

.msg-bar-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.msg-bar-pos {
  font-size: 0.76rem;
  font-weight: 600;
  color: #657083;
  font-variant-numeric: tabular-nums;
}

/* Slide-in kao ulazak u poruku na mobilnom */
.msg-slide-enter-active,
.msg-slide-leave-active {
  transition: transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.msg-slide-enter-from,
.msg-slide-leave-to {
  transform: translateX(100%);
}

@media (prefers-reduced-motion: reduce) {
  .msg-slide-enter-active,
  .msg-slide-leave-active {
    transition: none;
  }
}
</style>
