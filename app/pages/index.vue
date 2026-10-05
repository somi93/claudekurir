<template>
  <CourierHome
    v-if="sessionStore.role === 'dostava'"
    :courier-id="sessionStore.courierId!"
  />
  <DispatcherHome
    v-else-if="sessionStore.role === 'dispatcher'"
    :user-name="dispatcherName"
  />
</template>

<script setup lang="ts">
definePageMeta({ title: "Početna" });

import { computed } from "vue";
import { useSessionStore } from "~/stores/session";
import CourierHome from "~/components/home/CourierHome.vue";
import DispatcherHome from "~/components/home/DispatcherHome.vue";

const sessionStore = useSessionStore();
const dispatcherName = computed(() => toLatin(sessionStore.user?.name));
</script>

<style scoped>
.status-row {
  max-width: 960px;
  margin: 3vh auto 0;
  display: flex;
  justify-content: center;
}

.status-chip {
  font-weight: 700;
}
</style>
