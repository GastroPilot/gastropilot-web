"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Plus,
  Save,
  Search,
  Store,
  TicketPercent,
  Trash2,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import type { AdminTenant } from "@/lib/api/admin";
import {
  voucherManagementApi,
  type Voucher,
  type VoucherAppliesTo,
  type VoucherDiscountType,
  type VoucherKind,
  type VoucherScope,
  type VoucherUsage,
} from "@/lib/api/vouchers";
import {
  getRestaurantAccessToken,
  listAccessibleRestaurants,
  withOptionalAccessToken,
} from "@/lib/admin-tenant-context";
import {
  onPreferredAdminRestaurantChange,
  resolvePreferredRestaurantId,
  setPreferredAdminRestaurantId,
} from "@/lib/admin-restaurant-preference";
import { isManagerOrAboveRole } from "@/lib/admin-access";
import { useAdminAuth } from "@/lib/hooks/use-admin-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type VoucherStatus = "active" | "inactive" | "scheduled" | "expired" | "exhausted";

const SERVICE_TYPE_OPTIONS: Array<{ value: VoucherAppliesTo; label: string }> = [
  { value: "all", label: "Alle Services" },
  { value: "breakfast", label: "Frühstück" },
  { value: "lunch", label: "Mittagstisch" },
  { value: "dinner", label: "Abendgeschäft" },
];

const WEEKDAY_OPTIONS: Array<{ value: number; short: string; label: string }> = [
  { value: 0, short: "Mo", label: "Montag" },
  { value: 1, short: "Di", label: "Dienstag" },
  { value: 2, short: "Mi", label: "Mittwoch" },
  { value: 3, short: "Do", label: "Donnerstag" },
  { value: 4, short: "Fr", label: "Freitag" },
  { value: 5, short: "Sa", label: "Samstag" },
  { value: 6, short: "So", label: "Sonntag" },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(dateValue: string | null): string {
  const dateOnly = toDateOnly(dateValue);
  if (!dateOnly) return "-";
  const [year, month, day] = dateOnly.split("-").map((part) => Number(part));
  if (!year || !month || !day) return "-";
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizeVoucherCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9_-]/g, "");
}

function generateAutoCode(name: string): string {
  const base =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 18) || "RABATT";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

function toDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [dateOnly] = value.split("T");
  return dateOnly || null;
}

function toTimeInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 5);
}

function toTimeDisplay(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 5);
}

function getTodayDateKey(): string {
  const today = new Date();
  const year = String(today.getFullYear());
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getVoucherStatus(voucher: Voucher, todayDate: string): VoucherStatus {
  if (!voucher.is_active) return "inactive";

  const validFrom = toDateOnly(voucher.valid_from);
  const validUntil = toDateOnly(voucher.valid_until);

  if (validFrom && todayDate < validFrom) return "scheduled";
  if (validUntil && todayDate > validUntil) return "expired";
  if (voucher.kind === "voucher") {
    const remaining = voucher.remaining_value ?? voucher.value;
    if (remaining <= 0) return "exhausted";
    return "active";
  }
  if (voucher.max_uses !== null && voucher.max_uses > 0 && voucher.used_count >= voucher.max_uses) {
    return "exhausted";
  }

  return "active";
}

function getVoucherRemainingAmount(voucher: Voucher): number {
  if (voucher.kind !== "voucher") return voucher.value;
  if (voucher.remaining_value === null || voucher.remaining_value === undefined) {
    return voucher.value;
  }
  return Math.max(0, voucher.remaining_value);
}

function statusLabel(status: VoucherStatus): string {
  if (status === "active") return "Aktiv";
  if (status === "inactive") return "Inaktiv";
  if (status === "scheduled") return "Geplant";
  if (status === "expired") return "Abgelaufen";
  return "Aufgebraucht";
}

function statusBadgeClass(status: VoucherStatus): string {
  if (status === "active") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (status === "inactive") return "bg-muted text-muted-foreground border-border";
  if (status === "scheduled") return "bg-blue-500/15 text-blue-300 border-blue-500/30";
  if (status === "expired") return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return "bg-rose-500/15 text-rose-300 border-rose-500/30";
}

function parseNumberInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function discountLabel(voucher: Voucher): string {
  if (voucher.type === "percentage") {
    return `${voucher.value}% Rabatt`;
  }
  return `${formatCurrency(voucher.value)} Rabatt`;
}

function offerKindLabel(kind: VoucherKind): string {
  return kind === "voucher" ? "Gutschein" : "Rabatt";
}

function isVoucherOffer(voucher: Voucher): boolean {
  return voucher.kind === "voucher";
}

function offerScopeLabel(scope: VoucherScope): string {
  return scope === "individual" ? "Individuell" : "Öffentlich";
}

function containsUuidToken(value: string): boolean {
  const uuidPattern =
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  return uuidPattern.test(value);
}

function generateUuidToken(): string {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID().toUpperCase();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  }).toUpperCase();
}

function buildVoucherQrPayload(voucher: {
  code: string;
  name: string | null;
  kind: VoucherKind;
  scope: VoucherScope;
  type: VoucherDiscountType;
  value: number;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
}): string {
  const payload = {
    type: "gastropilot-voucher",
    version: 1,
    code: voucher.code,
    name: voucher.name,
    kind: voucher.kind,
    scope: voucher.scope,
    discount_type: voucher.type,
    discount_value: voucher.value,
    valid_from: toDateOnly(voucher.valid_from),
    valid_until: toDateOnly(voucher.valid_until),
    max_uses: voucher.max_uses,
  };
  return JSON.stringify(payload);
}

function appliesToLabel(value: VoucherAppliesTo): string {
  return SERVICE_TYPE_OPTIONS.find((entry) => entry.value === value)?.label ?? "Alle Services";
}

function weekdaysSummary(weekdays: number[] | null): string {
  if (!weekdays || weekdays.length === 0) return "Alle Wochentage";
  return weekdays
    .map((day) => WEEKDAY_OPTIONS.find((entry) => entry.value === day)?.short ?? "?")
    .join(", ");
}

export default function AdminMenuDiscountsPage() {
  const adminRole = useAdminAuth((state) => state.adminUser?.role ?? null);
  const canManageVouchers = isManagerOrAboveRole(adminRole);

  const [restaurants, setRestaurants] = useState<AdminTenant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | VoucherStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | VoucherDiscountType>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [voucherName, setVoucherName] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherDescription, setVoucherDescription] = useState("");
  const [voucherKind, setVoucherKind] = useState<VoucherKind>("discount");
  const [voucherScope, setVoucherScope] = useState<VoucherScope>("public");
  const [voucherType, setVoucherType] = useState<VoucherDiscountType>("fixed");
  const [voucherValue, setVoucherValue] = useState("");
  const [voucherAppliesTo, setVoucherAppliesTo] = useState<VoucherAppliesTo>("all");
  const [voucherValidWeekdays, setVoucherValidWeekdays] = useState<number[]>([]);
  const [voucherTimeFrom, setVoucherTimeFrom] = useState("");
  const [voucherTimeUntil, setVoucherTimeUntil] = useState("");
  const [voucherValidFrom, setVoucherValidFrom] = useState("");
  const [voucherValidUntil, setVoucherValidUntil] = useState("");
  const [voucherMaxUses, setVoucherMaxUses] = useState("");
  const [voucherMinOrderValue, setVoucherMinOrderValue] = useState("");
  const [voucherIsActive, setVoucherIsActive] = useState(true);

  const [usageLoading, setUsageLoading] = useState(false);
  const [voucherUsage, setVoucherUsage] = useState<VoucherUsage[]>([]);
  const qrPreviewContainerRef = useRef<HTMLDivElement | null>(null);

  const todayDate = useMemo(() => getTodayDateKey(), []);

  const selectedRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? null,
    [restaurants, selectedRestaurantId]
  );

  const vouchersWithStatus = useMemo(
    () =>
      vouchers.map((voucher) => ({
        voucher,
        status: getVoucherStatus(voucher, todayDate),
      })),
    [todayDate, vouchers]
  );

  const stats = useMemo(() => {
    const active = vouchersWithStatus.filter((entry) => entry.status === "active").length;
    const scheduled = vouchersWithStatus.filter((entry) => entry.status === "scheduled").length;
    const exhausted = vouchersWithStatus.filter((entry) => entry.status === "exhausted").length;
    return {
      total: vouchersWithStatus.length,
      active,
      scheduled,
      exhausted,
    };
  }, [vouchersWithStatus]);

  const filteredVouchers = useMemo(() => {
    return vouchersWithStatus.filter(({ voucher, status }) => {
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (typeFilter !== "all" && voucher.type !== typeFilter) return false;

      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;

      return (
        voucher.code.toLowerCase().includes(query) ||
        (voucher.name ?? "").toLowerCase().includes(query) ||
        (voucher.description ?? "").toLowerCase().includes(query)
      );
    });
  }, [searchQuery, statusFilter, typeFilter, vouchersWithStatus]);

  const groupedFilteredVouchers = useMemo(() => {
    const vouchersOnly = filteredVouchers.filter(({ voucher }) => isVoucherOffer(voucher));
    const discountsOnly = filteredVouchers.filter(({ voucher }) => !isVoucherOffer(voucher));
    return { vouchersOnly, discountsOnly };
  }, [filteredVouchers]);

  const voucherQrPreview = useMemo(() => {
    const normalizedCode = normalizeVoucherCode(voucherCode) || generateAutoCode(voucherName);
    if (!normalizedCode) return "";
    const parsedValue = parseNumberInput(voucherValue) ?? 0;
    return buildVoucherQrPayload({
      code: normalizedCode,
      name: voucherName.trim() || null,
      kind: voucherKind,
      scope: voucherScope,
      type: voucherType,
      value: parsedValue,
      valid_from: voucherValidFrom || null,
      valid_until: voucherValidUntil || null,
      max_uses:
        voucherScope === "individual"
          ? 1
          : parseNumberInput(voucherMaxUses) === null
            ? null
            : Math.trunc(parseNumberInput(voucherMaxUses) || 0),
    });
  }, [
    voucherCode,
    voucherKind,
    voucherScope,
    voucherMaxUses,
    voucherName,
    voucherType,
    voucherValidFrom,
    voucherValidUntil,
    voucherValue,
  ]);

  const loadRestaurants = useCallback(async () => {
    if (!adminRole) {
      setRestaurants([]);
      setSelectedRestaurantId("");
      setLoadingRestaurants(false);
      return;
    }

    setLoadingRestaurants(true);
    try {
      const list = await listAccessibleRestaurants(adminRole);
      setRestaurants(list);
      setSelectedRestaurantId((currentId) => {
        return resolvePreferredRestaurantId(list, currentId);
      });
    } catch (error) {
      console.error("Fehler beim Laden der Restaurants:", error);
      toast.error("Restaurants konnten nicht geladen werden");
    } finally {
      setLoadingRestaurants(false);
    }
  }, [adminRole]);

  const getTenantAccessToken = useCallback(
    async (restaurantId: string) => {
      return getRestaurantAccessToken(adminRole, restaurantId);
    },
    [adminRole]
  );

  const loadVouchers = useCallback(
    async (restaurantId: string) => {
      if (!restaurantId) {
        setVouchers([]);
        return;
      }

      setLoadingVouchers(true);
      try {
        const accessToken = await getTenantAccessToken(restaurantId);
        const list = await voucherManagementApi.list(withOptionalAccessToken(accessToken));
        const sorted = [...list].sort((a, b) => {
          const aDate = new Date(a.created_at).getTime();
          const bDate = new Date(b.created_at).getTime();
          return bDate - aDate;
        });
        setVouchers(sorted);
      } catch (error) {
        console.error("Fehler beim Laden der Gutscheine/Rabatte:", error);
        toast.error("Gutscheine und Rabatte konnten nicht geladen werden");
      } finally {
        setLoadingVouchers(false);
      }
    },
    [getTenantAccessToken]
  );

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    setPreferredAdminRestaurantId(selectedRestaurantId);
  }, [selectedRestaurantId]);

  useEffect(() => {
    return onPreferredAdminRestaurantChange((restaurantId) => {
      if (!restaurantId) return;
      setSelectedRestaurantId((currentId) => {
        if (currentId === restaurantId) return currentId;
        if (!restaurants.some((restaurant) => restaurant.id === restaurantId)) return currentId;
        return restaurantId;
      });
    });
  }, [restaurants]);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    loadVouchers(selectedRestaurantId);
  }, [selectedRestaurantId, loadVouchers]);

  const loadVoucherUsage = useCallback(
    async (voucherId: string) => {
      if (!selectedRestaurantId) return;
      setUsageLoading(true);
      try {
        const accessToken = await getTenantAccessToken(selectedRestaurantId);
        const usage = await voucherManagementApi.listUsage(
          voucherId,
          withOptionalAccessToken(accessToken)
        );
        setVoucherUsage(usage);
      } catch (error) {
        console.error("Fehler beim Laden der Nutzung:", error);
        toast.error("Nutzungsdaten konnten nicht geladen werden");
      } finally {
        setUsageLoading(false);
      }
    },
    [getTenantAccessToken, selectedRestaurantId]
  );

  const toggleWeekday = (weekday: number) => {
    setVoucherValidWeekdays((current) => {
      if (current.includes(weekday)) {
        return current.filter((day) => day !== weekday);
      }
      return [...current, weekday].sort((a, b) => a - b);
    });
  };

  const applyLunchPreset = () => {
    setVoucherAppliesTo("lunch");
    setVoucherValidWeekdays([0, 1, 2, 3, 4]);
    setVoucherTimeFrom("11:00");
    setVoucherTimeUntil("14:00");
  };

  const openDialog = (voucher: Voucher | null = null, createKind: VoucherKind = "discount") => {
    if (!canManageVouchers) {
      toast.error("Keine Berechtigung zum Bearbeiten von Gutscheinen und Rabatten");
      return;
    }

    setEditingVoucher(voucher);
    setVoucherUsage([]);

    if (voucher) {
      setVoucherName(voucher.name ?? "");
      setVoucherCode(voucher.code);
      setVoucherDescription(voucher.description ?? "");
      setVoucherKind(voucher.kind ?? "discount");
      setVoucherScope(voucher.scope ?? "public");
      setVoucherType(voucher.type);
      setVoucherValue(String(voucher.value));
      setVoucherAppliesTo(voucher.applies_to ?? "all");
      setVoucherValidWeekdays(voucher.valid_weekdays ?? []);
      setVoucherTimeFrom(toTimeInput(voucher.valid_time_from));
      setVoucherTimeUntil(toTimeInput(voucher.valid_time_until));
      setVoucherValidFrom(toDateOnly(voucher.valid_from) ?? "");
      setVoucherValidUntil(toDateOnly(voucher.valid_until) ?? "");
      setVoucherMaxUses(voucher.max_uses !== null ? String(voucher.max_uses) : "");
      setVoucherMinOrderValue(
        voucher.min_order_value !== null ? String(voucher.min_order_value) : ""
      );
      setVoucherIsActive(voucher.is_active);
      loadVoucherUsage(voucher.id);
    } else {
      setVoucherName("");
      const defaultScope: VoucherScope = createKind === "voucher" ? "individual" : "public";
      setVoucherCode(defaultScope === "individual" ? `IND-${generateUuidToken()}` : "");
      setVoucherDescription("");
      setVoucherKind(createKind);
      setVoucherScope(defaultScope);
      setVoucherType("fixed");
      setVoucherValue("");
      setVoucherAppliesTo("all");
      setVoucherValidWeekdays([]);
      setVoucherTimeFrom("");
      setVoucherTimeUntil("");
      setVoucherValidFrom("");
      setVoucherValidUntil("");
      setVoucherMaxUses(defaultScope === "individual" ? "1" : "");
      setVoucherMinOrderValue("");
      setVoucherIsActive(true);
    }

    setDialogOpen(true);
  };

  const buildPayload = useCallback(() => {
    if (!voucherName.trim()) {
      toast.error("Bitte einen Namen für den Gutschein oder Rabatt angeben");
      return null;
    }

    const parsedValue = parseNumberInput(voucherValue);
    if (parsedValue === null || parsedValue <= 0) {
      toast.error("Bitte einen gültigen Rabattwert angeben");
      return null;
    }

    if (voucherType === "percentage" && parsedValue > 100) {
      toast.error("Prozent-Rabatte dürfen maximal 100% betragen");
      return null;
    }
    if (voucherKind === "voucher" && voucherType === "percentage") {
      toast.error("Gutscheine unterstützen nur feste EUR-Werte");
      return null;
    }

    if (voucherValidFrom && voucherValidUntil && voucherValidUntil < voucherValidFrom) {
      toast.error("'Gültig bis' darf nicht vor 'Gültig von' liegen");
      return null;
    }

    const parsedMaxUses = parseNumberInput(voucherMaxUses);
    const isIndividual = voucherScope === "individual";
    const requiresSingleUse = isIndividual;
    if (
      !requiresSingleUse &&
      voucherMaxUses.trim() &&
      (parsedMaxUses === null || !Number.isInteger(parsedMaxUses) || parsedMaxUses < 1)
    ) {
      toast.error("Maximale Nutzungen muss eine ganze Zahl größer 0 sein");
      return null;
    }

    const parsedMinOrderValue = parseNumberInput(voucherMinOrderValue);
    if (
      voucherMinOrderValue.trim() &&
      (parsedMinOrderValue === null || parsedMinOrderValue < 0)
    ) {
      toast.error("Mindestbestellwert muss 0 oder größer sein");
      return null;
    }

    if ((voucherTimeFrom && !voucherTimeUntil) || (!voucherTimeFrom && voucherTimeUntil)) {
      toast.error("Bitte Start- und Endzeit gemeinsam angeben");
      return null;
    }

    if (voucherTimeFrom && voucherTimeUntil && voucherTimeUntil <= voucherTimeFrom) {
      toast.error("Die Endzeit muss nach der Startzeit liegen");
      return null;
    }

    let normalizedCode = normalizeVoucherCode(voucherCode);
    if (!normalizedCode) {
      normalizedCode = isIndividual ? `IND-${generateUuidToken()}` : generateAutoCode(voucherName);
    }

    if (normalizedCode.length < 4) {
      toast.error("Der Code muss mindestens 4 Zeichen enthalten");
      return null;
    }
    if (isIndividual && !containsUuidToken(normalizedCode)) {
      toast.error("Individuelle Angebote brauchen einen UUID-Code.");
      return null;
    }

    const weekdays = voucherValidWeekdays.length ? voucherValidWeekdays : null;

    return {
      code: normalizedCode,
      name: voucherName.trim(),
      description: voucherDescription.trim() || null,
      kind: voucherKind,
      scope: voucherScope,
      type: voucherType,
      value: parsedValue,
      applies_to: voucherAppliesTo,
      valid_weekdays: weekdays,
      valid_time_from: voucherTimeFrom || null,
      valid_time_until: voucherTimeUntil || null,
      valid_from: voucherValidFrom || null,
      valid_until: voucherValidUntil || null,
      max_uses:
        requiresSingleUse
          ? 1
          : parsedMaxUses === null
            ? null
            : Math.trunc(parsedMaxUses),
      min_order_value: parsedMinOrderValue,
      is_active: voucherIsActive,
    };
  }, [
    voucherAppliesTo,
    voucherCode,
    voucherDescription,
    voucherIsActive,
    voucherKind,
    voucherScope,
    voucherMaxUses,
    voucherMinOrderValue,
    voucherName,
    voucherTimeFrom,
    voucherTimeUntil,
    voucherType,
    voucherValidFrom,
    voucherValidUntil,
    voucherValidWeekdays,
    voucherValue,
  ]);

  const handleSaveVoucher = async () => {
    if (!canManageVouchers) {
      toast.error("Keine Berechtigung zum Speichern");
      return;
    }
    if (!selectedRestaurantId) {
      toast.error("Bitte wählen Sie zuerst ein Restaurant");
      return;
    }

    const payload = buildPayload();
    if (!payload) return;

    setSubmitting(true);
    try {
      const accessToken = await getTenantAccessToken(selectedRestaurantId);
      const requestOptions = withOptionalAccessToken(accessToken);

      if (editingVoucher) {
        await voucherManagementApi.update(editingVoucher.id, payload, requestOptions);
        toast.success(`${offerKindLabel(payload.kind)} aktualisiert`);
      } else {
        await voucherManagementApi.create(
          {
            restaurant_id: selectedRestaurantId,
            ...payload,
          },
          requestOptions
        );
        toast.success(`${offerKindLabel(payload.kind)} erstellt`);
      }

      setDialogOpen(false);
      await loadVouchers(selectedRestaurantId);
    } catch (error) {
      console.error("Fehler beim Speichern des Gutscheins/Rabatts:", error);
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteVoucher = async (voucher: Voucher) => {
    if (!canManageVouchers) {
      toast.error("Keine Berechtigung zum Löschen");
      return;
    }

    if (
      !confirm(
        `${offerKindLabel(voucher.kind)} "${voucher.name ?? voucher.code}" wirklich löschen?`
      )
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const accessToken = await getTenantAccessToken(selectedRestaurantId);
      await voucherManagementApi.delete(voucher.id, withOptionalAccessToken(accessToken));
      toast.success(`${offerKindLabel(voucher.kind)} gelöscht`);
      setDialogOpen(false);
      await loadVouchers(selectedRestaurantId);
    } catch (error) {
      console.error("Fehler beim Löschen:", error);
      toast.error("Löschen fehlgeschlagen");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadVoucherQr = useCallback(() => {
    if (!voucherQrPreview) {
      toast.error("QR-Code ist noch nicht verfügbar");
      return;
    }
    const svgElement = qrPreviewContainerRef.current?.querySelector("svg");
    if (!svgElement) {
      toast.error("QR-Code konnte nicht exportiert werden");
      return;
    }
    const serializer = new XMLSerializer();
    const svgMarkup = serializer.serializeToString(svgElement);
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fallbackCode = normalizeVoucherCode(voucherCode) || generateAutoCode(voucherName);
    link.href = url;
    link.download = `voucher-${fallbackCode.toLowerCase()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [voucherCode, voucherName, voucherQrPreview]);

  const renderVoucherCards = (
    entries: Array<{ voucher: Voucher; status: VoucherStatus }>,
    emptyText: string
  ) => {
    if (loadingVouchers) {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-48 rounded-xl" />
          ))}
        </div>
      );
    }
    if (entries.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-medium text-foreground">Keine passenden Aktionen gefunden</p>
          <p className="mt-1 text-sm text-muted-foreground">{emptyText}</p>
        </div>
      );
    }
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {entries.map(({ voucher, status }) => {
          const remainingAmount = getVoucherRemainingAmount(voucher);
          const usagePercent =
            voucher.kind === "voucher"
              ? voucher.value > 0
                ? Math.min(100, Math.round(((voucher.value - remainingAmount) / voucher.value) * 100))
                : 0
              : voucher.max_uses && voucher.max_uses > 0
                ? Math.min(100, Math.round((voucher.used_count / voucher.max_uses) * 100))
                : 0;
          return (
            <button
              key={voucher.id}
              type="button"
              onClick={() => openDialog(voucher)}
              disabled={!canManageVouchers}
              className="group rounded-xl border border-border/80 bg-background/70 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold leading-tight">{voucher.name || "Ohne Titel"}</p>
                  <p className="mt-1 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    {voucher.code}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={statusBadgeClass(status)}>{statusLabel(status)}</Badge>
                  <Badge variant="outline">{offerKindLabel(voucher.kind)}</Badge>
                  <Badge variant="outline">{offerScopeLabel(voucher.scope)}</Badge>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary">
                  {voucher.type === "percentage" ? "Prozent" : "Fixbetrag"}
                </Badge>
                <span className="text-sm font-semibold text-foreground">{discountLabel(voucher)}</span>
              </div>

              {voucher.description ? (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{voucher.description}</p>
              ) : null}

              <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <p>
                  Einsatz: {appliesToLabel(voucher.applies_to)} | {weekdaysSummary(voucher.valid_weekdays)}
                </p>
                <p>
                  Zeitfenster: {voucher.valid_time_from && voucher.valid_time_until
                    ? `${toTimeDisplay(voucher.valid_time_from)} - ${toTimeDisplay(voucher.valid_time_until)}`
                    : "Ganztägig"}
                </p>
                <p>
                  Gültig: {formatDate(voucher.valid_from)} bis {formatDate(voucher.valid_until)}
                </p>
                <p>
                  Mindestbestellwert: {voucher.min_order_value !== null
                    ? formatCurrency(voucher.min_order_value)
                    : "Keiner"}
                </p>
              </div>

              <div className="mt-3 border-t border-border/80 pt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Nutzung</span>
                  <span>
                    {voucher.kind === "voucher"
                      ? `${formatCurrency(remainingAmount)} / ${formatCurrency(voucher.value)}`
                      : `${voucher.used_count}${voucher.max_uses !== null ? ` / ${voucher.max_uses}` : ""}`}
                  </span>
                </div>
                {(voucher.kind === "voucher" || voucher.max_uses !== null) ? (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-background to-muted/40" />

      <div className="space-y-6">
        <Card className="overflow-hidden border-border/70 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20">
                  <TicketPercent className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-2xl tracking-tight">Gutscheine & Rabatte</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Restaurant-spezifische Aktionen mit Regeln für Mittagstisch, Wochentage und
                    Zeitfenster verwalten
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                <Button
                  onClick={() => openDialog(null, "voucher")}
                  disabled={!selectedRestaurantId || loadingVouchers || !canManageVouchers}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Gutschein anlegen
                </Button>
                <Button
                  onClick={() => openDialog(null, "discount")}
                  disabled={!selectedRestaurantId || loadingVouchers || !canManageVouchers}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Rabatt anlegen
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 xl:grid-cols-[1fr_180px_180px]">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Suche
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Nach Code, Name oder Beschreibung suchen"
                    className="pl-9"
                    disabled={!selectedRestaurantId}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Status
                </label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as "all" | VoucherStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="inactive">Inaktiv</SelectItem>
                    <SelectItem value="scheduled">Geplant</SelectItem>
                    <SelectItem value="expired">Abgelaufen</SelectItem>
                    <SelectItem value="exhausted">Aufgebraucht</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Rabattart
                </label>
                <Select
                  value={typeFilter}
                  onValueChange={(value) => setTypeFilter(value as "all" | VoucherDiscountType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="fixed">Fixbetrag</SelectItem>
                    <SelectItem value="percentage">Prozent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-border/80 bg-background/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Gesamt</p>
                <p className="mt-1 text-2xl font-semibold">{stats.total}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
                <p className="text-xs uppercase tracking-wide text-emerald-300">Aktiv</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-200">{stats.active}</p>
              </div>
              <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-3">
                <p className="text-xs uppercase tracking-wide text-blue-300">Geplant</p>
                <p className="mt-1 text-2xl font-semibold text-blue-200">{stats.scheduled}</p>
              </div>
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3">
                <p className="text-xs uppercase tracking-wide text-rose-300">Aufgebraucht</p>
                <p className="mt-1 text-2xl font-semibold text-rose-200">{stats.exhausted}</p>
              </div>
            </div>

            {!canManageVouchers ? (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-200">
                Diese Rolle hat Lesezugriff. Änderungen sind nur für Manager, Owner oder
                Platform-Admin erlaubt.
              </div>
            ) : null}
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
          <div className="space-y-4">
            <Card className="border-border/70 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">
                    Gutscheine
                    <span className="ml-2 text-base font-medium text-muted-foreground">
                      ({groupedFilteredVouchers.vouchersOnly.length})
                    </span>
                  </CardTitle>
                  {loadingVouchers ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                {renderVoucherCards(
                  groupedFilteredVouchers.vouchersOnly,
                  searchQuery || statusFilter !== "all" || typeFilter !== "all"
                    ? "Filter anpassen."
                    : canManageVouchers
                      ? "Legen Sie den ersten Gutschein an."
                      : "Für dieses Restaurant sind noch keine Gutscheine vorhanden."
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">
                    Rabatte
                    <span className="ml-2 text-base font-medium text-muted-foreground">
                      ({groupedFilteredVouchers.discountsOnly.length})
                    </span>
                  </CardTitle>
                  {loadingVouchers ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                {renderVoucherCards(
                  groupedFilteredVouchers.discountsOnly,
                  searchQuery || statusFilter !== "all" || typeFilter !== "all"
                    ? "Filter anpassen."
                    : canManageVouchers
                      ? "Legen Sie den ersten Rabatt an."
                      : "Für dieses Restaurant sind noch keine Rabatte vorhanden."
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => setDialogOpen(nextOpen && canManageVouchers)}
      >
        <DialogContent
          className="max-w-3xl border-border/70 bg-card/95 backdrop-blur-xl"
          onClose={() => setDialogOpen(false)}
        >
          <DialogHeader>
            <DialogTitle>
              {editingVoucher
                ? `${offerKindLabel(voucherKind)} bearbeiten`
                : `Neuer ${offerKindLabel(voucherKind)}`}
            </DialogTitle>
            <DialogDescription>
              {voucherKind === "voucher"
                ? "Gutscheine sind eindeutig und werden einmalig eingelöst. QR-Code enthält Code, Wert und Gültigkeit."
                : "Definieren Sie Bedingungen wie Mittagstisch, nur Sonntag oder ein tägliches Zeitfenster."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-4 pb-2 md:px-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Name</label>
                <Input
                  value={voucherName}
                  onChange={(event) => setVoucherName(event.target.value)}
                  placeholder="z. B. Sonntags-Mittag 15%"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Code</label>
                <Input
                  value={voucherCode}
                  onChange={(event) => setVoucherCode(normalizeVoucherCode(event.target.value))}
                  placeholder={voucherScope === "individual" ? "UUID-Code (z. B. IND-...)" : "z. B. SONNTAG15"}
                  disabled={submitting}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {voucherScope === "individual"
                    ? "Individuelle Angebote müssen einen UUID-Code enthalten."
                    : "Optional. Wenn leer, wird ein Code automatisch erzeugt."}
                </p>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Beschreibung</label>
              <textarea
                value={voucherDescription}
                onChange={(event) => setVoucherDescription(event.target.value)}
                rows={3}
                disabled={submitting}
                placeholder="Interne Hinweise oder Bedingungen"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Zielgruppe</label>
              <Select
                value={voucherScope}
                onValueChange={(value) => {
                  const nextScope = value as VoucherScope;
                  setVoucherScope(nextScope);
                  if (nextScope === "individual") {
                    setVoucherMaxUses("1");
                    if (!containsUuidToken(voucherCode)) {
                      setVoucherCode(`IND-${generateUuidToken()}`);
                    }
                  } else if (voucherMaxUses === "1") {
                    setVoucherMaxUses("");
                    if (containsUuidToken(voucherCode)) {
                      setVoucherCode(generateAutoCode(voucherName));
                    }
                  } else if (containsUuidToken(voucherCode)) {
                    setVoucherCode(generateAutoCode(voucherName));
                  }
                }}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Öffentlich (für alle)</SelectItem>
                  <SelectItem value="individual">Individuell (UUID-basiert)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Rabattart</label>
                <Select
                  value={voucherType}
                  onValueChange={(value) => setVoucherType(value as VoucherDiscountType)}
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixbetrag (EUR)</SelectItem>
                    {voucherKind === "discount" ? (
                      <SelectItem value="percentage">Prozent (%)</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  {voucherType === "percentage" ? "Wert (%)" : "Wert (EUR)"}
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={voucherValue}
                  onChange={(event) => setVoucherValue(event.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-background/50 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Einsatzregeln</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyLunchPreset}
                  disabled={submitting}
                >
                  Mittagstisch-Vorlage
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Gilt für</label>
                  <Select
                    value={voucherAppliesTo}
                    onValueChange={(value) => setVoucherAppliesTo(value as VoucherAppliesTo)}
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">Von</label>
                    <Input
                      type="time"
                      value={voucherTimeFrom}
                      onChange={(event) => setVoucherTimeFrom(event.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">Bis</label>
                    <Input
                      type="time"
                      value={voucherTimeUntil}
                      onChange={(event) => setVoucherTimeUntil(event.target.value)}
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-2 block text-sm font-medium text-foreground">Wochentage</label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((weekday) => {
                    const selected = voucherValidWeekdays.includes(weekday.value);
                    return (
                      <button
                        key={weekday.value}
                        type="button"
                        onClick={() => toggleWeekday(weekday.value)}
                        disabled={submitting}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                          selected
                            ? "border-primary/60 bg-primary/15 text-primary-contrast"
                            : "border-border bg-background text-muted-foreground hover:text-foreground"
                        }`}
                        title={weekday.label}
                      >
                        {weekday.short}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Kein Tag gewählt bedeutet: an allen Wochentagen gültig.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Gültig von</label>
                <Input
                  type="date"
                  value={voucherValidFrom}
                  onChange={(event) => setVoucherValidFrom(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Gültig bis</label>
                <Input
                  type="date"
                  value={voucherValidUntil}
                  onChange={(event) => setVoucherValidUntil(event.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Max. Nutzungen
                </label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={voucherScope === "individual" ? "1" : voucherMaxUses}
                  onChange={(event) => setVoucherMaxUses(event.target.value)}
                  placeholder={voucherScope === "individual" ? "Immer 1" : "Optional"}
                  disabled={submitting || voucherScope === "individual"}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Mindestbestellwert (EUR)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={voucherMinOrderValue}
                  onChange={(event) => setVoucherMinOrderValue(event.target.value)}
                  placeholder="Optional"
                  disabled={submitting}
                />
              </div>
            </div>

            {voucherScope === "individual" && voucherQrPreview ? (
              <div className="rounded-xl border border-border/80 bg-background/50 p-4">
                <p className="text-sm font-medium">QR-Code für Einlösung</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Der QR-Code enthält Code, Wert und Gültigkeit. Beim Scan kann das Service-Team den Gutschein eindeutig prüfen.
                </p>
                <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  <div ref={qrPreviewContainerRef} className="rounded-lg bg-white p-2">
                    <QRCodeSVG value={voucherQrPreview} size={120} level="M" />
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>Code: {(normalizeVoucherCode(voucherCode) || generateAutoCode(voucherName)).toUpperCase()}</p>
                    <p>Wert: {voucherValue ? `${voucherValue} ${voucherType === "percentage" ? "%" : "EUR"}` : "-"}</p>
                    <p>Typ: {offerKindLabel(voucherKind)} · {offerScopeLabel(voucherScope)}</p>
                    <p>
                      Gültig: {voucherValidFrom ? formatDate(voucherValidFrom) : "-"} bis {voucherValidUntil ? formatDate(voucherValidUntil) : "-"}
                    </p>
                    <p>
                      Einlösung: {voucherScope === "individual" && voucherKind === "voucher"
                        ? "mehrfach bis Restwert = 0"
                        : voucherScope === "individual"
                          ? "1 (einmalig)"
                          : "gemäß Einstellung"}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadVoucherQr}
                      disabled={submitting}
                    >
                      QR exportieren (SVG)
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Aktion aktiv</p>
                <p className="text-xs text-muted-foreground">
                  Inaktive Aktionen bleiben gespeichert, sind aber nicht anwendbar.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={voucherIsActive}
                  onChange={(event) => setVoucherIsActive(event.target.checked)}
                  disabled={submitting}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                />
              </label>
            </div>

            {editingVoucher ? (
              <div className="rounded-xl border border-border/80 bg-background/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Nutzungsverlauf</p>
                  {usageLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : null}
                </div>
                {usageLoading ? (
                  <Skeleton className="h-20 rounded-lg" />
                ) : voucherUsage.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Noch keine Nutzung erfasst.</p>
                ) : (
                  <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                    {voucherUsage.slice(0, 8).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-md border border-border/70 bg-background px-2.5 py-2 text-xs"
                      >
                        <span className="truncate pr-3 text-muted-foreground">
                          {entry.used_by_email || "Unbekannter Nutzer"}
                        </span>
                        <span className="font-medium">{formatCurrency(entry.discount_amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <DialogFooter className="items-center">
            {editingVoucher ? (
              <Button
                variant="destructive"
                className="mr-auto"
                onClick={() => handleDeleteVoucher(editingVoucher)}
                disabled={submitting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Löschen
              </Button>
            ) : null}

            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              <X className="mr-2 h-4 w-4" />
              Abbrechen
            </Button>
            <Button onClick={handleSaveVoucher} disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
