import Echo from "laravel-echo";
import Pusher from "pusher-js";
import type { ChannelAuthorizationCallback } from "pusher-js";

// pusher-js ne re-eksportuje tip auth podataka pod imenom iz root-a, pa ga
// izvlačimo iz potpisa callback-a.
type ChannelAuthData = Parameters<ChannelAuthorizationCallback>[1];
import { defineNuxtPlugin, useRuntimeConfig } from "nuxt/app";
import { SESSION_KEYS } from "~/stores/session";

// Laravel Echo klijent za Reverb (WebSocket). Koriste ga:
// - dispečerski ekran "Dodela narudžbi": `.offer.round.changed` na
//   `orders.{orderId}` umjesto poll-a GET /dispatcher/orders/{orderId}/offers
//   (backend odgovor 10.09.2026, stavka 2.4);
// - kurirski ekran "Dostave": `.courier.offers.changed` na
//   `App.Models.User.{courierId}` za nove ponude (useCourierOffers).
//
// Konekcija se NE otvara pri učitavanju stranice - `ensure()` je lijen (prvi
// poziv konstruiše Echo i tek tada se WS diže). Ostali ekrani i neulogovani
// prikaz ga nikad ne pozovu, pa ne plaćaju konekciju.
//
// Auth: privatni kanali idu kroz custom authorizer koji šalje Bearer token
// (isti localStorage ključ kao plugins/api.client.ts) na /broadcasting/auth.
// Host tog endpointa je pretpostavka (API host) - vidi pitanja za backend.
export default defineNuxtPlugin(() => {
  const cfg = useRuntimeConfig().public.reverb as {
    key: string;
    wsHost: string;
    wsPort: number;
    wssPort: number;
    forceTLS: boolean;
    authEndpoint: string;
  };

  let echo: Echo<"reverb"> | null = null;

  const ensure = (): Echo<"reverb"> => {
    if (echo) return echo;

    // laravel-echo traži Pusher na globalnom objektu (pusher-js protokol je
    // žičani format i za Reverb).
    (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

    // Dev-only dijagnostika (14.09 - "ništa u Socket tabu" istraga) - pusher-js
    // sopstveni verbose log (connect pokušaji, transport izbor, subscribe
    // uspjeh/neuspjeh) + naši state_change/error bind-ovi ispod. Bez ovoga je
    // svaki neuspjeh tih (subscribe() gore guta grešku, pada na poll fallback
    // bez traga zašto).
    if (import.meta.dev) {
      Pusher.logToConsole = true;
    }

    echo = new Echo({
      broadcaster: "reverb",
      key: cfg.key,
      wsHost: cfg.wsHost,
      wsPort: cfg.wsPort,
      wssPort: cfg.wssPort,
      forceTLS: cfg.forceTLS,
      enabledTransports: ["ws", "wss"],
      authorizer: (channel: { name: string }) => ({
        authorize: (socketId: string, callback: ChannelAuthorizationCallback) => {
          const token = localStorage.getItem(SESSION_KEYS.token);
          $fetch(cfg.authEndpoint, {
            method: "POST",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token ?? ""}`,
            },
            body: { socket_id: socketId, channel_name: channel.name },
          })
            .then((data) => callback(null, data as ChannelAuthData))
            .catch((error: unknown) => {
              if (import.meta.dev) console.error("[echo] broadcasting/auth failed", error);
              callback(error as Error, null);
            });
        },
      }),
    });

    if (import.meta.dev) {
      const connection = echo.connector?.pusher?.connection;
      connection?.bind("state_change", (states: { previous: string; current: string }) => {
        console.info("[echo] state_change", states.previous, "->", states.current);
      });
      connection?.bind("error", (err: unknown) => {
        console.error("[echo] connection error", err);
      });
    }

    return echo;
  };

  // `get()` vraća već konstruisan Echo ili null - da pozivaoci mogu da provjere
  // stanje konekcije bez da je nehotice podignu.
  const get = (): Echo<"reverb"> | null => echo;

  return { provide: { echo: { ensure, get } } };
});
