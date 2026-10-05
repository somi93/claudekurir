<template>
  <div class="offer-track">
    <div class="track-head d-flex align-center ga-2 flex-wrap">
      <v-chip v-if="roundActive" size="small" :color="roundChip.color" variant="tonal">
        {{ roundChip.label }}
      </v-chip>
      <span class="track-mode">{{ modeLabel }}</span>
    </div>

    <!-- Grupe (utils/candidateGroups) dolaze gotove iz roditelja - iste kao u
         "Listi". Prazne se ne prikazuju, a numeracija prati samo prikazane. -->
    <div v-for="(group, index) in groups" :key="group.key" class="track-group">
      <CandidateGroupHeader
        :number="index + 1"
        :title="group.title"
        :count="group.candidates.length"
        :total="candidates.length"
        :hint="group.hint"
        :selection="groupSelection(group)"
        @toggle-all="emit('toggle-group', group)"
      />
      <div class="track-row">
        <div
          v-for="candidate in group.candidates"
          :key="candidate.courierId"
          class="track-item"
          :class="`is-${offerStatusFor(candidate.courierId).status}`"
        >
          <label
            class="track-checkbox"
            :class="{
              'is-checked': selectedSet.has(candidate.courierId),
              'is-disabled': locked || sendLocked(candidate),
            }"
          >
            <input
              type="checkbox"
              :checked="selectedSet.has(candidate.courierId)"
              :disabled="locked || sendLocked(candidate)"
              @change="emit('toggle-select', candidate.courierId)"
            />
            <span class="box" />
          </label>
          <div class="avatar-wrap">
            <span class="rank">{{ rankOf(candidate.courierId) }}</span>
            <div class="avatar" :style="avatarStyle(candidate.courierId, candidate.vehicle)">
              <v-icon :icon="courierVehicleMeta(candidate.vehicle).icon" size="18" />
            </div>
            <span v-if="offerStatusFor(candidate.courierId).secondsLeft !== null" class="timer">
              {{ offerStatusFor(candidate.courierId).secondsLeft }}s
            </span>
            <v-icon
              v-else-if="statusIcon(candidate.courierId)"
              class="status-icon"
              :icon="statusIcon(candidate.courierId)!"
              size="11"
            />
          </div>
          <div class="name">{{ toLatin(candidate.name) }}</div>
          <div class="detail">
            {{ candidate.distanceKm !== null ? `${candidate.distanceKm.toFixed(1)} km` : "—" }}
          </div>
          <div class="badges">
            <v-chip
              size="x-small"
              variant="tonal"
              :color="
                candidate.currentlyAvailable
                  ? 'success'
                  : isBlockedFor(candidate, 'unavailable')
                    ? 'error'
                    : 'default'
              "
            >
              {{ candidate.currentlyAvailable ? "Dostupan" : "Nedostupan" }}
            </v-chip>
            <v-chip v-if="candidate.onDelivery" size="x-small" color="error" variant="tonal">
              Na isporuci
            </v-chip>
            <v-chip v-if="!candidate.vehicleSuitable" size="x-small" color="warning" variant="tonal">
              Ne odgovara vozilu
            </v-chip>
            <v-chip
              v-if="candidate.cashLimitExceeded"
              size="x-small"
              :color="isBlockedFor(candidate, 'cash_limit') ? 'error' : 'warning'"
              variant="tonal"
              prepend-icon="mdi-cash-remove"
            >
              Limit gotovine
            </v-chip>
            <template v-if="offerStatusFor(candidate.courierId).status !== 'none'">
              <OfferDeliveryInfo
                compact
                :outcome="offerChipFor(candidate.courierId)"
                :status="offerStatusFor(candidate.courierId).status"
                :push-sent="offerStatusFor(candidate.courierId).pushSent"
                :socket-received-at="offerStatusFor(candidate.courierId).socketReceivedAt"
              />
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="track-legend">
      <span class="legend-item"><i class="dot is-none" /> Na čekanju reda</span>
      <span class="legend-item"><i class="dot is-pending" /> Čeka odgovor</span>
      <span class="legend-item"><i class="dot is-accepted" /> Prihvatio</span>
      <span class="legend-item"><i class="dot is-declined" /> Odbio ponudu</span>
      <span class="legend-item"><i class="dot is-expired" /> Nije odgovorio / preskočen</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { courierVehicleMeta } from "~/utils/vehicle";
import type { CandidateCourier } from "~/types/candidateCourier";
import type { CourierOfferStatus, OfferMode } from "~/types/offer";
import CandidateGroupHeader from "./CandidateGroupHeader.vue";
import OfferDeliveryInfo from "./OfferDeliveryInfo.vue";
import { groupSelectionState } from "~/utils/candidateGroups";
import type { CandidateGroup } from "~/utils/candidateGroups";
import { isOfferSendLocked, offerBlockReasons } from "~/utils/candidateOfferPolicy";
import type { OfferBlockReason, OfferPolicy } from "~/utils/candidateOfferPolicy";

// Alternativni ("Tok") prikaz rezultata rangiranja - isti podaci kao lista
// (candidates + status ponude po kuriru), samo kao traka umjesto tabele reda-
// po-red. Selekcija kurira za slanje ponude dijeli isto stanje kao "Lista"
// varijanta (selectedSet/toggleSelected iz roditelja).
const props = defineProps<{
  // Svi prikazani kandidati (rang + ukupan broj u zaglavljima grupa).
  candidates: CandidateCourier[];
  groups: CandidateGroup[];
  offerStatusFor: (courierId: number) => {
    status: CourierOfferStatus;
    secondsLeft: number | null;
    pushSent: boolean | null;
    socketReceivedAt: Date | null;
  };
  offerChipFor: (courierId: number) => { color: string; label: string } | null;
  roundChip: { color: string; label: string };
  roundActive: boolean;
  mode: OfferMode;
  selectedSet: Set<number>;
  locked: boolean;
  policy: OfferPolicy;
}>();

const emit = defineEmits<{
  "toggle-select": [courierId: number];
  // "Izaberi sve" u zaglavlju grupe - roditelj čekira/odčekira cijelu grupu.
  "toggle-group": [group: CandidateGroup];
}>();

// Kandidatu se ne može poslati ponuda (ukupno, ili zbog konkretnog razloga) -
// takav se ne čekira, a chip mu je crven.
const isBlockedFor = (candidate: CandidateCourier, reason?: OfferBlockReason) => {
  const reasons = offerBlockReasons(candidate, props.policy);
  return reason ? reasons.includes(reason) : reasons.length > 0;
};

// Slanje zaključano (nema čekiranja) - vidi ALLOW_OFFER_TO_BLOCKED.
const sendLocked = (candidate: CandidateCourier) => isOfferSendLocked(candidate, props.policy);

const groupSelection = (group: CandidateGroup) =>
  groupSelectionState(group, props.selectedSet, sendLocked, props.locked);

const modeLabel = computed(() =>
  props.mode === "sequential" ? "Redom, jedan po jedan" : "Paralelno, svima odjednom"
);

// Rang (pozicija u punoj listi, 1-based) - prikazuje se i dalje po originalnom
// redosledu iako se kandidat sad renderuje u jednoj od grupa.
const rankOf = (courierId: number) =>
  props.candidates.findIndex((c) => c.courierId === courierId) + 1;

const STATUS_ICON: Partial<Record<CourierOfferStatus, string>> = {
  accepted: "mdi-check",
  declined: "mdi-close",
  expired: "mdi-clock-alert-outline",
  superseded: "mdi-arrow-down-thin",
};

const statusIcon = (courierId: number) => STATUS_ICON[props.offerStatusFor(courierId).status] ?? null;

const STATUS_RING: Record<CourierOfferStatus, string> = {
  none: "#d3d7e2",
  pending: "#3554d1",
  accepted: "#a9dfc2",
  declined: "#edb2ac",
  expired: "#d3d7e2",
  superseded: "#d3d7e2",
};

// Van pending stanja se avatar boji po vozilu (kao u listi) - samo pending
// dobija akcentnu boju runde, da "trenutno mu ide ponuda" upadne u oči.
const avatarStyle = (courierId: number, vehicle: CandidateCourier["vehicle"]) => {
  const status = props.offerStatusFor(courierId).status;
  const vehicleMeta = courierVehicleMeta(vehicle);
  const color = status === "pending" ? "#3554d1" : vehicleMeta.color;
  return {
    background: color + "1a",
    color,
    boxShadow: `0 0 0 2px ${STATUS_RING[status]}`,
  };
};
</script>

<style scoped>
.offer-track {
  margin-top: 12px;
  padding: 14px 16px 16px;
  border: 1px solid #e7e9ee;
  border-radius: 12px;
  background: #fafbfc;
}

.track-mode {
  font-size: 0.78rem;
  color: #6b7685;
}

.track-group + .track-group {
  margin-top: 4px;
}

.track-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding: 10px 2px 12px;
  margin-top: 4px;
}

.track-item {
  width: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
  padding-top: 6px;
}

.badges {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  margin-top: 1px;
  width: 100%;
}
.badges :deep(.v-chip) {
  height: auto;
  min-height: 17px;
  width: 100%;
  padding: 0 6px;
  font-size: 9px;
  justify-content: center;
}
.badges :deep(.v-chip__content) {
  white-space: normal;
  line-height: 1.15;
  text-align: center;
}

.track-checkbox {
  position: relative;
  flex: none;
  width: 16px;
  height: 16px;
  display: inline-flex;
  cursor: pointer;
}
.track-checkbox input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.track-checkbox .box {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1.5px solid #c7cbd6;
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, border-color 0.12s;
}
.track-checkbox .box::after {
  content: "";
  width: 4px;
  height: 8px;
  margin-top: -1px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) scale(0);
  transition: transform 0.1s;
}
.track-checkbox.is-checked .box {
  background: #3554d1;
  border-color: #3554d1;
}
.track-checkbox.is-checked .box::after {
  transform: rotate(45deg) scale(1);
}
.track-checkbox.is-disabled {
  cursor: not-allowed;
}
.track-checkbox.is-disabled input {
  cursor: not-allowed;
}
.track-checkbox.is-disabled .box {
  background: #f2f3f6;
  border-color: #dfe2ea;
}

.avatar-wrap {
  position: relative;
}

.avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rank {
  position: absolute;
  top: -6px;
  left: -6px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid #d3d7e2;
  font-size: 9px;
  color: #8b93a8;
  display: flex;
  align-items: center;
  justify-content: center;
}

.timer {
  position: absolute;
  bottom: -3px;
  right: -6px;
  background: #3554d1;
  color: #fff;
  font-size: 9.5px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 999px;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 0 0 2px #fafbfc;
}

.status-icon {
  position: absolute;
  bottom: -3px;
  right: -3px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 2px #fafbfc;
}
.is-accepted .status-icon { color: #1c9463; }
.is-declined .status-icon { color: #c8433a; }
.is-expired .status-icon,
.is-superseded .status-icon { color: #8b93a8; }

.name {
  font-size: 11.5px;
  font-weight: 600;
  color: #1b2033;
  line-height: 1.2;
}
.is-declined .name,
.is-expired .name,
.is-superseded .name {
  color: #9aa2b8;
  text-decoration: line-through;
  text-decoration-color: #d3d7e2;
}

.detail {
  font-size: 10.5px;
  color: #9aa2b8;
}

.is-pending .avatar {
  animation: pulse-ring 1.8s ease-in-out infinite;
}
@keyframes pulse-ring {
  0%, 100% { box-shadow: 0 0 0 2px #3554d1; }
  50% { box-shadow: 0 0 0 5px #b9c6f6; }
}
@media (prefers-reduced-motion: reduce) {
  .is-pending .avatar { animation: none; }
}

.track-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid #e7e9ee;
  font-size: 11px;
  color: #6b7685;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.dot.is-none { background: #d3d7e2; }
.dot.is-pending { background: #3554d1; }
.dot.is-accepted { background: #1c9463; }
.dot.is-declined { background: #c8433a; }
.dot.is-expired { background: #8b93a8; }
</style>
