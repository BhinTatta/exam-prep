import Link from "next/link";
import { auth, signOut } from "@/auth";
import { siteConfig, navLinks } from "@/config/site";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
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
import { hasRole } from "@/lib/auth-helpers";
import { GraduationCap, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { MobileNav } from "@/components/layout/mobile-nav";

export async function Navbar() {
  const session = await auth();
  const user = session?.user;

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
            {user && hasRole(user.role, "ADMIN") && (
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  Admin
                </Button>
              </Link>
            )}
            {user && hasRole(user.role, "MODERATOR") && !hasRole(user.role, "ADMIN") && (
              <Link href="/moderator">
                <Button variant="ghost" size="sm">
                  Moderate
                </Button>
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
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
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full">
                      <LogOut className="mr-2 size-4" /> Sign out
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <MobileNav isSignedIn={!!user} role={user?.role} />
        </div>
      </div>
    </header>
  );
}
