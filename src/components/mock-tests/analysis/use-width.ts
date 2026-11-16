"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The rendered width of an element, tracked as it resizes. Charts draw in real
 * pixels (rather than scaling a viewBox) so text and stroke widths stay the
 * same size on a phone as on a desktop.
 */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
