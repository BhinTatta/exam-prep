"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  CalendarDays,
  Compass,
  FileText,
  LayoutDashboard,
  Library,
  LogIn,
  LogOut,
  Menu,
  Mail,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { navLinks, navCta, siteConfig } from "@/config/site";
import { Logo } from "@/components/layout/logo";
import { hasRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

/**
 * Icons for the links in `navLinks`. Keyed by href rather than baked into the
 * site config, which stays free of React imports — a link added there without
 * an entry here falls back to a neutral icon instead of rendering a hole.
 */
const navLinkIcons: Record<string, LucideIcon> = {
  "/mentors": Users,
  "/resources": Library,
  "/qa": MessagesSquare,
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "px-3 pt-5 pb-1 text-[0.6875rem] font-semibold tracking-[0.09em] text-muted-foreground uppercase",
        className
      )}
    >
      {children}
    </p>
  );
}

type NavItemProps = {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  onNavigate: () => void;
};

/**
 * A drawer row, not a `<Button>`. The button scale tops out at 36px and reads
 * at `text-sm`, which is under the 44px touch target a thumb actually needs
 * and visibly smaller than the labels on every other mobile surface.
 */
function NavItem({ href, icon: Icon, label, active, onNavigate }: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-12 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-medium transition-colors outline-none",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "bg-accent text-accent-foreground"
          : "text-foreground/85 hover:bg-muted active:bg-muted dark:hover:bg-muted/50"
      )}
    >
      {active && (
        <span aria-hidden className="absolute -left-2 h-6 w-1 rounded-full bg-primary" />
      )}
      <Icon className={cn("size-[18px] shrink-0", active ? "text-primary" : "text-muted-foreground")} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const role = user?.role;
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu" className="size-10 md:hidden">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      {/* The close button is rendered inline below so it lines up with the
          logo instead of floating over the header at a fixed offset.
          `!` on the width: SheetContent sets it through a `data-[side]`
          variant, which out-specifies a plain `w-*` class. */}
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[min(22rem,86vw)]! p-0"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
            {/* The name still has to reach the accessibility tree — SheetTitle is
                what names the dialog — so it stays, visually replaced by the logo. */}
            <SheetTitle className="sr-only">{siteConfig.name}</SheetTitle>
            <Link href="/" onClick={close} className="inline-flex">
              <Logo variant="lockup" className="h-7" />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close menu"
              onClick={close}
              className="-mr-1 size-10 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </Button>
          </div>

          <nav className="flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
            {user && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-xs">
                <Avatar size="lg">
                  <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
                  <AvatarFallback>{(user.name ?? "U").slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-sm font-semibold">
                    {user.name ?? "Your account"}
                  </p>
                  {user.email && (
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  )}
                </div>
                {role && role !== "USER" && (
                  <Badge variant="secondary" className="shrink-0 px-1.5 text-[10px]">
                    {role}
                  </Badge>
                )}
              </div>
            )}

            <SectionLabel className={user ? undefined : "pt-4"}>Explore</SectionLabel>
            {navLinks.map((link) => (
              <NavItem
                key={link.href}
                href={link.href}
                icon={navLinkIcons[link.href] ?? Compass}
                label={link.label}
                active={isActivePath(pathname, link.href)}
                onNavigate={close}
              />
            ))}

            {user && (
              <>
                <SectionLabel>Your account</SectionLabel>
                <NavItem
                  href="/profile"
                  icon={User}
                  label="My profile"
                  active={isActivePath(pathname, "/profile")}
                  onNavigate={close}
                />
                <NavItem
                  href="/bookings"
                  icon={CalendarDays}
                  label="My sessions"
                  active={isActivePath(pathname, "/bookings")}
                  onNavigate={close}
                />
                {hasRole(role, "MENTOR") ? (
                  <NavItem
                    href="/mentor/dashboard"
                    icon={LayoutDashboard}
                    label="Mentor dashboard"
                    active={isActivePath(pathname, "/mentor")}
                    onNavigate={close}
                  />
                ) : (
                  <NavItem
                    href="/mentors/apply"
                    icon={Sparkles}
                    label="Become a mentor"
                    active={isActivePath(pathname, "/mentors/apply")}
                    onNavigate={close}
                  />
                )}
              </>
            )}

            {/* Showing a link is not access control: /admin and /moderator are
                guarded server-side by requireRole() and by src/proxy.ts. */}
            {hasRole(role, "MODERATOR") && (
              <>
                <SectionLabel>Manage</SectionLabel>
                {hasRole(role, "ADMIN") ? (
                  <NavItem
                    href="/admin"
                    icon={ShieldCheck}
                    label="Admin dashboard"
                    active={isActivePath(pathname, "/admin")}
                    onNavigate={close}
                  />
                ) : (
                  <NavItem
                    href="/moderator"
                    icon={ShieldCheck}
                    label="Moderate"
                    active={isActivePath(pathname, "/moderator")}
                    onNavigate={close}
                  />
                )}
              </>
            )}
            {/* Mirrors the site footer. On mobile that footer is several
                screens down, so these are effectively unreachable without it. */}
            <SectionLabel>More</SectionLabel>
            <NavItem
              href="/contact"
              icon={Mail}
              label="Contact us"
              active={isActivePath(pathname, "/contact")}
              onNavigate={close}
            />
            <NavItem
              href="/terms"
              icon={FileText}
              label="Terms & privacy"
              active={isActivePath(pathname, "/terms")}
              onNavigate={close}
            />
          </nav>

          <div className="shrink-0 space-y-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button asChild size="xl" emphasis="lift" className="w-full">
              <Link href={navCta.href} onClick={close}>
                {navCta.label}
              </Link>
            </Button>
            {user ? (
              <Button
                variant="ghost"
                size="lg"
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={() => {
                  close();
                  void signOut({ callbackUrl: "/" });
                }}
              >
                <LogOut /> Sign out
              </Button>
            ) : (
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link href="/sign-in" onClick={close}>
                  <LogIn /> Sign in
                </Link>
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
