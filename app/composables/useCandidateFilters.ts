import { computed, ref, type Ref } from "vue";
import { courierVehicleMeta } from "~/utils/vehicle";
import { toLatin } from "~/utils/toLatin";
import type { CandidateCourier } from "~/types/candidateCourier";

export type CandidateStatusFilterKey = "available" | "unavailable" | "on_delivery";

export const STATUS_FILTER_OPTIONS: { value: CandidateStatusFilterKey; label: string }[] = [
  { value: "available", label: "Dostupni" },
  { value: "unavailable", label: "Nedostupni" },
  { value: "on_delivery", label: "Na isporuci" },
];

// Sortiranje i filtriranje liste kandidata (CandidateCouriersPanel). Sve radi
// na frontendu - backend uvijek šalje isti (preporučeni) redosled.
export const useCandidateFilters = (
  candidates: Ref<CandidateCourier[]>,
  // Kandidat kome se ne može poslati ponuda (vidi utils/candidateOfferPolicy) -
  // takvi idu na dno liste, iza svih kojima se može.
  isBlocked: (c: CandidateCourier) => boolean = () => false
) => {
  // "Preporučeno" = backend rang (odgovara vozilu -> dostupan -> najbliži).
  // "Po udaljenosti" = čist redosled po km do restorana, bez obzira na vozilo/
  // dostupnost; kuriri bez poznate udaljenosti idu na kraj. U oba slučaja se
  // kandidati bez blokade prikazuju prvi (stabilna podjela, unutrašnji redosled
  // ostaje isti).
  const sortMode = ref<"recommended" | "distance">("recommended");
  const displayCandidates = computed<CandidateCourier[]>(() => {
    const ranked =
      sortMode.value !== "distance"
        ? candidates.value
        : [...candidates.value].sort((a, b) => {
            const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
            const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
            return da - db;
          });
    return [...ranked.filter((c) => !isBlocked(c)), ...ranked.filter(isBlocked)];
  });

  // Filter po statusu kurira. Prazan izbor = svi. Kad je vise izabrano, radi
  // kao OR (kurir se prikaže ako zadovolji bilo koji izabrani status).
  const statusFilters = ref<CandidateStatusFilterKey[]>([]);
  const matchesStatusFilter = (c: CandidateCourier): boolean => {
    if (statusFilters.value.length === 0) return true;
    return statusFilters.value.some((key) => {
      if (key === "available") return c.currentlyAvailable;
      if (key === "unavailable") return !c.currentlyAvailable;
      return c.onDelivery;
    });
  };

  // Filter po vozilu - opcije se grade iz vozila koja stvarno postoje u listi
  // kandidata (nema smisla nuditi "Bicikl" ako ga niko ne vozi).
  const vehicleFilters = ref<string[]>([]);
  const vehicleFilterOptions = computed(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string; icon: string }[] = [];
    for (const c of candidates.value) {
      if (seen.has(c.vehicle)) continue;
      seen.add(c.vehicle);
      const meta = courierVehicleMeta(c.vehicle);
      opts.push({ value: c.vehicle, label: meta.label, icon: meta.icon });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  });
  const matchesVehicleFilter = (c: CandidateCourier): boolean =>
    vehicleFilters.value.length === 0 || vehicleFilters.value.includes(c.vehicle);

  // Pretraga po imenu/ID-u, klijentski (candidate-couriers nema server-side
  // search, lista je ionako već učitana za ovu narudžbu).
  const searchQuery = ref("");
  const matchesSearchFilter = (c: CandidateCourier): boolean => {
    const query = searchQuery.value.trim().toLowerCase();
    if (!query) return true;
    return (
      toLatin(c.name ?? "").toLowerCase().includes(query) ||
      String(c.courierId).includes(query)
    );
  };

  const visibleCandidates = computed<CandidateCourier[]>(() =>
    displayCandidates.value.filter(
      (c) => matchesStatusFilter(c) && matchesVehicleFilter(c) && matchesSearchFilter(c)
    )
  );

  return {
    sortMode,
    displayCandidates,
    statusFilters,
    vehicleFilters,
    vehicleFilterOptions,
    searchQuery,
    visibleCandidates,
  };
};
