import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { MentorCard } from "@/components/mentors/mentor-card";
import { daysUntilSlot, pickNextSlot } from "@/lib/days";
import { Users, ShieldCheck, Wallet, Undo2 } from "lucide-react";

export const metadata = {
  title: "Talk to someone who cleared it",
  description:
    "1:1 video sessions with mentors who sat the same exam and passed it. Pay per session, full refund if they don't show.",
};
export const dynamic = "force-dynamic";

/** Mentors with no open slot sort last. */
function slotDistance(slot: { dayOfWeek: number; startTime: string } | null) {
  return slot ? daysUntilSlot(slot.dayOfWeek, slot.startTime) : Number.MAX_SAFE_INTEGER;
}

export default async function MentorsPage() {
  const profiles = await prisma.mentorProfile.findMany({
    where: { verified: true },
    include: {
      user: { select: { name: true, image: true } },
      availability: { where: { isBooked: false } },
    },
    orderBy: { createdAt: "desc" },
  });

  const mentors = profiles
    .map((m) => ({ mentor: m, nextSlot: pickNextSlot(m.availability) }))
    .sort((a, b) => slotDistance(a.nextSlot) - slotDistance(b.nextSlot));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="flex flex-col items-center gap-4 text-center">
        <h1 className="max-w-2xl text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Talk to someone who was exactly where you are
        </h1>
        <p className="max-w-xl text-pretty text-muted-foreground">
          Every mentor here sat the same exam you&apos;re preparing for — and cleared it. One 45-minute
          video call is usually worth more than another month of guessing what matters.
        </p>
      </header>

      {/* Objection handling, up front: is this real, what does it cost me, what
          if it goes wrong. Cheaper to answer here than to lose the booking. */}
      <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
        <Assurance icon={ShieldCheck} title="Verified by a human">
          Rank card and ID checked before a profile goes live.
        </Assurance>
        <Assurance icon={Wallet} title="Pay per session">
          No subscription, no package, no upsell call.
        </Assurance>
        <Assurance icon={Undo2} title="They don't show, you don't pay">
          Full refund if a mentor misses the call. No argument.
        </Assurance>
      </div>

      {mentors.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={Users}
            title="No verified mentors yet"
            description="We verify every mentor by hand, so this list fills up slowly. Check back soon."
          />
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {mentors.map(({ mentor, nextSlot }, i) => (
            <MentorCard
              key={mentor.id}
              mentor={mentor}
              nextSlot={nextSlot}
              highlight={i === 0 && !!nextSlot}
            />
          ))}
        </div>
      )}

      <div className="mt-14 flex flex-col items-center gap-3 border-t pt-10 text-center">
        <p className="font-heading text-lg font-semibold">Cleared the exam yourself?</p>
        <p className="max-w-md text-sm text-muted-foreground">
          You remember what nobody told you in time. Set your own rate and hours.
        </p>
        <Button asChild variant="outline" size="lg">
          <Link href="/mentors/apply">Become a mentor</Link>
        </Button>
      </div>
    </div>
  );
}

function Assurance({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <Icon className="size-4.5 text-primary" />
      <p className="mt-1 text-sm font-semibold">{title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
