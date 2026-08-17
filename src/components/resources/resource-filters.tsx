"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resourceCategories } from "@/config/site";
import { Search } from "lucide-react";
import { useTransition } from "react";

export function ResourceFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const category = searchParams.get("category") ?? "all";
  const q = searchParams.get("q") ?? "";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          defaultValue={q}
          placeholder="Search resources..."
          className="pl-8"
          onChange={(e) => updateParam("q", e.target.value)}
        />
      </div>
      <Tabs value={category} onValueChange={(v) => updateParam("category", v)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {resourceCategories.map((c) => (
            <TabsTrigger key={c.slug} value={c.slug}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
