<template>
  <v-navigation-drawer
    v-model="open"
    :permanent="lgAndUp"
    :temporary="!lgAndUp"
    width="264"
    class="dispatcher-sidebar"
  >
    <NuxtLink to="/" class="sidebar-brand">
      <span class="brand-mark">Ordera</span>
      <span class="brand-sub">Dispečer</span>
    </NuxtLink>

    <div class="sidebar-company">
      <GlobalSelect
        v-model="companiesStore.selectedCompanyId"
        :items="companyItems"
        item-title="name"
        item-value="id"
        label="Dostavna firma"
        :loading="companiesStore.loadingCompanies"
        density="compact"
        hide-details
      />
    </div>

    <v-list nav density="compact" color="secondary" class="sidebar-nav">
      <v-list-item
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :prepend-icon="item.icon"
        :title="item.title"
        :subtitle="item.subtitle"
        rounded="lg"
      />
    </v-list>

    <template #append>
      <v-list v-if="accountKind === 'admin'" nav density="compact" color="secondary">
        <v-list-item
          to="/admin/orders"
          prepend-icon="mdi-timeline-text-outline"
          title="Istorija narudžbi"
          rounded="lg"
        />
        <v-list-item
          to="/choose-role"
          prepend-icon="mdi-account-switch-outline"
          title="Promeni prikaz"
          rounded="lg"
        />
      </v-list>

      <div v-if="userLabel" class="sidebar-user">{{ userLabel }}</div>

      <v-btn
        variant="text"
        color="error"
        prepend-icon="mdi-logout"
        block
        class="sidebar-logout"
        @click="emit('logout')"
      >
        Odjava
      </v-btn>
    </template>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRoute } from "nuxt/app";
import { useDisplay } from "vuetify";
import { useDeliveryCompaniesStore } from "~/stores/deliveryCompanies";
import { useSessionStore } from "~/stores/session";
import { dispatcherNavItems } from "~/utils/navigation";
import type { AccountKind } from "~/types/user";

defineProps<{
  accountKind: AccountKind | null;
}>();

const emit = defineEmits<{
  logout: [];
}>();

// Na >=lg (1280px) sidebar je trajno prikvačen; ispod toga postaje temporary
// drawer koji otvara hamburger u app baru (vidi app.vue). `open` model drži
// stanje samo u temporary režimu - u permanent režimu ga Vuetify ignoriše.
const { lgAndUp } = useDisplay();
const open = defineModel<boolean>("open", { default: false });

// Klik na stavku menija u temporary režimu vodi na drugu rutu - zatvori drawer
// da se ne preklapa sa sadržajem nove stranice.
const route = useRoute();
watch(
  () => route.path,
  () => {
    if (!lgAndUp.value) open.value = false;
  }
);

const companiesStore = useDeliveryCompaniesStore();
onMounted(() => companiesStore.ensureLoaded());

const sessionStore = useSessionStore();
const { user } = storeToRefs(sessionStore);
const userLabel = computed(() =>
  user.value ? toLatin(`${user.value.name} ${user.value.lastname}`.trim()) : ""
);

// Nazivi dostavnih firmi mogu biti ćirilicom - prikaži ih latinicom u biraču.
const companyItems = computed(() =>
  companiesStore.companies.map((company) => ({ ...company, name: toLatin(company.name) }))
);

// v-list-item prati aktivnu rutu sam (Vuetify router integracija preko :to),
// bez ručnog poređenja route.path - izbegava se i bag koji smo imali sa
// startsWith prefiksom (/dispatcher bi lažno bio aktivan na svakoj sestrinskoj
// dispečerskoj ruti).
const navItems = dispatcherNavItems;
</script>

<style scoped>
.dispatcher-sidebar :deep(.v-navigation-drawer__content) {
  display: flex;
  flex-direction: column;
}

.sidebar-brand {
  display: flex;
  flex-direction: column;
  padding: 20px 20px 16px;
  text-decoration: none;
}

.brand-mark {
  font-weight: 800;
  font-size: 1.1rem;
  color: #0b1220;
  letter-spacing: -0.01em;
}

.brand-sub {
  font-size: 0.74rem;
  font-weight: 600;
  color: #9aa4b2;
}

.sidebar-company {
  padding: 0 16px 8px;
}

.sidebar-nav {
  flex: 1;
}

.sidebar-user {
  padding: 8px 16px 4px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #6b7685;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-logout {
  margin: 4px 12px 12px;
  width: calc(100% - 24px);
  justify-content: flex-start;
}
</style>
