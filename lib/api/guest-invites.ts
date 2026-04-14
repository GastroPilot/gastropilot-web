import { api } from "./client";

export interface InvitedGuestProfile {
  first_name: string;
  last_name: string;
  allergen_ids: string[];
}

export interface GuestInvite {
  id: string;
  reservation_id: string;
  invite_token: string;
  status: "pending" | "accepted" | "declined";
  invited_guest: InvitedGuestProfile | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInviteResponse {
  invite_token: string;
  invite_url: string;
}

export interface InviteDetails {
  reservation: {
    restaurant_name: string;
    restaurant_slug: string;
    date: string;
    time: string;
    party_size: number;
    host_name: string;
  };
  invite_status: "pending" | "accepted" | "declined";
}

export interface AcceptInviteRequest {
  first_name: string;
  last_name: string;
  allergen_ids: string[];
}

export const guestInvitesApi = {
  create: async (reservationId: string): Promise<CreateInviteResponse> => {
    return api.post(`/public/me/reservations/${reservationId}/invites`);
  },

  list: async (reservationId: string): Promise<GuestInvite[]> => {
    return api.get(`/public/me/reservations/${reservationId}/invites`);
  },

  revoke: async (reservationId: string, inviteId: string): Promise<void> => {
    await api.delete(`/public/me/reservations/${reservationId}/invites/${inviteId}`);
  },

  getDetails: async (token: string): Promise<InviteDetails> => {
    return api.get(`/public/invites/${token}`);
  },

  accept: async (token: string, data: AcceptInviteRequest): Promise<{ success: boolean }> => {
    return api.post(`/public/invites/${token}/accept`, data);
  },

  decline: async (token: string): Promise<{ success: boolean }> => {
    return api.post(`/public/invites/${token}/decline`);
  },
};
