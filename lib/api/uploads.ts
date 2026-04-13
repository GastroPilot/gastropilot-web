import { API_PREFIX, buildApiUrl, getApiBaseUrl } from "./config";

function parseUploadError(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Upload fehlgeschlagen";
  const data = payload as { detail?: unknown; message?: unknown };
  if (typeof data.detail === "string") return data.detail;
  if (typeof data.message === "string") return data.message;
  return "Upload fehlgeschlagen";
}

async function uploadFile(
  endpoint: string,
  file: File,
  accessToken?: string
): Promise<{ url: string }> {
  const token =
    accessToken ||
    (typeof window !== "undefined"
      ? localStorage.getItem("admin_access_token")
      : null);

  const formData = new FormData();
  formData.append("file", file);

  const url = buildApiUrl(getApiBaseUrl(), API_PREFIX, endpoint);
  const response = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(parseUploadError(errorData));
  }

  return response.json();
}

export const uploadsApi = {
  uploadRestaurantImage: (file: File, accessToken?: string) =>
    uploadFile("/uploads/restaurant-image", file, accessToken),
};
