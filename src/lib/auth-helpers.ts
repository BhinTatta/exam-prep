import { cache } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasRole, type AppRole } from "@/lib/roles";

export type { AppRole };
export { hasRole };

/**
 * Request-scoped session read.
 *
 * `auth()` is not deduplicated by next-auth, and our session callback queries
 * the user row on every call (so role changes apply immediately). Without this
 * wrapper a page that calls requireUser() and then reads the session again
 * costs two round-trips to Neon for identical data. React's `cache` collapses
 * them to one per request.
 */
export const getSession = cache(async () => auth());

/** Server-side guard for pages that require sign-in. Redirects to /sign-in otherwise. */
export async function requireUser() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  return session.user;
}

/** Server-side guard for role-gated pages. Redirects to / if the role bar isn't met. */
export async function requireRole(min: AppRole) {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  if (!hasRole(session.user.role, min)) redirect("/");
  return session.user;
}
