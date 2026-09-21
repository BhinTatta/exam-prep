"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_RATING, RATING_LABELS } from "@/lib/reviews";

/**
 * The rating control.
 *
 * Built on real radio inputs rather than buttons with ARIA: a radio group
 * already gives arrow-key navigation, a single tab stop and the right
 * announcement, and none of that has to be reimplemented. Hover and keyboard
 * focus both drive the same preview, so the meaning of the star you are about
 * to pick is readable before you commit to it — the sentence under the row is
 * the point, not decoration.
 */
export function StarInput({
  value,
  onChange,
  disabled,
  name = "rating",
  className,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
  name?: string;
  className?: string;
}) {
  const [preview, setPreview] = useState(0);
  const shown = preview || value;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <fieldset
        className="flex w-fit items-center gap-0.5"
        onMouseLeave={() => setPreview(0)}
        disabled={disabled}
      >
        <legend className="sr-only">Your rating</legend>
        {Array.from({ length: MAX_RATING }, (_, i) => i + 1).map((n) => (
          <label
            key={n}
            onMouseEnter={() => setPreview(n)}
            className={cn(
              "rounded-md p-1 transition-transform",
              "focus-within:ring-3 focus-within:ring-ring/50 focus-within:outline-none",
              disabled ? "cursor-default" : "cursor-pointer hover:scale-110 active:scale-95"
            )}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              onFocus={() => setPreview(n)}
              onBlur={() => setPreview(0)}
              disabled={disabled}
              className="sr-only"
            />
            <Star
              className={cn(
                "size-8 transition-colors duration-150",
                n <= shown
                  ? "fill-highlight text-highlight"
                  : "text-muted-foreground/30 hover:text-muted-foreground/50"
              )}
            />
            <span className="sr-only">
              {n} {n === 1 ? "star" : "stars"} — {RATING_LABELS[n]}
            </span>
          </label>
        ))}
      </fieldset>

      {/* Reserved height: the row below must not jump as the label appears. */}
      <p
        aria-hidden
        className={cn(
          "min-h-5 pl-1 text-sm font-medium transition-opacity",
          shown ? "text-foreground opacity-100" : "opacity-0"
        )}
      >
        {shown ? RATING_LABELS[shown] : " "}
      </p>
    </div>
  );
}
