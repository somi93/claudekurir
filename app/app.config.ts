// Javna, build-time konfiguracija (nije env-zavisna, ne ide preko .env-a).
// Za env-zavisne stvari (API base URL) koristi runtimeConfig u nuxt.config.ts.
export default defineAppConfig({
  // Firebase Web push (FCM). Sve vrijednosti su javne (idu u klijentski bundle).
  // Jedan projekat (`ordera-e6eb8`, isti koji koristi restorani-ordera-app), nema
  // staging - zato ovdje kao konstante, a ne u runtimeConfig.
  firebase: {
    apiKey: "AIzaSyChwSmfzlsvU0pJBDDgxOmtLKjty7sz3RI",
    authDomain: "ordera-e6eb8.firebaseapp.com",
    projectId: "ordera-e6eb8",
    storageBucket: "ordera-e6eb8.appspot.com",
    messagingSenderId: "948069129002",
    appId: "1:948069129002:web:a797aa9fc5281f7e70dc53",

    // <<< JEDINO STO FALI: zalijepi VAPID kljuc izmedju navodnika ispod.
    // Firebase konzola > Project settings > Cloud Messaging >
    // Web Push certificates > Key pair (pocinje sa "B", ~87 znakova).
    // Dok je prazno, registracija tokena se preskace (dev konzola: "[push] ...").
    vapidKey: "BHhDGtt-WJzPdMu85DbJDNB7w1zpgB8E5MxZVI8eUob4oL2h0Ab1sOdTFM3LO4UtkDUMrv9gYUeIIbP1x6pSTyE",
  },
});
