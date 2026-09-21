"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { hasRole } from "@/lib/roles";

/**
 * Desktop nav links that only exist for elevated roles. Client-side for the
 * same reason as NavUser — see the note there. These render nothing until the
 * session resolves, which only affects admins and moderators.
 *
 * Showing a link is not access control: /admin and /moderator are guarded
 * server-side by requireRole() in their layouts, and by src/proxy.ts.
 */
export function NavRoleLinks() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  if (!role) return null;

  if (hasRole(role, "ADMIN")) {
    return (
      <Link href="/admin">
        <Button variant="ghost" size="sm">
          Admin
        </Button>
      </Link>
    );
  }

  if (hasRole(role, "MODERATOR")) {
    return (
      <Link href="/moderator">
        <Button variant="ghost" size="sm">
          Moderate
        </Button>
      </Link>
    );
  }

  return null;
}
