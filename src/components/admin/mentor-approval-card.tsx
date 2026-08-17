"use client";

import { useTransition } from "react";
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
    subjects: string[];
    rate: number;
    upiId: string;
    bio: string | null;
    proofUrl: string;
    user: { name: string | null; email: string | null };
  };
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{profile.user.name}</CardTitle>
        <CardDescription>
          {profile.institute}
          {profile.rank ? ` · ${profile.rank}` : ""} · {profile.user.email}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {profile.subjects.map((s) => (
            <Badge key={s} variant="secondary">
              {s}
            </Badge>
          ))}
          <Badge variant="outline">₹{profile.rate}/session</Badge>
          <Badge variant="outline">UPI: {profile.upiId}</Badge>
        </div>
        {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}
        <a href={profile.proofUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileText className="size-4" /> View proof document
          </Button>
        </a>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={isPending}
            className="gap-1.5"
            onClick={() =>
              startTransition(async () => {
                await verifyMentor(profile.id, true);
                toast.success("Mentor approved");
              })
            }
          >
            <Check className="size-4" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            className="gap-1.5"
            onClick={() =>
              startTransition(async () => {
                await verifyMentor(profile.id, false);
                toast.success("Application rejected");
              })
            }
          >
            <X className="size-4" /> Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
