<template>
  <div v-if="visible" class="push-permission-bar" :class="{ 'push-permission-bar--denied': isDenied }">
    <v-icon :icon="isDenied ? 'mdi-bell-off-outline' : 'mdi-bell-ring-outline'" size="18" />
    <span class="push-permission-text">
      <template v-if="isDenied">
        Obavještenja su blokirana - ne stižu ti ponude kad je aplikacija u pozadini. Uključi ih
        preko katanca pored adrese.
      </template>
      <template v-else>
        Uključi obavještenja da ne propustiš nove ponude i promjene statusa.
      </template>
    </span>
    <div class="push-permission-actions">
      <v-btn size="small" variant="text" @click="skip">Ne sada</v-btn>
      <GlobalButtonPrimary size="small" :loading="loading" @click="request">
        {{ isDenied ? "Provjeri ponovo" : "Uključi" }}
      </GlobalButtonPrimary>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "nuxt/app";
import { storeToRefs } from "pinia";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import { usePushNotifications } from "~/composables/usePushNotifications";
import { useAlertStore } from "~/stores/alert";
import { useSessionStore } from "~/stores/session";

const route = useRoute();
const { user } = storeToRefs(useSessionStore());
const { permissionState, syncPermissionState, requestPermissionAndRegister } =
  usePushNotifications();
const alerts = useAlertStore();

onMounted(syncPermissionState);

// "Ne sada" sakriva traku do sledeceg mount-a (novi login/refresh) - isti
// obrazac kao PasswordReminderBanner.vue, da korisnik ne bude gnjavljen na
// svakoj stranici u istoj sesiji.
const skipped = ref(false);
const loading = ref(false);

const isDenied = computed(() => permissionState.value === "denied");

// Ekran Dostave ima sopstvenu "Spremnost" (lokacija, veza, obavještenja, zvuk,
// ekran), a Profil grupu "Aplikacija" - isto stanje i iste radnje. Traka od 168 px bi
// tamo gurnula glavno dugme ispod donje navigacije (Dostave) ili prvi naslov na 40%
// ekrana (Profil), pa se na te dvije stranice ne prikazuje.
const hasOwnControls = computed(
  () => route.path === "/courier/deliveries" || route.path === "/courier/profile"
);

const visible = computed(
  () =>
    Boolean(user.value) &&
    !skipped.value &&
    !hasOwnControls.value &&
    (permissionState.value === "default" || permissionState.value === "denied")
);

const skip = () => {
  skipped.value = true;
};

const request = async () => {
  loading.value = true;
  try {
    await requestPermissionAndRegister();
    if (permissionState.value === "granted") {
      alerts.success("Obavještenja su uključena.");
    } else if (permissionState.value === "denied") {
      alerts.warning("Obavještenja su i dalje blokirana u podešavanjima pregledača.");
    }
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.push-permission-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: #fde8e8;
  color: #8c1c13;
  font-size: 0.85rem;
  flex-wrap: wrap;
}

.push-permission-bar--denied {
  background: #f8d0cd;
  color: #7a1610;
}

.push-permission-text {
  flex: 1 1 auto;
}

.push-permission-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
</style>
