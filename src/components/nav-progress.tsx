"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Global top progress bar for route transitions.
 *
 * Next.js runs page rendering on the server, so navigating to a dynamic route
 * (most of this app) shows nothing until the server responds — it feels frozen.
 * This bar gives an immediate "something is happening" signal for every
 * navigation. It listens for internal link clicks + back/forward, starts a
 * trickling bar, and completes it when `usePathname()` changes.
 *
 * Navigations triggered imperatively (`router.push`) aren't observable, so
 * `startNavProgress()` is exported for those call sites to call manually.
 */
const starters = new Set<() => void>();

export function startNavProgress() {
  starters.forEach((fn) => fn());
}

export function NavProgress() {
  const pathname = usePathname();
  const prevPath = useRef(pathname);

  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);

  const running = useRef(false);
  const startDelay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideDelay = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    function clearTimers() {
      if (startDelay.current) clearTimeout(startDelay.current);
      if (trickle.current) clearInterval(trickle.current);
      if (hideDelay.current) clearTimeout(hideDelay.current);
      startDelay.current = trickle.current = hideDelay.current = null;
    }

    function begin() {
      if (running.current) return;
      // Debounce: a navigation that resolves in <120ms never flashes the bar.
      startDelay.current = setTimeout(() => {
        running.current = true;
        setVisible(true);
        setWidth(8);
        if (reduce) return;
        trickle.current = setInterval(() => {
          setWidth((w) => (w >= 92 ? w : w + (94 - w) * 0.1 + 0.75));
        }, 220);
      }, 120);
    }

    function onClick(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.getAttribute("rel")?.includes("external")
      ) {
        return;
      }
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }
      begin();
    }

    starters.add(begin);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", begin);

    return () => {
      starters.delete(begin);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", begin);
      clearTimers();
    };
  }, []);

  // Complete the bar when the route actually changes.
  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;

    if (startDelay.current) {
      clearTimeout(startDelay.current);
      startDelay.current = null;
    }
    if (trickle.current) {
      clearInterval(trickle.current);
      trickle.current = null;
    }
    if (!running.current) return;
    running.current = false;

    setWidth(100);
    hideDelay.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 220);
  }, [pathname]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-0.5"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }}
    >
      <div
        className="h-full rounded-r-full bg-primary"
        style={{
          width: `${width}%`,
          transition:
            width === 100
              ? "width 200ms ease"
              : "width 260ms cubic-bezier(.2,.7,.2,1)",
          boxShadow: "0 0 8px var(--primary), 0 0 3px var(--primary)",
        }}
      />
    </div>
  );
}
