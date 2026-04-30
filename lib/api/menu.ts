import { adminApi } from "./client";
import { API_PREFIX, buildApiUrl, getApiBaseUrl } from "./config";

export interface MenuCategory {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category_type: "food" | "drink";
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MenuItem {
  id: string;
  tenant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  is_vegetarian: boolean;
  is_vegan: boolean;
  allergens: string[];
  ingredients: Array<Record<string, unknown>>;
  tags: string[];
  image_url: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface MenuCategoryCreate {
  restaurant_id: string;
  name: string;
  description?: string | null;
  category_type?: "food" | "drink";
  sort_order?: number;
  is_active?: boolean;
}

export interface MenuCategoryUpdate {
  name?: string;
  description?: string | null;
  category_type?: "food" | "drink";
  sort_order?: number;
  is_active?: boolean;
}

export interface MenuItemCreate {
  restaurant_id: string;
  category_id?: string | null;
  name: string;
  description?: string | null;
  price: number;
  is_available?: boolean;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  allergens?: string[];
  ingredients?: Array<Record<string, unknown>>;
  tags?: string[];
  image_url?: string | null;
  sort_order?: number;
}

export interface MenuItemUpdate {
  category_id?: string | null;
  name?: string;
  description?: string | null;
  price?: number;
  is_available?: boolean;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  allergens?: string[];
  ingredients?: Array<Record<string, unknown>>;
  tags?: string[];
  image_url?: string | null;
  sort_order?: number;
}

interface MenuRequestOptions {
  accessToken?: string;
}

function buildQuery(params: {
  restaurant_id?: string;
  category_id?: string;
  available_only?: boolean;
}): string {
  const search = new URLSearchParams();
  if (params.restaurant_id) search.set("restaurant_id", params.restaurant_id);
  if (params.category_id) search.set("category_id", params.category_id);
  if (params.available_only) search.set("available_only", "true");
  const query = search.toString();
  return query ? `?${query}` : "";
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

export const menuManagementApi = {
  listCategories: (
    params: { restaurant_id?: string } = {},
    options: MenuRequestOptions = {}
  ): Promise<MenuCategory[]> =>
    options.accessToken
      ? requestWithAccessToken<MenuCategory[]>(
          `/menus/categories${buildQuery(params)}`,
          "GET",
          options.accessToken
        )
      : adminApi.get<MenuCategory[]>(`/menus/categories${buildQuery(params)}`),

  createCategory: (data: MenuCategoryCreate, options: MenuRequestOptions = {}): Promise<MenuCategory> =>
    options.accessToken
      ? requestWithAccessToken<MenuCategory>(
          "/menus/categories",
          "POST",
          options.accessToken,
          data
        )
      : adminApi.post<MenuCategory>("/menus/categories", data),

  updateCategory: (
    categoryId: string,
    data: MenuCategoryUpdate,
    options: MenuRequestOptions = {}
  ): Promise<MenuCategory> =>
    options.accessToken
      ? requestWithAccessToken<MenuCategory>(
          `/menus/categories/${categoryId}`,
          "PATCH",
          options.accessToken,
          data
        )
      : adminApi.patch<MenuCategory>(`/menus/categories/${categoryId}`, data),

  deleteCategory: (categoryId: string, options: MenuRequestOptions = {}): Promise<void> =>
    options.accessToken
      ? requestWithAccessToken<void>(
          `/menus/categories/${categoryId}`,
          "DELETE",
          options.accessToken
        )
      : adminApi.delete<void>(`/menus/categories/${categoryId}`),

  listItems: (
    params: { restaurant_id?: string; category_id?: string; available_only?: boolean } = {},
    options: MenuRequestOptions = {}
  ): Promise<MenuItem[]> =>
    options.accessToken
      ? requestWithAccessToken<MenuItem[]>(
          `/menus/items${buildQuery(params)}`,
          "GET",
          options.accessToken
        )
      : adminApi.get<MenuItem[]>(`/menus/items${buildQuery(params)}`),

  createItem: (data: MenuItemCreate, options: MenuRequestOptions = {}): Promise<MenuItem> =>
    options.accessToken
      ? requestWithAccessToken<MenuItem>(
          "/menus/items",
          "POST",
          options.accessToken,
          data
        )
      : adminApi.post<MenuItem>("/menus/items", data),

  updateItem: (
    itemId: string,
    data: MenuItemUpdate,
    options: MenuRequestOptions = {}
  ): Promise<MenuItem> =>
    options.accessToken
      ? requestWithAccessToken<MenuItem>(
          `/menus/items/${itemId}`,
          "PATCH",
          options.accessToken,
          data
        )
      : adminApi.patch<MenuItem>(`/menus/items/${itemId}`, data),

  deleteItem: (itemId: string, options: MenuRequestOptions = {}): Promise<void> =>
    options.accessToken
      ? requestWithAccessToken<void>(`/menus/items/${itemId}`, "DELETE", options.accessToken)
      : adminApi.delete<void>(`/menus/items/${itemId}`),
};
