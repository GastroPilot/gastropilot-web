"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Clock,
  Edit,
  KeyRound,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  UserCheck,
  UserCog,
  UserX,
  Users,
  User as UserIcon,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { adminTenantsApi, type AdminTenant } from "@/lib/api/admin";
import {
  operatorsApi,
  type OperatorCreateInput,
  type OperatorRole,
  type OperatorUpdateInput,
  type OperatorUser,
} from "@/lib/api/operators";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OperatorFormData = OperatorCreateInput & { is_active: boolean };

const ROLE_ORDER: OperatorRole[] = [
  "platform_admin",
  "owner",
  "manager",
  "staff",
  "kitchen",
  "guest",
];

function getInitialFormData(): OperatorFormData {
  return {
    operator_number: "",
    pin: "",
    nfc_tag_id: "",
    first_name: "",
    last_name: "",
    role: "staff",
    is_active: true,
  };
}

function roleLabel(role: string): string {
  switch (role) {
    case "platform_admin":
      return "Platform Admin";
    case "owner":
      return "Restaurantinhaber";
    case "manager":
      return "Schichtleiter";
    case "staff":
      return "Mitarbeiter";
    case "kitchen":
      return "Küche";
    case "guest":
      return "Gast";
    default:
      return role;
  }
}

function roleTone(role: string): string {
  switch (role) {
    case "platform_admin":
      return "bg-violet-500/15 text-violet-200 border-violet-400/30";
    case "owner":
      return "bg-blue-500/15 text-blue-200 border-blue-400/30";
    case "manager":
      return "bg-amber-500/15 text-amber-200 border-amber-400/30";
    case "kitchen":
      return "bg-emerald-500/15 text-emerald-200 border-emerald-400/30";
    case "guest":
      return "bg-sky-500/15 text-sky-200 border-sky-400/30";
    default:
      return "bg-muted text-foreground border-border";
  }
}

function toOperatorRole(value: string | undefined | null): OperatorRole {
  if (!value) return "staff";
  return ROLE_ORDER.includes(value as OperatorRole) ? (value as OperatorRole) : "staff";
}

function formatLastLogin(value?: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

export default function AdminOperatorsPage() {
  const [restaurants, setRestaurants] = useState<AdminTenant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [loadingOperators, setLoadingOperators] = useState(false);

  const [operators, setOperators] = useState<OperatorUser[]>([]);
  const [currentUser, setCurrentUser] = useState<OperatorUser | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<OperatorUser | null>(null);
  const [formData, setFormData] = useState<OperatorFormData>(getInitialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const selectedRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? null,
    [restaurants, selectedRestaurantId]
  );

  const assignableRoles = useMemo(() => {
    if (currentUser?.role === "platform_admin") {
      return ["platform_admin", "owner", "manager", "staff"] as OperatorRole[];
    }
    return ["owner", "manager", "staff"] as OperatorRole[];
  }, [currentUser?.role]);

  const formRoleOptions = useMemo(() => {
    const allowed = new Set<OperatorRole>(assignableRoles);
    if (editingOperator) {
      allowed.add(toOperatorRole(editingOperator.role));
    }
    return ROLE_ORDER.filter((role) => allowed.has(role));
  }, [assignableRoles, editingOperator]);

  const roleFilterOptions = useMemo(() => {
    const rolesFromData = new Set<OperatorRole>();
    operators.forEach((operator) => rolesFromData.add(toOperatorRole(operator.role)));
    return ROLE_ORDER.filter((role) => rolesFromData.has(role));
  }, [operators]);

  const filteredOperators = useMemo(() => {
    return operators.filter((operator) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        (operator.operator_number ?? "").includes(query) ||
        `${operator.first_name} ${operator.last_name}`.toLowerCase().includes(query) ||
        (operator.nfc_tag_id ?? "").toLowerCase().includes(query);
      const matchesRole = roleFilter === "all" || operator.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [operators, searchQuery, roleFilter]);

  const getTenantAccessToken = useCallback(async (restaurantId: string): Promise<string> => {
    const session = await adminTenantsApi.impersonate(restaurantId);
    return session.impersonation_token;
  }, []);

  const loadRestaurants = useCallback(async () => {
    setLoadingRestaurants(true);
    try {
      const list = await adminTenantsApi.list();
      setRestaurants(list);
      setSelectedRestaurantId((current) => {
        if (current && list.some((restaurant) => restaurant.id === current)) {
          return current;
        }
        return list[0]?.id ?? "";
      });
    } catch (loadError) {
      console.error("Fehler beim Laden der Restaurants:", loadError);
      toast.error("Restaurants konnten nicht geladen werden");
    } finally {
      setLoadingRestaurants(false);
    }
  }, []);

  const loadOperators = useCallback(
    async (restaurantId: string) => {
      if (!restaurantId) {
        setOperators([]);
        setCurrentUser(null);
        return;
      }

      setLoadingOperators(true);
      try {
        const accessToken = await getTenantAccessToken(restaurantId);
        const [list, me] = await Promise.all([
          operatorsApi.list({ accessToken }),
          operatorsApi.getCurrentUser({ accessToken }),
        ]);
        setOperators(list);
        setCurrentUser(me);
      } catch (loadError) {
        console.error("Fehler beim Laden der Bediener:", loadError);
        toast.error("Bediener konnten nicht geladen werden");
      } finally {
        setLoadingOperators(false);
      }
    },
    [getTenantAccessToken]
  );

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    loadOperators(selectedRestaurantId);
  }, [selectedRestaurantId, loadOperators]);

  useEffect(() => {
    if (roleFilter === "all") return;
    if (!roleFilterOptions.includes(roleFilter as OperatorRole)) {
      setRoleFilter("all");
    }
  }, [roleFilter, roleFilterOptions]);

  const resetDialogState = () => {
    setDialogOpen(false);
    setEditingOperator(null);
    setFormData(getInitialFormData());
    setError("");
  };

  const handleCreate = () => {
    setEditingOperator(null);
    setFormData(getInitialFormData());
    setError("");
    setDialogOpen(true);
  };

  const handleEdit = (operator: OperatorUser) => {
    setEditingOperator(operator);
    setFormData({
      operator_number: operator.operator_number ?? "",
      pin: "",
      nfc_tag_id: operator.nfc_tag_id ?? "",
      first_name: operator.first_name,
      last_name: operator.last_name,
      role: toOperatorRole(operator.role),
      is_active: operator.is_active,
    });
    setError("");
    setDialogOpen(true);
  };

  const handleOperatorNumberChange = (value: string) => {
    setFormData((current) => ({
      ...current,
      operator_number: value.replace(/\D/g, "").slice(0, 4),
    }));
  };

  const handlePinChange = (value: string) => {
    setFormData((current) => ({
      ...current,
      pin: value.replace(/\D/g, "").slice(0, 8),
    }));
  };

  const validateForm = (): boolean => {
    if (editingOperator) {
      if (formData.operator_number && formData.operator_number.length !== 4) {
        setError("Bedienernummer muss 4 Ziffern lang sein");
        return false;
      }
      if (formData.pin && (formData.pin.length < 6 || formData.pin.length > 8)) {
        setError("PIN muss 6-8 Ziffern lang sein");
        return false;
      }
      if (formData.first_name.trim().length < 2) {
        setError("Vorname muss mindestens 2 Zeichen lang sein");
        return false;
      }
      if (formData.last_name.trim().length < 2) {
        setError("Nachname muss mindestens 2 Zeichen lang sein");
        return false;
      }
      return true;
    }

    if (!formData.operator_number || formData.operator_number.length !== 4) {
      setError("Bedienernummer muss 4 Ziffern lang sein");
      return false;
    }
    if (!formData.pin || formData.pin.length < 6 || formData.pin.length > 8) {
      setError("PIN muss 6-8 Ziffern lang sein");
      return false;
    }
    if (formData.operator_number === "0000" || formData.operator_number === "0001") {
      setError("Bedienernummer ist reserviert");
      return false;
    }
    if (formData.first_name.trim().length < 2) {
      setError("Vorname muss mindestens 2 Zeichen lang sein");
      return false;
    }
    if (formData.last_name.trim().length < 2) {
      setError("Nachname muss mindestens 2 Zeichen lang sein");
      return false;
    }

    return true;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!selectedRestaurantId) {
      setError("Bitte zuerst ein Restaurant auswählen");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      const accessToken = await getTenantAccessToken(selectedRestaurantId);
      if (editingOperator) {
        const payload: OperatorUpdateInput = {
          operator_number: formData.operator_number || undefined,
          pin: formData.pin || undefined,
          nfc_tag_id: formData.nfc_tag_id?.trim().toUpperCase() || null,
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          role: formData.role,
          is_active: formData.is_active,
        };
        await operatorsApi.update(editingOperator.id, payload, { accessToken });
        toast.success("Bediener aktualisiert");
      } else {
        const { is_active: _formIsActive, ...createCandidate } = formData;
        const payload: OperatorCreateInput = {
          ...createCandidate,
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          nfc_tag_id: formData.nfc_tag_id?.trim().toUpperCase() || null,
        };
        await operatorsApi.create(payload, { accessToken });
        toast.success("Bediener angelegt");
      }

      resetDialogState();
      await loadOperators(selectedRestaurantId);
    } catch (submitError) {
      console.error("Fehler beim Speichern des Bedieners:", submitError);
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Bediener konnte nicht gespeichert werden";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (operator: OperatorUser) => {
    if (!selectedRestaurantId) return;
    const confirmed = window.confirm(
      `Bediener ${operator.first_name} ${operator.last_name} (${operator.operator_number ?? "—"}) wirklich löschen?`
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const accessToken = await getTenantAccessToken(selectedRestaurantId);
      await operatorsApi.remove(operator.id, { accessToken });
      toast.success("Bediener gelöscht");
      await loadOperators(selectedRestaurantId);
    } catch (deleteError) {
      console.error("Fehler beim Löschen des Bedieners:", deleteError);
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Bediener konnte nicht gelöscht werden";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-background to-muted/40" />

      <div className="space-y-6">
        <Card className="overflow-hidden border-border/70 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20">
                  <UserCog className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-2xl tracking-tight">Bedienerverwaltung</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Bediener anlegen, Rollen vergeben und Status verwalten
                  </p>
                </div>
              </div>

              <Button onClick={handleCreate} disabled={!selectedRestaurantId || loadingOperators}>
                <Plus className="mr-2 h-4 w-4" />
                Bediener anlegen
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)_220px]">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Restaurant
                </label>
                {loadingRestaurants ? (
                  <Skeleton className="h-10 w-full rounded-md" />
                ) : (
                  <Select
                    value={selectedRestaurantId}
                    onValueChange={setSelectedRestaurantId}
                    disabled={restaurants.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Restaurant auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {restaurants.map((restaurant) => (
                        <SelectItem key={restaurant.id} value={restaurant.id}>
                          {restaurant.name}
                          {restaurant.is_suspended ? " (deaktiviert)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Suche
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Nach Name, Nummer oder NFC-Tag suchen"
                    className="pl-9"
                    disabled={!selectedRestaurantId}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Rolle filtern
                </label>
                <Select value={roleFilter} onValueChange={setRoleFilter} disabled={!selectedRestaurantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle Rollen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Rollen</SelectItem>
                    {roleFilterOptions.map((role) => (
                      <SelectItem key={role} value={role}>
                        {roleLabel(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {!selectedRestaurantId && !loadingRestaurants ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Kein Restaurant verfügbar</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Erstellen Sie zuerst in der Restaurantverwaltung ein Restaurant.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {selectedRestaurant ? (
          <Card className="border-border/70 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-xl">
                  Bedienerliste
                  <span className="ml-2 text-base font-medium text-muted-foreground">
                    ({filteredOperators.length})
                  </span>
                </CardTitle>
                {loadingOperators ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              </div>
            </CardHeader>
            <CardContent>
              {loadingOperators ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 rounded-lg" />
                  ))}
                </div>
              ) : filteredOperators.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  {operators.length === 0
                    ? "Noch keine Bediener vorhanden."
                    : "Keine Bediener für die aktuelle Suche gefunden."}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/60">
                  <table className="min-w-full divide-y divide-border/70">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Nr.
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Rolle
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          NFC Tag-ID
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Letzter Login
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Status
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Aktionen
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 bg-background/40">
                      {filteredOperators.map((operator) => (
                        <tr key={operator.id} className="hover:bg-muted/20">
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-sm font-semibold">
                            {operator.operator_number ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              <UserIcon className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {operator.first_name} {operator.last_name}
                              </span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">
                            <Badge className={`border ${roleTone(operator.role)}`}>
                              {roleLabel(operator.role)}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                            {operator.nfc_tag_id ? (
                              <span className="inline-flex items-center gap-1 font-mono text-xs text-foreground">
                                <WalletCards className="h-3.5 w-3.5 text-primary" />
                                {operator.nfc_tag_id}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              {formatLastLogin(operator.last_login_at)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">
                            {operator.is_active ? (
                              <Badge className="border border-emerald-400/30 bg-emerald-500/15 text-emerald-200">
                                <UserCheck className="mr-1 h-3.5 w-3.5" />
                                Aktiv
                              </Badge>
                            ) : (
                              <Badge className="border border-red-400/30 bg-red-500/15 text-red-200">
                                <UserX className="mr-1 h-3.5 w-3.5" />
                                Inaktiv
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(operator)}
                                disabled={submitting}
                              >
                                <Edit className="mr-1.5 h-4 w-4" />
                                Bearbeiten
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(operator)}
                                disabled={submitting}
                              >
                                <Trash2 className="mr-1.5 h-4 w-4" />
                                Löschen
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            resetDialogState();
            return;
          }
          setDialogOpen(true);
        }}
      >
        <DialogContent
          className="max-w-3xl border-border/70 bg-card/95 backdrop-blur-xl"
          onClose={resetDialogState}
        >
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingOperator ? "Bediener bearbeiten" : "Neuen Bediener anlegen"}
              </DialogTitle>
              <DialogDescription>
                {editingOperator
                  ? "Bearbeiten Sie Stammdaten, Rolle und Aktiv-Status."
                  : "Legen Sie einen neuen Bediener für das ausgewählte Restaurant an."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-4 pb-2 md:px-6">
              {error ? (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Bedienernummer (4 Ziffern)</label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={formData.operator_number ?? ""}
                      onChange={(event) => handleOperatorNumberChange(event.target.value)}
                      inputMode="numeric"
                      pattern="[0-9]{4}"
                      maxLength={4}
                      required={!editingOperator}
                      disabled={Boolean(editingOperator) || submitting}
                      className="pl-9 text-center font-mono tracking-[0.2em]"
                      placeholder="0000"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">PIN (6-8 Ziffern)</label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={formData.pin ?? ""}
                      onChange={(event) => handlePinChange(event.target.value)}
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]{6,8}"
                      maxLength={8}
                      required={!editingOperator}
                      disabled={submitting}
                      className="pl-9 text-center font-mono tracking-[0.2em]"
                      placeholder={editingOperator ? "Leer lassen, um nicht zu ändern" : "••••••"}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Vorname</label>
                  <Input
                    value={formData.first_name}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, first_name: event.target.value }))
                    }
                    required
                    minLength={2}
                    maxLength={120}
                    disabled={submitting}
                    placeholder="Max"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Nachname</label>
                  <Input
                    value={formData.last_name}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, last_name: event.target.value }))
                    }
                    required
                    minLength={2}
                    maxLength={120}
                    disabled={submitting}
                    placeholder="Mustermann"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Rolle</label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) =>
                      setFormData((current) => ({ ...current, role: toOperatorRole(value) }))
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Rolle wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {formRoleOptions.map((role) => (
                        <SelectItem key={role} value={role}>
                          {roleLabel(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">NFC Tag-ID (optional)</label>
                  <Input
                    value={formData.nfc_tag_id ?? ""}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        nfc_tag_id: event.target.value.toUpperCase(),
                      }))
                    }
                    maxLength={64}
                    disabled={submitting}
                    className="font-mono"
                    placeholder="04A1B2C3D4E5F6"
                  />
                </div>
              </div>

              {editingOperator ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Status</label>
                  <Select
                    value={formData.is_active ? "active" : "inactive"}
                    onValueChange={(value) =>
                      setFormData((current) => ({
                        ...current,
                        is_active: value === "active",
                      }))
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Aktiv</SelectItem>
                      <SelectItem value="inactive">Inaktiv</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            <DialogFooter className="items-center">
              <Button type="button" variant="outline" onClick={resetDialogState} disabled={submitting}>
                <X className="mr-2 h-4 w-4" />
                Abbrechen
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {editingOperator ? "Änderungen speichern" : "Bediener anlegen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
