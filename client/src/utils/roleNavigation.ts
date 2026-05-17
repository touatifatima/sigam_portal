export type RoleValue = string | string[] | null | undefined;

const splitRoleValue = (value: RoleValue): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => String(entry ?? "").split(","));
  }

  return String(value ?? "").split(",");
};

export const normalizeRoles = (value: RoleValue): string[] =>
  splitRoleValue(value)
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);

export const hasRole = (value: RoleValue, targets: string[]): boolean => {
  const roles = normalizeRoles(value);
  return roles.some((role) => targets.includes(role));
};

export const isAdminRole = (value: RoleValue): boolean =>
  hasRole(value, ["admin", "administrateur"]);

export const isOperateurRole = (value: RoleValue): boolean =>
  hasRole(value, ["operateur", "operator"]);

export const isInvestisseurRole = (value: RoleValue): boolean =>
  hasRole(value, ["investisseur", "investor", "user", "utilisateur"]);

export const isUserRole = (value: RoleValue): boolean =>
  hasRole(value, ["user", "utilisateur"]);

export const isCadastreRole = (value: RoleValue): boolean =>
  hasRole(value, ["cadastre"]);

export const getDefaultDashboardPath = (value: RoleValue): string => {
  if (isAdminRole(value)) return "/permis_dashboard/PermisDashboard";
  if (isCadastreRole(value)) return "/cadastre/dashboard";
  if (isOperateurRole(value)) return "/investisseur/InvestorDashboard";
  return "/investisseur/InvestorDashboard";
};

type PostLoginPathOptions = {
  role: RoleValue;
  isEntrepriseVerified?: boolean;
  shouldShowWelcome?: boolean;
};

export const getPostLoginPath = ({
  role,
  isEntrepriseVerified,
  shouldShowWelcome,
}: PostLoginPathOptions): string => {
  if (isAdminRole(role) || isCadastreRole(role)) {
    return getDefaultDashboardPath(role);
  }

  if (isEntrepriseVerified && shouldShowWelcome) {
    return "/investisseur/Identification/bienvenue";
  }

  return "/investisseur/InvestorDashboard";
};

const CADASTRE_ALLOWED_PREFIXES = [
  "/",
  "/cadastre/dashboard",
  "/investisseur/interactive",
  "/carte/carte_public",
  "/notification",
  "/investisseur/profil",
  "/investisseur/parametres",
  "/unauthorized",
];

const CADASTRE_BLOCKED_PREFIXES = [
  "/investisseur/InvestorDashboard",
  "/investisseur/demandes",
  "/investisseur/permis",
  "/investisseur/nouvelle_demande",
  "/investisseur/statistiques",
  "/investisseur/Identification",
  "/operateur",
  "/admin",
  "/admin_panel",
  "/permis_dashboard",
];

export const isCadastreAllowedPath = (pathname: string): boolean => {
  if (!pathname) return false;
  if (CADASTRE_ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }

  if (CADASTRE_BLOCKED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return false;
  }

  return true;
};
