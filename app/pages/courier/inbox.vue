<template>
  <DeliveryPage :max-width="760">
    <template #header>
      <PageHeader title="Poruke" back-to="/" back-label="Nazad na početnu">
        <template v-if="loaded" #subtitle>
          <template v-if="unreadCount > 0">
            <b class="unread-n">{{ unreadCount }}</b> {{ unreadLabel }}
          </template>
          <template v-else>Sve pročitano</template>
        </template>

        <template #actions>
          <button v-if="unreadCount > 0" type="button" class="mark-all" @click="markAllRead">
            <v-icon icon="mdi-check-all" size="18" />
            Označi sve
          </button>
        </template>

        <template v-if="showChips" #below>
          <GlobalFilterBar role="tablist" aria-label="Kategorije poruka">
            <GlobalFilterPill
              v-for="chip in chips"
              :key="chip.value"
              :label="chip.label"
              :count="chip.unread"
              :chevron="false"
              :active="categoryFilter === chip.value"
              role="tab"
              :aria-selected="categoryFilter === chip.value"
              @click="categoryFilter = chip.value"
            />
          </GlobalFilterBar>
        </template>
      </PageHeader>
    </template>

    <InboxSkeleton v-if="!loaded && !errorMessage" />

    <InboxEmptyState
      v-else-if="!loaded"
      tone="error"
      icon="mdi-alert-circle-outline"
      title="Ne mogu da učitam poruke"
    >
      {{ errorMessage }}
      <template #action>
        <GlobalButtonPrimary @click="retry">
          <v-icon icon="mdi-refresh" size="18" class="mr-1" />
          Pokušaj ponovo
        </GlobalButtonPrimary>
      </template>
    </InboxEmptyState>

    <InboxEmptyState
      v-else-if="messages.length === 0"
      icon="mdi-bell-outline"
      title="Još nema poruka"
    >
      Ovde stižu poruke od dispečera i obaveštenja iz aplikacije.
      <template v-if="canEnablePush" #action>
        <v-btn variant="tonal" color="secondary" @click="enablePush">
          <v-icon icon="mdi-bell-ring-outline" size="18" class="mr-1" />
          Uključi obaveštenja
        </v-btn>
      </template>
    </InboxEmptyState>

    <InboxEmptyState
      v-else-if="filteredMessages.length === 0"
      icon="mdi-bell-off-outline"
      title="Nema poruka u ovoj kategoriji"
    >
      Pokušaj sa drugom kategorijom.
      <template #action>
        <v-btn variant="tonal" color="secondary" @click="categoryFilter = 'all'">
          Prikaži sve
        </v-btn>
      </template>
    </InboxEmptyState>

    <template v-else>
      <InboxMessageList
        :groups="dayGroups"
        :expanded="expandedDigests"
        @open="openMessage"
        @toggle-digest="toggleDigest"
      />
      <div v-if="hasMore" class="load-more">
        <v-btn variant="tonal" color="primary" :loading="loadingMore" @click="loadMore">
          Prikaži starije
        </v-btn>
      </div>
    </template>

    <InboxMessageView
      :message="activeMessage"
      :position="activeIndex + 1"
      :total="sequence.length"
      :has-prev="activeIndex > 0"
      :has-next="activeIndex >= 0 && activeIndex < sequence.length - 1"
      @close="closeMessage"
      @prev="goTo(-1)"
      @next="goTo(1)"
      @mark-unread="markActiveUnread"
    />
  </DeliveryPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Poruke" });

import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "nuxt/app";
import { useSessionStore } from "~/stores/session";
import PageHeader from "~/components/common/PageHeader.vue";
import GlobalFilterBar from "~/components/common/GlobalFilterBar.vue";
import GlobalFilterPill from "~/components/common/GlobalFilterPill.vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import DeliveryPage from "~/components/layout/DeliveryPage.vue";
import InboxSkeleton from "~/components/inbox/InboxSkeleton.vue";
import InboxEmptyState from "~/components/inbox/InboxEmptyState.vue";
import InboxMessageList from "~/components/inbox/InboxMessageList.vue";
import InboxMessageView from "~/components/inbox/InboxMessageView.vue";
import { useCourierInbox } from "~/composables/useCourierInbox";
import { usePushNotifications } from "~/composables/usePushNotifications";
import { isOffer } from "~/utils/inboxGroups";
import { pluralizeSr } from "~/utils/datetime";

const sessionStore = useSessionStore();
const courierId = computed(() => Number(sessionStore.courierId));

const {
  messages,
  loaded,
  loadingMore,
  errorMessage,
  unreadCount,
  hasMore,
  pagesLoaded,
  categoryFilter,
  chips,
  filteredMessages,
  dayGroups,
  expandedDigests,
  toggleDigest,
  retry,
  loadMore,
  markRead,
  markUnread,
  markAllRead,
} = useCourierInbox(courierId);

const unreadLabel = computed(() =>
  pluralizeSr(unreadCount.value, "nepročitana poruka", "nepročitane poruke", "nepročitanih poruka")
);

const showChips = computed(() => loaded.value && chips.value.length > 1);

// --- Otvorena poruka živi u adresi (?m=ID) -------------------------------------
// Tako dugme Nazad na telefonu zatvara poruku umjesto da napusti cijelu stranicu,
// a push notifikacija može da otvori baš tu poruku (vidi firebase-messaging-sw.js).

const route = useRoute();
const router = useRouter();

const activeId = computed(() => {
  const raw = route.query.m;
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(id) && id > 0 ? id : null;
});

const activeMessage = computed(() =>
  activeId.value ? (messages.value.find((m) => m.id === activeId.value) ?? null) : null
);

// Poruke kroz koje se kreće dugmadima Novija / Starija: prave poruke (u izabranoj
// kategoriji) odvojeno od ponuda, najnovija prva.
const sequence = computed(() => {
  const current = activeMessage.value;
  if (!current) return [];
  const offer = isOffer(current);
  const list = messages.value.filter((m) => {
    if (isOffer(m) !== offer) return false;
    if (offer) return true;
    return categoryFilter.value === "all" || m.category === categoryFilter.value;
  });
  return list.some((m) => m.id === current.id) ? list : [current];
});

const activeIndex = computed(() =>
  activeMessage.value ? sequence.value.findIndex((m) => m.id === activeMessage.value!.id) : -1
);

const withMessage = (id: number) => ({ query: { ...route.query, m: String(id) } });

const openMessage = (id: number) => {
  void router.push(withMessage(id));
};

const goTo = (delta: number) => {
  const target = sequence.value[activeIndex.value + delta];
  if (target) void router.replace(withMessage(target.id));
};

const withoutMessage = () => {
  const { m: _m, ...rest } = route.query;
  return { query: rest };
};

// Ako je prethodni zapis u istoriji ova ista lista (otvorili smo poruku iz nje),
// vraćamo se unazad - tako istorija ostaje čista i Nazad radi isto što i strelica.
// Kad je poruka otvorena direktno (push, link), nema se kuda vratiti pa se samo
// skida ?m= iz adrese.
const closeMessage = () => {
  const back = (window.history.state as { back?: string | null } | null)?.back;
  if (back) {
    const [path = "", search = ""] = back.split("?");
    if (path === route.path && !new URLSearchParams(search).has("m")) {
      router.back();
      return;
    }
  }
  void router.replace(withoutMessage());
};

const markActiveUnread = () => {
  const message = activeMessage.value;
  if (!message) return;
  void markUnread(message.id);
  closeMessage();
};

// Otvaranje poruke je označava pročitanom (optimistički, PUT ide u pozadini).
watch(
  activeMessage,
  (message) => {
    if (message && !message.read) void markRead(message.id);
  },
  { immediate: true }
);

// Adresa upućuje na poruku koja nije među učitanim (npr. link iz notifikacije):
// povlačimo starije stranice dok je ne nađemo, a ako je nema (ili učitavanje ne
// uspije) - skidamo ?m=. Ograničenje je na UKUPAN broj učitanih stranica, a ne na
// broj poziva, jer isto učitavanje radi i početno punjenje sandučeta.
const MAX_LOOKUP_PAGES = 12;
watch(
  [loaded, activeId, activeMessage, hasMore, loadingMore],
  async () => {
    if (!loaded.value || !activeId.value || activeMessage.value || loadingMore.value) return;
    if (hasMore.value && pagesLoaded.value < MAX_LOOKUP_PAGES) {
      const before = pagesLoaded.value;
      await loadMore();
      if (pagesLoaded.value > before) return; // sljedeći krug kreće kad se `loadingMore` ugasi
    }
    void router.replace(withoutMessage());
  },
  { immediate: true }
);

// --- Prazno stanje: soft-ask za push --------------------------------------------

const { permissionState, syncPermissionState, requestPermissionAndRegister } =
  usePushNotifications();
onMounted(syncPermissionState);
const canEnablePush = computed(() => permissionState.value === "default");
const enablePush = () => requestPermissionAndRegister();
</script>

<style scoped>
.unread-n {
  color: #2459c7;
  font-weight: 800;
}

.mark-all {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border: none;
  border-radius: 999px;
  background: #eef4ff;
  color: #2459c7;
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.mark-all:active {
  background: #dfeaff;
}

.mark-all:focus-visible {
  outline: 2px solid #2f6fed;
  outline-offset: 2px;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 18px 0 4px;
}
</style>
