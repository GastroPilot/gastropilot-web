import { adminApi } from "./client";
import { API_PREFIX, buildApiUrl, getApiBaseUrl } from "./config";

export type OperatorRole =
  | "platform_admin"
  | "owner"
  | "manager"
  | "staff"
  | "kitchen"
  | "guest";

export interface OperatorUser {
  id: string;
  tenant_id?: string | null;
  email?: string | null;
  operator_number: string | null;
  nfc_tag_id?: string | null;
  first_name: string;
  last_name: string;
  role: OperatorRole | string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string | null;
}

export interface OperatorCreateInput {
  operator_number?: string;
  pin?: string;
  nfc_tag_id?: string | null;
  email?: string | null;
  password?: string | null;
  first_name: string;
  last_name: string;
  role: OperatorRole;
}

export interface OperatorUpdateInput {
  operator_number?: string;
  pin?: string;
  nfc_tag_id?: string | null;
  email?: string | null;
  password?: string | null;
  first_name?: string;
  last_name?: string;
  role?: OperatorRole;
  is_active?: boolean;
}

interface OperatorRequestOptions {
  accessToken?: string;
}

function parseErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Request fehlgeschlagen";
  }

  const data = payload as { detail?: unknown; message?: unknown };
  if (typeof data.detail === "string") return data.detail;
  if (typeof data.message === "string") return data.message;

  if (Array.isArray(data.detail)) {
    const joined = data.detail
      .map((entry) => {
        if (entry && typeof entry === "object") {
          const maybeMessage = (entry as { msg?: unknown }).msg;
          if (typeof maybeMessage === "string") return maybeMessage;
        }
        return "";
      })
      .filter(Boolean)
      .join(", ");
    if (joined) return joined;
  }

  return "Request fehlgeschlagen";
}

async function requestWithAccessToken<T>(
  endpoint: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
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

export const operatorsApi = {
  getCurrentUser: (options: OperatorRequestOptions = {}): Promise<OperatorUser> =>
    options.accessToken
      ? requestWithAccessToken<OperatorUser>("/auth/me", "GET", options.accessToken)
      : adminApi.get<OperatorUser>("/auth/me"),

  list: (options: OperatorRequestOptions = {}): Promise<OperatorUser[]> =>
    options.accessToken
      ? requestWithAccessToken<OperatorUser[]>("/users/", "GET", options.accessToken)
      : adminApi.get<OperatorUser[]>("/users/"),

  create: (
    data: OperatorCreateInput,
    options: OperatorRequestOptions = {}
  ): Promise<OperatorUser> =>
    options.accessToken
      ? requestWithAccessToken<OperatorUser>("/users/", "POST", options.accessToken, data)
      : adminApi.post<OperatorUser>("/users/", data),

  update: (
    operatorId: string,
    data: OperatorUpdateInput,
    options: OperatorRequestOptions = {}
  ): Promise<OperatorUser> =>
    options.accessToken
      ? requestWithAccessToken<OperatorUser>(
          `/users/${operatorId}`,
          "PATCH",
          options.accessToken,
          data
        )
      : adminApi.patch<OperatorUser>(`/users/${operatorId}`, data),

  remove: (operatorId: string, options: OperatorRequestOptions = {}): Promise<void> =>
    options.accessToken
      ? requestWithAccessToken<void>(`/users/${operatorId}`, "DELETE", options.accessToken)
      : adminApi.delete<void>(`/users/${operatorId}`),
};
