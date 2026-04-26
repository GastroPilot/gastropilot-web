import { adminApi } from "./client";
import { API_PREFIX, buildApiUrl, getApiBaseUrl } from "./config";

export type VoucherDiscountType = "fixed" | "percentage";
export type VoucherAppliesTo = "all" | "breakfast" | "lunch" | "dinner";

export interface Voucher {
  id: string;
  tenant_id: string;
  code: string;
  name: string | null;
  description: string | null;
  type: VoucherDiscountType;
  value: number;
  applies_to: VoucherAppliesTo;
  valid_weekdays: number[] | null;
  valid_time_from: string | null;
  valid_time_until: string | null;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  used_count: number;
  min_order_value: number | null;
  is_active: boolean;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoucherUsage {
  id: string;
  voucher_id: string;
  reservation_id: string | null;
  used_by_email: string | null;
  discount_amount: number;
  used_at: string;
}

export interface VoucherCreate {
  restaurant_id: string;
  code: string;
  name?: string | null;
  description?: string | null;
  type?: VoucherDiscountType;
  value: number;
  applies_to?: VoucherAppliesTo;
  valid_weekdays?: number[] | null;
  valid_time_from?: string | null;
  valid_time_until?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  max_uses?: number | null;
  min_order_value?: number | null;
  is_active?: boolean;
}

export interface VoucherUpdate {
  code?: string | null;
  name?: string | null;
  description?: string | null;
  type?: VoucherDiscountType;
  value?: number;
  applies_to?: VoucherAppliesTo;
  valid_weekdays?: number[] | null;
  valid_time_from?: string | null;
  valid_time_until?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  max_uses?: number | null;
  min_order_value?: number | null;
  is_active?: boolean;
}

interface VoucherRequestOptions {
  accessToken?: string;
}

function parseErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Request fehlgeschlagen";
  }

  const data = payload as { detail?: unknown; message?: unknown };
  if (typeof data.detail === "string") return data.detail;
  if (typeof data.message === "string") return data.message;
  return "Request fehlgeschlagen";
}

async function requestWithAccessToken<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  accessToken: string,
  body?: unknown
): Promise<T> {
  const url = buildApiUrl(getApiBaseUrl(), API_PREFIX, endpoint);
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(parseErrorMessage(errorData));
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

export const voucherManagementApi = {
  list: (options: VoucherRequestOptions = {}): Promise<Voucher[]> =>
    options.accessToken
      ? requestWithAccessToken<Voucher[]>("/vouchers", "GET", options.accessToken)
      : adminApi.get<Voucher[]>("/vouchers"),

  create: (data: VoucherCreate, options: VoucherRequestOptions = {}): Promise<Voucher> =>
    options.accessToken
      ? requestWithAccessToken<Voucher>("/vouchers", "POST", options.accessToken, data)
      : adminApi.post<Voucher>("/vouchers", data),

  update: (
    voucherId: string,
    data: VoucherUpdate,
    options: VoucherRequestOptions = {}
  ): Promise<Voucher> =>
    options.accessToken
      ? requestWithAccessToken<Voucher>(
          `/vouchers/${voucherId}`,
          "PUT",
          options.accessToken,
          data
        )
      : adminApi.put<Voucher>(`/vouchers/${voucherId}`, data),

  delete: (voucherId: string, options: VoucherRequestOptions = {}): Promise<void> =>
    options.accessToken
      ? requestWithAccessToken<void>(`/vouchers/${voucherId}`, "DELETE", options.accessToken)
      : adminApi.delete<void>(`/vouchers/${voucherId}`),

  listUsage: (
    voucherId: string,
    options: VoucherRequestOptions = {}
  ): Promise<VoucherUsage[]> =>
    options.accessToken
      ? requestWithAccessToken<VoucherUsage[]>(
          `/vouchers/${voucherId}/usage`,
          "GET",
          options.accessToken
        )
      : adminApi.get<VoucherUsage[]>(`/vouchers/${voucherId}/usage`),
};
