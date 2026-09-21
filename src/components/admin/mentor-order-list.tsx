"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatAir } from "@/lib/mentors/rank";
import { setMentorDisplayOrder } from "@/app/admin/actions";
import { ArrowDown, ArrowUp, Pin, PinOff, RotateCcw } from "lucide-react";

export type OrderableMentor = {
  id: string;
  rank: string | null;
  examCleared: string;
  examYear: number;
  currentRole: string;
  institute: string;
  displayOrder: number | null;
  reviewCount: number;
  user: { name: string | null };
};

function sameOrder(a: OrderableMentor[], b: string[]) {
  return a.length === b.length && a.every((m, i) => m.id === b[i]);
}

/**
 * Hand-picked ordering for the mentor listings.
 *
 * The automatic order optimises for availability, which is right once there
 * are enough mentors for availability to be the differentiator. Until then the
 * admin knows which three mentors actually convert, and this is where they say
 * so. Pinning is explicitly a small, visible list rather than a score on every
 * mentor: the whole value is that you can see, in order, exactly what a student
 * sees first.
 *
 * Edits are local until Save, and Save sends the entire pinned list — see
 * setMentorDisplayOrder for why a whole list beats one position at a time.
 */
export function MentorOrderList({ mentors }: { mentors: OrderableMentor[] }) {
  const initialPinnedIds = mentors.filter((m) => m.displayOrder !== null).map((m) => m.id);
  const [pinned, setPinned] = useState(() =>
    mentors.filter((m) => m.displayOrder !== null)
  );
  const [unpinned, setUnpinned] = useState(() =>
    mentors.filter((m) => m.displayOrder === null)
  );
  const [isSaving, startSaving] = useTransition();

  const dirty = !sameOrder(pinned, initialPinnedIds);

  function move(index: number, by: -1 | 1) {
    const target = index + by;
    if (target < 0 || target >= pinned.length) return;
    const next = [...pinned];
    [next[index], next[target]] = [next[target], next[index]];
    setPinned(next);
  }

  function pin(mentor: OrderableMentor) {
    setPinned([...pinned, mentor]);
    setUnpinned(unpinned.filter((m) => m.id !== mentor.id));
  }

  function unpin(mentor: OrderableMentor) {
    setPinned(pinned.filter((m) => m.id !== mentor.id));
    // Back to the top of the unpinned pile, where it's easy to undo a misclick.
    setUnpinned([mentor, ...unpinned]);
  }

  function reset() {
    setPinned(mentors.filter((m) => m.displayOrder !== null));
    setUnpinned(mentors.filter((m) => m.displayOrder === null));
  }

  function save() {
    startSaving(async () => {
      try {
        await setMentorDisplayOrder(pinned.map((m) => m.id));
        toast.success(
          pinned.length === 0
            ? "Order cleared — listings are back to soonest-slot order"
            : `Order saved — ${pinned.length} mentor${pinned.length === 1 ? "" : "s"} pinned`
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save the order");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Pinned to the top</p>
            <p className="text-xs text-muted-foreground">
              Shown first on the home page, /mentors and test results — in this order.
            </p>
          </div>
          <Badge variant="secondary">{pinned.length}</Badge>
        </div>

        {pinned.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Nothing pinned. Every mentor is ordered by whoever has the soonest open slot.
          </p>
        ) : (
          <ol className="divide-y">
            {pinned.map((mentor, i) => (
              <li key={mentor.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-6 shrink-0 font-heading text-lg font-bold tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <MentorLine mentor={mentor} />
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label={`Move ${mentor.user.name ?? "mentor"} up`}
                    disabled={i === 0 || isSaving}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label={`Move ${mentor.user.name ?? "mentor"} down`}
                    disabled={i === pinned.length - 1 || isSaving}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Unpin ${mentor.user.name ?? "mentor"}`}
                    disabled={isSaving}
                    onClick={() => unpin(mentor)}
                  >
                    <PinOff className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="rounded-xl border">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Everyone else</p>
          <p className="text-xs text-muted-foreground">
            Listed below the pinned mentors, soonest open slot first.
          </p>
        </div>
        {unpinned.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Every verified mentor is pinned.</p>
        ) : (
          <ul className="divide-y">
            {unpinned.map((mentor) => (
              <li key={mentor.id} className="flex items-center gap-3 px-4 py-3">
                <MentorLine mentor={mentor} />
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5"
                  disabled={isSaving}
                  onClick={() => pin(mentor)}
                >
                  <Pin className="size-4" /> Pin
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button loading={isSaving} loadingText="Saving…" disabled={!dirty} onClick={save}>
          Save order
        </Button>
        <Button variant="ghost" className="gap-1.5" disabled={!dirty || isSaving} onClick={reset}>
          <RotateCcw className="size-4" /> Discard changes
        </Button>
        {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
      </div>
    </div>
  );
}

function MentorLine({ mentor }: { mentor: OrderableMentor }) {
  const credential = [formatAir(mentor.rank), mentor.examCleared, mentor.examYear || null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium">{mentor.user.name ?? "Unnamed mentor"}</p>
      <p className="truncate text-xs text-muted-foreground">
        {[credential, mentor.currentRole || mentor.institute].filter(Boolean).join(" — ")}
        {mentor.reviewCount > 0 &&
          ` · ${mentor.reviewCount} review${mentor.reviewCount === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}
