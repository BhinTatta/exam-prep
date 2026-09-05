export type AppRole = "USER" | "MODERATOR" | "MENTOR" | "ADMIN";

const ROLE_RANK: Record<AppRole, number> = {
  USER: 0,
  MENTOR: 1,
  MODERATOR: 2,
  ADMIN: 3,
};

export function hasRole(role: string | undefined, min: AppRole): boolean {
  if (!role) return false;
  return (ROLE_RANK[role as AppRole] ?? -1) >= ROLE_RANK[min];
}
