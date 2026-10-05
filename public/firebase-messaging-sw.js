/* global importScripts, firebase */

// Service worker za FCM background poruke (kad je tab zatvoren ili u pozadini).
// Firebase config se ne moze procitati iz runtimeConfig-a ovde, pa ga
// composables/usePushNotifications.ts prosledjuje kao query string prilikom
// regist: navigator.serviceWorker.register('/firebase-messaging-sw.js?apiKey=...').
//
// Verzija compat SDK-a mora da prati `firebase` paket u package.json.

importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js");

const params = new URL(self.location).searchParams;

const firebaseConfig = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
};

if (firebaseConfig.apiKey && firebaseConfig.appId) {
  firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification ?? {};
    const title = notification.title ?? "Ordera";

    self.registration.showNotification(title, {
      body: notification.body ?? "",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: payload.data ?? {},
      tag: payload.data?.order_id ? `order-${payload.data.order_id}` : undefined,
    });
  });
}

// Kuda vodi klik na notifikaciju - iz `data` koje je backend poslao uz push.
// Samo putanje unutar aplikacije ("/..."), nikad spoljni URL.
//  - data.url               : eksplicitna putanja (ima prednost)
//  - data.type "order_offer": ponuda -> ekran Dostave
//  - data.type "inbox_message" (+ data.inbox_id): poruka kuriru -> /courier/inbox?m=ID
//    (tip za inbox poruku backend još nije potvrdio - vidi docs/2026/10/
//    03_10_2026_Frontend_pitanja_za_backend.textile)
// Sve ostalo ide na "/" kao i do sada.
const notificationTarget = (data) => {
  const d = data || {};
  if (typeof d.url === "string" && d.url.startsWith("/") && !d.url.startsWith("//")) {
    return d.url;
  }
  if (d.type === "order_offer") return "/courier/deliveries";
  if (d.type === "inbox_message") {
    return d.inbox_id
      ? `/courier/inbox?m=${encodeURIComponent(d.inbox_id)}`
      : "/courier/inbox";
  }
  return "/";
};

// Klik na notifikaciju - ako je aplikacija otvorena, fokusira je i javlja joj kuda
// treba da ide (router u stranici, bez ponovnog učitavanja); inače otvara novi
// prozor direktno na odredištu.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = notificationTarget(event.notification.data);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.postMessage({ type: "notification-click", url: target });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
