"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Calendar, LayoutDashboard, LogOut, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { hasRole } from "@/lib/roles";

/**
 * The only auth-dependent part of the navbar, resolved on the client.
 *
 * Keeping this off the server is what lets the pages above it prerender:
 * `auth()` reads cookies, and a cookie read anywhere in the root layout opts
 * every route in the app out of static rendering. The session is fetched by
 * SessionProvider after hydration instead, so the HTML itself stays cacheable.
 *
 * Signed-out is the default rather than a loading skeleton: most visitors are
 * signed out, so they see the right thing with no flash, and a real sign-in
 * link ends up in the prerendered HTML for crawlers and no-JS clients. A
 * signed-in user sees it swap to their avatar once the session resolves.
 *
 * The slot keeps a fixed minimum width so that swap never shifts the layout.
 */
export function NavUser() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <div className="flex min-w-[76px] justify-end">
      {!user ? (
        <Link href="/sign-in">
          <Button size="sm">Sign in</Button>
        </Link>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
                <AvatarFallback>{(user.name ?? "U").slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-1">
              <span className="font-medium">{user.name}</span>
              <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {user.role}
                </Badge>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <User className="mr-2 size-4" /> My profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/bookings">
                <Calendar className="mr-2 size-4" /> My sessions
              </Link>
            </DropdownMenuItem>
            {hasRole(user.role, "MENTOR") && (
              <DropdownMenuItem asChild>
                <Link href="/mentor/dashboard">
                  <LayoutDashboard className="mr-2 size-4" /> Mentor dashboard
                </Link>
              </DropdownMenuItem>
            )}
            {hasRole(user.role, "ADMIN") && (
              <DropdownMenuItem asChild>
                <Link href="/admin">
                  <ShieldCheck className="mr-2 size-4" /> Admin dashboard
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href="/mentors/apply">Become a mentor</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/" })}>
              <LogOut className="mr-2 size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
