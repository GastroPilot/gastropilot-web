"use client";

import { create } from "zustand";
import { adminImpersonation } from "@/lib/api/admin";
import { adminAuthApi, type AdminUser } from "@/lib/api/admin-auth";

interface AdminAuthState {
  adminUser: AdminUser | null;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;

  login: (data: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  loadAdmin: () => Promise<void>;
  clearError: () => void;
}

export const useAdminAuth = create<AdminAuthState>((set) => ({
  adminUser: null,
  isAdmin: false,
  isLoading: true,
  error: null,

  login: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const user = await adminAuthApi.login(data);
      set({ adminUser: user, isAdmin: true, isLoading: false });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Admin-Login fehlgeschlagen";
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  logout: () => {
    adminAuthApi.logout();
    set({ adminUser: null, isAdmin: false, error: null });
  },

  loadAdmin: async () => {
    if (!adminAuthApi.isAuthenticated()) {
      set({ adminUser: null, isAdmin: false, isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const user = await adminAuthApi.getMe();
      const isPlatformRole = ["platform_admin", "platform_support", "platform_analyst"].includes(
        user.role
      );
      const canUseAdminUi =
        user.role === "platform_admin" ||
        (adminImpersonation.isActive() &&
          (user.role === "platform_support" || user.role === "platform_analyst"));

      if (!isPlatformRole || !canUseAdminUi) {
        adminAuthApi.logout();
        set({ adminUser: null, isAdmin: false, isLoading: false });
        return;
      }
      set({ adminUser: user, isAdmin: true, isLoading: false });
    } catch {
      adminAuthApi.logout();
      set({ adminUser: null, isAdmin: false, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
