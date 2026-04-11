"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Copy,
  KeyRound,
  Loader2,
  Monitor,
  Plus,
  Store,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { adminTenantsApi, type AdminTenant } from "@/lib/api/admin";
import {
  devicesApi,
  type Device,
  type DeviceWithToken,
} from "@/lib/api/devices";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const STATION_OPTIONS = [
  { value: "alle", label: "Alle Stationen" },
  { value: "kueche", label: "Küche" },
  { value: "bar", label: "Bar" },
  { value: "grill", label: "Grill" },
  { value: "dessert", label: "Dessert" },
  { value: "vorspeisen", label: "Vorspeisen" },
];

function formatDate(value: string | null): string {
  if (!value) return "Nie";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  return diff < 5 * 60 * 1000;
}

function getStationLabel(station: string): string {
  return STATION_OPTIONS.find((option) => option.value === station)?.label ?? station;
}

export default function AdminDevicesPage() {
  const [restaurants, setRestaurants] = useState<AdminTenant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);

  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [creatingDevice, setCreatingDevice] = useState(false);
  const [deletingDeviceId, setDeletingDeviceId] = useState<string | null>(null);
  const [regeneratingDeviceId, setRegeneratingDeviceId] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [shownToken, setShownToken] = useState<string | null>(null);
  const [shownDeviceName, setShownDeviceName] = useState("");

  const [name, setName] = useState("");
  const [station, setStation] = useState("alle");
  const [formError, setFormError] = useState("");

  const selectedRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? null,
    [restaurants, selectedRestaurantId]
  );

  const onlineCount = useMemo(
    () => devices.filter((device) => isOnline(device.last_seen_at)).length,
    [devices]
  );

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
    } catch (error) {
      console.error("Fehler beim Laden der Restaurants:", error);
      toast.error("Restaurants konnten nicht geladen werden");
    } finally {
      setLoadingRestaurants(false);
    }
  }, []);

  const loadDevices = useCallback(
    async (restaurantId: string) => {
      if (!restaurantId) {
        setDevices([]);
        return;
      }

      setLoadingDevices(true);
      try {
        const accessToken = await getTenantAccessToken(restaurantId);
        const list = await devicesApi.list({ accessToken });
        setDevices(list);
      } catch (error) {
        console.error("Fehler beim Laden der Geräte:", error);
        const message = error instanceof Error ? error.message : "Geräte konnten nicht geladen werden";
        toast.error(message);
      } finally {
        setLoadingDevices(false);
      }
    },
    [getTenantAccessToken]
  );

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  useEffect(() => {
    if (!selectedRestaurantId) {
      setDevices([]);
      return;
    }
    loadDevices(selectedRestaurantId);
  }, [selectedRestaurantId, loadDevices]);

  const resetCreateForm = () => {
    setName("");
    setStation("alle");
    setFormError("");
  };

  const openCreateDialog = () => {
    resetCreateForm();
    setCreateDialogOpen(true);
  };

  const closeCreateDialog = () => {
    setCreateDialogOpen(false);
    resetCreateForm();
  };

  const closeTokenDialog = () => {
    setTokenDialogOpen(false);
    setShownToken(null);
    setShownDeviceName("");
  };

  const showTokenDialog = (device: DeviceWithToken) => {
    setShownToken(device.device_token);
    setShownDeviceName(device.name);
    setTokenDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!selectedRestaurantId) {
      toast.error("Bitte zuerst ein Restaurant auswählen");
      return;
    }

    const normalizedName = name.trim();
    if (!normalizedName) {
      setFormError("Gerätename ist erforderlich");
      return;
    }

    setCreatingDevice(true);
    setFormError("");
    try {
      const accessToken = await getTenantAccessToken(selectedRestaurantId);
      const created = await devicesApi.create(
        {
          name: normalizedName,
          station,
        },
        { accessToken }
      );
      toast.success("Gerät erstellt");
      closeCreateDialog();
      showTokenDialog(created);
      await loadDevices(selectedRestaurantId);
    } catch (error) {
      console.error("Fehler beim Erstellen des Geräts:", error);
      const message = error instanceof Error ? error.message : "Gerät konnte nicht erstellt werden";
      setFormError(message);
      toast.error(message);
    } finally {
      setCreatingDevice(false);
    }
  };

  const handleDelete = async (device: Device) => {
    if (!selectedRestaurantId) return;
    const confirmed = window.confirm(
      `Möchten Sie das Gerät "${device.name}" wirklich löschen? Der Zugang wird sofort gesperrt.`
    );
    if (!confirmed) return;

    setDeletingDeviceId(device.id);
    try {
      const accessToken = await getTenantAccessToken(selectedRestaurantId);
      await devicesApi.remove(device.id, { accessToken });
      toast.success("Gerät gelöscht");
      await loadDevices(selectedRestaurantId);
    } catch (error) {
      console.error("Fehler beim Löschen des Geräts:", error);
      const message = error instanceof Error ? error.message : "Gerät konnte nicht gelöscht werden";
      toast.error(message);
    } finally {
      setDeletingDeviceId(null);
    }
  };

  const handleRegenerateToken = async (device: Device) => {
    if (!selectedRestaurantId) return;
    const confirmed = window.confirm(
      `Token für "${device.name}" neu generieren? Das alte Token wird ungültig.`
    );
    if (!confirmed) return;

    setRegeneratingDeviceId(device.id);
    try {
      const accessToken = await getTenantAccessToken(selectedRestaurantId);
      const result = await devicesApi.regenerateToken(device.id, { accessToken });
      toast.success("Token erfolgreich neu generiert");
      setShownToken(result.device_token);
      setShownDeviceName(device.name);
      setTokenDialogOpen(true);
      await loadDevices(selectedRestaurantId);
    } catch (error) {
      console.error("Fehler beim Regenerieren des Tokens:", error);
      const message = error instanceof Error ? error.message : "Token konnte nicht erneuert werden";
      toast.error(message);
    } finally {
      setRegeneratingDeviceId(null);
    }
  };

  const copyToken = async () => {
    if (!shownToken) return;
    try {
      await navigator.clipboard.writeText(shownToken);
      toast.success("Token kopiert");
    } catch {
      toast.error("Token konnte nicht kopiert werden");
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
                  <Monitor className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-2xl tracking-tight">Geräte / KDS</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Kitchen Display System verwalten und Gerätezugänge steuern
                  </p>
                </div>
              </div>

              <Button onClick={openCreateDialog} disabled={!selectedRestaurantId || loadingDevices}>
                <Plus className="mr-2 h-4 w-4" />
                Neues Gerät
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
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

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2.5">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Geräte</div>
                  <div className="mt-1 text-xl font-semibold">{devices.length}</div>
                </div>
                <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2.5">
                  <div className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                    Online
                  </div>
                  <div className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-100">
                    {onlineCount}
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2.5">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Offline</div>
                  <div className="mt-1 text-xl font-semibold text-muted-foreground">
                    {Math.max(devices.length - onlineCount, 0)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {!selectedRestaurantId && !loadingRestaurants ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Store className="mb-3 h-10 w-10 text-muted-foreground" />
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
                  Geräte
                  <span className="ml-2 text-base font-medium text-muted-foreground">
                    ({devices.length})
                  </span>
                </CardTitle>
                {loadingDevices ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              </div>
            </CardHeader>
            <CardContent>
              {loadingDevices ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-[208px] rounded-xl" />
                  ))}
                </div>
              ) : devices.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-10 text-center">
                  <Monitor className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="font-medium text-foreground">Keine Geräte registriert</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Registrieren Sie das erste KDS-Gerät für {selectedRestaurant.name}.
                  </p>
                  <Button className="mt-4" onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Erstes Gerät registrieren
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {devices.map((device) => {
                    const deviceOnline = isOnline(device.last_seen_at);
                    const deleting = deletingDeviceId === device.id;
                    const regenerating = regeneratingDeviceId === device.id;
                    const disabled = deleting || regenerating;

                    return (
                      <div
                        key={device.id}
                        className="rounded-xl border border-border/70 bg-background/55 p-4 shadow-sm transition-colors hover:border-primary/50"
                      >
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/70 bg-card/70">
                              <Monitor className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="font-semibold text-foreground">{device.name}</div>
                              <p className="text-xs text-muted-foreground">{getStationLabel(device.station)}</p>
                            </div>
                          </div>
                          <Badge
                            className={
                              deviceOnline
                                ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
                                : "border-border bg-muted text-muted-foreground"
                            }
                          >
                            {deviceOnline ? (
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            ) : (
                              <XCircle className="mr-1 h-3.5 w-3.5" />
                            )}
                            {deviceOnline ? "Online" : "Offline"}
                          </Badge>
                        </div>

                        <div className="space-y-2 border-t border-border/60 pt-3 text-sm">
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              Zuletzt gesehen
                            </span>
                            <span>{formatDate(device.last_seen_at)}</span>
                          </div>
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Erstellt</span>
                            <span>{formatDate(device.created_at)}</span>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleRegenerateToken(device)}
                            disabled={disabled}
                          >
                            {regenerating ? (
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            ) : (
                              <KeyRound className="mr-1 h-4 w-4" />
                            )}
                            Token erneuern
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(device)}
                            disabled={disabled}
                          >
                            {deleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeCreateDialog();
            return;
          }
          setCreateDialogOpen(true);
        }}
      >
        <DialogContent
          className="max-w-xl border-border/70 bg-card/95 backdrop-blur-xl"
          onClose={closeCreateDialog}
        >
          <DialogHeader>
            <DialogTitle>Neues KDS-Gerät registrieren</DialogTitle>
            <DialogDescription>
              Erstellen Sie einen neuen Gerätezugang für das ausgewählte Restaurant.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-4 pb-2 md:px-6">
            {formError ? (
              <div className="rounded-lg border border-red-500/45 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {formError}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Gerätename *</label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="z. B. Küche Hauptstation"
                disabled={creatingDevice}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Station</label>
              <Select value={station} onValueChange={setStation} disabled={creatingDevice}>
                <SelectTrigger>
                  <SelectValue placeholder="Station wählen" />
                </SelectTrigger>
                <SelectContent>
                  {STATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Diese Station filtert, welche Bestellungen auf dem Gerät angezeigt werden.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeCreateDialog} disabled={creatingDevice}>
              Abbrechen
            </Button>
            <Button onClick={handleCreate} disabled={creatingDevice}>
              {creatingDevice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {creatingDevice ? "Erstellen..." : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={tokenDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeTokenDialog();
            return;
          }
          setTokenDialogOpen(true);
        }}
      >
        <DialogContent
          className="max-w-4xl border-border/70 bg-card/95 backdrop-blur-xl"
          onClose={closeTokenDialog}
        >
          <DialogHeader>
            <DialogTitle>Geräte-Token</DialogTitle>
            <DialogDescription>
              Dieses Token wird aus Sicherheitsgründen nur einmal angezeigt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-4 pb-2 md:px-6">
            <div className="text-sm text-muted-foreground">
              Gerät: <span className="font-semibold text-foreground">{shownDeviceName || "—"}</span>
            </div>

            <div className="rounded-lg border border-border/70 bg-background/70 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Geräte-Token
              </div>
              <div className="overflow-x-auto rounded-md border border-border/70 bg-card/70">
                <code className="block min-w-max whitespace-nowrap px-3 py-2 font-mono text-[11px] text-foreground">
                  {shownToken || "—"}
                </code>
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-200">
              Wichtig: Token sofort speichern oder direkt im KDS-Gerät hinterlegen.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeTokenDialog}>
              Schließen
            </Button>
            <Button onClick={copyToken} disabled={!shownToken}>
              <Copy className="mr-2 h-4 w-4" />
              Token kopieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
