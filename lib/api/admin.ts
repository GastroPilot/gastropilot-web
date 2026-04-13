import { adminApi } from "./client";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface AdminGuest {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  language: string | null;
  notes: string | null;
  email_verified: boolean;
  has_password: boolean;
  allergen_profile?: unknown[];
  created_at: string | null;
  updated_at?: string | null;
}

export interface AdminReservation {
  id: string;
  tenant_id: string;
  restaurant_name: string;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  party_size: number;
  start_at: string | null;
  end_at: string | null;
  status: string;
  channel: string;
  special_requests: string | null;
  notes?: string | null;
  confirmation_code?: string | null;
  canceled_reason?: string | null;
  created_at: string | null;
}

export interface AdminReview {
  id: string;
  tenant_id: string;
  restaurant_name: string;
  guest_profile_id: string | null;
  guest_name: string | null;
  rating: number;
  title: string | null;
  text: string | null;
  is_visible: boolean;
  is_verified: boolean;
  staff_reply: string | null;
  staff_reply_at: string | null;
  created_at: string | null;
}

export interface AdminStats {
  total_guests: number;
  total_reservations: number;
  total_reviews: number;
  total_restaurants: number;
  reservations_by_status: Record<string, number>;
  recent_guests_30d: number;
  recent_reservations_30d: number;
}

// ─── API Functions ──────────────────────────────────────────────────────────

function buildQuery(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      parts.push(`${key}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

export const adminGuestsApi = {
  list: (params: { page?: number; per_page?: number; search?: string } = {}) =>
    adminApi.get<PaginatedResponse<AdminGuest>>(
      `/admin/guests${buildQuery(params)}`
    ),

  get: (id: string) => adminApi.get<AdminGuest>(`/admin/guests/${id}`),

  update: (
    id: string,
    data: {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      language?: string;
      notes?: string;
      allergen_profile?: unknown[];
      email_verified?: boolean;
      password?: string;
    }
  ) => adminApi.patch<AdminGuest>(`/admin/guests/${id}`, data),

  delete: (id: string) =>
    adminApi.delete<{ deleted: boolean }>(`/admin/guests/${id}`),
};

export const adminReservationsApi = {
  list: (
    params: {
      page?: number;
      per_page?: number;
      status?: string;
      restaurant_id?: string;
    } = {}
  ) =>
    adminApi.get<PaginatedResponse<AdminReservation>>(
      `/admin/reservations${buildQuery(params)}`
    ),

  get: (id: string) =>
    adminApi.get<AdminReservation>(`/admin/reservations/${id}`),

  updateStatus: (
    id: string,
    data: { status: string; canceled_reason?: string }
  ) =>
    adminApi.patch<{ id: string; status: string }>(
      `/admin/reservations/${id}/status`,
      data
    ),
};

export const adminReviewsApi = {
  list: (
    params: {
      page?: number;
      per_page?: number;
      restaurant_id?: string;
      visible?: boolean;
    } = {}
  ) =>
    adminApi.get<PaginatedResponse<AdminReview>>(
      `/admin/reviews${buildQuery(params)}`
    ),

  toggleVisibility: (id: string, is_visible: boolean) =>
    adminApi.patch<{ id: string; is_visible: boolean }>(
      `/admin/reviews/${id}`,
      { is_visible }
    ),

  delete: (id: string) =>
    adminApi.delete<{ deleted: boolean }>(`/admin/reviews/${id}`),

  reply: (id: string, text: string) =>
    adminApi.post<{ id: string; staff_reply: string; staff_reply_at: string }>(
      `/admin/reviews/${id}/reply`,
      { text }
    ),
};

export const adminStatsApi = {
  get: () => adminApi.get<AdminStats>("/admin/stats"),
};

// ─── Tenant Types ──────────────────────────────────────────────────────────

export interface AdminTenant {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  description?: string | null;
  is_suspended: boolean;
  subscription_status: string | null;
  subscription_tier: string | null;
  settings?: Record<string, unknown>;
  created_at: string | null;
  updated_at?: string | null;
}

export interface AdminTenantCreate {
  name: string;
  slug?: string;
  address?: string;
  phone?: string;
  email?: string;
  owner_first_name: string;
  owner_last_name: string;
  owner_email: string;
  owner_password: string;
  owner_operator_number: string;
  owner_pin: string;
}

export interface AdminTenantImpersonation {
  impersonation_token: string;
  tenant_id: string;
  tenant_name: string;
}

export interface AdminUserImpersonation {
  impersonation_token: string;
  user_id: string;
  user_name: string;
  tenant_id: string | null;
}

export const adminTenantsApi = {
  list: () => adminApi.get<AdminTenant[]>("/admin/tenants"),

  get: (id: string) => adminApi.get<AdminTenant>(`/admin/tenants/${id}`),

  impersonate: (id: string) =>
    adminApi.get<AdminTenantImpersonation>(`/admin/tenants/${id}/impersonate`),

  create: (data: AdminTenantCreate) =>
    adminApi.post<{
      tenant_id: string;
      tenant_name: string;
      owner_id: string;
      owner_operator_number: string;
    }>("/admin/tenants", data),

  update: (
    id: string,
    data: {
      name?: string;
      slug?: string;
      address?: string;
      phone?: string;
      email?: string;
      settings?: Record<string, unknown>;
    }
  ) => adminApi.patch<{ id: string; name: string }>(`/admin/tenants/${id}`, data),

  delete: (id: string) =>
    adminApi.delete<{ deleted: boolean }>(`/admin/tenants/${id}`),

  toggleSuspension: (id: string, is_suspended: boolean) =>
    adminApi.patch<{ id: string; name: string; is_suspended: boolean }>(
      `/admin/tenants/${id}/suspend`,
      { is_suspended }
    ),
};

export const adminUsersApi = {
  impersonate: (id: string) =>
    adminApi.get<AdminUserImpersonation>(`/admin/users/${id}/impersonate`),
};

const IMPERSONATION_KEYS = {
  originalToken: "admin_original_token",
  userId: "impersonating_user_id",
  userName: "impersonating_user_name",
} as const;

export const adminImpersonation = {
  start(token: string, userId: string, userName: string): void {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(IMPERSONATION_KEYS.originalToken)) {
      const currentToken = localStorage.getItem("admin_access_token");
      if (currentToken) {
        localStorage.setItem(IMPERSONATION_KEYS.originalToken, currentToken);
      }
    }
    localStorage.setItem("admin_access_token", token);
    localStorage.setItem(IMPERSONATION_KEYS.userId, userId);
    localStorage.setItem(IMPERSONATION_KEYS.userName, userName);
  },

  stop(): void {
    if (typeof window === "undefined") return;
    const originalToken = localStorage.getItem(IMPERSONATION_KEYS.originalToken);
    if (originalToken) {
      localStorage.setItem("admin_access_token", originalToken);
    } else {
      localStorage.removeItem("admin_access_token");
    }
    localStorage.removeItem(IMPERSONATION_KEYS.originalToken);
    localStorage.removeItem(IMPERSONATION_KEYS.userId);
    localStorage.removeItem(IMPERSONATION_KEYS.userName);
  },

  clear(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(IMPERSONATION_KEYS.originalToken);
    localStorage.removeItem(IMPERSONATION_KEYS.userId);
    localStorage.removeItem(IMPERSONATION_KEYS.userName);
  },

  isActive(): boolean {
    if (typeof window === "undefined") return false;
    return Boolean(localStorage.getItem(IMPERSONATION_KEYS.userId));
  },

  getUserId(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(IMPERSONATION_KEYS.userId);
  },

  getUserName(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(IMPERSONATION_KEYS.userName);
  },
};

// ─── Platform Admin Types ──────────────────────────────────────────────────

export interface AdminPlatformAdmin {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string | null;
  updated_at?: string | null;
}

export const adminPlatformAdminsApi = {
  list: () =>
    adminApi.get<AdminPlatformAdmin[]>("/admin/platform-admins"),

  get: (id: string) =>
    adminApi.get<AdminPlatformAdmin>(`/admin/platform-admins/${id}`),

  create: (data: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    role?: string;
  }) =>
    adminApi.post<AdminPlatformAdmin>("/admin/platform-admins", data),

  update: (
    id: string,
    data: {
      first_name?: string;
      last_name?: string;
      email?: string;
      password?: string;
      role?: string;
      is_active?: boolean;
    }
  ) =>
    adminApi.patch<AdminPlatformAdmin>(
      `/admin/platform-admins/${id}`,
      data
    ),

  delete: (id: string) =>
    adminApi.delete<{ deleted: boolean }>(`/admin/platform-admins/${id}`),
};
