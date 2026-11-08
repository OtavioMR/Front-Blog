export type UserRole = "READER" | "AUTHOR" | "ADMIN" | "SUPER_ADMIN";

export enum Capability {
  ARTICLE_CREATE = "article:create",
  ARTICLE_EDIT_OWN = "article:edit:own",
  ARTICLE_PUBLISH_OWN = "article:publish:own",
  COMMENT_CREATE = "comment:create",
  ADMIN_ACCESS = "admin:access",
  ADMIN_MODERATE = "admin:moderate",
  ADMIN_MANAGE_USERS = "admin:manage_users",
  SUPERADMIN_MANAGE_ROLES = "superadmin:manage_roles",
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  READER: 1,
  AUTHOR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export const ROLE_CAPABILITIES: Record<UserRole, readonly Capability[]> = {
  READER: [Capability.COMMENT_CREATE],
  AUTHOR: [
    Capability.COMMENT_CREATE,
    Capability.ARTICLE_CREATE,
    Capability.ARTICLE_EDIT_OWN,
    Capability.ARTICLE_PUBLISH_OWN,
  ],
  ADMIN: [
    Capability.COMMENT_CREATE,
    Capability.ARTICLE_CREATE,
    Capability.ARTICLE_EDIT_OWN,
    Capability.ARTICLE_PUBLISH_OWN,
    Capability.ADMIN_ACCESS,
    Capability.ADMIN_MODERATE,
    Capability.ADMIN_MANAGE_USERS,
  ],
  SUPER_ADMIN: [
    Capability.COMMENT_CREATE,
    Capability.ARTICLE_CREATE,
    Capability.ARTICLE_EDIT_OWN,
    Capability.ARTICLE_PUBLISH_OWN,
    Capability.ADMIN_ACCESS,
    Capability.ADMIN_MODERATE,
    Capability.ADMIN_MANAGE_USERS,
    Capability.SUPERADMIN_MANAGE_ROLES,
  ],
};

export function hasCapability(
  role: string | null | undefined,
  capability: Capability,
): boolean {
  if (!role) return false;
  const upperRole = role.toUpperCase() as UserRole;
  const caps = ROLE_CAPABILITIES[upperRole];
  return caps ? caps.includes(capability) : false;
}

export function roleSatisfies(
  userRole: string | null | undefined,
  requiredRole: string,
): boolean {
  if (!userRole) return false;
  const userLevel = ROLE_HIERARCHY[userRole.toUpperCase() as UserRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole.toUpperCase() as UserRole] ?? 0;
  return userLevel >= requiredLevel;
}

export function canWriteArticles(role: string | null | undefined): boolean {
  return hasCapability(role, Capability.ARTICLE_CREATE);
}

export function canManageSeries(role: string | null | undefined): boolean {
  return hasCapability(role, Capability.ARTICLE_CREATE);
}

export function canAccessAdmin(role: string | null | undefined): boolean {
  return hasCapability(role, Capability.ADMIN_ACCESS);
}

export function canManageRoles(role: string | null | undefined): boolean {
  return hasCapability(role, Capability.SUPERADMIN_MANAGE_ROLES);
}

export function formatRoleName(role: string | null | undefined): string {
  switch (role?.toUpperCase()) {
    case "SUPER_ADMIN":
      return "Superadministrador";
    case "ADMIN":
      return "Administrador";
    case "AUTHOR":
      return "Autor";
    case "READER":
      return "Leitor";
    default:
      return role || "Desconhecido";
  }
}
