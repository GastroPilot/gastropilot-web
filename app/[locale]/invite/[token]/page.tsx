"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, Clock, Users, MapPin, Calendar, UserPlus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useInviteDetails, useAcceptInvite } from "@/lib/hooks/use-guest-invites";
import { guestInvitesApi } from "@/lib/api/guest-invites";
import { toast } from "sonner";

const ALLERGENS = [
  { id: "gluten", label: "Gluten" },
  { id: "crustaceans", label: "Krebstiere" },
  { id: "eggs", label: "Eier" },
  { id: "fish", label: "Fisch" },
  { id: "peanuts", label: "Erdnüsse" },
  { id: "soy", label: "Soja" },
  { id: "milk", label: "Milch" },
  { id: "nuts", label: "Schalenfrüchte" },
  { id: "celery", label: "Sellerie" },
  { id: "mustard", label: "Senf" },
  { id: "sesame", label: "Sesam" },
  { id: "sulfites", label: "Sulfite" },
  { id: "lupin", label: "Lupine" },
  { id: "molluscs", label: "Weichtiere" },
];

export default function InvitePage() {
  const params = useParams();
  const token = params.token as string;
  const { data, isLoading, isError } = useInviteDetails(token);
  const acceptMutation = useAcceptInvite(token);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedAllergens, setSelectedAllergens] = useState<Set<string>>(new Set());
  const [accepted, setAccepted] = useState(false);

  const toggleAllergen = (id: string) => {
    setSelectedAllergens((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAccept = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    try {
      await acceptMutation.mutateAsync({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        allergen_ids: Array.from(selectedAllergens),
      });
      setAccepted(true);
    } catch (err: any) {
      toast.error("Fehler", { description: err.message || "Einladung konnte nicht angenommen werden." });
    }
  };

  const handleDecline = async () => {
    try {
      await guestInvitesApi.decline(token);
      toast.success("Abgelehnt");
    } catch {
      // silent
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <CardContent className="pt-6">
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <p className="mt-4 text-lg font-semibold">Ungültiger Einladungslink</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Dieser Link ist ungültig oder abgelaufen.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.invite_status === "accepted" || accepted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <CardContent className="pt-6">
            <CheckCircle className="mx-auto h-16 w-16 text-emerald-500" />
            <p className="mt-4 text-xl font-bold">Du bist dabei!</p>
            <p className="mt-2 text-muted-foreground">
              {data.reservation.restaurant_name} — {data.reservation.date}, {data.reservation.time} Uhr
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Das Restaurant wurde benachrichtigt.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const res = data.reservation;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">
        {/* Header */}
        <div className="text-center">
          <UserPlus className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-3 text-2xl font-bold">Du bist eingeladen!</h1>
        </div>

        {/* Reservation Info */}
        <Card>
          <CardHeader>
            <CardTitle>{res.restaurant_name}</CardTitle>
            <CardDescription>Eingeladen von {res.host_name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-primary" />
              <span>{res.date}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-primary" />
              <span>{res.time} Uhr</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-primary" />
              <span>{res.party_size} Personen</span>
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Vorname"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <Input
                placeholder="Nachname"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Allergene & Unverträglichkeiten</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Teile dem Restaurant deine Ernährungsbedürfnisse mit.
              </p>
              <div className="flex flex-wrap gap-2">
                {ALLERGENS.map((a) => (
                  <Badge
                    key={a.id}
                    variant={selectedAllergens.has(a.id) ? "default" : "outline"}
                    className="cursor-pointer select-none"
                    onClick={() => toggleAllergen(a.id)}
                  >
                    {a.label}
                  </Badge>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleAccept}
              disabled={!firstName.trim() || !lastName.trim() || acceptMutation.isPending}
            >
              {acceptMutation.isPending ? "Wird gesendet..." : "Einladung annehmen"}
            </Button>
            <Button variant="ghost" className="w-full" onClick={handleDecline}>
              Ablehnen
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
