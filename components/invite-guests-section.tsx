"use client";

import { Users, UserPlus, Clock, CheckCircle, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReservationInvites, useCreateInvite, useRevokeInvite } from "@/lib/hooks/use-guest-invites";
import { toast } from "sonner";

const ALLERGEN_LABELS: Record<string, string> = {
  gluten: "Gluten", crustaceans: "Krebstiere", eggs: "Eier", fish: "Fisch",
  peanuts: "Erdnüsse", soy: "Soja", milk: "Milch", nuts: "Schalenfrüchte",
  celery: "Sellerie", mustard: "Senf", sesame: "Sesam", sulfites: "Sulfite",
  lupin: "Lupine", molluscs: "Weichtiere",
};

interface Props {
  reservationId: string;
  partySize: number;
  status: string;
}

export function InviteGuestsSection({ reservationId, partySize, status }: Props) {
  const { data: invites, isLoading } = useReservationInvites(reservationId);
  const createInvite = useCreateInvite(reservationId);
  const revokeInvite = useRevokeInvite(reservationId);

  const canManage = partySize > 1 && (status === "pending" || status === "confirmed");
  if (!canManage) return null;

  const maxInvites = partySize - 1;
  const currentCount = invites?.filter((i) => i.status !== "declined").length ?? 0;
  const acceptedCount = invites?.filter((i) => i.status === "accepted").length ?? 0;
  const canInviteMore = currentCount < maxInvites;

  const handleInvite = async () => {
    try {
      const result = await createInvite.mutateAsync();
      if (navigator.share) {
        await navigator.share({
          title: "GastroPilot Einladung",
          url: result.invite_url,
        });
      } else {
        await navigator.clipboard.writeText(result.invite_url);
        toast.success("Link kopiert", { description: "Einladungslink in die Zwischenablage kopiert." });
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error("Fehler", { description: err.message || "Einladung konnte nicht erstellt werden." });
      }
    }
  };

  const handleRevoke = async (inviteId: string) => {
    try {
      await revokeInvite.mutateAsync(inviteId);
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Eingeladene Gäste</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {acceptedCount}/{maxInvites} bestätigt
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-10 animate-pulse rounded-md bg-muted" />
          <div className="h-10 animate-pulse rounded-md bg-muted" />
        </div>
      ) : (
        <>
          {invites && invites.length > 0 && (
            <div className="space-y-2">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2"
                >
                  {invite.status === "accepted" ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : invite.status === "declined" ? (
                    <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                  ) : (
                    <Clock className="h-4 w-4 shrink-0 text-amber-500" />
                  )}

                  <div className="min-w-0 flex-1">
                    {invite.invited_guest ? (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-sm font-medium">
                          {invite.invited_guest.first_name} {invite.invited_guest.last_name}
                        </span>
                        {invite.invited_guest.allergen_ids.map((id) => (
                          <span
                            key={id}
                            className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
                          >
                            {ALLERGEN_LABELS[id] || id}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm italic text-muted-foreground">
                        {invite.status === "declined" ? "Abgesagt" : "Ausstehend..."}
                      </span>
                    )}
                  </div>

                  {invite.status === "pending" && (
                    <button
                      onClick={() => handleRevoke(invite.id)}
                      className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {canInviteMore ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleInvite}
              disabled={createInvite.isPending}
              className="w-full"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {createInvite.isPending ? "Erstelle..." : "Gast einladen"}
            </Button>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Alle Gästeplätze belegt
            </p>
          )}
        </>
      )}
    </div>
  );
}
