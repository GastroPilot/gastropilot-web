"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Loader2,
  Plus,
  Save,
  Search,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { AdminTenant } from "@/lib/api/admin";
import {
  menuDealsApi,
  type MenuDeal,
  type MenuDealPricingMode,
  type MenuDealServicePeriod,
} from "@/lib/api/menu-deals";
import {
  menuManagementApi,
  type MenuCategory,
} from "@/lib/api/menu";
import {
  getRestaurantAccessToken,
  listAccessibleRestaurants,
  withOptionalAccessToken,
} from "@/lib/admin-tenant-context";
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

type DealStatus = "active" | "inactive" | "scheduled" | "expired";
type GroupKey = "main" | "side" | "drink" | "dessert";

type GroupState = {
  enabled: boolean;
  required: boolean;
  quantity: number;
  categoryIds: string[];
  surchargeAllowed: boolean;
};

const SERVICE_OPTIONS: Array<{ value: MenuDealServicePeriod; label: string }> = [
  { value: "all", label: "Alle Services" },
  { value: "breakfast", label: "Frühstück" },
  { value: "lunch", label: "Mittagstisch" },
  { value: "dinner", label: "Abendgeschäft" },
];

const PRICING_OPTIONS: Array<{ value: MenuDealPricingMode; label: string }> = [
  { value: "fixed_price", label: "Festpreis" },
  { value: "fixed_discount", label: "Fixer Rabatt (EUR)" },
  { value: "percentage_discount", label: "Prozent-Rabatt" },
];

const WEEKDAYS: Array<{ value: number; short: string; label: string }> = [
  { value: 0, short: "Mo", label: "Montag" },
  { value: 1, short: "Di", label: "Dienstag" },
  { value: 2, short: "Mi", label: "Mittwoch" },
  { value: 3, short: "Do", label: "Donnerstag" },
  { value: 4, short: "Fr", label: "Freitag" },
  { value: 5, short: "Sa", label: "Samstag" },
  { value: 6, short: "So", label: "Sonntag" },
];

const GROUP_LABELS: Record<GroupKey, string> = {
  main: "Hauptgericht",
  side: "Beilage",
  drink: "Getränk",
  dessert: "Dessert",
};

function createInitialGroupState(): Record<GroupKey, GroupState> {
  return {
    main: {
      enabled: true,
      required: true,
      quantity: 1,
      categoryIds: [],
      surchargeAllowed: true,
    },
    side: {
      enabled: true,
      required: true,
      quantity: 1,
      categoryIds: [],
      surchargeAllowed: false,
    },
    drink: {
      enabled: true,
      required: true,
      quantity: 1,
      categoryIds: [],
      surchargeAllowed: false,
    },
    dessert: {
      enabled: false,
      required: false,
      quantity: 1,
      categoryIds: [],
      surchargeAllowed: false,
    },
  };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(dateValue: string | null): string {
  if (!dateValue) return "-";
  const [year, month, day] = dateValue.split("T")[0]?.split("-").map((part) => Number(part)) ?? [];
  if (!year || !month || !day) return "-";
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseNumberInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getTodayDateKey(): string {
  const today = new Date();
  const year = String(today.getFullYear());
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDealStatus(deal: MenuDeal, todayKey: string): DealStatus {
  if (!deal.is_active) return "inactive";
  if (deal.available_from_date && todayKey < deal.available_from_date) return "scheduled";
  if (deal.available_until_date && todayKey > deal.available_until_date) return "expired";
  return "active";
}

function statusLabel(status: DealStatus): string {
  if (status === "active") return "Aktiv";
  if (status === "inactive") return "Inaktiv";
  if (status === "scheduled") return "Geplant";
  return "Abgelaufen";
}

function statusBadgeClass(status: DealStatus): string {
  if (status === "active") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (status === "inactive") return "bg-muted text-muted-foreground border-border";
  if (status === "scheduled") return "bg-blue-500/15 text-blue-300 border-blue-500/30";
  return "bg-amber-500/15 text-amber-300 border-amber-500/30";
}

function pricingModeLabel(mode: MenuDealPricingMode): string {
  return PRICING_OPTIONS.find((entry) => entry.value === mode)?.label ?? "Festpreis";
}

function servicePeriodLabel(period: MenuDealServicePeriod): string {
  return SERVICE_OPTIONS.find((entry) => entry.value === period)?.label ?? "Alle Services";
}

function weekdaysSummary(weekdays: number[] | null): string {
  if (!weekdays || weekdays.length === 0) return "Alle Wochentage";
  return weekdays
    .map((day) => WEEKDAYS.find((entry) => entry.value === day)?.short ?? "?")
    .join(", ");
}

function timeSummary(fromValue: string | null, untilValue: string | null): string {
  const from = fromValue ? fromValue.slice(0, 5) : "";
  const until = untilValue ? untilValue.slice(0, 5) : "";
  if (!from || !until) return "Ganztägig";
  return `${from} - ${until}`;
}

export default function AdminMenuDealsPage() {
  const adminRole = useAdminAuth((state) => state.adminUser?.role ?? null);
  const canManageDeals = isManagerOrAboveRole(adminRole);

  const [restaurants, setRestaurants] = useState<AdminTenant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);

  const [deals, setDeals] = useState<MenuDeal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DealStatus>("all");
  const [pricingFilter, setPricingFilter] = useState<"all" | MenuDealPricingMode>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<MenuDeal | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [dealName, setDealName] = useState("");
  const [dealDescription, setDealDescription] = useState("");
  const [dealPricingMode, setDealPricingMode] = useState<MenuDealPricingMode>("fixed_price");
  const [dealValue, setDealValue] = useState("");
  const [dealServicePeriod, setDealServicePeriod] = useState<MenuDealServicePeriod>("all");
  const [dealWeekdays, setDealWeekdays] = useState<number[]>([]);
  const [dealTimeFrom, setDealTimeFrom] = useState("");
  const [dealTimeUntil, setDealTimeUntil] = useState("");
  const [dealValidFrom, setDealValidFrom] = useState("");
  const [dealValidUntil, setDealValidUntil] = useState("");
  const [dealMinPartySize, setDealMinPartySize] = useState("");
  const [dealMaxPartySize, setDealMaxPartySize] = useState("");
  const [dealDisplayOrder, setDealDisplayOrder] = useState(0);
  const [dealIsActive, setDealIsActive] = useState(true);
  const [allowMainSurcharge, setAllowMainSurcharge] = useState(true);
  const [mainBasePrice, setMainBasePrice] = useState("");
  const [componentGroups, setComponentGroups] = useState<Record<GroupKey, GroupState>>(
    createInitialGroupState()
  );

  const todayKey = useMemo(() => getTodayDateKey(), []);

  const categoryById = useMemo(() => {
    const map = new Map<string, MenuCategory>();
    for (const category of categories) {
      map.set(category.id, category);
    }
    return map;
  }, [categories]);

  const foodCategories = useMemo(
    () => categories.filter((category) => category.category_type === "food" && category.is_active),
    [categories]
  );

  const drinkCategories = useMemo(
    () => categories.filter((category) => category.category_type === "drink" && category.is_active),
    [categories]
  );

  const dealsWithStatus = useMemo(
    () => deals.map((deal) => ({ deal, status: getDealStatus(deal, todayKey) })),
    [deals, todayKey]
  );

  const filteredDeals = useMemo(() => {
    return dealsWithStatus.filter(({ deal, status }) => {
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (pricingFilter !== "all" && deal.pricing_mode !== pricingFilter) return false;

      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;

      return (
        deal.name.toLowerCase().includes(query) ||
        (deal.description ?? "").toLowerCase().includes(query)
      );
    });
  }, [dealsWithStatus, pricingFilter, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const active = dealsWithStatus.filter((entry) => entry.status === "active").length;
    const scheduled = dealsWithStatus.filter((entry) => entry.status === "scheduled").length;
    const inactive = dealsWithStatus.filter((entry) => entry.status === "inactive").length;
    return {
      total: dealsWithStatus.length,
      active,
      scheduled,
      inactive,
    };
  }, [dealsWithStatus]);

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
        if (currentId && list.some((restaurant) => restaurant.id === currentId)) {
          return currentId;
        }
        return list[0]?.id ?? "";
      });
    } catch (error) {
      console.error("Fehler beim Laden der Restaurants:", error);
      toast.error("Restaurants konnten nicht geladen werden");
    } finally {
      setLoadingRestaurants(false);
    }
  }, [adminRole]);

  const getTenantAccessToken = useCallback(
    async (restaurantId: string) => getRestaurantAccessToken(adminRole, restaurantId),
    [adminRole]
  );

  const loadDealsAndCategories = useCallback(
    async (restaurantId: string) => {
      if (!restaurantId) {
        setDeals([]);
        setCategories([]);
        return;
      }

      setLoadingDeals(true);
      setLoadingCategories(true);
      try {
        const accessToken = await getTenantAccessToken(restaurantId);
        const requestOptions = withOptionalAccessToken(accessToken);
        const loadForOptions = async (options: { accessToken?: string }) =>
          Promise.all([
            menuDealsApi.list(options, "bundle_deal", restaurantId),
            menuManagementApi.listCategories({ restaurant_id: restaurantId }, options),
          ]);

        let [dealList, menuCategories] = await loadForOptions(requestOptions);

        if (accessToken && dealList.length === 0 && menuCategories.length === 0) {
          [dealList, menuCategories] = await loadForOptions({});
        }

        setDeals(dealList.filter((deal) => deal.tenant_id === restaurantId));
        setCategories(menuCategories.filter((category) => category.tenant_id === restaurantId));
      } catch (error) {
        console.error("Fehler beim Laden der Menü-Deals:", error);
        toast.error("Menü-Deals konnten nicht geladen werden");
      } finally {
        setLoadingDeals(false);
        setLoadingCategories(false);
      }
    },
    [getTenantAccessToken]
  );

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    loadDealsAndCategories(selectedRestaurantId);
  }, [loadDealsAndCategories, selectedRestaurantId]);

  const toggleWeekday = (weekday: number) => {
    setDealWeekdays((current) => {
      if (current.includes(weekday)) {
        return current.filter((entry) => entry !== weekday);
      }
      return [...current, weekday].sort((a, b) => a - b);
    });
  };

  const toggleGroupCategory = (groupKey: GroupKey, categoryId: string) => {
    setComponentGroups((current) => {
      const group = current[groupKey];
      const hasCategory = group.categoryIds.includes(categoryId);
      const nextCategoryIds = hasCategory
        ? group.categoryIds.filter((id) => id !== categoryId)
        : [...group.categoryIds, categoryId];
      return {
        ...current,
        [groupKey]: {
          ...group,
          categoryIds: nextCategoryIds,
        },
      };
    });
  };

  const updateGroup = (groupKey: GroupKey, patch: Partial<GroupState>) => {
    setComponentGroups((current) => ({
      ...current,
      [groupKey]: {
        ...current[groupKey],
        ...patch,
      },
    }));
  };

  const applyLunchPreset = () => {
    setDealServicePeriod("lunch");
    setDealWeekdays([0, 1, 2, 3, 4]);
    setDealTimeFrom("11:00");
    setDealTimeUntil("14:00");
    setComponentGroups((current) => ({
      ...current,
      main: { ...current.main, enabled: true, required: true },
      side: { ...current.side, enabled: true, required: true },
      drink: { ...current.drink, enabled: true, required: true },
      dessert: { ...current.dessert, enabled: false, required: false },
    }));
  };

  const resetForm = () => {
    setDealName("");
    setDealDescription("");
    setDealPricingMode("fixed_price");
    setDealValue("");
    setDealServicePeriod("all");
    setDealWeekdays([]);
    setDealTimeFrom("");
    setDealTimeUntil("");
    setDealValidFrom("");
    setDealValidUntil("");
    setDealMinPartySize("");
    setDealMaxPartySize("");
    setDealDisplayOrder(deals.length + 1);
    setDealIsActive(true);
    setAllowMainSurcharge(true);
    setMainBasePrice("");
    setComponentGroups(createInitialGroupState());
  };

  const openDialog = (deal: MenuDeal | null = null) => {
    if (!canManageDeals) {
      toast.error("Keine Berechtigung zum Bearbeiten von Menü-Deals");
      return;
    }

    setEditingDeal(deal);
    if (!deal) {
      resetForm();
      setDialogOpen(true);
      return;
    }

    setDealName(deal.name);
    setDealDescription(deal.description ?? "");
    setDealPricingMode(deal.pricing_mode);
    setDealValue(String(deal.price));
    setDealServicePeriod(deal.service_period);
    setDealWeekdays(deal.available_weekdays ?? []);
    setDealTimeFrom(deal.valid_time_from ? deal.valid_time_from.slice(0, 5) : "");
    setDealTimeUntil(deal.valid_time_until ? deal.valid_time_until.slice(0, 5) : "");
    setDealValidFrom(deal.available_from_date ?? "");
    setDealValidUntil(deal.available_until_date ?? "");
    setDealMinPartySize(deal.min_party_size !== null ? String(deal.min_party_size) : "");
    setDealMaxPartySize(deal.max_party_size !== null ? String(deal.max_party_size) : "");
    setDealDisplayOrder(deal.display_order ?? 0);
    setDealIsActive(deal.is_active);
    setAllowMainSurcharge(deal.allow_main_item_surcharge);
    setMainBasePrice(
      deal.main_item_base_price !== null && deal.main_item_base_price !== undefined
        ? String(deal.main_item_base_price)
        : ""
    );

    const nextGroups = createInitialGroupState();
    const rules = deal.component_rules ?? [];
    for (const rule of rules) {
      const groupKey = rule.key as GroupKey;
      if (!["main", "side", "drink", "dessert"].includes(groupKey)) continue;
      nextGroups[groupKey] = {
        enabled: true,
        required: rule.required,
        quantity: rule.quantity,
        categoryIds: rule.category_ids ?? [],
        surchargeAllowed: rule.surcharge_allowed,
      };
    }
    setComponentGroups(nextGroups);
    setDialogOpen(true);
  };

  const buildPayload = useCallback(() => {
    if (!dealName.trim()) {
      toast.error("Bitte einen Deal-Namen angeben");
      return null;
    }

    const parsedValue = parseNumberInput(dealValue);
    if (parsedValue === null || parsedValue <= 0) {
      toast.error("Bitte einen gültigen Preis-/Rabattwert angeben");
      return null;
    }

    if (dealPricingMode === "percentage_discount" && parsedValue > 100) {
      toast.error("Prozent-Rabatt darf maximal 100 sein");
      return null;
    }

    const parsedMinPartySize = parseNumberInput(dealMinPartySize);
    const parsedMaxPartySize = parseNumberInput(dealMaxPartySize);

    if (dealMinPartySize.trim() && (parsedMinPartySize === null || parsedMinPartySize < 1 || !Number.isInteger(parsedMinPartySize))) {
      toast.error("Mindest-Personenzahl muss eine ganze Zahl >= 1 sein");
      return null;
    }

    if (dealMaxPartySize.trim() && (parsedMaxPartySize === null || parsedMaxPartySize < 1 || !Number.isInteger(parsedMaxPartySize))) {
      toast.error("Maximal-Personenzahl muss eine ganze Zahl >= 1 sein");
      return null;
    }

    if (
      parsedMinPartySize !== null &&
      parsedMaxPartySize !== null &&
      parsedMaxPartySize < parsedMinPartySize
    ) {
      toast.error("Maximal-Personenzahl muss >= Mindest-Personenzahl sein");
      return null;
    }

    if (dealValidFrom && dealValidUntil && dealValidUntil < dealValidFrom) {
      toast.error("'Gültig bis' darf nicht vor 'Gültig von' liegen");
      return null;
    }

    if ((dealTimeFrom && !dealTimeUntil) || (!dealTimeFrom && dealTimeUntil)) {
      toast.error("Bitte Start- und Endzeit gemeinsam angeben");
      return null;
    }

    if (dealTimeFrom && dealTimeUntil && dealTimeUntil <= dealTimeFrom) {
      toast.error("Endzeit muss nach Startzeit liegen");
      return null;
    }

    const parsedMainBasePrice = parseNumberInput(mainBasePrice);
    if (allowMainSurcharge) {
      if (parsedMainBasePrice === null || parsedMainBasePrice < 0) {
        toast.error("Bitte einen gültigen Basispreis für Hauptgerichte angeben");
        return null;
      }
    }

    const componentRules = (Object.keys(componentGroups) as GroupKey[])
      .filter((groupKey) => componentGroups[groupKey].enabled)
      .map((groupKey) => {
        const group = componentGroups[groupKey];
        return {
          key: groupKey,
          label: GROUP_LABELS[groupKey],
          required: group.required,
          quantity: group.quantity,
          category_ids: group.categoryIds,
          item_ids: null,
          surcharge_allowed: group.surchargeAllowed,
        };
      });

    if (componentRules.length === 0) {
      toast.error("Bitte mindestens eine Deal-Komponente aktivieren");
      return null;
    }

    const invalidGroup = componentRules.find((rule) => !rule.category_ids || rule.category_ids.length === 0);
    if (invalidGroup) {
      toast.error(`Bitte mindestens eine Kategorie für ${invalidGroup.label} auswählen`);
      return null;
    }

    return {
      name: dealName.trim(),
      description: dealDescription.trim() || null,
      price: parsedValue,
      is_active: dealIsActive,
      available_from_date: dealValidFrom || null,
      available_until_date: dealValidUntil || null,
      min_party_size: parsedMinPartySize === null ? null : Math.trunc(parsedMinPartySize),
      max_party_size: parsedMaxPartySize === null ? null : Math.trunc(parsedMaxPartySize),
      available_weekdays: dealWeekdays.length ? dealWeekdays : null,
      display_order: dealDisplayOrder,
      package_type: "bundle_deal" as const,
      pricing_mode: dealPricingMode,
      service_period: dealServicePeriod,
      valid_time_from: dealTimeFrom || null,
      valid_time_until: dealTimeUntil || null,
      component_rules: componentRules,
      allow_main_item_surcharge: allowMainSurcharge,
      main_item_base_price: allowMainSurcharge ? parsedMainBasePrice : null,
    };
  }, [
    allowMainSurcharge,
    componentGroups,
    dealDescription,
    dealDisplayOrder,
    dealIsActive,
    dealMaxPartySize,
    dealMinPartySize,
    dealName,
    dealPricingMode,
    dealServicePeriod,
    dealTimeFrom,
    dealTimeUntil,
    dealValidFrom,
    dealValidUntil,
    dealValue,
    dealWeekdays,
    mainBasePrice,
  ]);

  const handleSaveDeal = async () => {
    if (!canManageDeals) {
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

      if (editingDeal) {
        await menuDealsApi.update(editingDeal.id, payload, requestOptions, selectedRestaurantId);
        toast.success("Menü-Deal aktualisiert");
      } else {
        await menuDealsApi.create(
          {
            restaurant_id: selectedRestaurantId,
            ...payload,
          },
          requestOptions
        );
        toast.success("Menü-Deal erstellt");
      }

      setDialogOpen(false);
      await loadDealsAndCategories(selectedRestaurantId);
    } catch (error) {
      console.error("Fehler beim Speichern des Menü-Deals:", error);
      toast.error("Menü-Deal konnte nicht gespeichert werden");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDeal = async (deal: MenuDeal) => {
    if (!canManageDeals) {
      toast.error("Keine Berechtigung zum Löschen");
      return;
    }

    if (!confirm(`Menü-Deal "${deal.name}" wirklich löschen?`)) {
      return;
    }

    setSubmitting(true);
    try {
      const accessToken = await getTenantAccessToken(selectedRestaurantId);
      await menuDealsApi.delete(
        deal.id,
        withOptionalAccessToken(accessToken),
        selectedRestaurantId
      );
      toast.success("Menü-Deal gelöscht");
      setDialogOpen(false);
      await loadDealsAndCategories(selectedRestaurantId);
    } catch (error) {
      console.error("Fehler beim Löschen:", error);
      toast.error("Menü-Deal konnte nicht gelöscht werden");
    } finally {
      setSubmitting(false);
    }
  };

  const renderCategoryChips = (groupKey: GroupKey, options: MenuCategory[]) => {
    const group = componentGroups[groupKey];
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((category) => {
          const selected = group.categoryIds.includes(category.id);
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => toggleGroupCategory(groupKey, category.id)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                selected
                  ? "border-primary/60 bg-primary/15 text-primary-contrast"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
              disabled={submitting || !group.enabled}
            >
              {category.name}
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
                  <Box className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-2xl tracking-tight">Menü-Deals verwalten</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Kombi-Angebote wie Hauptgericht + Beilage + Getränk + Dessert mit Festpreis oder
                    Rabattregeln erstellen.
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                <Button
                  onClick={() => openDialog(null)}
                  disabled={!selectedRestaurantId || loadingDeals || !canManageDeals}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Menü-Deal anlegen
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 xl:grid-cols-[300px_1fr_200px_220px]">
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
                    placeholder="Nach Deal-Name/Beschreibung suchen"
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
                  onValueChange={(value) => setStatusFilter(value as "all" | DealStatus)}
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
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Preislogik
                </label>
                <Select
                  value={pricingFilter}
                  onValueChange={(value) =>
                    setPricingFilter(value as "all" | MenuDealPricingMode)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="fixed_price">Festpreis</SelectItem>
                    <SelectItem value="fixed_discount">Fixer Rabatt</SelectItem>
                    <SelectItem value="percentage_discount">Prozent-Rabatt</SelectItem>
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
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                <p className="text-xs uppercase tracking-wide text-amber-300">Inaktiv</p>
                <p className="mt-1 text-2xl font-semibold text-amber-200">{stats.inactive}</p>
              </div>
            </div>

            {!canManageDeals ? (
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

        {selectedRestaurantId ? (
          <Card className="border-border/70 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">
                  Menü-Deals
                  <span className="ml-2 text-base font-medium text-muted-foreground">
                    ({filteredDeals.length})
                  </span>
                </CardTitle>
                {loadingDeals ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {loadingDeals || loadingCategories ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-48 rounded-xl" />
                  ))}
                </div>
              ) : filteredDeals.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-10 text-center">
                  <p className="font-medium text-foreground">Keine passenden Deals gefunden</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {searchQuery || statusFilter !== "all" || pricingFilter !== "all"
                      ? "Filter anpassen."
                      : "Legen Sie den ersten Menü-Deal an."}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredDeals.map(({ deal, status }) => {
                    const components = deal.component_rules ?? [];
                    return (
                      <button
                        key={deal.id}
                        type="button"
                        onClick={() => openDialog(deal)}
                        disabled={!canManageDeals}
                        className="group rounded-xl border border-border/80 bg-background/70 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold leading-tight">{deal.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {pricingModeLabel(deal.pricing_mode)}
                            </p>
                          </div>
                          <Badge className={statusBadgeClass(status)}>{statusLabel(status)}</Badge>
                        </div>

                        {deal.description ? (
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                            {deal.description}
                          </p>
                        ) : null}

                        <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                          <p>Service: {servicePeriodLabel(deal.service_period)}</p>
                          <p>Wochentage: {weekdaysSummary(deal.available_weekdays)}</p>
                          <p>Zeitfenster: {timeSummary(deal.valid_time_from, deal.valid_time_until)}</p>
                          <p>
                            Gültig: {formatDate(deal.available_from_date)} bis {formatDate(deal.available_until_date)}
                          </p>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {components.map((component) => (
                            <span
                              key={component.key}
                              className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-foreground"
                            >
                              {component.label}
                            </span>
                          ))}
                        </div>

                        <div className="mt-3 border-t border-border/80 pt-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Wert</span>
                            <span className="text-sm font-semibold text-foreground">
                              {deal.pricing_mode === "percentage_discount"
                                ? `${deal.price}%`
                                : formatCurrency(deal.price)}
                            </span>
                          </div>
                          {deal.allow_main_item_surcharge ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Hauptgericht-Aufpreis ab {formatCurrency(deal.main_item_base_price ?? 0)}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => setDialogOpen(nextOpen && canManageDeals)}
      >
        <DialogContent
          className="max-w-4xl border-border/70 bg-card/95 backdrop-blur-xl"
          onClose={() => setDialogOpen(false)}
        >
          <DialogHeader>
            <DialogTitle>{editingDeal ? "Menü-Deal bearbeiten" : "Neuer Menü-Deal"}</DialogTitle>
            <DialogDescription>
              Definieren Sie Bundle-Komponenten, Festpreis oder Rabatt und optionale Aufpreise für
              Premium-Hauptgerichte.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-4 pb-2 md:px-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Deal-Name</label>
                <Input
                  value={dealName}
                  onChange={(event) => setDealName(event.target.value)}
                  placeholder="z. B. Mittagstisch Classic"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Sortierung</label>
                <Input
                  type="number"
                  value={dealDisplayOrder}
                  onChange={(event) => setDealDisplayOrder(Number(event.target.value) || 0)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Beschreibung</label>
              <textarea
                value={dealDescription}
                onChange={(event) => setDealDescription(event.target.value)}
                rows={3}
                disabled={submitting}
                placeholder="Beschreibung und Bedingungen"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="rounded-xl border border-border/80 bg-background/50 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Kontext & Zeitraum</p>
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

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Service</label>
                  <Select
                    value={dealServicePeriod}
                    onValueChange={(value) =>
                      setDealServicePeriod(value as MenuDealServicePeriod)
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_OPTIONS.map((option) => (
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
                      value={dealTimeFrom}
                      onChange={(event) => setDealTimeFrom(event.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">Bis</label>
                    <Input
                      type="time"
                      value={dealTimeUntil}
                      onChange={(event) => setDealTimeUntil(event.target.value)}
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-2 block text-sm font-medium text-foreground">Wochentage</label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((weekday) => {
                    const selected = dealWeekdays.includes(weekday.value);
                    return (
                      <button
                        key={weekday.value}
                        type="button"
                        onClick={() => toggleWeekday(weekday.value)}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                          selected
                            ? "border-primary/60 bg-primary/15 text-primary-contrast"
                            : "border-border bg-background text-muted-foreground hover:text-foreground"
                        }`}
                        disabled={submitting}
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

              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Gültig von</label>
                  <Input
                    type="date"
                    value={dealValidFrom}
                    onChange={(event) => setDealValidFrom(event.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Gültig bis</label>
                  <Input
                    type="date"
                    value={dealValidUntil}
                    onChange={(event) => setDealValidUntil(event.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-background/50 p-3">
              <p className="mb-3 text-sm font-medium">Preislogik</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Modell</label>
                  <Select
                    value={dealPricingMode}
                    onValueChange={(value) => setDealPricingMode(value as MenuDealPricingMode)}
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRICING_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {dealPricingMode === "percentage_discount" ? "Rabatt (%)" : "Wert (EUR)"}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={dealValue}
                    onChange={(event) => setDealValue(event.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Mindest-Personenzahl
                  </label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={dealMinPartySize}
                    onChange={(event) => setDealMinPartySize(event.target.value)}
                    placeholder="Optional"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Maximal-Personenzahl
                  </label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={dealMaxPartySize}
                    onChange={(event) => setDealMaxPartySize(event.target.value)}
                    placeholder="Optional"
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-background/50 p-3">
              <p className="mb-3 text-sm font-medium">Bundle-Komponenten</p>
              <div className="space-y-3">
                {(Object.keys(GROUP_LABELS) as GroupKey[]).map((groupKey) => {
                  const group = componentGroups[groupKey];
                  const options = groupKey === "drink" ? drinkCategories : foodCategories;
                  return (
                    <div key={groupKey} className="rounded-lg border border-border/70 p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-3">
                        <label className="inline-flex items-center gap-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            checked={group.enabled}
                            onChange={(event) =>
                              updateGroup(groupKey, { enabled: event.target.checked })
                            }
                            className="h-4 w-4 accent-[hsl(var(--primary))]"
                            disabled={submitting}
                          />
                          {GROUP_LABELS[groupKey]}
                        </label>
                        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={group.required}
                            onChange={(event) =>
                              updateGroup(groupKey, { required: event.target.checked })
                            }
                            className="h-4 w-4 accent-[hsl(var(--primary))]"
                            disabled={submitting || !group.enabled}
                          />
                          Pflicht
                        </label>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          Menge
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={group.quantity}
                            onChange={(event) =>
                              updateGroup(groupKey, {
                                quantity: Math.max(1, Number(event.target.value) || 1),
                              })
                            }
                            disabled={submitting || !group.enabled}
                            className="h-8 w-20"
                          />
                        </div>
                        {groupKey === "main" ? (
                          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={group.surchargeAllowed}
                              onChange={(event) =>
                                updateGroup(groupKey, {
                                  surchargeAllowed: event.target.checked,
                                })
                              }
                              className="h-4 w-4 accent-[hsl(var(--primary))]"
                              disabled={submitting || !group.enabled}
                            />
                            Aufpreis zulassen
                          </label>
                        ) : null}
                      </div>

                      {renderCategoryChips(groupKey, options)}
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 rounded-lg border border-border/70 p-3">
                <label className="inline-flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={allowMainSurcharge}
                    onChange={(event) => setAllowMainSurcharge(event.target.checked)}
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                    disabled={submitting}
                  />
                  Hauptgericht-Aufpreis aktivieren
                </label>
                <div className="mt-2">
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Inkludierter Basispreis für Hauptgericht (EUR)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={mainBasePrice}
                    onChange={(event) => setMainBasePrice(event.target.value)}
                    placeholder="z. B. 12.90"
                    disabled={submitting || !allowMainSurcharge}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Deal aktiv</p>
                <p className="text-xs text-muted-foreground">
                  Inaktive Deals bleiben gespeichert und werden nicht ausgespielt.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={dealIsActive}
                  onChange={(event) => setDealIsActive(event.target.checked)}
                  disabled={submitting}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                />
              </label>
            </div>
          </div>

          <DialogFooter className="items-center">
            {editingDeal ? (
              <Button
                variant="destructive"
                className="mr-auto"
                onClick={() => handleDeleteDeal(editingDeal)}
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
            <Button onClick={handleSaveDeal} disabled={submitting}>
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
