import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { useRouter } from "nuxt/app";
import type { AppRole, OrderaUser } from "~/types/user";
import { getAccountKind, ROLE_HOME } from "~/types/user";
import * as authService from "~/services/authService";
import { usePushNotifications } from "~/composables/usePushNotifications";

// Token je jedini localStorage kljuc sesije - mora da prezivi refresh. Sve
// ostalo (user, rola, courierId) zivi samo u memoriji ovog store-a, popunjeno
// kroz ensureUser(), da ne postoje dva izvora istine (localStorage cache
// naspram stvarnog /me odgovora). Koristi ga i middleware/auth.global.ts i
// plugins/api.client.ts i pages/login.vue.
export const SESSION_KEYS = {
  token: "dispatcher-token",
  // Admin nema svoj UI - bira koji od tri prikaza hoce da gleda na
  // /choose-role. Pamtimo poslednji izbor da ne bira ponovo posle svakog
  // refresh-a/logina (vidi setAdminActiveRole ispod).
  adminActiveRole: "dispatcher-admin-active-role",
} as const;

export const useSessionStore = defineStore("session", () => {
  const router = useRouter();

  const user = ref<OrderaUser | null>(null);
  const adminActiveRole = ref<AppRole | null>(null);

  // Ključ za forsirani remount cijele <v-app> ljuske (vidi app.vue) - Vuetify
  // ne preračuna v-navigation-drawer <-> v-main offset kad drawer prvi put
  // mont-uje sa `permanent` već `true` bez pravog false->true prelaza (SPA
  // navigacija posle login/logout/promjene prikaza). Bump SAMO iz tih
  // eksplicitnih akcija (login.vue, logout(), setAdminActiveRole()) - ne
  // prati `activeMode` reaktivno jer se on mijenja i na obično učitavanje
  // stranice (public -> stvarna rola čim se hidracija završi), što bi
  // remontovalo i <NuxtPage> (i sve fetch-ove trenutne stranice) bez potrebe.
  const shellRemountKey = ref(0);
  const bumpShellRemount = () => {
    shellRemountKey.value++;
  };

  const accountKind = computed(() => (user.value ? getAccountKind(user.value.type) : null));

  // Aktivan prikaz u aplikaciji. Za dostava/dispatcher nalog je
  // uvek isti kao AccountKind; za admina je to ono sto je izabrao na
  // /choose-role (ili null dok ne izabere); za nepodrzane tipove je uvek null.
  const role = computed<AppRole | null>(() => {
    switch (accountKind.value) {
      case "dostava":
        return "dostava";
      case "dispatcher":
        return "dispatcher";
      case "admin":
        return adminActiveRole.value;
      default:
        return null;
    }
  });

  const setAdminActiveRole = (next: AppRole) => {
    adminActiveRole.value = next;
    localStorage.setItem(SESSION_KEYS.adminActiveRole, next);
    // Bump TEK poslije navigacije - vidi komentar u logout().
    router.push(ROLE_HOME[next]).then(() => bumpShellRemount());
  };

  // Kurir nema posebnu "profilnu" celinu odvojenu od OrderaUser-a - njegov ID
  // je prosto user.id kad mu je rola "dostava" (svi tipovi korisnika, ukljucujuci
  // kurira, prolaze kroz isti /login + /me). Kad admin bira prikaz "dostava"
  // radi se o istom user.id - nema stvarnih kurirskih podataka iza toga, to je
  // samo pregled UI-a.
  const courierId = computed<number | null>(() =>
    role.value === "dostava" ? user.value!.id : null
  );

  const userInitials = computed(() => {
    if (!user.value) return "";
    const first = (user.value.name || "").charAt(0);
    const last = (user.value.lastname || "").charAt(0);
    return (
      (first + last).toUpperCase() || (user.value.email || "?").charAt(0).toUpperCase()
    );
  });

  const clearSession = () => {
    localStorage.removeItem(SESSION_KEYS.token);
    user.value = null;
    adminActiveRole.value = null;
  };

  let profileRequest: Promise<void> | null = null;

  // Ucitava /me tacno jednom po sesiji i deli isti (in-flight ili vec gotov)
  // rezultat sa svim pozivaocima - middleware ga zove (i ceka) na svakoj
  // navigaciji, login.vue sa force:true posle prijave jer je token tek
  // promenjen. Vidi middleware/auth.global.ts za zasto je ovo async umesto
  // localStorage cache-a za rolu.
  const ensureUser = (force = false) => {
    if (force) profileRequest = null;
    if (!profileRequest) {
      profileRequest = (async () => {
        if (!localStorage.getItem(SESSION_KEYS.token)) {
          user.value = null;
          return;
        }
        try {
          user.value = await authService.fetchMe();
          if (getAccountKind(user.value.type) === "admin" && !adminActiveRole.value) {
            const stored = localStorage.getItem(SESSION_KEYS.adminActiveRole);
            if (stored === "dostava" || stored === "dispatcher") {
              adminActiveRole.value = stored;
            }
          }
        } catch {
          clearSession();
          router.push("/login");
        }
      })();
    }
    return profileRequest;
  };

  const logout = async () => {
    // Skidamo FCM token DOK Bearer jos vazi (API DELETE ga trazi) - da uredjaj
    // vise ne dobija notifikacije za korisnika koji se odjavio.
    await usePushNotifications().unregisterDevice();

    // Best-effort - refresh-token je httpOnly cookie koji server treba da
    // invalidira. Ako poziv ne uspe (mreža, isteklo sve), korisnika ipak
    // izbacujemo lokalno - ne sme da ga zaglavi ulogovanog zbog mrežne greške.
    try {
      await authService.logout();
    } catch {
      // ignorisano namerno
    }
    clearSession();
    profileRequest = null;
    // Bump TEK poslije navigacije - ako se <v-app> remontuje dok je ruta još
    // stara (npr. /courier/deliveries), <NuxtPage> montira tu istu stranicu
    // iznova, ali bez tokena (sesija je gore već obrisana) - njeni composable-i
    // odmah pucaju sa 401 (vidi useCourierOrders/useCourierOffers/
    // useCourierLocation), što dalje okine i neuspio token refresh.
    await router.push("/login");
    bumpShellRemount();
  };

  return {
    user,
    accountKind,
    role,
    setAdminActiveRole,
    courierId,
    userInitials,
    ensureUser,
    clearSession,
    logout,
    shellRemountKey,
    bumpShellRemount,
  };
});
