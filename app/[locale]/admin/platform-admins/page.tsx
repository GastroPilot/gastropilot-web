"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminImpersonation,
  adminPlatformAdminsApi,
  adminUsersApi,
  type AdminPlatformAdmin,
} from "@/lib/api/admin";
import { cn } from "@/lib/utils";
import { useAdminAuth } from "@/lib/hooks/use-admin-auth";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, LogIn, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABELS = {
  platform_admin: "Admin",
  platform_support: "Support",
  platform_analyst: "Analyst",
} as const;

const ROLE_OPTIONS = [
  "platform_admin",
  "platform_support",
  "platform_analyst",
] as const;

type PlatformAdminRole = (typeof ROLE_OPTIONS)[number];
type AdminUpdatePayload = Parameters<typeof adminPlatformAdminsApi.update>[1];

function isPlatformAdminRole(value: string): value is PlatformAdminRole {
  return ROLE_OPTIONS.includes(value as PlatformAdminRole);
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role as PlatformAdminRole] ?? role;
}

function toPlatformAdminRole(value: string): PlatformAdminRole {
  return isPlatformAdminRole(value) ? value : "platform_admin";
}

export default function AdminPlatformAdminsPage() {
  const queryClient = useQueryClient();
  const { adminUser } = useAdminAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminPlatformAdmin | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const { data: admins, isLoading } = useQuery({
    queryKey: ["admin", "platform-admins"],
    queryFn: () => adminPlatformAdminsApi.list(),
  });
  const adminList = admins ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminPlatformAdminsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "platform-admins"] });
      toast.success("Admin erfolgreich gelöscht");
    },
    onError: (err: Error) => toast.error(err.message || "Fehler beim Löschen"),
  });

  const handleImpersonate = async (admin: AdminPlatformAdmin) => {
    if (admin.id === adminUser?.id) {
      toast.error("Sie können sich nicht selbst impersonieren");
      return;
    }

    const confirmed = confirm(
      `Benutzer "${admin.first_name} ${admin.last_name}" wirklich impersonieren?\n\nSie übernehmen danach dessen Sitzung.`
    );
    if (!confirmed) return;

    setImpersonatingId(admin.id);
    try {
      const response = await adminUsersApi.impersonate(admin.id);
      adminImpersonation.start(
        response.impersonation_token,
        response.user_id,
        response.user_name
      );
      toast.success(`Impersonation gestartet: ${response.user_name}`);
      window.location.href = "/admin";
    } catch (error) {
      console.error("Fehler bei der User-Impersonation:", error);
      const message =
        error instanceof Error ? error.message : "Impersonation fehlgeschlagen";
      toast.error(message);
      setImpersonatingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Zugangsverwaltung</h1>
        <Button onClick={() => setShowCreate(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Neuer Admin
        </Button>
      </div>

      {showCreate && (
        <CreateAdminForm
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ["admin", "platform-admins"] });
          }}
        />
      )}

      <div className="mb-2 text-xs text-muted-foreground">
        Benutzer bearbeiten, rollenbasiert verwalten und bei Bedarf impersonieren.
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-md border p-4 md:hidden">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="mt-2 h-4 w-52" />
              <Skeleton className="mt-3 h-10 w-full" />
            </div>
          ))}
          <div className="hidden overflow-x-auto rounded-md border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">E-Mail</th>
                  <th className="px-4 py-3 text-left font-medium">Rolle</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Letzter Login</th>
                  <th className="px-4 py-3 text-left font-medium">Erstellt</th>
                  <th className="px-4 py-3 text-right font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-20" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : adminList.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Keine Admins vorhanden"
          description="Erstellen Sie einen neuen Platform-Admin."
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {adminList.map((admin) => (
              <div key={admin.id} className="rounded-md border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {admin.first_name} {admin.last_name}
                      {admin.id === adminUser?.id ? (
                        <span className="ml-1 text-xs text-muted-foreground">(Sie)</span>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted-foreground">{admin.email || "—"}</p>
                  </div>
                  <Badge variant={admin.is_active ? "default" : "destructive"}>
                    {admin.is_active ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{roleLabel(admin.role)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Letzter Login:{" "}
                    {admin.last_login_at
                      ? new Date(admin.last_login_at).toLocaleString("de-DE")
                      : "—"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Erstellt:{" "}
                  {admin.created_at
                    ? new Date(admin.created_at).toLocaleDateString("de-DE")
                    : "—"}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button variant="outline" size="sm" onClick={() => setEditingAdmin(admin)}>
                    Bearbeiten
                  </Button>
                  {admin.id !== adminUser?.id ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleImpersonate(admin)}
                      disabled={impersonatingId === admin.id}
                    >
                      {impersonatingId === admin.id ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <LogIn className="mr-1.5 h-4 w-4" />
                      )}
                      Impersonieren
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      Impersonieren
                    </Button>
                  )}
                  {admin.id !== adminUser?.id ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (
                          confirm(
                            `Admin "${admin.first_name} ${admin.last_name}" wirklich löschen?`
                          )
                        ) {
                          deleteMutation.mutate(admin.id);
                        }
                      }}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Löschen
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      Löschen
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-md border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">E-Mail</th>
                  <th className="px-4 py-3 text-left font-medium">Rolle</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Letzter Login</th>
                  <th className="px-4 py-3 text-left font-medium">Erstellt</th>
                  <th className="px-4 py-3 text-right font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {adminList.map((admin) => (
                  <tr
                    key={admin.id}
                    className="cursor-pointer border-b hover:bg-muted/30"
                    onClick={() => setEditingAdmin(admin)}
                  >
                    <td className="px-4 py-3 font-medium">
                      {admin.first_name} {admin.last_name}
                      {admin.id === adminUser?.id ? (
                        <span className="ml-2 text-xs text-muted-foreground">(Sie)</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{admin.email || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{roleLabel(admin.role)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={admin.is_active ? "default" : "destructive"}>
                        {admin.is_active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {admin.last_login_at
                        ? new Date(admin.last_login_at).toLocaleString("de-DE")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {admin.created_at
                        ? new Date(admin.created_at).toLocaleDateString("de-DE")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {admin.id !== adminUser?.id ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleImpersonate(admin);
                              }}
                              disabled={impersonatingId === admin.id}
                              title="Impersonieren"
                            >
                              {impersonatingId === admin.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <LogIn className="h-4 w-4 text-primary-contrast" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (
                                  confirm(
                                    `Admin "${admin.first_name} ${admin.last_name}" wirklich löschen?`
                                  )
                                ) {
                                  deleteMutation.mutate(admin.id);
                                }
                              }}
                              className="text-destructive hover:text-destructive"
                              title="Löschen"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <EditAdminDialog
        admin={editingAdmin}
        open={editingAdmin !== null}
        currentAdminId={adminUser?.id ?? null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingAdmin(null);
          }
        }}
        onSuccess={() => {
          setEditingAdmin(null);
          queryClient.invalidateQueries({ queryKey: ["admin", "platform-admins"] });
        }}
      />
    </div>
  );
}

function CreateAdminForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "platform_admin" as PlatformAdminRole,
  });

  const createMutation = useMutation({
    mutationFn: () => adminPlatformAdminsApi.create(form),
    onSuccess: () => {
      toast.success("Admin erstellt");
      onSuccess();
    },
    onError: (err: Error) => toast.error(err.message || "Fehler beim Erstellen"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  return (
    <div className="mb-6 rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Neuen Platform-Admin anlegen</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Vorname *</Label>
            <Input
              value={form.first_name}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label>Nachname *</Label>
            <Input
              value={form.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label>E-Mail *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label>Passwort (min. 8 Zeichen) *</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              minLength={8}
              required
            />
          </div>
          <div>
            <Label>Rolle *</Label>
            <Select
              value={form.role}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, role: toPlatformAdminRole(value) }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Rolle wählen" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    {roleLabel(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Erstelle..." : "Admin erstellen"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function EditAdminDialog({
  admin,
  open,
  currentAdminId,
  onOpenChange,
  onSuccess,
}: {
  admin: AdminPlatformAdmin | null;
  open: boolean;
  currentAdminId: string | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<{
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    role: PlatformAdminRole;
    is_active: boolean;
  }>({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "platform_admin",
    is_active: true,
  });

  useEffect(() => {
    if (!admin || !open) return;
    setForm({
      first_name: admin.first_name,
      last_name: admin.last_name,
      email: admin.email ?? "",
      password: "",
      role: toPlatformAdminRole(admin.role),
      is_active: admin.is_active,
    });
  }, [admin, open]);

  const isSelf = admin?.id === currentAdminId;

  const updateMutation = useMutation({
    mutationFn: (payload: AdminUpdatePayload) => {
      if (!admin) {
        throw new Error("Kein Admin ausgewählt");
      }
      return adminPlatformAdminsApi.update(admin.id, payload);
    },
    onSuccess: () => {
      toast.success("Admin aktualisiert");
      onSuccess();
    },
    onError: (err: Error) => toast.error(err.message || "Fehler beim Speichern"),
  });

  const buildPayload = (): AdminUpdatePayload => {
    if (!admin) return {};

    const payload: AdminUpdatePayload = {};
    const nextFirstName = form.first_name.trim();
    const nextLastName = form.last_name.trim();
    const nextEmail = form.email.trim();
    const nextPassword = form.password.trim();

    if (nextFirstName !== admin.first_name) payload.first_name = nextFirstName;
    if (nextLastName !== admin.last_name) payload.last_name = nextLastName;
    if (nextEmail !== (admin.email ?? "")) payload.email = nextEmail;
    if (nextPassword) payload.password = nextPassword;

    if (!isSelf && form.role !== admin.role) {
      payload.role = form.role;
    }
    if (!isSelf && form.is_active !== admin.is_active) {
      payload.is_active = form.is_active;
    }

    return payload;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = buildPayload();

    if (Object.keys(payload).length === 0) {
      toast.info("Keine Änderungen");
      onOpenChange(false);
      return;
    }

    updateMutation.mutate(payload);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!updateMutation.isPending) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className="max-w-xl" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Benutzer bearbeiten</DialogTitle>
          <DialogDescription>
            Passe Stammdaten, Rolle und Aktiv-Status an.
          </DialogDescription>
        </DialogHeader>

        {admin ? (
          <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4 md:px-6 md:pb-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Vorname</Label>
                <Input
                  value={form.first_name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, first_name: event.target.value }))
                  }
                  required
                  maxLength={120}
                  disabled={updateMutation.isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nachname</Label>
                <Input
                  value={form.last_name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, last_name: event.target.value }))
                  }
                  required
                  maxLength={120}
                  disabled={updateMutation.isPending}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>E-Mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                disabled={updateMutation.isPending}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Neues Passwort (optional)</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                minLength={8}
                disabled={updateMutation.isPending}
                placeholder="Leer lassen, um nicht zu ändern"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Rolle</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, role: toPlatformAdminRole(value) }))
                  }
                  disabled={updateMutation.isPending || isSelf}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Rolle wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role} value={role}>
                        {roleLabel(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <div className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {form.is_active ? "Aktiv" : "Inaktiv"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {form.is_active
                          ? "Benutzer kann sich anmelden"
                          : "Benutzer kann sich nicht anmelden"}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.is_active}
                      onClick={() =>
                        setForm((current) => ({ ...current, is_active: !current.is_active }))
                      }
                      disabled={updateMutation.isPending || isSelf}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        form.is_active ? "bg-primary" : "bg-muted",
                        (updateMutation.isPending || isSelf) &&
                          "cursor-not-allowed opacity-60"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-5 w-5 rounded-full bg-white transition-transform",
                          form.is_active ? "translate-x-5" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {isSelf && (
              <p className="text-xs text-muted-foreground">
                Eigene Rolle und eigener Aktiv-Status sind aus Sicherheitsgründen nicht änderbar.
              </p>
            )}

            <DialogFooter className="px-0 pb-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateMutation.isPending}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Speichern
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
