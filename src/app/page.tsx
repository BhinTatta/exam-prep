import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { siteConfig, exams } from "@/config/site";
import { BookOpen, MessagesSquare, Users, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Curated resources",
    description:
      "Institute material, books, test series and PYQs — organized by subject and category, kept up to date by moderators.",
    href: "/resources",
    cta: "Browse resources",
  },
  {
    icon: MessagesSquare,
    title: "Community Q&A",
    description:
      "Ask a question with full LaTeX support, get answers from the community, or deep-link straight to ChatGPT for a first pass.",
    href: "/qa",
    cta: "Ask a question",
  },
  {
    icon: Users,
    title: "Mentor marketplace",
    description:
      "Book 1:1 sessions with verified toppers and mentors. Simple manual UPI payment, Jitsi video call, zero platform fee in v1.",
    href: "/mentors",
    cta: "Find a mentor",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,theme(colors.primary/8%),transparent_60%)]" />
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-24 text-center">
          <Badge variant="secondary" className="gap-1.5 px-3 py-1">
            <Sparkles className="size-3.5" /> Free forever. No ads. Community-first.
          </Badge>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            {siteConfig.tagline}
          </h1>
          <p className="max-w-2xl text-balance text-lg text-muted-foreground">
            {siteConfig.description} Built for {exams.map((e) => e.label).join(", ")} aspirants,
            by people who&apos;ve taken the exams.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/resources">
              <Button size="lg" className="gap-1.5">
                Explore resources <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/qa">
              <Button size="lg" variant="outline">
                Ask the community
              </Button>
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {exams.map((exam) => (
              <Badge key={exam.slug} variant="outline" className="px-3 py-1 text-sm font-normal">
                {exam.fullName}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-20">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Everything in one place</h2>
          <p className="mt-2 text-muted-foreground">Three pillars, one platform, zero cost to you.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="flex flex-col justify-between transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="size-5 text-primary" />
                </div>
                <CardTitle>{f.title}</CardTitle>
                <CardDescription>{f.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={f.href}>
                  <Button variant="ghost" className="gap-1.5 px-0 hover:bg-transparent hover:underline">
                    {f.cta} <ArrowRight className="size-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center">
          <ShieldCheck className="size-8 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Run by moderators, not algorithms
          </h2>
          <p className="max-w-xl text-muted-foreground">
            Content is curated by trusted moderators, mentors are manually verified before they
            can take bookings, and every payment is confirmed by a human before a session is
            locked in.
          </p>
          <Link href="/mentors/apply">
            <Button variant="outline" size="lg">
              Apply to become a mentor
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
