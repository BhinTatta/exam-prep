"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { navLinks, navCta, siteConfig } from "@/config/site";
import { Logo } from "@/components/layout/logo";
import { hasRole } from "@/lib/roles";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isSignedIn = !!session?.user;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          {/* The name still has to reach the accessibility tree — SheetTitle is
              what names the dialog — so it stays, visually replaced by the logo. */}
          <SheetTitle className="sr-only">{siteConfig.name}</SheetTitle>
          <Logo variant="lockup" className="h-7" />
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4">
          <Link href={navCta.href} onClick={() => setOpen(false)} className="mb-2">
            <Button size="xl" emphasis="lift" className="w-full">
              {navCta.label}
            </Button>
          </Link>
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
              <Button variant="ghost" className="w-full justify-start">
                {link.label}
              </Button>
            </Link>
          ))}
          {isSignedIn && (
            <>
              <Link href="/profile" onClick={() => setOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">
                  My profile
                </Button>
              </Link>
              <Link href="/bookings" onClick={() => setOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">
                  My sessions
                </Button>
              </Link>
            </>
          )}
          {isSignedIn && hasRole(role, "ADMIN") && (
            <Link href="/admin" onClick={() => setOpen(false)}>
              <Button variant="ghost" className="w-full justify-start">
                Admin
              </Button>
            </Link>
          )}
          {isSignedIn && hasRole(role, "MENTOR") && (
            <Link href="/mentor/dashboard" onClick={() => setOpen(false)}>
              <Button variant="ghost" className="w-full justify-start">
                Mentor dashboard
              </Button>
            </Link>
          )}
          {!isSignedIn && (
            <Link href="/sign-in" onClick={() => setOpen(false)}>
              <Button className="w-full justify-start">Sign in</Button>
            </Link>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
