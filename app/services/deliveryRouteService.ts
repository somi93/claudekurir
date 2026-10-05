import { useNuxtApp } from "nuxt/app";
import type { RouteRequest, RouteResponse } from "~/types/courier";

export const fetchRoute = async (
  payload: RouteRequest,
  signal?: AbortSignal
): Promise<RouteResponse> => {
  return useNuxtApp().$api<RouteResponse>("/routing/route", {
    method: "POST",
    signal,
    body: payload,
  });
};
