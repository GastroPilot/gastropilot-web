export type WebAdminRole =
  | "platform_admin"
  | "platform_support"
  | "platform_analyst"
  | "owner"
  | "manager"
  | "staff"
  | "kitchen";

const DIRECT_WEB_ADMIN_ROLES = new Set<WebAdminRole>([
  "platform_admin",
  "owner",
]);

const IMPERSONATION_WEB_ADMIN_ROLES = new Set<WebAdminRole>([
  "platform_support",
  "platform_analyst",
]);

const MANAGER_OR_ABOVE_ROLES = new Set<WebAdminRole>([
  "platform_admin",
  "owner",
]);

const OWNER_OR_ABOVE_ROLES = new Set<WebAdminRole>([
  "platform_admin",
  "owner",
]);

type RouteRule = {
  prefix: string;
  roles: Set<WebAdminRole>;
};

const ADMIN_ROUTE_RULES: RouteRule[] = [
  {
    prefix: "/admin/platform-admins",
    roles: new Set<WebAdminRole>([
      "platform_admin",
      "platform_support",
      "platform_analyst",
    ]),
  },
  { prefix: "/admin/tenants", roles: new Set<WebAdminRole>(["platform_admin"]) },
  { prefix: "/admin/guests", roles: new Set<WebAdminRole>(["platform_admin"]) },
  { prefix: "/admin/reservations", roles: new Set<WebAdminRole>(["platform_admin"]) },
  { prefix: "/admin/reviews", roles: new Set<WebAdminRole>(["platform_admin"]) },
  { prefix: "/admin/billing", roles: new Set<WebAdminRole>(["platform_admin", "owner"]) },
  { prefix: "/admin/devices", roles: new Set<WebAdminRole>(["platform_admin", "owner"]) },
  {
    prefix: "/admin/operators",
    roles: new Set<WebAdminRole>(["platform_admin", "owner"]),
  },
  {
    prefix: "/admin/tenant-settings",
    roles: new Set<WebAdminRole>(["platform_admin", "owner"]),
  },
  {
    prefix: "/admin/menu",
    roles: new Set<WebAdminRole>(["platform_admin", "owner"]),
  },
  { prefix: "/admin", roles: new Set<WebAdminRole>(["platform_admin"]) },
];

function toWebAdminRole(value: string | null | undefined): WebAdminRole | null {
  if (!value) return null;
  if (DIRECT_WEB_ADMIN_ROLES.has(value as WebAdminRole)) return value as WebAdminRole;
  if (IMPERSONATION_WEB_ADMIN_ROLES.has(value as WebAdminRole)) {
    return value as WebAdminRole;
  }
  return null;
}

function routeMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPlatformAdminRole(role: string | null | undefined): boolean {
  return role === "platform_admin";
}

export function isManagerOrAboveRole(role: string | null | undefined): boolean {
  return role ? MANAGER_OR_ABOVE_ROLES.has(role as WebAdminRole) : false;
}

export function isOwnerOrAboveRole(role: string | null | undefined): boolean {
  return role ? OWNER_OR_ABOVE_ROLES.has(role as WebAdminRole) : false;
}

export function canManageOperatorAccounts(role: string | null | undefined): boolean {
  return isOwnerOrAboveRole(role);
}

export function canEditTenantSlug(role: string | null | undefined): boolean {
  return isPlatformAdminRole(role);
}

export function canLoginToWebAdminUi(role: string | null | undefined): boolean {
  return role ? DIRECT_WEB_ADMIN_ROLES.has(role as WebAdminRole) : false;
}

export function canUseWebAdminUi(
  role: string | null | undefined,
  isImpersonating: boolean
): boolean {
  const normalized = toWebAdminRole(role);
  if (!normalized) return false;
  if (DIRECT_WEB_ADMIN_ROLES.has(normalized)) return true;
  return isImpersonating && IMPERSONATION_WEB_ADMIN_ROLES.has(normalized);
}

export function canAccessAdminRoute(
  pathname: string,
  role: string | null | undefined
): boolean {
  const normalizedRole = toWebAdminRole(role);
  if (!normalizedRole) return false;

  const rule = ADMIN_ROUTE_RULES.find(({ prefix }) => routeMatches(pathname, prefix));
  if (!rule) return false;

  return rule.roles.has(normalizedRole);
}

export function getDefaultAdminRoute(role: string | null | undefined): string | null {
  if (role === "platform_admin") return "/admin";
  if (role === "owner") return "/admin/tenant-settings";
  if (role === "platform_support" || role === "platform_analyst") {
    return "/admin/platform-admins";
  }
  return null;
}
