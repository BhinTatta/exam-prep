import { auth } from "@/auth";
import { redirect } from "next/navigation";

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

/** Server-side guard for pages that require sign-in. Redirects to /sign-in otherwise. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  return session.user;
}

/** Server-side guard for role-gated pages. Redirects to / if the role bar isn't met. */
export async function requireRole(min: AppRole) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!hasRole(session.user.role, min)) redirect("/");
  return session.user;
}
