<template>
  <div v-if="visible" class="password-reminder-bar">
    <v-icon icon="mdi-lock-alert-outline" size="18" />
    <span class="password-reminder-text">
      Koristiš privremenu lozinku - preporučujemo da je promeniš.
    </span>
    <div class="password-reminder-actions">
      <v-btn size="small" variant="text" @click="skip">Preskoči za sada</v-btn>
      <GlobalButtonPrimary size="small" @click="goChange">Promeni sada</GlobalButtonPrimary>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "nuxt/app";
import { storeToRefs } from "pinia";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import { useSessionStore } from "~/stores/session";

const route = useRoute();
const router = useRouter();
const { user, role } = storeToRefs(useSessionStore());

// "Preskoči za sada" ne postoji na backendu (nema snooze polja) - samo
// sakriva banner do sledećeg mount-a app.vue (refresh/nova prijava). Namerno
// nije trajno, podsetnik treba da se vrati dok korisnik stvarno ne promeni
// lozinku (vidi GET /me, stavka 1, 16.08).
const skipped = ref(false);

const visible = computed(
  () =>
    Boolean(user.value?.must_change_password) &&
    !skipped.value &&
    route.path !== "/change-password"
);

const skip = () => {
  skipped.value = true;
};

// Kurir mijenja lozinku u Profilu (donji list ?s=lozinka, uz ostale podatke naloga); ostali na
// zasebnoj stranici. Do 04.10. je i kurira vodilo na /change-password, a middleware ga je odatle
// vraćao na Dostave.
const goChange = () => {
  if (role.value === "dostava") router.push({ path: "/courier/profile", query: { s: "lozinka" } });
  else router.push("/change-password");
};
</script>

<style scoped>
.password-reminder-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: #fff4e0;
  color: #7a5300;
  font-size: 0.85rem;
  flex-wrap: wrap;
}

.password-reminder-text {
  flex: 1 1 auto;
}

.password-reminder-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

/* Površina dodira ≥ 44 px (mala dugmad su bila 28 px visoka). */
.password-reminder-actions :deep(.v-btn) {
  min-height: 44px;
}
</style>
