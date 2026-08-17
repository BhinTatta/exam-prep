"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { navLinks, siteConfig } from "@/config/site";
import { hasRole } from "@/lib/auth-helpers";

export function MobileNav({ isSignedIn, role }: { isSignedIn: boolean; role?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>{siteConfig.name}</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
              <Button variant="ghost" className="w-full justify-start">
                {link.label}
              </Button>
            </Link>
          ))}
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
