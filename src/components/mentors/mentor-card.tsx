import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatSlotWhen } from "@/lib/days";
import { cn } from "@/lib/utils";
import { RatingChip } from "@/components/reviews/rating-summary";
import { formatAir } from "@/lib/mentors/rank";
import { BadgeCheck, CalendarClock, Languages, ArrowRight } from "lucide-react";

export type MentorCardData = {
  id: string;
  rate: number;
  institute: string;
  rank: string | null;
  examCleared: string;
  examYear: number;
  currentRole: string;
  languages: string[];
  story: string;
  // Read straight off the mentor row. Ratings on a listing must never cost a
  // query per card — see the rollup comment in prisma/schema.prisma.
  reviewCount: number;
  ratingSum: number;
  user: { name: string | null; image: string | null };
};

export type MentorCardSlot = { dayOfWeek: number; startTime: string; duration: number } | null;

function firstNameOf(name: string | null) {
  return name?.trim().split(/\s+/)[0] ?? "them";
}

/**
 * The unit that does the actual selling.
 *
 * Deliberate ordering: credential → their own words → practical details →
 * price. A student decides "has this person cleared MY exam and will they get
 * me" long before they weigh ₹400, so price is last and always paired with
 * what it buys. The whole card is one link (stretched over the CTA) so it is a
 * single tab stop with a single accessible name.
 */
export function MentorCard({
  mentor,
  nextSlot,
  highlight = false,
  className,
}: {
  mentor: MentorCardData;
  nextSlot?: MentorCardSlot;
  /** Lifts this card visually — use for the top pick, never for all of them. */
  highlight?: boolean;
  className?: string;
}) {
  const firstName = firstNameOf(mentor.user.name);
  const credential = [formatAir(mentor.rank), mentor.examCleared, mentor.examYear || null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card
      className={cn(
        "relative flex h-full flex-col overflow-hidden transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-lg focus-within:-translate-y-0.5 focus-within:shadow-lg",
        highlight && "border-primary/40 shadow-md ring-1 ring-primary/15",
        className
      )}
    >
      {/* Floating pill rather than a full-width banner: a banner adds height to
          this card only, knocking its header out of line with its neighbours. */}
      {highlight && (
        <span className="absolute top-3 right-3 z-10 rounded-full bg-primary px-2.5 py-1 text-[0.625rem] font-semibold tracking-wide text-primary-foreground uppercase shadow-sm">
          Soonest
        </span>
      )}

      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <Avatar className="size-14 shrink-0 ring-2 ring-background">
            <AvatarImage src={mentor.user.image ?? undefined} alt="" />
            <AvatarFallback className="bg-accent text-base font-semibold text-accent-foreground">
              {(mentor.user.name ?? "M").slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className={cn("truncate font-heading text-lg leading-tight font-semibold", highlight && "pr-16")}>
              {mentor.user.name}
            </p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {mentor.currentRole || mentor.institute}
            </p>
          </div>
        </div>

        {/* The credential strip — the single most load-bearing element on the
            card. Tinted, not muted, because this is the reason to trust them. */}
        {credential && (
          <div className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2">
            <BadgeCheck className="size-4 shrink-0 text-primary" />
            <span className="truncate text-sm font-semibold text-accent-foreground">{credential}</span>
          </div>
        )}

        {mentor.story && (
          <blockquote className="border-l-2 border-primary/30 pl-3 text-[0.9375rem] leading-relaxed text-pretty italic">
            &ldquo;{mentor.story}&rdquo;
          </blockquote>
        )}

        <div className="mt-auto flex flex-col gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <RatingChip rollup={mentor} />
            {mentor.languages.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Languages className="size-3.5" /> {mentor.languages.join(", ")}
              </span>
            )}
            {nextSlot && (
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <CalendarClock className="size-3.5 text-primary" />
                {formatSlotWhen(nextSlot.dayOfWeek, nextSlot.startTime)}
              </span>
            )}
          </div>

          <div className="flex items-end justify-between gap-3 border-t pt-3">
            <div>
              <p className="font-heading text-2xl leading-none font-bold tabular-nums">
                ₹{mentor.rate}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                for a {nextSlot?.duration ?? 45}-min 1:1 call
              </p>
            </div>
            {!nextSlot && (
              <Badge variant="outline" className="text-xs font-normal">
                No open slots
              </Badge>
            )}
          </div>

          <Button
            asChild
            size="xl"
            emphasis={highlight ? "glow" : "lift"}
            className="w-full justify-between"
          >
            {/* Stretched link: covers the card so the whole thing is clickable. */}
            <Link href={`/mentors/${mentor.id}`} className="after:absolute after:inset-0">
              Talk to {firstName}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
