"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Mail } from "lucide-react";
import { resolveReport, resolveContactMessage } from "@/app/reports/actions";
import { formatDistanceToNow } from "date-fns";
import type { ReportTargetType } from "@prisma/client";

type ReportRow = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  contextUrl: string | null;
  reason: string;
  details: string | null;
  createdAt: Date;
  reporter: { name: string | null };
};

type ContactRow = {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: Date;
};

export function ReportsQueue({ reports, messages }: { reports: ReportRow[]; messages: ContactRow[] }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Tabs defaultValue="reports">
      <TabsList>
        <TabsTrigger value="reports">Reports ({reports.length})</TabsTrigger>
        <TabsTrigger value="contact">Contact ({messages.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="reports" className="flex flex-col gap-2">
        {reports.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">{r.targetType}</Badge>
                  <Badge variant="secondary">{r.reason}</Badge>
                </div>
                {r.details && <p className="mt-1.5 text-sm">{r.details}</p>}
                <p className="mt-1 text-sm text-muted-foreground">
                  Reported by {r.reporter.name} · {formatDistanceToNow(r.createdAt, { addSuffix: true })}
                  {r.contextUrl && (
                    <>
                      {" · "}
                      <Link href={r.contextUrl} className="text-primary hover:underline">
                        View content
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await resolveReport(r.id, "RESOLVED");
                      toast.success("Marked resolved");
                    })
                  }
                >
                  <Check className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await resolveReport(r.id, "DISMISSED");
                      toast.success("Dismissed");
                    })
                  }
                >
                  <X className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {reports.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No open reports.</p>}
      </TabsContent>

      <TabsContent value="contact" className="flex flex-col gap-2">
        {messages.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-sm text-muted-foreground">
                  {m.email} · {formatDistanceToNow(m.createdAt, { addSuffix: true })}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm">{m.message}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <a href={`mailto:${m.email}`}>
                  <Button variant="ghost" size="icon" className="size-8">
                    <Mail className="size-4" />
                  </Button>
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await resolveContactMessage(m.id, true);
                      toast.success("Marked resolved");
                    })
                  }
                >
                  <Check className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {messages.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No open messages.</p>}
      </TabsContent>
    </Tabs>
  );
}
