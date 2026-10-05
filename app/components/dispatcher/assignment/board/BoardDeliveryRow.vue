<template>
  <div class="delivery-row" :class="{ 'delivery-row--late': late }">
    <div class="delivery-row__head">
      <button type="button" class="info" @click="emit('toggle')">
        <span class="info__primary">
          {{ toLatin(delivery.restaurantName) }} · #{{ delivery.id }}
        </span>
        <span class="info__secondary">
          <template v-if="delivery.courier">
            <v-icon :icon="veh.icon" size="14" class="veh-icon" />
            <span class="courier-name">{{ toLatin(delivery.courier.name) }}</span>
            <span v-if="deadlineLabel" class="dim">· {{ deadlineLabel }}</span>
          </template>
          <span v-else class="no-courier">
            <v-icon icon="mdi-alert-outline" size="14" />
            Kurir nedodijeljen
          </span>
        </span>
      </button>

      <span class="status" :class="late ? 'status--late' : 'status--calm'">
        {{ timing.text }}
      </span>

      <v-btn
        v-if="delivery.courier?.phone"
        :href="`tel:${delivery.courier.phone}`"
        :color="late ? 'error' : 'primary'"
        :variant="late ? 'flat' : 'tonal'"
        size="small"
        prepend-icon="mdi-phone"
        class="call-btn"
        @click.stop
      >
        Pozovi
      </v-btn>

      <button
        type="button"
        class="chev"
        :aria-label="expanded ? 'Sakrij detalje' : 'Prikaži detalje'"
        @click="emit('toggle')"
      >
        <v-icon :icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="20" />
      </button>
    </div>

    <v-expand-transition>
      <LocationDetails
        v-if="expanded"
        :location="delivery.location"
        class="delivery-row__details"
      />
    </v-expand-transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import LocationDetails from "../LocationDetails.vue";
import { isLateDelivery } from "~/utils/dispatchBoard";
import { deliveryTiming } from "~/utils/dispatchBoardFormat";
import { formatClockTime } from "~/utils/datetime";
import { courierVehicleMeta } from "~/utils/vehicle";
import type { ActiveDelivery } from "~/models/ActiveDelivery";

const props = defineProps<{
  delivery: ActiveDelivery;
  expanded: boolean;
}>();

const emit = defineEmits<{ toggle: [] }>();

const late = computed(() => isLateDelivery(props.delivery.minutesUntilDelivery));
const timing = computed(() => deliveryTiming(props.delivery));
const veh = computed(() => courierVehicleMeta(props.delivery.courier?.vehicle ?? ""));
const deadlineLabel = computed(() => {
  // Kod zakašnjelih "Kasni X min" već nosi priču - apsolutni rok (u prošlosti)
  // bi samo zbunjivao.
  if (late.value) return "";
  const clock = formatClockTime(props.delivery.deliveryTime);
  return clock ? `rok ${clock}` : "";
});
</script>

<style scoped>
.delivery-row {
  border: 1px solid #e7e9ee;
  border-radius: 12px;
  background: #fff;
  transition: border-color 0.15s ease;
}

.delivery-row:hover {
  border-color: #d3d7df;
}

.delivery-row--late {
  border-color: #f2c4c4;
  background: #fff8f8;
}

.delivery-row--late:hover {
  border-color: #e8a9a9;
}

.delivery-row__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
}

.info {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0;
  border: none;
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.info__primary {
  font-size: 0.92rem;
  font-weight: 600;
  color: #1f2733;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.info__secondary {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-size: 0.82rem;
  color: #9aa4b2;
}

.veh-icon {
  flex: none;
  color: #9aa4b2;
}

.courier-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  min-width: 0;
}

.dim {
  flex: none;
  color: #b4bcc8;
}

.no-courier {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #e0a100;
  font-weight: 600;
}

.status {
  flex: none;
  font-size: 0.85rem;
  white-space: nowrap;
}

.status--calm {
  color: #6b7685;
}

.status--late {
  color: #e5484d;
  font-weight: 700;
}

.call-btn {
  flex: none;
  text-transform: none;
  letter-spacing: 0;
}

.chev {
  flex: none;
  display: inline-flex;
  padding: 4px;
  border: none;
  background: transparent;
  color: #b4bcc8;
  cursor: pointer;
}

.chev:hover {
  color: #6b7685;
}

.delivery-row__details {
  border-top: 1px solid #f0f1f4;
}
</style>
