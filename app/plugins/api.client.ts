import { ofetch, type FetchOptions } from "ofetch";
import { defineNuxtPlugin, navigateTo, useRuntimeConfig } from "nuxt/app";
import { SESSION_KEYS, useSessionStore } from "~/stores/session";

// Jedina "veza" ka pravom backendu (gpsApiBase):
// - kači token na svaki zahtev
// - na 401 pokuša jednom refresh (isti /login endpoint, grant_type: refresh_token,
//   refresh token je httpOnly cookie pa ide credentials: "include") i ponovi zahtev
// - ako refresh ne uspe, čisti sesiju i vraća na /login
// Mock-api pozivi (restoran/kurir demo podaci) ovo ne koriste, gađaju direktno.
export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig();
  const baseURL = runtimeConfig.public.gpsApiBase as string;

  const rawApi = ofetch.create({
    baseURL,
    onRequest({ options }) {
      const token = localStorage.getItem(SESSION_KEYS.token);
      if (token) {
        options.headers = new Headers(options.headers);
        options.headers.set("Authorization", `Bearer ${token}`);
      }
    },
  });

  const clearSessionAndRedirect = () => {
    useSessionStore().clearSession();
    navigateTo("/login");
  };

  let refreshPromise: Promise<string> | null = null;

  const refreshAccessToken = () => {
    if (!refreshPromise) {
      refreshPromise = ofetch<{ access_token: string }>("/login", {
        baseURL,
        method: "POST",
        credentials: "include",
        body: { grant_type: "refresh_token" },
      })
        .then((response) => {
          localStorage.setItem(SESSION_KEYS.token, response.access_token);
          return response.access_token;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  };

  const api = async <T>(request: string, options?: FetchOptions<"json">): Promise<T> => {
    try {
      return await rawApi<T>(request, options);
    } catch (error: any) {
      // Login sam po sebi ne sme da okine refresh - 401 tu znači pogrešan
      // email/lozinka, ne istekao token.
      if (error?.response?.status !== 401 || request === "/login") {
        throw error;
      }

      try {
        await refreshAccessToken();
        return await rawApi<T>(request, options);
      } catch (refreshError) {
        clearSessionAndRedirect();
        throw refreshError;
      }
    }
  };

  return {
    provide: { api },
  };
});
