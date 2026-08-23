import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hasRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResourceFilters } from "@/components/resources/resource-filters";
import { ResourceActions } from "@/components/resources/resource-actions";
import { ReportButton } from "@/components/report-button";
import { resourceCategories } from "@/config/site";
import { BookMarked, ExternalLink, Plus, Pin, Star } from "lucide-react";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Resources" };

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;
  const session = await auth();
  const canWrite = hasRole(session?.user?.role, "MODERATOR");
  const isAdmin = hasRole(session?.user?.role, "ADMIN");

  const where: Prisma.ResourceWhereInput = {
    ...(category ? { category } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { tags: { has: q } },
          ],
        }
      : {}),
  };

  const resources = await prisma.resource.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { featured: "desc" }, { createdAt: "desc" }],
    include: { uploader: { select: { name: true } } },
  });

  const categoryLabel = (slug: string) =>
    resourceCategories.find((c) => c.slug === slug)?.label ?? slug;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        title="Resources"
        description="Institute material, books, test series and PYQs — curated by moderators."
        action={
          canWrite && (
            <Link href="/resources/new">
              <Button className="gap-1.5">
                <Plus className="size-4" /> Add resource
              </Button>
            </Link>
          )
        }
      />

      <Suspense>
        <ResourceFilters />
      </Suspense>

      {resources.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title="No resources found"
          description={canWrite ? "Add the first one to get started." : "Check back soon."}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {resources.map((r) => (
            <Card key={r.id} className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                <div className="flex items-center gap-1.5">
                  {r.pinned && <Pin className="size-3.5 text-primary" />}
                  {r.featured && <Star className="size-3.5 fill-amber-400 text-amber-400" />}
                  <CardTitle className="text-base leading-snug">{r.title}</CardTitle>
                </div>
                <div className="flex shrink-0 items-center">
                  {session?.user && <ReportButton targetType="RESOURCE" targetId={r.id} />}
                  {canWrite && (
                    <ResourceActions id={r.id} pinned={r.pinned} featured={r.featured} isAdmin={isAdmin} />
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{categoryLabel(r.category)}</Badge>
                  {r.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Added by {r.uploader.name ?? "moderator"}</span>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    Open <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
