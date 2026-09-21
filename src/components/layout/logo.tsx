import Image from "next/image";
import { brandAssets, siteConfig, type BrandVariant } from "@/config/site";
import { cn } from "@/lib/utils";

type LogoProps = {
  /** Which lock-up to render. See public/brand/README.md for what each is for. */
  variant?: BrandVariant;
  /** Sizing classes for the rendered image, e.g. "h-8 w-auto". */
  className?: string;
  /** Set on above-the-fold logos so the browser doesn't lazy-load them. */
  priority?: boolean;
};

/**
 * The site logo, in whichever theme is active.
 *
 * Both variants are rendered and one is hidden with a `dark:` class rather
 * than picking a file from `useTheme()`. Reading the theme in JS would mean
 * rendering nothing (or the wrong logo) until hydration, which is a visible
 * flash on the very first paint of every page — and it would force this into
 * a client component sitting in the root layout. CSS switches before paint.
 *
 * The pair shares one canvas size, so the swap cannot shift layout.
 */
export function Logo({ variant = "lockup", className, priority }: LogoProps) {
  const asset = brandAssets[variant];
  // The wrapper carries the accessible name, so the images themselves are
  // decorative — otherwise assistive tech announces the brand twice, once for
  // each theme variant.
  const shared = { width: asset.width, height: asset.height, priority, "aria-hidden": true as const };

  return (
    <span role="img" aria-label={siteConfig.name} className={cn("inline-flex", className)}>
      <Image {...shared} alt="" src={asset.light} className="h-full w-auto dark:hidden" />
      <Image {...shared} alt="" src={asset.dark} className="hidden h-full w-auto dark:block" />
    </span>
  );
}
