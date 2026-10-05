<template>
  <AppSheet :open="open" title="Odjaviti se?" @update:open="emit('update:open', $event)">
    <p class="lo-text">
      Na ovom telefonu nećeš primati ponude ni obavještenja dok se ponovo ne prijaviš.
    </p>

    <TintAlert v-if="active.length" tone="warn" role="alert" :title="activeTitle">
      {{ activeText }}
    </TintAlert>

    <template #footer>
      <AppButton variant="danger" icon="mdi-logout" :loading="busy" @click="logout">
        {{ busy ? "Odjavljujem…" : "Odjavi me" }}
      </AppButton>
      <AppButton variant="ghost" data-autofocus :disabled="busy" @click="emit('update:open', false)">
        Ostani prijavljen
      </AppButton>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { fetchMyOrders } from "~/services/courierOrdersService";
import { useSessionStore } from "~/stores/session";
import type { Order } from "~/models/Order";
import { isOrderActive } from "~/utils/orderDisplay";

// Potvrda odjave u listu: posljedica je napisana ("nećeš primati ponude ni obavještenja"), a kad
// kurir ima aktivnu dostavu, upozorenje je iznad dugmeta (odjava je ne završava, a dispečer ga
// tada ne prati). Fokus je na "Ostani prijavljen", nikad na opasnom dugmetu. Upozorenje traži
// jedan zahtjev (/orders/driver/{id}) pri otvaranju; ako padne, potvrda se prikazuje bez njega.
const props = defineProps<{ open: boolean; courierId: number }>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const session = useSessionStore();
const busy = ref(false);
const active = ref<Order[]>([]);

let ticket = 0;
watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    busy.value = false;
    active.value = [];
    if (!Number.isFinite(props.courierId) || props.courierId <= 0) return;
    const mine = ++ticket;
    try {
      const orders = await fetchMyOrders(props.courierId);
      if (mine === ticket && props.open) active.value = orders.filter(isOrderActive);
    } catch {
      // bez upozorenja: odjava ostaje moguća
    }
  },
  { immediate: true }
);

const ids = computed(() => active.value.map((order) => `#${order.id}`).join(", "));
const activeTitle = computed(() =>
  active.value.length === 1 ? "Imaš aktivnu dostavu" : `Imaš aktivne dostave (${active.value.length})`
);
const activeText = computed(() =>
  active.value.length === 1
    ? `Narudžba ${ids.value} je još kod tebe. Odjava je ne završava, a dispečer te neće moći pratiti.`
    : `Narudžbe ${ids.value} su još kod tebe. Odjava ih ne završava, a dispečer te neće moći pratiti.`
);

const logout = async () => {
  if (busy.value) return;
  busy.value = true;
  try {
    await session.logout();
  } finally {
    busy.value = false;
  }
};
</script>

<style scoped>
.lo-text {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.5;
  color: #5b6676;
}
</style>
