import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasRole, type AppRole } from "@/lib/roles";

export type { AppRole };
export { hasRole };

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
