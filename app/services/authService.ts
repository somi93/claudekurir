import { useNuxtApp } from "nuxt/app";
import type { OrderaUser } from "~/types/user";
import type { LoginCredentials, LoginResponse } from "~/types/auth";

export const login = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  return useNuxtApp().$api<LoginResponse>("/login", {
    method: "POST",
    body: credentials,
  });
};

export const fetchMe = async (): Promise<OrderaUser> => {
  return useNuxtApp().$api<OrderaUser>("/me");
};

export const logout = async (): Promise<void> => {
  await useNuxtApp().$api("/logout", { method: "POST", credentials: "include" });
};

export type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
  new_password_confirmation: string;
};

// Uspešan poziv sam gasi must_change_password na backendu (16.08) - front ne
// zove ništa dodatno za to, samo lokalno ažurira sessionStore.user posle ovog
// poziva (vidi pages/change-password.vue).
export const changePassword = async (payload: ChangePasswordPayload): Promise<void> => {
  await useNuxtApp().$api("/me/password", { method: "PUT", body: payload });
};
