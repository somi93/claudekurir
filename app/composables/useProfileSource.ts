import { onBeforeUnmount, onMounted, watch, type ComputedRef } from "vue";
import { storeToRefs } from "pinia";
import { useProfileStore } from "~/stores/profile";

// Profil kurira za ekran koji ga prikazuje. Podaci žive u stores/profile.ts, pa prelazak
// između ekrana ne zove server ponovo dok su podaci svježi.
//  - pri otvaranju: učitava što fali, staro osvježava u pozadini (bez skeletona)
//  - povratak u aplikaciju (sa zaključanog ekrana, iz druge aplikacije): osvježi staro
export const useProfileSource = (courierId: ComputedRef<number>) => {
  const store = useProfileStore();
  const {
    profile,
    companies,
    loaded,
    loading,
    error,
    stale,
    at,
    companiesLoaded,
    companiesLoading,
    companiesError,
    saving,
  } = storeToRefs(store);

  const open = () => {
    if (!Number.isFinite(courierId.value) || courierId.value <= 0) return;
    store.start(courierId.value);
    store.open();
  };

  const onVisible = () => {
    if (!document.hidden) open();
  };

  onMounted(() => {
    open();
    document.addEventListener("visibilitychange", onVisible);
  });
  onBeforeUnmount(() => document.removeEventListener("visibilitychange", onVisible));
  watch(courierId, open);

  return {
    profile,
    companies,
    loaded,
    loading,
    error,
    stale,
    at,
    companiesLoaded,
    companiesLoading,
    companiesError,
    saving,
    retry: store.retry,
    retryCompanies: store.retryCompanies,
    save: store.save,
  };
};
