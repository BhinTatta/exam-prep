"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resourceCategories, subjects } from "@/config/site";
import { createResource } from "@/app/resources/actions";

export function ResourceForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await createResource(formData);
        toast.success("Resource added");
        router.push("/resources");
      } catch {
        toast.error("Couldn't add resource — check the fields and try again.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="Fiziks GATE Physics Notes — Electrodynamics" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="url">Link</Label>
            <Input id="url" name="url" type="url" placeholder="https://..." required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select name="category" required defaultValue={resourceCategories[0].slug}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resourceCategories.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subject">Subject</Label>
              <Select name="subject" required defaultValue={subjects[0].slug}>
                <SelectTrigger id="subject">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.slug} value={s.slug}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input id="tags" name="tags" placeholder="electrodynamics, gate, notes" />
          </div>
          <Button type="submit" disabled={isPending} className="mt-2">
            {isPending ? "Adding..." : "Add resource"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
