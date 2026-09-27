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

/**
 * Sign-in URL that returns the visitor to where they were headed.
 *
 * Without this, a signed-out visitor who clicks "Become a mentor" signs in and
 * lands on the homepage, having lost both the page and whatever convinced them
 * to click. The sign-in page already reads `callbackUrl`; nothing was passing it.
 *
 * There is no request-path header to derive this from, so a caller that cares
 * passes its own path. Callers that don't stay as they were.
 */
function signInUrl(callbackUrl?: string) {
  return callbackUrl ? `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/sign-in";
}

/**
 * Server-side guard for pages that require sign-in. Redirects to /sign-in
 * otherwise, coming back to `callbackUrl` after a successful sign-in.
 */
export async function requireUser(callbackUrl?: string) {
  const session = await getSession();
  if (!session?.user) redirect(signInUrl(callbackUrl));
  return session.user;
}

/** Server-side guard for role-gated pages. Redirects to / if the role bar isn't met. */
export async function requireRole(min: AppRole, callbackUrl?: string) {
  const session = await getSession();
  if (!session?.user) redirect(signInUrl(callbackUrl));
  if (!hasRole(session.user.role, min)) redirect("/");
  return session.user;
}
