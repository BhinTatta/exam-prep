import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { MentorApplyForm } from "@/components/mentors/mentor-apply-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sessionPricing } from "@/config/site";
import { ArrowRight, BadgeCheck, EyeOff, Undo2 } from "lucide-react";

export const metadata = {
  title: "Become a mentor",
  description:
    "You already answer these messages. Take the call properly, for someone who turned up — and get paid for the time.",
};

export default async function MentorApplyPage() {
  // Signed-out visitors come back here after signing in, instead of being
  // dropped on the homepage having lost the page that convinced them to click.
  const user = await requireUser("/mentors/apply");
  const existing = await prisma.mentorProfile.findUnique({ where: { userId: user.id } });

  if (existing) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <PageHeader title="Become a mentor" />
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">You&apos;ve already applied</p>
                <p className="text-sm text-muted-foreground">{existing.institute}</p>
              </div>
              <Badge variant={existing.verified ? "default" : "secondary"}>
                {existing.verified ? "Verified" : "Pending review"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {existing.verified
                ? "Your profile is live. Set your hours and share your link from the dashboard."
                : "A person is checking your proof. You'll be able to set your hours as soon as that's done."}
            </p>
            <Button asChild variant="outline" className="self-start">
              <Link href="/mentor/dashboard">
                Go to your dashboard <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      {/* The pitch runs above the form rather than beside it, and it is kept to
          five short blocks on purpose. Anyone who lands here already knows they
          cleared the exam; what they don't know is that this is worth their
          Sunday. Past roughly a screen and a half of copy that stops being
          persuasion and starts being a wall. */}
      <header className="flex flex-col gap-3">
        <h1 className="text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          You already answer these messages.
        </h1>
        <p className="text-pretty text-muted-foreground">
          The same questions every week, from juniors who got your number from somewhere. You reply
          when you can, and you feel bad about the ones you don&apos;t.
        </p>
      </header>

      <div className="mt-10 flex flex-col gap-7 border-y py-8">
        <Pitch title="The ones you leave on read">
          It isn&apos;t that you don&apos;t want to answer. A real answer takes half an hour, and you
          have your own semester to survive. And the generic version — how to revise, which books, how
          many hours — is already on YouTube in better detail than you&apos;d type at 1am. What
          isn&apos;t on YouTube is someone looking at <em>this</em> student&apos;s last mock and
          telling them what applies to them.
        </Pitch>

        <Pitch title="You were this student">
          Most people here are preparing the way you did. A small town, a batch of 200, nobody at home
          who has done this before. One honest {sessionPricing.durationMinutes} minutes from someone
          who actually got through can change how a whole year goes. That is not a small thing to be
          able to give.
        </Pitch>

        <Pitch title="And you’re paid for the time">
          ₹{sessionPricing.studentPays} from the student, ₹{sessionPricing.mentorReceives} to you, for
          a {sessionPricing.durationMinutes}-minute call. Being paid isn&apos;t the opposite of
          helping — it&apos;s what makes it possible to do this on a Sunday instead of feeling guilty
          about an hour you didn&apos;t have. Take the calls you want, when you want.
        </Pitch>

        <Pitch title="Next time someone messages you, send your link">
          Instead of typing the same reply again, share your profile. The ones who are serious book a
          slot. The ones who messaged twenty mentors don&apos;t. You stop doing that sorting yourself
          — and everyone who reaches you actually wants to be there.
        </Pitch>

        {/* Doubles as the filter. Plenty of students will click "Become a
            mentor" out of curiosity; three plain facts about proof and refunds
            let them bow out on their own, which is kinder than a gate. */}
        <div className="flex flex-col gap-2.5">
          <p className="font-heading text-base font-semibold">Before you go live</p>
          <ul className="flex flex-col gap-2.5">
            <Rule icon={BadgeCheck}>
              Upload your rank card, ID or certificate — a person checks it, usually within a couple
              of days.
            </Rule>
            <Rule icon={EyeOff}>Your profile stays hidden until it&apos;s verified.</Rule>
            <Rule icon={Undo2}>If you miss a call, the student is refunded in full.</Rule>
          </ul>
        </div>
      </div>

      <div className="mt-8">
        <MentorApplyForm />
      </div>
    </div>
  );
}

function Pitch({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-heading text-base font-semibold">{title}</h2>
      <p className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">{children}</p>
    </section>
  );
}

function Rule({
  icon: Icon,
  children,
}: {
  icon: typeof BadgeCheck;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <span className="text-pretty">{children}</span>
    </li>
  );
}
