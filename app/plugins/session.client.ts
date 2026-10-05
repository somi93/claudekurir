import { useSessionStore } from "~/stores/session";

// Store poziva useRoute()/useRouter() u svom setup-u - ako se prvi put
// instancira iz middleware/auth.global.ts, Nuxt baca NUXT_E2005 upozorenje
// ("useRoute called within middleware"). Pluginovi se izvršavaju pre
// middleware-a, pa instanciranje ovde garantuje da se to prvo pozivanje desi
// u bezbednom kontekstu.
export default defineNuxtPlugin(() => {
  useSessionStore();
});
