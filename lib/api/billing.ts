import { adminApi } from "./client";
import { API_PREFIX, buildApiUrl, getApiBaseUrl } from "./config";

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
  tier: string;
}

export interface Subscription {
  id: string;
  plan: string;
  status: string;
  current_period_end: string | null;
}

interface BillingRequestOptions {
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
  method: "GET" | "POST",
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

export const billingApi = {
  getPlans: (options: BillingRequestOptions = {}): Promise<SubscriptionPlan[]> =>
    options.accessToken
      ? requestWithAccessToken<SubscriptionPlan[]>(
          "/billing/plans",
          "GET",
          options.accessToken
        )
      : adminApi.get<SubscriptionPlan[]>("/billing/plans"),

  getSubscription: (options: BillingRequestOptions = {}): Promise<Subscription> =>
    options.accessToken
      ? requestWithAccessToken<Subscription>(
          "/billing/subscription",
          "GET",
          options.accessToken
        )
      : adminApi.get<Subscription>("/billing/subscription"),

  createCheckout: (
    planId: string,
    urls: { success_url: string; cancel_url: string },
    options: BillingRequestOptions = {}
  ): Promise<{ checkout_url: string }> =>
    options.accessToken
      ? requestWithAccessToken<{ checkout_url: string }>(
          "/billing/checkout",
          "POST",
          options.accessToken,
          {
            plan_id: planId,
            success_url: urls.success_url,
            cancel_url: urls.cancel_url,
          }
        )
      : adminApi.post<{ checkout_url: string }>("/billing/checkout", {
          plan_id: planId,
          success_url: urls.success_url,
          cancel_url: urls.cancel_url,
        }),

  openPortal: (options: BillingRequestOptions = {}): Promise<{ url: string }> =>
    options.accessToken
      ? requestWithAccessToken<{ url: string }>(
          "/billing/portal",
          "POST",
          options.accessToken,
          {}
        )
      : adminApi.post<{ url: string }>("/billing/portal", {}),
};
