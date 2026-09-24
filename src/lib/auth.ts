export const ROLE_COOKIE = "nd_role";

export type Role = "admin" | "team";

export function isValidRole(value: string | undefined | null): value is Role {
  return value === "admin" || value === "team";
}
