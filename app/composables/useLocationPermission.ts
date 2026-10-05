import { onBeforeUnmount, onMounted, ref } from "vue";

// Stanje dozvole za lokaciju u pregledaču, za grupu "Aplikacija" na Profilu.
//  - granted / denied / prompt: kako javlja Permissions API
//  - unknown: pregledač ga nema (stariji Safari) - tada se jedino može zatražiti dozvola
// Praćenje lokacije same (tok za dispečera) je u useCourierLocation; ovo samo pokazuje stanje
// i traži dozvolu na dodir.
export type LocationPermission = "granted" | "denied" | "prompt" | "unknown";

export const useLocationPermission = () => {
  const state = ref<LocationPermission>("unknown");
  let status: PermissionStatus | null = null;

  const read = () => {
    if (status) state.value = status.state as LocationPermission;
  };

  const check = async (): Promise<LocationPermission> => {
    try {
      if (!navigator.permissions?.query) {
        state.value = "unknown";
        return state.value;
      }
      if (!status) {
        status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
        status.onchange = read;
      }
      read();
    } catch {
      state.value = "unknown";
    }
    return state.value;
  };

  // Otvara pitanje pregledača (samo kad je dozvola "prompt"); ako je "denied", pregledač ne
  // pita ponovo, a kurir mora da je uključi kod adrese.
  const request = (): Promise<LocationPermission> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve("unknown");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        () => void check().then(resolve),
        () => void check().then(resolve),
        { timeout: 10000 }
      );
    });

  onMounted(() => void check());
  onBeforeUnmount(() => {
    if (status) status.onchange = null;
    status = null;
  });

  return { state, check, request };
};
