import "server-only";
import { revalidatePath } from "next/cache";

/**
 * On-demand cache busting for the ISR-cached pages.
 *
 * ---------------------------------------------------------------------------
 * How the home page is cached
 * ---------------------------------------------------------------------------
 * `src/app/page.tsx` sets `export const revalidate = 3600`, so the page is
 * rendered once, stored, and served as static HTML from the CDN. There are
 * exactly two ways that stored copy is ever replaced:
 *
 * 1. THE TIMER (the only one in use today). Stale-while-revalidate: once the
 *    stored copy is older than an hour, the next request still gets the OLD
 *    copy immediately, and a fresh render is kicked off in the background.
 *    Nobody waits. When that render finishes it replaces the stored copy, and
 *    everyone after that gets the new one. Worst case a visitor sees content
 *    up to roughly an hour old — never a slow page.
 *
 * 2. ON DEMAND — these helpers. `revalidatePath()` throws the stored copy away
 *    immediately. It does NOT re-render on the spot: the *next* request for
 *    that path is a cache miss, so that one visitor waits for a fresh render
 *    (a database round-trip), and their render becomes the new stored copy
 *    that everyone else is served. So it is cheap to call, but it does hand
 *    the bill to whoever arrives next. Calling it in a loop, or on something
 *    that happens often, means paying a full render every time.
 *
 *    Measured locally against a real database, to give the shape of it:
 *
 *      steady state            x-nextjs-cache: HIT    ~3ms
 *      first hit after a bust  x-nextjs-cache: MISS  ~46ms   <- one visitor
 *      every hit after that    x-nextjs-cache: HIT    ~3ms
 *
 *    A change written straight to the database is NOT picked up until one of
 *    these two things happens — that is the whole point of the cache, and the
 *    thing to remember when a row is edited by hand and the site 'doesn't
 *    update'.
 *
 * ---------------------------------------------------------------------------
 * Where you can call these
 * ---------------------------------------------------------------------------
 * Server Actions ("use server") and Route Handlers ONLY. `revalidatePath` does
 * not work in Client Components or in `src/proxy.ts`. Called from a Server
 * Action it also refreshes the UI of anyone currently looking at that path.
 *
 * These are deliberately plain functions rather than a "use server" module:
 * every export of a "use server" file becomes an endpoint the browser can
 * call, and an unauthenticated "wipe the home page cache" endpoint is not
 * something worth having. Call these from inside an action that has already
 * done its own `requireRole()` check.
 *
 * ---------------------------------------------------------------------------
 * Nothing calls these yet — on purpose
 * ---------------------------------------------------------------------------
 * The home page currently refreshes on the hourly timer alone. They exist so
 * that when something *should* update the front page immediately — a change to
 * which mentors are featured, an edit to the headline copy, a new diagnostic
 * test going live — the mechanism is already here and documented, rather than
 * being rediscovered under pressure.
 *
 * A mentor being verified is intentionally NOT one of those moments: who
 * appears on the front page is a curation decision, not a consequence of
 * approval.
 */

/**
 * Drop the cached home page. The next visitor renders it fresh, and that
 * render becomes the copy everyone else is served.
 *
 * Call after changing what the home page is built from — which mentors are
 * featured, or which diagnostic test is the published one.
 */
export function revalidateHomePage(): void {
  // Literal path, so no `type` argument — see the revalidatePath reference.
  revalidatePath("/");
}

/**
 * Drop every cached page whose content comes from mentor records.
 *
 * Right now that is just the home page: `/mentors` and `/mentors/[id]` are
 * still rendered per request (`force-dynamic`), so they always read live data
 * and have no cache to clear. If either is moved to ISR later, add it here so
 * callers don't have to remember which pages are cached this week.
 */
export function revalidateMentorPages(): void {
  revalidateHomePage();
}
