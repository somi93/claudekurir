import { useNuxtApp } from "nuxt/app";
import type { CandidateCourier, CandidateCourierDto } from "~/types/candidateCourier";
import type { OrderActionResponse } from "~/types/order";

const mapCandidateCourierDto = (dto: CandidateCourierDto): CandidateCourier => ({
  courierId: dto.courier_id,
  name: dto.name,
  vehicle: dto.vehicle,
  distanceKm: dto.distance_km,
  zone: dto.zone,
  vehicleSuitable: dto.vehicle_suitable,
  currentlyAvailable: dto.currently_available,
  onDelivery: dto.on_delivery ?? false,
  cashLimitExceeded: dto.cash_limit_exceeded ?? false,
});

// Odgovor nema "success" polje (za razliku od ostalih dispatcher endpoint-a) -
// samo { data: [...] }. Lista je već rangirana na backendu (vehicle_suitable,
// pa currently_available, pa distance_km) - front je prikazuje u istom
// redosledu, ne sortira ponovo.
export const fetchCandidateCouriers = async (
  orderId: number,
  deliveryCompanyId: number
): Promise<CandidateCourier[]> => {
  const response = await useNuxtApp().$api<{ data: CandidateCourierDto[] }>(
    `/dispatcher/orders/${orderId}/candidate-couriers`,
    { query: { delivery_company_id: deliveryCompanyId } }
  );
  return (response.data ?? []).map(mapCandidateCourierDto);
};

// "Pošalji ponudu" - isti /orders/{id}/accept endpoint koji kurir sam zove
// kad prihvati narudžbu (App\Modules\GpsTracking, van dispatcher API-ja).
// Dispečer ga poziva u ime kurira sa courier_id sa rangirane liste - vidi
// dispecer-Dodela_kurira_frontend.md. Može vratiti 409 ako je kurir u
// međuvremenu sam prihvatio narudžbu ILI je na BLOCK limitu gotovine - to
// rukuje pozivalac (composable). Odgovor nosi `warning` + current_cash_amount /
// cash_limit_amount kad je kurir blizu/preko limita (backend DIO 2, tačka 2.1).
export const assignCourierToOrder = async (
  orderId: number,
  courierId: number
): Promise<OrderActionResponse> => {
  return useNuxtApp().$api<OrderActionResponse>(`/orders/${orderId}/accept`, {
    method: "POST",
    body: { driver_id: courierId },
  });
};
