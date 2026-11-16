import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { RankCalculator } from "@/components/rank-predictor/rank-calculator";
import { RANK_EXAM } from "@/lib/rank-predictor/data";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "IIT JAM Physics Rank Predictor",
  description:
    "Enter your marks and see the All India Rank they would have earned in each of the last five IIT JAM Physics exams — and which IITs that rank reaches.",
};

const DEFAULT_MARKS = 40;

export default async function RankPredictorPage({ searchParams }: { searchParams: Promise<{ marks?: string }> }) {
  const { marks } = await searchParams;
  const parsed = Number(marks);
  // Half-mark steps match the slider; anything unusable falls back to a
  // mid-table score so the page opens with something to look at.
  const initial =
    marks && Number.isFinite(parsed) ? Math.round(Math.max(0, Math.min(RANK_EXAM.maxMarks, parsed)) * 100) / 100 : DEFAULT_MARKS;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        title="JAM Physics rank predictor"
        description="Move the slider to see what a score has been worth, year by year."
        action={
          <Button asChild variant="outline" size="lg">
            <Link href="/mock-tests">
              Get a real score <ArrowRight />
            </Link>
          </Button>
        }
      />
      {/* Keyed so a fresh ?marks= link resets the calculator instead of being ignored. */}
      <RankCalculator key={initial} initialMarks={initial} />
    </div>
  );
}
