import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { StudyPlan } from "@/lib/assessment/types";
import { Sparkles, LogIn, Lock, Download } from "lucide-react";

export function StudyPlanSection({
  studyPlan,
  canViewFull,
  callbackUrl,
  pdfUrl,
}: {
  studyPlan: StudyPlan | null;
  canViewFull: boolean;
  callbackUrl: string;
  pdfUrl: string;
}) {
  if (!studyPlan) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="size-4" /> Your study plan
          </div>
          <p className="text-lg font-medium">{studyPlan.overallMessage}</p>
          <p className="mt-1 text-sm text-muted-foreground">{studyPlan.summary}</p>
        </div>

        {canViewFull ? (
          <>
            <div className="flex flex-col gap-3 border-t pt-4">
              {studyPlan.topics.map((t) => (
                <div key={t.topic} className="text-sm">
                  <span className="font-medium">{t.topic}:</span>{" "}
                  <span className="text-muted-foreground">{t.advice}</span>
                </div>
              ))}
            </div>
            <a href={pdfUrl} download className="self-start">
              <Button variant="outline" className="gap-1.5">
                <Download className="size-4" /> Download as PDF
              </Button>
            </a>
          </>
        ) : (
          <div className="relative border-t pt-4">
            <div aria-hidden className="flex select-none flex-col gap-3 blur-[3px]">
              {studyPlan.topics.map((t) => (
                <div key={t.topic} className="text-sm">
                  <span className="font-medium">{t.topic}:</span>{" "}
                  <span className="text-muted-foreground">{t.advice}</span>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-card via-card/95 to-card/40 px-4 text-center">
              <Lock className="size-5 text-primary" />
              <p className="text-sm font-medium">
                {studyPlan.topics.length} topic breakdown{studyPlan.topics.length === 1 ? "" : "s"} + a downloadable PDF
              </p>
              <Link href={`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
                <Button className="gap-1.5">
                  <LogIn className="size-4" /> Unlock full plan & PDF
                </Button>
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
