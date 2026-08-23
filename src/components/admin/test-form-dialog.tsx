"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { subjects } from "@/config/site";
import { createTest, updateTest } from "@/app/admin/tests/actions";
import { Plus, Pencil } from "lucide-react";
import type { Test } from "@prisma/client";

export function TestFormDialog({ mode, test }: { mode: "create" | "edit"; test?: Test }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (mode === "create") {
          const created = await createTest(formData);
          setOpen(false);
          router.push(`/admin/tests/${created.id}`);
        } else if (test) {
          await updateTest(test.id, formData);
          setOpen(false);
          toast.success("Test updated");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save test");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button className="gap-1.5">
            <Plus className="size-4" /> New test
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Pencil className="size-3.5" /> Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New assessment test" : "Edit test"}</DialogTitle>
          <DialogDescription>
            The slug determines the public URL: /tests/&lt;slug&gt;
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={test?.title} placeholder="JAM Physics Diagnostic" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              defaultValue={test?.slug}
              placeholder="jam-physics-diagnostic"
              pattern="[a-z0-9-]+"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="subject">Subject</Label>
              <Select name="subject" required defaultValue={test?.subject ?? subjects[0].slug}>
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
            <div className="grid gap-2">
              <Label htmlFor="durationMinutes">Duration (minutes)</Label>
              <Input
                id="durationMinutes"
                name="durationMinutes"
                type="number"
                min={1}
                max={180}
                defaultValue={test?.durationMinutes ?? 15}
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description (shown on the test intro page)</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={test?.description ?? ""}
              rows={3}
              placeholder="A 15-minute diagnostic covering JAM-level Physics fundamentals."
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : mode === "create" ? "Create test" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
