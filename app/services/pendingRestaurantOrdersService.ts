import { useNuxtApp } from "nuxt/app";
import type { ApiListResponse } from "~/types/api";
import type { PendingRestaurantOrderDto } from "~/types/pendingRestaurantOrder";
import {
  mapPendingRestaurantOrderDto,
  type PendingRestaurantOrder,
} from "~/models/PendingRestaurantOrder";

// Klizni prozor oko "sada" - backend (odgovor §3.1) prima opcione ?days_back= /
// ?days_forward= (default mu je 7/7). Šaljemo eksplicitno da prozor bude
// podešljiv na jednom mjestu i otporan na promjenu backend default-a. Bez ovoga
// je lista bila neograničena unazad (stare test narudžbe od 2024.).
const PENDING_RESTAURANT_WINDOW_DAYS = 7;

// Narudžbe koje čekaju potvrdu restorana - "Čeka restoran" tab na "Dodela
// narudžbi" ekranu. Isti obrazac kao fetchWaitingOrders.
export const fetchPendingRestaurantOrders = async (
  deliveryCompanyId: number
): Promise<PendingRestaurantOrder[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<PendingRestaurantOrderDto>>(
    "/dispatcher/orders/pending-restaurant-confirmation",
    {
      query: {
        delivery_company_id: deliveryCompanyId,
        days_back: PENDING_RESTAURANT_WINDOW_DAYS,
        days_forward: PENDING_RESTAURANT_WINDOW_DAYS,
      },
    }
  );
  return (response.data ?? []).map(mapPendingRestaurantOrderDto);
};

// POST /api/dispatcher/orders/{orderId}/resolve-restaurant-status (odgovor §4,
// novo) - dispečer ručno rješava narudžbu koju restoran nije prihvatio kroz
// aplikaciju (tablet ugašen), a telefonski je potvrdio/odbio. Backend ograničava
// na on-hold kao polaznu tačku i vodi audit trag (ko i kada). Bez tijela odgovora
// koji nam treba - composable radi pun refresh liste.
export const resolveRestaurantStatus = async (
  orderId: number,
  action: "accept" | "reject",
  note?: string
): Promise<void> => {
  await useNuxtApp().$api(`/dispatcher/orders/${orderId}/resolve-restaurant-status`, {
    method: "POST",
    body: { action, ...(note ? { note } : {}) },
  });
};
