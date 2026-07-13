import { AppError } from "@wp-agent-studio/shared";

export type Role = "ADMIN" | "EDITOR" | "VIEWER";
export type Permission = "workspace:manage" | "site:read" | "site:write" | "project:read" | "project:write" | "approval:decide" | "deployment:execute" | "audit:read";
const permissions: Record<Role, ReadonlySet<Permission>> = {
  ADMIN: new Set(["workspace:manage", "site:read", "site:write", "project:read", "project:write", "approval:decide", "deployment:execute", "audit:read"]),
  EDITOR: new Set(["site:read", "site:write", "project:read", "project:write", "approval:decide", "deployment:execute", "audit:read"]),
  VIEWER: new Set(["site:read", "project:read", "audit:read"])
};
export const can = (role: Role, permission: Permission): boolean => permissions[role].has(permission);
export function assertPermission(role: Role, permission: Permission): void {
  if (!can(role, permission)) throw new AppError("FORBIDDEN", "Vous n’avez pas l’autorisation nécessaire", 403);
}
