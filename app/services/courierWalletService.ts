import { useNuxtApp } from "nuxt/app";
import type { ApiListResponse } from "~/types/api";
import type { CourierWalletBalance } from "~/types/wallet";
import type { CourierCashHandover } from "~/types/cash-handover";

// Jedini kurirski novčanik poziv - pravi ledger saldo + limit gotovine. Stari
// /couriers/{id}/wallet (+ /wallet-transactions) je backend 28.08 potvrdio kao
// odvojen ručni sistem bez veze sa ledgerom; više ga ne zovemo (DIO 2, 2.7).
//
// Laravel decimal cast serijalizuje novčane vrijednosti kao string - potvrđeno
// uživo 08.09 (cash_limit_amount: "200.00"). Normalizujemo ovdje da tip
// (number | null) stvarno drži i da .toFixed() u UI-ju ne pukne na stringu.
const toMoney = (value: unknown): number =>
  value === null || value === undefined || value === "" ? 0 : Number(value) || 0;

// Isto, ali čuva null (limit gotovine = null znači "bez limita", ne 0).
// Prima unknown jer Laravel decimal cast ume da vrati string ("200.00") iako
// tip kaže number | null.
const toMoneyOrNull = (value: unknown): number | null =>
  value === null || value === undefined || value === "" ? null : Number(value) || 0;

export const fetchCourierWalletBalance = async (
  courierId: number
): Promise<CourierWalletBalance> => {
  const raw = await useNuxtApp().$api<CourierWalletBalance>(
    `/couriers/${courierId}/wallet-balance`
  );
  return {
    ...raw,
    cash_owed_to_company: toMoney(raw.cash_owed_to_company),
    wage_owed_to_courier: toMoney(raw.wage_owed_to_courier),
    cash_limit_amount: toMoneyOrNull(raw.cash_limit_amount),
  };
};

// GET /couriers/{courierId}/cash-handovers - sopstvena istorija predaja gotovine
// (issue #223636, tačka 2). Oblik potvrđen 30.08: { success, data: [...] }.
export const fetchCourierCashHandovers = async (
  courierId: number
): Promise<CourierCashHandover[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<CourierCashHandover>>(
    `/couriers/${courierId}/cash-handovers`
  );
  return response.data ?? [];
};

// POST /cash-handovers/report - kurir prijavljuje da je predao pazar dispečeru
// (issue #223636, tačka 4a). Dispečer poslije potvrđuje stvarno primljen iznos
// (confirm), tako da je ovo samo "najava".
//
// Potvrđeno uživo 30.08: telo { reported_amount: <broj> }, ruta na prijavljenog
// kurira (courier_id + delivery_company_id se izvedu iz tokena), bez courierId u
// putanji. Odgovor je { success, handover: {...} } (ključ "handover", ne "data";
// status: "pending", bez confirmed_*). Odmah kreira pending red vidljiv u
// cash-handovers listi. Vraćamo ga (ako postoji) da ekran odmah pokaže "na čekanju",
// i prije nego što lista stigne ponovo; bez njega store svejedno radi pun refresh.
export const reportCashHandover = async (
  reportedAmount: number
): Promise<CourierCashHandover | null> => {
  const response = await useNuxtApp().$api<{ handover?: CourierCashHandover | null } | null>(
    `/cash-handovers/report`,
    {
      method: "POST",
      body: { reported_amount: reportedAmount },
    }
  );
  return response?.handover ?? null;
};
