import { adminApi } from "./client";
import { API_PREFIX, buildApiUrl, getApiBaseUrl } from "./config";

export type MenuDealPricingMode = "fixed_price" | "fixed_discount" | "percentage_discount";
export type MenuDealServicePeriod = "all" | "breakfast" | "lunch" | "dinner";

export interface MenuDealComponentRule {
  key: string;
  label: string;
  required: boolean;
  quantity: number;
  category_ids: string[] | null;
  item_ids: string[] | null;
  surcharge_allowed: boolean;
}

export interface MenuDeal {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  available_from_date: string | null;
  available_until_date: string | null;
  min_party_size: number | null;
  max_party_size: number | null;
  available_times: Record<string, string[]> | null;
  available_weekdays: number[] | null;
  image_url: string | null;
  display_order: number;
  package_type: "bundle_deal" | "addon";
  pricing_mode: MenuDealPricingMode;
  service_period: MenuDealServicePeriod;
  valid_time_from: string | null;
  valid_time_until: string | null;
  component_rules: MenuDealComponentRule[] | null;
  allow_main_item_surcharge: boolean;
  main_item_base_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface MenuDealCreate {
  restaurant_id: string;
  name: string;
  description?: string | null;
  price: number;
  is_active?: boolean;
  available_from_date?: string | null;
  available_until_date?: string | null;
  min_party_size?: number | null;
  max_party_size?: number | null;
  available_weekdays?: number[] | null;
  display_order?: number;
  package_type?: "bundle_deal" | "addon";
  pricing_mode?: MenuDealPricingMode;
  service_period?: MenuDealServicePeriod;
  valid_time_from?: string | null;
  valid_time_until?: string | null;
  component_rules?: MenuDealComponentRule[] | null;
  allow_main_item_surcharge?: boolean;
  main_item_base_price?: number | null;
}

export interface MenuDealUpdate {
  name?: string;
  description?: string | null;
  price?: number;
  is_active?: boolean;
  available_from_date?: string | null;
  available_until_date?: string | null;
  min_party_size?: number | null;
  max_party_size?: number | null;
  available_weekdays?: number[] | null;
  display_order?: number;
  package_type?: "bundle_deal" | "addon";
  pricing_mode?: MenuDealPricingMode;
  service_period?: MenuDealServicePeriod;
  valid_time_from?: string | null;
  valid_time_until?: string | null;
  component_rules?: MenuDealComponentRule[] | null;
  allow_main_item_surcharge?: boolean;
  main_item_base_price?: number | null;
}

interface MenuDealRequestOptions {
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

export const menuDealsApi = {
  list: (
    options: MenuDealRequestOptions = {},
    packageType: "bundle_deal" | "addon" | "all" = "bundle_deal",
    restaurantId?: string
  ): Promise<MenuDeal[]> => {
    const params = new URLSearchParams();
    if (packageType !== "all") {
      params.set("package_type", packageType);
    }
    if (restaurantId) {
      params.set("restaurant_id", restaurantId);
    }
    const query = params.toString();
    const endpoint = query ? `/upsell-packages?${query}` : "/upsell-packages";
    return options.accessToken
      ? requestWithAccessToken<MenuDeal[]>(endpoint, "GET", options.accessToken)
      : adminApi.get<MenuDeal[]>(endpoint);
  },

  create: (data: MenuDealCreate, options: MenuDealRequestOptions = {}): Promise<MenuDeal> =>
    options.accessToken
      ? requestWithAccessToken<MenuDeal>("/upsell-packages", "POST", options.accessToken, data)
      : adminApi.post<MenuDeal>("/upsell-packages", data),

  update: (
    dealId: string,
    data: MenuDealUpdate,
    options: MenuDealRequestOptions = {},
    restaurantId?: string
  ): Promise<MenuDeal> => {
    const endpoint = restaurantId
      ? `/upsell-packages/${dealId}?restaurant_id=${encodeURIComponent(restaurantId)}`
      : `/upsell-packages/${dealId}`;
    return options.accessToken
      ? requestWithAccessToken<MenuDeal>(endpoint, "PUT", options.accessToken, data)
      : adminApi.put<MenuDeal>(endpoint, data);
  },

  delete: (
    dealId: string,
    options: MenuDealRequestOptions = {},
    restaurantId?: string
  ): Promise<void> => {
    const endpoint = restaurantId
      ? `/upsell-packages/${dealId}?restaurant_id=${encodeURIComponent(restaurantId)}`
      : `/upsell-packages/${dealId}`;
    return options.accessToken
      ? requestWithAccessToken<void>(endpoint, "DELETE", options.accessToken)
      : adminApi.delete<void>(endpoint);
  },
};
