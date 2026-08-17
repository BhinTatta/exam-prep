import Link from "next/link";
import { requireRole } from "@/lib/auth-helpers";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/mentors", label: "Mentor approvals" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/moderation", label: "Moderation" },
  { href: "/admin/sessions", label: "Sessions & payouts" },
  { href: "/admin/users", label: "Users" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("ADMIN");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 lg:flex-row">
      <aside className="lg:w-48 lg:shrink-0">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "shrink-0 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
