<template>
  <DeliveryPage :max-width="720">
    <template #header>
      <PageHeader title="Preporuči prijatelja" back-to="/" back-label="Nazad na početnu">
        <template #actions>
          <v-btn
            icon="mdi-plus"
            variant="flat"
            color="primary"
            size="small"
            aria-label="Pozovi prijatelja"
            @click="openAddDialog"
          />
        </template>
      </PageHeader>
    </template>

    <GlobalCard padding="20px" class="mb-4">
      <h1 class="referral-title">Pozovi prijatelja, zaradite obojica</h1>
      <p class="referral-lede">
        Kad tvoj prijatelj odradi {{ REWARD_DELIVERIES }} dostava, oboje dobijate po
        {{ REWARD_AMOUNT }} KM bonusa.
      </p>

      <div class="link-chip">
        <v-icon icon="mdi-link-variant" size="18" class="link-icon" />
        <span class="link-text">{{ referralLink }}</span>
      </div>

      <div class="link-actions">
        <v-btn
          variant="tonal"
          color="primary"
          class="link-action-btn"
          :prepend-icon="copied ? 'mdi-check' : 'mdi-content-copy'"
          @click="copyLink"
        >
          {{ copied ? "Kopirano" : "Kopiraj" }}
        </v-btn>
        <GlobalButtonPrimary
          v-if="canShare"
          class="link-action-btn"
          prepend-icon="mdi-share-variant"
          @click="shareLink"
        >
          Podeli
        </GlobalButtonPrimary>
      </div>
    </GlobalCard>

    <GlobalCard padding="20px">
      <template #title>Pozvani prijatelji</template>
      <template #subtitle>
        Status ide: pozvan → registrovan → aktivan → nagrada isplaćena.
      </template>

      <div v-if="loading" class="friend-list">
        <v-skeleton-loader
          v-for="n in 3"
          :key="n"
          type="list-item-avatar-two-line"
          class="friend-skeleton"
        />
      </div>
      <div v-else-if="friends.length > 0" class="friend-list">
        <div v-for="friend in friends" :key="friend.id" class="friend-row">
          <v-avatar color="primary" size="40">
            <span class="friend-initials">{{ initials(toLatin(friend.name)) }}</span>
          </v-avatar>

          <div class="friend-main">
            <p class="friend-name">{{ toLatin(friend.name) }}</p>
            <p class="friend-date">Pozvan {{ formatDate(friend.invitedAt) }}</p>
            <v-progress-linear
              v-if="friend.status === 'active'"
              :model-value="(friend.deliveriesDone / friend.deliveriesRequired) * 100"
              color="warning"
              height="6"
              rounded
              class="friend-progress"
            />
            <p v-if="friend.status === 'active'" class="friend-progress-label">
              {{ friend.deliveriesDone }} / {{ friend.deliveriesRequired }} dostava
            </p>
          </div>

          <v-chip
            size="small"
            :color="REFERRAL_STATUS_META[friend.status].color"
            variant="tonal"
          >
            <v-icon start :icon="REFERRAL_STATUS_META[friend.status].icon" size="14" />
            {{ REFERRAL_STATUS_META[friend.status].label }}
          </v-chip>

          <GlobalButtonDelete
            class="friend-delete-btn"
            ariaLabel="Obriši unos"
            @click="confirmDelete(friend)"
          />
        </div>
      </div>
      <GlobalEmptyState v-else-if="errorMessage" icon="mdi-alert-circle-outline">
        {{ errorMessage }}
        <template #action>
          <v-btn variant="tonal" size="small" @click="refresh">Pokušaj ponovo</v-btn>
        </template>
      </GlobalEmptyState>
      <GlobalEmptyState v-else icon="mdi-account-heart-outline">
        Još nisi pozvao nijednog prijatelja - podeli link iznad.
      </GlobalEmptyState>
    </GlobalCard>

    <InviteFriendDialog v-model:open="dialogOpen" :saving="saving" @save="onSaveFriend" />
  </DeliveryPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Preporuči prijatelja" });

import { computed, ref } from "vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import GlobalButtonDelete from "~/components/common/GlobalButtonDelete.vue";
import GlobalCard from "~/components/common/GlobalCard.vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";
import { useSessionStore } from "~/stores/session";
import { useConfirmStore } from "~/stores/confirm";
import { formatDate } from "~/utils/datetime";
import { REFERRAL_STATUS_META } from "~/utils/referral";
import { REFERRAL_REWARD_AMOUNT, REFERRAL_REWARD_DELIVERIES } from "~/config/referral";
import { useCourierReferrals } from "~/composables/useCourierReferrals";
import PageHeader from "~/components/common/PageHeader.vue";
import DeliveryPage from "~/components/layout/DeliveryPage.vue";
import InviteFriendDialog from "~/components/referral/InviteFriendDialog.vue";
import type { ReferredFriend } from "~/types/referral";

const sessionStore = useSessionStore();
const courierId = computed(() => Number(sessionStore.courierId));

const REWARD_DELIVERIES = REFERRAL_REWARD_DELIVERIES;
const REWARD_AMOUNT = REFERRAL_REWARD_AMOUNT;

const { friends, loading, errorMessage, saving, refresh, addFriend, removeFriend } =
  useCourierReferrals(courierId);

const referralLink = computed(() =>
  courierId.value
    ? `https://kurir.ordera.app/r/${courierId.value}`
    : "https://kurir.ordera.app/r/..."
);

const copied = ref(false);
const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(referralLink.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // clipboard API nije dostupan (npr. bez HTTPS) - link je i dalje vidljiv u čipu iznad za kopiranje ručno
  }
};

// Web Share otvara nativni share sheet (WhatsApp/Viber/SMS) - na mobilnom je to
// prirodniji put za "pozovi prijatelja" nego copy-paste, pa ga koristimo kad je dostupan.
const canShare = typeof navigator !== "undefined" && !!navigator.share;
const shareLink = async () => {
  try {
    await navigator.share({
      title: "Ordera kurir",
      text: `Pozivam te da postaneš kurir na Ordera - prijavi se preko mog linka.`,
      url: referralLink.value,
    });
  } catch {
    // korisnik je otkazao share dijalog - nema potrebe za greškom
  }
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

const dialogOpen = ref(false);

const openAddDialog = () => {
  dialogOpen.value = true;
};

const onSaveFriend = async (name: string) => {
  const ok = await addFriend(name);
  if (ok) dialogOpen.value = false;
};

const confirmStore = useConfirmStore();

const confirmDelete = async (friend: ReferredFriend) => {
  try {
    await confirmStore.confirm(
      "Obriši pozivnicu",
      `Obrisati pozivnicu za "${toLatin(friend.name)}"?`,
      {
        color: "error",
      }
    );
    await removeFriend(friend.id);
  } catch {
    // Otkazano
  }
};
</script>

<style scoped>
.referral-title {
  margin: 0;
  font-size: 1.3rem;
  letter-spacing: -0.02em;
}

.referral-lede {
  margin: 4px 0 14px;
  color: #6b7685;
  font-size: 0.9rem;
}

.link-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f5f6f8;
  border: 1px solid #e7e9ee;
  overflow: hidden;
}

.link-icon {
  flex-shrink: 0;
  color: #9aa4b2;
}

.link-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85rem;
  color: #0b1220;
}

.link-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.link-action-btn {
  flex: 1;
}

.global-card :deep(.panel-subtitle) {
  margin-bottom: 8px;
}

.friend-list {
  display: grid;
  gap: 4px;
  margin-top: 8px;
}

.friend-skeleton {
  border-radius: 16px;
}

.friend-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid #eceef2;
}

.friend-row:last-child {
  border-bottom: none;
}

.friend-initials {
  color: #fff;
  font-size: 0.8rem;
  font-weight: 700;
}

.friend-main {
  flex: 1;
  min-width: 0;
}

.friend-name {
  margin: 0;
  font-weight: 700;
  font-size: 0.92rem;
}

.friend-date {
  margin: 1px 0 0;
  font-size: 0.78rem;
  color: #9aa4b2;
}

.friend-progress {
  margin-top: 6px;
  max-width: 220px;
}

.friend-progress-label {
  margin: 3px 0 0;
  font-size: 0.75rem;
  color: #6b7685;
  font-weight: 600;
}

.friend-delete-btn {
  flex-shrink: 0;
  margin-right: -8px;
}
</style>
