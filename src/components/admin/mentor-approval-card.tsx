"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, FileText } from "lucide-react";
import { verifyMentor } from "@/app/admin/actions";

export function MentorApprovalCard({
  profile,
}: {
  profile: {
    id: string;
    institute: string;
    rank: string | null;
    examCleared: string;
    examYear: number;
    currentRole: string;
    languages: string[];
    story: string;
    subjects: string[];
    rate: number;
    upiId: string;
    bio: string | null;
    proofUrl: string;
    user: { name: string | null; email: string | null };
  };
}) {
  const [isPending, startTransition] = useTransition();
  // One transition drives both buttons — remember which was pressed so only
  // that one spins.
  const [clicked, setClicked] = useState<"approve" | "reject" | null>(null);

  function decide(approved: boolean) {
    setClicked(approved ? "approve" : "reject");
    startTransition(async () => {
      try {
        await verifyMentor(profile.id, approved);
        toast.success(approved ? "Mentor approved" : "Application rejected");
      } finally {
        setClicked(null);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{profile.user.name}</CardTitle>
        <CardDescription>
          {profile.currentRole || profile.institute} · {profile.user.email}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* The claim being verified, first — this is what the proof document
            has to back up. */}
        <div className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
          {[profile.rank, profile.examCleared, profile.examYear || null].filter(Boolean).join(" · ")}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {profile.subjects.map((s) => (
            <Badge key={s} variant="secondary">
              {s}
            </Badge>
          ))}
          <Badge variant="outline">₹{profile.rate}/session</Badge>
          <Badge variant="outline">UPI: {profile.upiId}</Badge>
          {profile.languages.map((l) => (
            <Badge key={l} variant="outline">
              {l}
            </Badge>
          ))}
        </div>
        {profile.story && (
          <blockquote className="border-l-2 border-primary/30 pl-3 text-sm italic">
            &ldquo;{profile.story}&rdquo;
          </blockquote>
        )}
        {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}
        <a href={profile.proofUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileText className="size-4" /> View proof document
          </Button>
        </a>
        <div className="flex gap-2">
          <Button
            size="sm"
            loading={isPending && clicked === "approve"}
            disabled={isPending}
            loadingText="Approving…"
            className="gap-1.5"
            onClick={() => decide(true)}
          >
            <Check className="size-4" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            loading={isPending && clicked === "reject"}
            disabled={isPending}
            loadingText="Rejecting…"
            className="gap-1.5"
            onClick={() => decide(false)}
          >
            <X className="size-4" /> Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
