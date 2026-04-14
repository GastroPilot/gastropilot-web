import { adminApi } from "./client";

export interface AdminRestaurant {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  company_name: string | null;
  street: string | null;
  zip_code: string | null;
  city: string | null;
  country: string | null;
  tax_number: string | null;
  vat_id: string | null;
  settings: Record<string, unknown>;
}

export interface AdminRestaurantUpdate {
  name?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  description?: string | null;
  company_name?: string | null;
  street?: string | null;
  zip_code?: string | null;
  city?: string | null;
  country?: string | null;
  tax_number?: string | null;
  vat_id?: string | null;
}

export const adminRestaurantsApi = {
  list: (): Promise<AdminRestaurant[]> =>
    adminApi.get<AdminRestaurant[]>("/restaurants"),

  get: (id: string): Promise<AdminRestaurant> =>
    adminApi.get<AdminRestaurant>(`/restaurants/${id}`),

  update: (id: string, data: AdminRestaurantUpdate): Promise<AdminRestaurant> =>
    adminApi.patch<AdminRestaurant>(`/restaurants/${id}`, data),
};
