import { adminApi } from "./client";
import { API_PREFIX, buildApiUrl, getApiBaseUrl } from "./config";

export interface Device {
  id: string;
  tenant_id: string;
  name: string;
  station: string;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceWithToken extends Device {
  device_token: string;
}

export interface DeviceCreateInput {
  name: string;
  station?: string;
}

export interface DeviceRegenerateResponse {
  id: string;
  device_token: string;
  message: string;
}

interface DeviceRequestOptions {
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
  method: "GET" | "POST" | "DELETE",
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

export const devicesApi = {
  list: (options: DeviceRequestOptions = {}): Promise<Device[]> =>
    options.accessToken
      ? requestWithAccessToken<Device[]>("/devices/", "GET", options.accessToken)
      : adminApi.get<Device[]>("/devices/"),

  create: (
    data: DeviceCreateInput,
    options: DeviceRequestOptions = {}
  ): Promise<DeviceWithToken> =>
    options.accessToken
      ? requestWithAccessToken<DeviceWithToken>("/devices/", "POST", options.accessToken, data)
      : adminApi.post<DeviceWithToken>("/devices/", data),

  remove: (deviceId: string, options: DeviceRequestOptions = {}): Promise<void> =>
    options.accessToken
      ? requestWithAccessToken<void>(`/devices/${deviceId}`, "DELETE", options.accessToken)
      : adminApi.delete<void>(`/devices/${deviceId}`),

  regenerateToken: (
    deviceId: string,
    options: DeviceRequestOptions = {}
  ): Promise<DeviceRegenerateResponse> =>
    options.accessToken
      ? requestWithAccessToken<DeviceRegenerateResponse>(
          `/devices/${deviceId}/regenerate-token`,
          "POST",
          options.accessToken
        )
      : adminApi.post<DeviceRegenerateResponse>(`/devices/${deviceId}/regenerate-token`),
};
