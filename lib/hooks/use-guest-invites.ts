import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { guestInvitesApi, type AcceptInviteRequest } from "@/lib/api/guest-invites";

const INVITES_KEY = "reservation-invites";

export function useReservationInvites(reservationId: string | undefined) {
  return useQuery({
    queryKey: [INVITES_KEY, reservationId],
    queryFn: () => guestInvitesApi.list(reservationId!),
    enabled: !!reservationId,
    staleTime: 30_000,
  });
}

export function useCreateInvite(reservationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => guestInvitesApi.create(reservationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INVITES_KEY, reservationId] });
    },
  });
}

export function useRevokeInvite(reservationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => guestInvitesApi.revoke(reservationId, inviteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INVITES_KEY, reservationId] });
    },
  });
}

export function useInviteDetails(token: string | undefined) {
  return useQuery({
    queryKey: ["invite-details", token],
    queryFn: () => guestInvitesApi.getDetails(token!),
    enabled: !!token,
  });
}

export function useAcceptInvite(token: string) {
  return useMutation({
    mutationFn: (data: AcceptInviteRequest) => guestInvitesApi.accept(token, data),
  });
}
