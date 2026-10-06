<template>
  <!-- Chrome (DispatcherSidebar / BottomNav / app-bar) se renderuje uslovno
       (v-if) preko `activeMode`. Vuetify layout sistem (v-navigation-drawer
       <-> v-main offset) NE preračuna razmak kad `v-navigation-drawer` prvi
       put mont-uje sa `permanent` već `true` i bez stvarnog false->true
       prelaza (SPA navigacija login -> "/", logout -> /login, promjena
       prikaza) - meni se ne pojavi / login se ne centrira do ručnog
       refresha. Ključ po `sessionStore.shellRemountKey` na <v-app> forsira
       rebuild layout-a, ali se SAMO bumpuje eksplicitno iz login.vue/
       logout()/setAdminActiveRole() (vidi stores/session.ts) - NE reaguje na
       obično `activeMode` (public -> courier/dispatcher čim `mounted`
       postane true je isto "promjena moda" ali se dešava na SVAKO
       učitavanje stranice, ne samo na stvarnu promjenu role; kad bi ključ
       pratio `activeMode` direktno, <v-app> (i time <NuxtPage> - sve
       fetch-ove/pretplate trenutne stranice) bi se remontovao pri svakom
       učitavanju, ne samo pri login/logout/promjeni prikaza). -->
  <v-app :key="sessionStore.shellRemountKey">
    <GlobalAlerts />
    <GlobalConfirmBox />

    <v-app-bar
      v-if="activeMode === 'dispatcher' && !dispatcherWide"
      flat
      density="comfortable"
      class="dispatcher-app-bar"
    >
      <v-app-bar-nav-icon
        aria-label="Otvori meni"
        @click="dispatcherDrawer = !dispatcherDrawer"
      />
      <span class="dispatcher-app-bar-title">Ordera</span>
      <span class="dispatcher-app-bar-sub">Dispečer</span>
    </v-app-bar>

    <v-main class="page-shell">
      <PasswordReminderBanner v-if="activeMode !== 'public'" />
      <PushPermissionBanner v-if="activeMode !== 'public'" />
      <OutboxStatusBanner v-if="activeMode === 'dispatcher'" />
      <v-container
        fluid
        class="pa-0 page-content"
        :class="{ 'page-content--with-nav': activeMode === 'courier' }"
      >
        <NuxtPage />
      </v-container>
    </v-main>

    <BottomNav v-if="activeMode === 'courier'" :items="bottomNavItems" />
    <DispatcherSidebar
      v-if="activeMode === 'dispatcher'"
      v-model:open="dispatcherDrawer"
      :account-kind="accountKind"
      @logout="logout"
    />
  </v-app>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useHead, useRoute } from "nuxt/app";
import { useDisplay } from "vuetify";
import { storeToRefs } from "pinia";
import BottomNav from "~/components/layout/BottomNav.vue";
import DispatcherSidebar from "~/components/layout/DispatcherSidebar.vue";
import GlobalAlerts from "~/components/common/GlobalAlerts.vue";
import GlobalConfirmBox from "~/components/common/GlobalConfirmBox.vue";
import PasswordReminderBanner from "~/components/common/PasswordReminderBanner.vue";
import PushPermissionBanner from "~/components/common/PushPermissionBanner.vue";
import OutboxStatusBanner from "~/components/dispatcher/OutboxStatusBanner.vue";
import { useSessionStore } from "~/stores/session";
import { useCashDeskStore } from "~/stores/cashDesk";
import { useInboxStore } from "~/stores/inbox";
import { useDeliveriesStore } from "~/stores/deliveries";
import { useWalletStore } from "~/stores/wallet";
import { useProfileStore } from "~/stores/profile";
import { summarizeCashLimit } from "~/utils/cashLimit";
import { COURIER_INBOX_PATH, courierBottomNavItems } from "~/utils/navigation";

const route = useRoute();

// Naslov taba (document.title) na jednom mjestu: svaka stranica u
// definePageMeta({ title }) navede svoj kratki naslov, a ovdje se lijepi
// sufiks brenda. Bez title-a (nepoznata ruta) ostaje samo "Ordera".
useHead({
  title: () => (route.meta.title as string | undefined) ?? "",
  titleTemplate: (title) => (title ? `${title} · Ordera` : "Ordera"),
});

// sessionStore.ensureUser() se poziva (i ceka) iz middleware/auth.global.ts,
// ne ovde - middleware je async i Nuxt ga saceka pre montiranja stranice
// (vidi komentar tamo), pa su user/rola/courierId vec popunjeni cim se bilo
// koja komponenta, roditelj ili dete, prvi put montira.
const sessionStore = useSessionStore();
const { role, accountKind, courierId } = storeToRefs(sessionStore);
const { logout } = sessionStore;
const inboxStore = useInboxStore();
const cashDeskStore = useCashDeskStore();
const deliveriesStore = useDeliveriesStore();
const walletStore = useWalletStore();
const profileStore = useProfileStore();
const { unreadCount: inboxUnread } = storeToRefs(inboxStore);
const { balance: walletBalance } = storeToRefs(walletStore);

// Na SSR-u role.value je uvek null (middleware/auth.global.ts cita token iz
// localStorage-a, koji na serveru ne postoji, pa se ceo middleware preskace
// - vidi "if (import.meta.server) return" tamo). Na klijentu je role.value
// vec popunjen pre nego sto se ova komponenta hidrira (middleware ga saceka
// pre montiranja <NuxtPage>), pa bi computed odmah "znao" pravu rolu -
// razlicito od onoga sto je server renderovao. Vue takav hydration mismatch
// samo prijavi u konzoli i zadrzi stari (server) DOM (vidi "Hydration class
// mismatch" upozorenje), a posto se role.value posle toga vise ne menja,
// nema novog reaktivnog okidaca da ikad ispravi klasu - page-content--with-nav
// i BottomNav ostaju trajno odsutni iako je korisnik ulogovan. Fix: prvi
// render (SSR + hidratacija) uvek racuna kao "public" preko mounted zastavice,
// a stvarna rola preuzima tek u onMounted - to je vec NAKON hidratacije, pa
// je to obican reaktivni update (Vue ga ispravno patch-uje), ne hydration
// mismatch.
const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});

// Dispečerski sidebar je trajno prikvačen na >=lg (1280px); ispod toga je
// temporary drawer koji otvara hamburger u app baru. Drawer state živi ovde
// da bi i app bar (hamburger) i sam drawer dele isti izvor istine.
//
// VNavigationDrawer prikazuje sadržaj i gura `v-main` (layout offset) samo dok
// mu je model `true`. Njegov interni watcher sam upali drawer kad `permanent`
// pređe iz false u true (npr. posle SSR hydration-a kad se izmjeri prava
// širina), ali NE i kad je `permanent` već true pri prvom renderu - a upravo
// to je slučaj kad se `v-app` remontira kroz SPA navigaciju (prijava -> "/"):
// display je već izmjeren, `lgAndUp` je odmah true, pa nema prelaza da okine
// watcher i sidebar ostane skriven (bez menija, bez lijevog razmaka) do ručne
// navigacije na drugu stranu. Zato model držimo jednakim "je li permanent":
// na >=lg je uvijek otvoren, ispod toga zatvoren (hamburger ga otvara).
const { lgAndUp: dispatcherWide } = useDisplay();
const dispatcherDrawer = ref(false);
watch(
  dispatcherWide,
  (wide) => {
    dispatcherDrawer.value = wide;
  },
  { immediate: true }
);

const activeMode = computed<"public" | "dispatcher" | "courier">(() => {
  if (!mounted.value) return "public";
  if (route.path === "/login" || route.path.startsWith("/r/")) return "public";
  // "/" grana po roli u pages/index.vue (CourierHome/DispatcherHome), pa mod
  // ovde mora da prati stvarnu rolu korisnika, ne samo putanju - middleware/
  // auth.global.ts je vec garantovao da je token vazeci i rola poznata pre
  // nego sto se ova stranica montira.
  if (role.value === "dostava") return "courier";
  if (role.value === "dispatcher") return "dispatcher";
  return "public";
});

// Sanduče kurira (poruke + broj nepročitanih za bedže) se drži živim cijelo vrijeme
// dok je kurir prijavljen, ne samo dok je otvorena stranica Poruke - inače bi bedž
// u navigaciji i na početnoj bio zastario. Van kurirskog prikaza se gasi i briše
// stanje (odjava, promjena prikaza). `activeMode` je na serveru i do hidratacije
// "public", pa se ništa ne pokreće tokom SSR-a.
watch(
  [activeMode, courierId],
  ([mode, id]) => {
    if (mode === "courier" && id) {
      inboxStore.start(Number(id));
      // Saldo gotovine za tačku na stavci "Novčanik"; ostalo (predaje, isplate) učitava ekran.
      walletStore.start(Number(id));
      void walletStore.touchBalance();
      // Profil (vozilo za rutu na Dostavama, ime i podaci na Profilu): jednom po prijavi, ostalo
      // osvježava ekran koji ga prikazuje.
      profileStore.start(Number(id));
      void profileStore.touch();
    } else {
      inboxStore.stop();
      walletStore.stop();
      profileStore.stop();
      // Istorija i zarada prethodnog kurira ne smiju da ostanu u memoriji poslije odjave
      // ili promjene prikaza (učitava ih stranica koja ih prikazuje, vidi stores/deliveries.ts).
      deliveriesStore.stop();
    }
  },
  { immediate: true }
);

// Predaje gotovine koje čekaju potvrdu (značka na "Finansije" u meniju i na početnoj) se provjeravaju
// dok je dispečerska ljuska prikazana; van nje se gasi i briše stanje (odjava, promjena prikaza).
watch(
  activeMode,
  (mode) => {
    if (mode === "dispatcher") cashDeskStore.start();
    else cashDeskStore.stop();
  },
  { immediate: true }
);

// Povratak u aplikaciju (sa zaključanog ekrana, iz druge aplikacije): saldo stariji od minute
// se osvježava, da tačka u navigaciji ne ostane zastarjela.
const onVisible = () => {
  if (!document.hidden && activeMode.value === "courier") void walletStore.touchBalance();
};
onMounted(() => document.addEventListener("visibilitychange", onVisible));
onBeforeUnmount(() => document.removeEventListener("visibilitychange", onVisible));

// Tačka na "Novčanik" kad je gotovina blizu ili preko limita (negativan saldo i nula ne pune limit).
const walletDot = computed<"near" | "over" | null>(() => {
  const balance = walletBalance.value;
  if (!balance || balance.cash_limit_amount == null || balance.cash_owed_to_company <= 0) return null;
  const { state } = summarizeCashLimit(balance.cash_owed_to_company, balance.cash_limit_amount);
  return state === "ok" ? null : state;
});

// Samo za kurira - dispečer ima DispatcherSidebar.vue, koja sama dodaje
// istovetnu prečicu za admina interno.
const bottomNavItems = computed(() => {
  const items = courierBottomNavItems.map((item) => {
    if (item.to === COURIER_INBOX_PATH) return { ...item, badge: inboxUnread.value };
    if (item.to === "/courier/wallet") return { ...item, dot: walletDot.value };
    return item;
  });
  // Admin nema svoj UI - dodajemo mu prečicu da promeni koji prikaz gleda,
  // vidi pages/choose-role.vue.
  if (accountKind.value !== "admin") return items;
  return [
    ...items,
    { to: "/choose-role", label: "Prikaz", icon: "mdi-account-switch-outline" },
  ];
});
</script>

<style>
:root {
  color-scheme: light;

  /* Zajednički tokeni boja za stranice i komponente koje ih koriste kao
     `var(--ink)` itd. Ranije su živjeli na korijenu pojedine stranice
     (deliveries.vue); kad je commit ac0aa89 (06.08.) obrisao tu definiciju, sedam
     fajlova je ostalo bez boja (prazne pilule, kartice bez ivice). Zato su ovdje,
     jednom, i ne zavise od korijena nijedne stranice. Prva tri prate Vuetify temu
     (nuxt.config.ts) uz rezervnu vrijednost; sive su biranje po kontrastu (WCAG
     4.5:1 na bijeloj): #5b6676 = 6.0:1, #657083 = 5.0:1. */
  --ink: rgb(var(--v-theme-primary, 11, 18, 32));
  --ink-soft: #5b6676;
  --ink-faint: #657083;
  --line: #eceef2;
  --bg: rgb(var(--v-theme-background, 245, 246, 248));
  --brand: rgb(var(--v-theme-secondary, 47, 111, 237));
  --success: rgb(var(--v-theme-accent, 0, 179, 126));
}

html,
body,
#__nuxt {
  min-height: 100%;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Vuetify default: .v-input__details ima min-height za tacno jedan red hinta
   i overflow: hidden - kad hint/messages preloni u drugi red (npr. duzi
   tekst ili :messages niz od vise stavki), drugi red se odsjeca (npr. donji
   dio slova sa repom - g, j, p). min-height ostaje isti, samo dozvoljavamo
   da se sadrzaj vidi kad je visi od jednog reda. */
.v-input__details {
  overflow: visible;
}

/* Jednoobrazan "sivi" izgled svih globalnih form komponenti - GlobalTextField,
   GlobalSelect, GlobalAutocomplete, GlobalTextarea i pickeri koji ih koriste
   (GlobalDatePicker, GlobalTimePicker). Definisano na jednom mjestu; komponente
   samo dodaju klasu .global-field i podrazumijevano rade u variant="solo" flat. */
.global-field .v-field {
  border-radius: 12px;
  background: #f2f3f7;
  box-shadow: none;
}
</style>

<style scoped>
.page-shell {
  background: #f5f6f8;
}

.dispatcher-app-bar {
  background: #fff;
  border-bottom: 1px solid #e7e9ee;
}

.dispatcher-app-bar-title {
  font-weight: 800;
  font-size: 1.05rem;
  color: #0b1220;
  letter-spacing: -0.01em;
}

.dispatcher-app-bar-sub {
  margin-left: 8px;
  font-size: 0.74rem;
  font-weight: 600;
  color: #9aa4b2;
}

.page-content--with-nav {
  /* Prostor za bottom-nav (BottomNav.vue), zajednicko za sve ulogovane
     stranice - ne treba duplirati po stranici (ranije su pojedine stranice
     same dodavale ekstra padding-bottom u svojoj *-body klasi za isti cilj).
     Mora da bude na v-container, ne na v-main: Vuetify postavlja svoj
     padding-bottom na v-main kao inline style (layout sistem za app-bar/
     bottom-navigation), koji bi pregazio nasu CSS klasu. */
  padding-bottom: calc(60px + var(--v-safe-bottom, 0px));
}
</style>
