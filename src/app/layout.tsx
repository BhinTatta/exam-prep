import type { Metadata } from "next";
import { Geist, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { siteConfig, brandIcons } from "@/config/site";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { TermsGate } from "@/components/terms-gate";
import { NavProgress } from "@/components/nav-progress";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Display / heading face — a narrow, lightly editorial grotesque (Lattice).
const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  // Required for the generated OG images (e.g. a mentor profile's
  // opengraph-image) to resolve to absolute URLs — a relative og:image is
  // ignored by every social preview crawler, which is exactly the surface the
  // share button exists to feed.
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: `%s · ${siteConfig.name}` },
  description: siteConfig.description,
  // Declared here rather than through the app/icon.* file convention so that
  // every brand asset stays in /public/brand — one folder to swap. See
  // public/brand/README.md.
  icons: {
    icon: [
      { url: brandIcons.favicon, sizes: "any" },
      { url: brandIcons.png192, sizes: "192x192", type: "image/png" },
      { url: brandIcons.png512, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: brandIcons.apple, sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${schibsted.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <NavProgress />
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <TermsGate />
        </Providers>
      </body>
    </html>
  );
}
