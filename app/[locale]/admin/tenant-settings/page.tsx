"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Bell,
  Building2,
  Calendar,
  Clock,
  ExternalLink,
  Globe,
  ImagePlus,
  Link as LinkIcon,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Settings,
  ShoppingBag,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminTenantsApi, type AdminTenant } from "@/lib/api/admin";
import {
  adminRestaurantsApi,
  type AdminRestaurant,
} from "@/lib/api/admin-restaurants";
import {
  getRestaurantAccessToken,
  listAccessibleRestaurants,
} from "@/lib/admin-tenant-context";
import {
  onPreferredAdminRestaurantChange,
  resolvePreferredRestaurantId,
  setPreferredAdminRestaurantId,
} from "@/lib/admin-restaurant-preference";
import { canEditTenantSlug } from "@/lib/admin-access";
import { useAdminAuth } from "@/lib/hooks/use-admin-auth";
import {
  DEFAULT_TENANT_SETTINGS,
  tenantSettingsApi,
  type DayHours,
  type OpeningHours,
  type TenantSettings,
} from "@/lib/api/tenant-settings";
import { uploadsApi } from "@/lib/api/uploads";

type SectionProps = {
  icon: React.ElementType;
  title: string;
  description?: string;
  onSave: () => void;
  saving: boolean;
  children: React.ReactNode;
};

type FieldRowProps = {
  label: string;
  hint?: string;
  wide?: boolean;
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
};

const DAYS: { key: keyof OpeningHours; label: string }[] = [
  { key: "monday", label: "Montag" },
  { key: "tuesday", label: "Dienstag" },
  { key: "wednesday", label: "Mittwoch" },
  { key: "thursday", label: "Donnerstag" },
  { key: "friday", label: "Freitag" },
  { key: "saturday", label: "Samstag" },
  { key: "sunday", label: "Sonntag" },
];

const DEFAULT_DAY: DayHours = { open: "09:00", close: "22:00", closed: false };

function buildDefaultOpeningHours(): OpeningHours {
  return Object.fromEntries(DAYS.map(({ key }) => [key, { ...DEFAULT_DAY }])) as OpeningHours;
}

function FieldRow({ label, hint, wide, inline, className, children }: FieldRowProps) {
  if (inline) {
    return (
      <div
        className={`rounded-lg border border-border/70 bg-background/60 p-3 md:p-4 ${
          className ?? ""
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">{label}</div>
            {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
          </div>
          <div className="shrink-0">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-border/70 bg-background/60 p-3 md:p-4 ${
        wide ? "space-y-3" : "space-y-2.5"
      } ${className ?? ""}`}
    >
      <div className="space-y-1">
        <div className="text-sm font-semibold text-foreground">{label}</div>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (nextValue: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  onSave,
  saving,
  children,
}: SectionProps) {
  return (
    <Card className="border-border/70 bg-card/85 backdrop-blur-sm">
      <CardHeader className="border-b border-border/70 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Icon className="mt-0.5 h-4 w-4 text-primary-contrast" />
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              {description ? (
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
          <Button onClick={onSave} disabled={saving} className="w-full min-w-[110px] sm:w-auto">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Speichern
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">{children}</CardContent>
    </Card>
  );
}

export default function TenantSettingsPage() {
  const adminRole = useAdminAuth((state) => state.adminUser?.role ?? null);
  const [restaurants, setRestaurants] = useState<AdminTenant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [savingContact, setSavingContact] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingBooking, setSavingBooking] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Unternehmensdaten (§ 14 UStG Pflichtangaben)
  const [companyName, setCompanyName] = useState("");
  const [street, setStreet] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [vatId, setVatId] = useState("");

  const [website, setWebsite] = useState("");
  const [timezone, setTimezone] = useState(DEFAULT_TENANT_SETTINGS.timezone);
  const [currency, setCurrency] = useState(DEFAULT_TENANT_SETTINGS.currency);
  const [language, setLanguage] = useState(DEFAULT_TENANT_SETTINGS.language);
  const [orderPrefix, setOrderPrefix] = useState(DEFAULT_TENANT_SETTINGS.order_number_prefix);
  const [taxRate, setTaxRate] = useState(String(DEFAULT_TENANT_SETTINGS.tax_rate));
  const [receiptFooter, setReceiptFooter] = useState("");

  const [slug, setSlug] = useState("");
  const [bookingEnabled, setBookingEnabled] = useState(DEFAULT_TENANT_SETTINGS.public_booking_enabled);
  const [leadTime, setLeadTime] = useState(String(DEFAULT_TENANT_SETTINGS.booking_lead_time_hours));
  const [maxParty, setMaxParty] = useState(String(DEFAULT_TENANT_SETTINGS.booking_max_party_size));
  const [defaultDuration, setDefaultDuration] = useState(
    String(DEFAULT_TENANT_SETTINGS.booking_default_duration_minutes)
  );

  const [openingHours, setOpeningHours] = useState<OpeningHours>(buildDefaultOpeningHours());
  const [notifyEmail, setNotifyEmail] = useState(DEFAULT_TENANT_SETTINGS.notify_new_reservation_email);
  const [notifyPush, setNotifyPush] = useState(DEFAULT_TENANT_SETTINGS.notify_new_order_push);

  const selectedRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? null,
    [restaurants, selectedRestaurantId]
  );
  const canUpdateSlug = canEditTenantSlug(adminRole);

  const loadRestaurantList = useCallback(async () => {
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
      setSelectedRestaurantId((current) => {
        return resolvePreferredRestaurantId(list, current);
      });
    } catch (error) {
      console.error("Fehler beim Laden der Restaurants:", error);
      toast.error("Restaurants konnten nicht geladen werden");
    } finally {
      setLoadingRestaurants(false);
    }
  }, [adminRole]);

  const hydrateFromData = useCallback(
    (restaurant: AdminRestaurant, settings: TenantSettings) => {
      setName(restaurant.name ?? "");
      setAddress(restaurant.address ?? "");
      setPhone(restaurant.phone ?? "");
      setEmail(restaurant.email ?? "");
      setDescription(restaurant.description ?? "");
      setCompanyName(restaurant.company_name ?? "");
      setStreet(restaurant.street ?? "");
      setZipCode(restaurant.zip_code ?? "");
      setCity(restaurant.city ?? "");
      setTaxNumber(restaurant.tax_number ?? "");
      setVatId(restaurant.vat_id ?? "");
      setSlug(restaurant.slug ?? "");

      setImageUrl(
        typeof settings.image_url === "string"
          ? settings.image_url
          : settings.logo_url ?? null
      );
      setWebsite(typeof settings.website === "string" ? settings.website : "");
      setTimezone(settings.timezone ?? DEFAULT_TENANT_SETTINGS.timezone);
      setCurrency(settings.currency ?? DEFAULT_TENANT_SETTINGS.currency);
      setLanguage(settings.language ?? DEFAULT_TENANT_SETTINGS.language);
      setOrderPrefix(settings.order_number_prefix ?? DEFAULT_TENANT_SETTINGS.order_number_prefix);
      setTaxRate(String(settings.tax_rate ?? DEFAULT_TENANT_SETTINGS.tax_rate));
      setReceiptFooter(settings.receipt_footer ?? "");

      setBookingEnabled(
        settings.public_booking_enabled ?? DEFAULT_TENANT_SETTINGS.public_booking_enabled
      );
      setLeadTime(
        String(settings.booking_lead_time_hours ?? DEFAULT_TENANT_SETTINGS.booking_lead_time_hours)
      );
      setMaxParty(
        String(settings.booking_max_party_size ?? DEFAULT_TENANT_SETTINGS.booking_max_party_size)
      );
      setDefaultDuration(
        String(
          settings.booking_default_duration_minutes ??
            DEFAULT_TENANT_SETTINGS.booking_default_duration_minutes
        )
      );

      const defaultHours = buildDefaultOpeningHours();
      if (settings.opening_hours) {
        for (const { key } of DAYS) {
          const day = settings.opening_hours[key];
          if (day) {
            defaultHours[key] = { ...DEFAULT_DAY, ...day };
          }
        }
      }
      setOpeningHours(defaultHours);

      setNotifyEmail(
        settings.notify_new_reservation_email ??
          DEFAULT_TENANT_SETTINGS.notify_new_reservation_email
      );
      setNotifyPush(
        settings.notify_new_order_push ?? DEFAULT_TENANT_SETTINGS.notify_new_order_push
      );
    },
    []
  );

  const loadRestaurantDetails = useCallback(
    async (restaurantId: string) => {
      if (!restaurantId) return;
      setLoadingDetails(true);
      try {
        const [restaurant, settings] = await Promise.all([
          adminRestaurantsApi.get(restaurantId),
          tenantSettingsApi.getSettings(restaurantId),
        ]);
        hydrateFromData(restaurant, settings);
      } catch (error) {
        console.error("Fehler beim Laden der Einstellungen:", error);
        toast.error("Restaurant-Einstellungen konnten nicht geladen werden");
      } finally {
        setLoadingDetails(false);
      }
    },
    [hydrateFromData]
  );

  const getTenantAccessToken = useCallback(async (restaurantId: string) => {
    return getRestaurantAccessToken(adminRole, restaurantId);
  }, [adminRole]);

  useEffect(() => {
    loadRestaurantList();
  }, [loadRestaurantList]);

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
    loadRestaurantDetails(selectedRestaurantId);
  }, [selectedRestaurantId, loadRestaurantDetails]);

  const setDayField = (
    day: keyof OpeningHours,
    field: keyof DayHours,
    value: string | boolean
  ) => {
    setOpeningHours((current) => ({
      ...current,
      [day]: {
        ...(current[day] ?? DEFAULT_DAY),
        [field]: value,
      },
    }));
  };

  const generateSlug = () => {
    const generated = name
      .toLowerCase()
      .replace(/[äÄ]/g, "ae")
      .replace(/[öÖ]/g, "oe")
      .replace(/[üÜ]/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setSlug(generated);
  };

  const validateContact = () => {
    if (!name.trim()) {
      toast.error("Restaurantname ist erforderlich");
      return false;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Bitte eine gültige E-Mail-Adresse eingeben");
      return false;
    }
    if (phone.trim() && !/^[\d\s+\-()]+$/.test(phone.trim())) {
      toast.error("Bitte eine gültige Telefonnummer eingeben");
      return false;
    }
    return true;
  };

  const saveContact = async () => {
    if (!selectedRestaurantId || !validateContact()) return;
    setSavingContact(true);
    try {
      await Promise.all([
        adminRestaurantsApi.update(selectedRestaurantId, {
          name: name.trim(),
          address: address.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          description: description.trim() || null,
        }),
        tenantSettingsApi.updateSettings(selectedRestaurantId, {
          logo_url: imageUrl,
          image_url: imageUrl,
        }),
      ]);
      toast.success("Stammdaten gespeichert");
      await loadRestaurantList();
    } catch (error) {
      console.error("Fehler beim Speichern der Stammdaten:", error);
      toast.error("Stammdaten konnten nicht gespeichert werden");
    } finally {
      setSavingContact(false);
    }
  };

  const saveBusiness = async () => {
    if (!selectedRestaurantId) return;
    setSavingBusiness(true);
    try {
      await adminRestaurantsApi.update(selectedRestaurantId, {
        company_name: companyName.trim() || null,
        street: street.trim() || null,
        zip_code: zipCode.trim() || null,
        city: city.trim() || null,
        tax_number: taxNumber.trim() || null,
        vat_id: vatId.trim() || null,
      });
      toast.success("Unternehmensdaten gespeichert");
    } catch (error) {
      console.error("Fehler beim Speichern der Unternehmensdaten:", error);
      toast.error("Unternehmensdaten konnten nicht gespeichert werden");
    } finally {
      setSavingBusiness(false);
    }
  };

  const saveGeneral = async () => {
    if (!selectedRestaurantId) return;
    setSavingGeneral(true);
    try {
      await tenantSettingsApi.updateSettings(selectedRestaurantId, {
        website: website.trim() || null,
        timezone,
        currency,
        language,
        order_number_prefix: orderPrefix.trim() || "B",
        tax_rate: parseFloat(taxRate) || 0,
        receipt_footer: receiptFooter.trim() || null,
      });
      toast.success("Allgemeine Einstellungen gespeichert");
    } catch (error) {
      console.error("Fehler beim Speichern der allgemeinen Einstellungen:", error);
      toast.error("Allgemeine Einstellungen konnten nicht gespeichert werden");
    } finally {
      setSavingGeneral(false);
    }
  };

  const saveBooking = async () => {
    if (!selectedRestaurantId) return;
    setSavingBooking(true);
    try {
      const updates: Promise<unknown>[] = [
        tenantSettingsApi.updateSettings(selectedRestaurantId, {
          public_booking_enabled: bookingEnabled,
          booking_lead_time_hours: Math.max(0, parseInt(leadTime, 10) || 0),
          booking_max_party_size: Math.max(1, parseInt(maxParty, 10) || 1),
          booking_default_duration_minutes: Math.max(
            15,
            parseInt(defaultDuration, 10) || 120
          ),
        }),
      ];

      if (canUpdateSlug) {
        updates.push(
          adminTenantsApi.update(selectedRestaurantId, { slug: slug.trim() || undefined })
        );
      } else if (slug.trim() !== (selectedRestaurant?.slug ?? "")) {
        toast.info("Der URL-Slug kann nur von Platform-Admins geändert werden");
      }

      await Promise.all(updates);
      toast.success("Buchungseinstellungen gespeichert");
      await loadRestaurantList();
    } catch (error) {
      console.error("Fehler beim Speichern der Buchungseinstellungen:", error);
      toast.error("Buchungseinstellungen konnten nicht gespeichert werden");
    } finally {
      setSavingBooking(false);
    }
  };

  const saveHours = async () => {
    if (!selectedRestaurantId) return;
    setSavingHours(true);
    try {
      await tenantSettingsApi.updateSettings(selectedRestaurantId, {
        opening_hours: openingHours,
      });
      toast.success("Öffnungszeiten gespeichert");
    } catch (error) {
      console.error("Fehler beim Speichern der Öffnungszeiten:", error);
      toast.error("Öffnungszeiten konnten nicht gespeichert werden");
    } finally {
      setSavingHours(false);
    }
  };

  const saveNotifications = async () => {
    if (!selectedRestaurantId) return;
    setSavingNotifications(true);
    try {
      await tenantSettingsApi.updateSettings(selectedRestaurantId, {
        notify_new_reservation_email: notifyEmail,
        notify_new_order_push: notifyPush,
      });
      toast.success("Benachrichtigungen gespeichert");
    } catch (error) {
      console.error("Fehler beim Speichern der Benachrichtigungen:", error);
      toast.error("Benachrichtigungen konnten nicht gespeichert werden");
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleUploadImage = async (file: File) => {
    if (!selectedRestaurantId) {
      toast.error("Bitte zuerst ein Restaurant auswählen");
      return;
    }

    setImageUploading(true);
    try {
      const token = await getTenantAccessToken(selectedRestaurantId);
      const { url } = await uploadsApi.uploadRestaurantImage(file, token);
      setImageUrl(url);
      toast.success("Bild hochgeladen");
    } catch (error) {
      console.error("Fehler beim Bild-Upload:", error);
      toast.error(error instanceof Error ? error.message : "Upload fehlgeschlagen");
    } finally {
      setImageUploading(false);
    }
  };

  const restaurantLink = useMemo(() => {
    if (!slug || typeof window === "undefined") return "";
    return `${window.location.origin}/book/${slug}`;
  }, [slug]);

  return (
    <div className="relative space-y-6">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-background to-muted/40" />

      <Card className="border-border/70 bg-card/85 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/25">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-2xl tracking-tight">Restaurant-Einstellungen</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Stammdaten, Öffnungszeiten, Buchung und Benachrichtigungen verwalten
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {!loadingRestaurants && restaurants.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="mb-2 h-9 w-9 text-muted-foreground" />
            <p className="font-medium">Keine Restaurants vorhanden</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Bitte zuerst ein Restaurant in der Restaurantverwaltung anlegen.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {selectedRestaurant ? (
        <div className="space-y-6">
          {loadingDetails ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Einstellungen werden geladen...
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Section
            icon={Building2}
            title="Stammdaten"
            description="Name, Adresse und Kontaktdaten Ihres Restaurants."
            onSave={saveContact}
            saving={savingContact}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FieldRow label="Restaurantname">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Mein Restaurant"
                  className="w-full"
                />
              </FieldRow>

              <FieldRow label="Adresse">
                <div className="flex w-full items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Musterstraße 1, 12345 Stadt"
                  />
                </div>
              </FieldRow>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FieldRow label="Telefon">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+49 123 456789"
                  />
                </div>
              </FieldRow>
              <FieldRow label="E-Mail">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="info@restaurant.de"
                  />
                </div>
              </FieldRow>
            </div>

            <FieldRow label="Beschreibung" hint="Optional" wide>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Beschreiben Sie Ihr Restaurant..."
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </FieldRow>

            <FieldRow
              label="Titelbild (Web)"
              hint="JPEG, PNG oder WebP, maximal 10 MB."
              wide
            >
              <div className="space-y-3">
                <div className="relative h-44 w-full max-w-sm overflow-hidden rounded-lg border border-border bg-muted">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt="Restaurant-Bild"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Building2 className="h-10 w-10 text-muted-foreground/60" />
                    </div>
                  )}
                  {imageUrl ? (
                    <button
                      type="button"
                      onClick={() => setImageUrl(null)}
                      className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-white hover:bg-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <label
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-medium transition-colors ${
                    imageUploading ? "cursor-not-allowed opacity-60" : "hover:bg-accent"
                  }`}
                >
                  {imageUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  {imageUploading ? "Wird hochgeladen..." : imageUrl ? "Bild ändern" : "Bild hochladen"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={imageUploading}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      await handleUploadImage(file);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            </FieldRow>
          </Section>

          <Section
            icon={Building2}
            title="Unternehmensdaten"
            description="Pflichtangaben für Rechnungen und Belege gem. § 14 UStG."
            onSave={saveBusiness}
            saving={savingBusiness}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FieldRow label="Firmenbezeichnung" hint="Vollständiger Unternehmensname für Rechnungen">
                <Input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Muster Restaurant GmbH"
                  className="w-full"
                />
              </FieldRow>
              <FieldRow label="Straße + Hausnummer">
                <Input
                  value={street}
                  onChange={(event) => setStreet(event.target.value)}
                  placeholder="Musterstraße 1"
                  className="w-full"
                />
              </FieldRow>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FieldRow label="PLZ">
                <Input
                  value={zipCode}
                  onChange={(event) => setZipCode(event.target.value)}
                  placeholder="12345"
                  className="w-full"
                />
              </FieldRow>
              <FieldRow label="Ort">
                <Input
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Berlin"
                  className="w-full"
                />
              </FieldRow>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FieldRow label="Steuernummer" hint="Vom Finanzamt zugeteilte Steuernummer">
                <Input
                  value={taxNumber}
                  onChange={(event) => setTaxNumber(event.target.value)}
                  placeholder="123/456/78901"
                  className="w-full"
                />
              </FieldRow>
              <FieldRow label="USt-IdNr." hint="Umsatzsteuer-Identifikationsnummer (optional)">
                <Input
                  value={vatId}
                  onChange={(event) => setVatId(event.target.value)}
                  placeholder="DE123456789"
                  className="w-full"
                />
              </FieldRow>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              Gem. § 14 Abs. 4 UStG müssen auf jeder Rechnung der vollständige Name und die Anschrift
              des leistenden Unternehmers sowie die Steuernummer oder USt-IdNr. angegeben werden.
            </div>
          </Section>

            <Section
              icon={Globe}
              title="Allgemein"
              description="Zeitzone, Währung, Sprache und Standardwerte."
              onSave={saveGeneral}
              saving={savingGeneral}
            >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FieldRow label="Website">
                <div className="flex w-full items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                    placeholder="https://www.mein-restaurant.de"
                  />
                </div>
              </FieldRow>

              <FieldRow label="Zeitzone">
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Berlin">Europa/Berlin (MEZ/MESZ)</SelectItem>
                    <SelectItem value="Europe/Vienna">Europa/Wien</SelectItem>
                    <SelectItem value="Europe/Zurich">Europa/Zürich</SelectItem>
                    <SelectItem value="Europe/Paris">Europa/Paris</SelectItem>
                    <SelectItem value="Europe/London">Europa/London</SelectItem>
                    <SelectItem value="America/New_York">Amerika/New York</SelectItem>
                    <SelectItem value="America/Los_Angeles">Amerika/Los Angeles</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FieldRow label="Währung">
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR – Euro</SelectItem>
                    <SelectItem value="USD">USD – US-Dollar</SelectItem>
                    <SelectItem value="GBP">GBP – Pfund</SelectItem>
                    <SelectItem value="CHF">CHF – Franken</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Sprache">
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="it">Italiano</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Bestellnummer-Präfix">
                <Input
                  value={orderPrefix}
                  onChange={(event) => setOrderPrefix(event.target.value)}
                  className="w-24"
                />
              </FieldRow>
              <FieldRow label="MwSt.-Satz (%)" hint="Standardwert für neue Artikel.">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={taxRate}
                  onChange={(event) => setTaxRate(event.target.value)}
                  className="w-24"
                />
              </FieldRow>
            </div>

            <FieldRow label="Bon-Fußzeile" hint="Optional" wide>
              <textarea
                value={receiptFooter}
                onChange={(event) => setReceiptFooter(event.target.value)}
                rows={3}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </FieldRow>
          </Section>

          <Section
            icon={ShoppingBag}
            title="Online-Buchung"
            description="Reservierungslink und Buchungsregeln."
            onSave={saveBooking}
            saving={savingBooking}
          >
            <FieldRow
              label="Öffentliche Buchung"
              hint="Aktiviert Buchung über den Web-Link."
              inline
            >
              <Toggle checked={bookingEnabled} onChange={setBookingEnabled} />
            </FieldRow>

            <FieldRow label="URL-Slug" hint="Eindeutiger Kurz-Link" wide>
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="flex flex-1 items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={slug}
                      onChange={(event) =>
                        setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                      }
                      placeholder="mein-restaurant"
                      disabled={!canUpdateSlug}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateSlug}
                    disabled={!canUpdateSlug}
                  >
                    Generieren
                  </Button>
                </div>
                {!canUpdateSlug ? (
                  <p className="text-xs text-muted-foreground">
                    Der URL-Slug kann nur durch Platform-Admins geändert werden.
                  </p>
                ) : null}
                {slug ? (
                  <p className="text-xs text-muted-foreground">
                    <ExternalLink className="mr-1 inline h-3 w-3" />
                    Buchungs-URL:{" "}
                    <code className="rounded border border-border bg-background px-1 py-0.5">
                      {restaurantLink || `/book/${slug}`}
                    </code>
                  </p>
                ) : null}
              </div>
            </FieldRow>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <FieldRow label="Vorlaufzeit (h)">
                <Input
                  type="number"
                  min={0}
                  max={168}
                  value={leadTime}
                  onChange={(event) => setLeadTime(event.target.value)}
                  className="w-full"
                />
              </FieldRow>

              <FieldRow label="Max. Personen">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={maxParty}
                    onChange={(event) => setMaxParty(event.target.value)}
                    className="w-full"
                  />
                </div>
              </FieldRow>

              <FieldRow label="Aufenthaltsdauer">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Select value={defaultDuration} onValueChange={setDefaultDuration}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 Min.</SelectItem>
                      <SelectItem value="60">1 Stunde</SelectItem>
                      <SelectItem value="90">1,5 Std.</SelectItem>
                      <SelectItem value="120">2 Stunden</SelectItem>
                      <SelectItem value="150">2,5 Std.</SelectItem>
                      <SelectItem value="180">3 Stunden</SelectItem>
                      <SelectItem value="240">4 Stunden</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </FieldRow>
            </div>
          </Section>

          <Section
            icon={Clock}
            title="Öffnungszeiten"
            description="Reguläre Öffnungszeiten pro Wochentag."
            onSave={saveHours}
            saving={savingHours}
          >
            <div className="space-y-3">
              {DAYS.map(({ key, label }) => {
                const day = openingHours[key] ?? DEFAULT_DAY;
                const isClosed = day.closed ?? false;
                return (
                  <div
                    key={key}
                    className="rounded-lg border border-border/70 bg-background/70 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">{label}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            isClosed
                              ? "bg-muted text-muted-foreground"
                              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
                          }`}
                        >
                          {isClosed ? "Geschlossen" : "Geöffnet"}
                        </span>
                        <Toggle
                          checked={!isClosed}
                          onChange={(open) => setDayField(key, "closed", !open)}
                        />
                      </div>
                    </div>

                    {!isClosed ? (
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="space-y-1">
                          <span className="text-xs text-muted-foreground">Öffnet</span>
                          <input
                            type="time"
                            value={day.open ?? "09:00"}
                            onChange={(event) => setDayField(key, "open", event.target.value)}
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs text-muted-foreground">Schließt</span>
                          <input
                            type="time"
                            value={day.close ?? "22:00"}
                            onChange={(event) => setDayField(key, "close", event.target.value)}
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          />
                        </label>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs italic text-muted-foreground">
                        An diesem Tag geschlossen
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          <Section
            icon={Bell}
            title="Benachrichtigungen"
            description="Automatische Hinweise bei neuen Ereignissen."
            onSave={saveNotifications}
            saving={savingNotifications}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FieldRow
                label="E-Mail bei neuer Reservierung"
                hint="Sobald eine neue Reservierung eingeht."
                inline
              >
                <Toggle checked={notifyEmail} onChange={setNotifyEmail} />
              </FieldRow>

              <FieldRow
                label="Push bei neuer Bestellung"
                hint="Sobald eine neue Bestellung eingeht."
                inline
              >
                <Toggle checked={notifyPush} onChange={setNotifyPush} />
              </FieldRow>
            </div>
          </Section>
        </div>
      ) : null}
    </div>
  );
}
