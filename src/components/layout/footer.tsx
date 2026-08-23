import Link from "next/link";
import { siteConfig } from "@/config/site";

export function Footer() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <p>
          © {new Date().getFullYear()} {siteConfig.name}. Free, always. No ads.
        </p>
        <div className="flex items-center gap-4">
          <Link href="/resources" className="hover:text-foreground">
            Resources
          </Link>
          <Link href="/qa" className="hover:text-foreground">
            Q&amp;A
          </Link>
          <Link href="/mentors" className="hover:text-foreground">
            Mentors
          </Link>
          <Link href="/contact" className="hover:text-foreground">
            Contact
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
