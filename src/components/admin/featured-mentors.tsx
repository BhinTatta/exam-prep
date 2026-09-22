"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Pin, PinOff, Star, Users } from "lucide-react";
import { setFeaturedRank } from "@/app/admin/actions";

export type FeaturableMentor = {
  id: string;
  featuredRank: number | null;
  reviewCount: number;
  ratingScore: number;
  paidSessions: number;
  examCleared: string;
  user: { name: string | null; image: string | null };
};

/**
 * Who gets pinned to the home page.
 *
 * The home page shows three cards, filled featured-first and then by weighted
 * rating. That default is deliberately boring and usually right — this table
 * is the override for when it isn't: a mentor who photographs well, one
 * running a campaign, one whose exam we're pushing this month.
 *
 * Rank is a number rather than a checkbox because three cards have an order,
 * and which one leads is the decision worth making. Saving busts the home
 * page's cached copy, so the change is live on the next visit rather than
 * whenever the hourly timer next comes round.
 */
export function FeaturedMentors({ mentors }: { mentors: FeaturableMentor[] }) {
  if (mentors.length === 0) return null;

  return (
    <div className="flex flex-col divide-y rounded-xl ring-1 ring-border">
      {mentors.map((mentor) => (
        <MentorRow key={mentor.id} mentor={mentor} />
      ))}
    </div>
  );
}

function MentorRow({ mentor }: { mentor: FeaturableMentor }) {
  const [pending, startTransition] = useTransition();

  function save(rank: number | null) {
    startTransition(async () => {
      try {
        await setFeaturedRank(mentor.id, rank);
        toast.success(
          rank === null
            ? `${mentor.user.name ?? "Mentor"} removed from the home page`
            : `${mentor.user.name ?? "Mentor"} pinned at #${rank}`
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't save that");
      }
    });
  }

  return (
    <form
      className="flex flex-wrap items-center gap-3 p-4"
      action={(formData) => {
        const raw = String(formData.get("rank") ?? "").trim();
        const rank = Number(raw);
        if (!raw || !Number.isInteger(rank) || rank < 1 || rank > 99) {
          toast.error("Enter a whole number from 1 to 99");
          return;
        }
        save(rank);
      }}
    >
      <Avatar className="size-9 shrink-0">
        <AvatarImage src={mentor.user.image ?? undefined} alt="" />
        <AvatarFallback className="text-xs font-semibold">
          {(mentor.user.name ?? "M").slice(0, 1)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-semibold">
          {mentor.user.name ?? "Unnamed mentor"}
          {mentor.featuredRank !== null && (
            <Badge variant="secondary" className="gap-1 text-xs font-normal">
              <Pin className="size-3" /> #{mentor.featuredRank}
            </Badge>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="truncate">{mentor.examCleared || "—"}</span>
          <span className="flex items-center gap-1">
            <Star className="size-3" />
            <span className="tabular-nums">{mentor.ratingScore.toFixed(2)}</span>
            <span className="tabular-nums">({mentor.reviewCount})</span>
          </span>
          <span className="flex items-center gap-1">
            <Users className="size-3" />
            <span className="tabular-nums">{mentor.paidSessions}</span>
          </span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Input
          name="rank"
          type="number"
          min={1}
          max={99}
          inputMode="numeric"
          defaultValue={mentor.featuredRank ?? ""}
          placeholder="—"
          aria-label={`Home page rank for ${mentor.user.name ?? "this mentor"}`}
          className={cn("w-20 tabular-nums")}
        />
        <Button type="submit" size="sm" variant="outline" loading={pending}>
          Pin
        </Button>
        {mentor.featuredRank !== null && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={pending}
            aria-label={`Unpin ${mentor.user.name ?? "this mentor"}`}
            onClick={() => save(null)}
          >
            <PinOff />
          </Button>
        )}
      </div>
    </form>
  );
}
