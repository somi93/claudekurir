import { resolveCurrency } from "~/utils/currency";
import type { RestaurantCooperation } from "~/types/restaurant-cooperation";

// Valuta restorana (odgovor 2.2) se od 01.09 vraća po redu. Ako je postavljena i
// razlikuje se od valute firme, vraćamo je za prikaz upozorenja - dispečer da
// zna prije nego uključi saradnju da cijene neće biti u istoj valuti. Bez
// restaurant_currency (stari zapis) nema šta da se poredi. Koristi ga i lista
// (RestaurantCooperationPanel) i modal sa kontakt podacima (RestaurantDetailDialog).
export const currencyMismatch = (
  restaurant: RestaurantCooperation,
  companyCurrency: string
): string | null => {
  if (!restaurant.restaurant_currency?.trim()) return null;
  const restaurantCurrency = resolveCurrency(restaurant.restaurant_currency);
  return restaurantCurrency !== resolveCurrency(companyCurrency) ? restaurantCurrency : null;
};
