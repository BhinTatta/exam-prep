import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { siteConfig, navLinks } from "@/config/site";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavRoleLinks } from "@/components/layout/nav-role-links";
import { NavUser } from "@/components/layout/nav-user";

/**
 * Deliberately free of `auth()`. This renders in the root layout, so any
 * cookie read here would make every route in the app dynamic — including the
 * landing page, which has no per-user content at all. The auth-dependent
 * pieces are isolated in NavRoleLinks and NavUser and resolve on the client.
 */
export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <GraduationCap className="size-5 text-primary" />
            <span>{siteConfig.name}</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button variant="ghost" size="sm">
                  {link.label}
                </Button>
              </Link>
            ))}
            <NavRoleLinks />
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NavUser />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
