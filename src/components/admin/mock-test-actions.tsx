"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteMockTest, importMockTest, setMockTestPublished } from "@/app/admin/mock-tests/actions";

export function ImportMockTestDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function onImport() {
    setError(null);
    startTransition(async () => {
      const result = await importMockTest(json);
      if (!result.ok) return setError(result.error);
      const s = result.summary;
      toast.success(
        `${s.created ? "Created" : "Updated"} “${s.title}” — ${s.questions} questions, ${s.totalMarks} marks` +
          (s.removedQuestions.length ? `. Removed Q${s.removedQuestions.join(", Q")}.` : ".")
      );
      setOpen(false);
      setJson("");
      router.push(`/admin/mock-tests/${s.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Upload className="size-4" /> Import paper
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import a paper</DialogTitle>
          <DialogDescription>
            Paste a paper file (see docs/mock-tests.md) or choose a .json file. Importing a slug that already exists
            updates that paper in place — recorded attempts are kept.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) setJson(await file.text());
            e.target.value = "";
          }}
        />
        <Textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          placeholder='{ "slug": "jam-physics-2025", "title": "…", "sections": [ … ] }'
          spellCheck={false}
          className="h-64 max-h-[50dvh] resize-none overflow-auto font-mono text-xs [field-sizing:fixed]"
        />
        {error && (
          <pre className="max-h-40 overflow-auto rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs whitespace-pre-wrap text-destructive">
            {error}
          </pre>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={isPending}>
            Choose file…
          </Button>
          <Button onClick={onImport} disabled={json.trim() === ""} loading={isPending} loadingText="Importing…">
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MockPublishToggle({ testId, published }: { testId: string; published: boolean }) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
      <Label htmlFor="mock-published" className="cursor-pointer text-sm">
        {published ? "Published" : "Draft"}
      </Label>
      <Switch
        id="mock-published"
        checked={published}
        disabled={isPending}
        onCheckedChange={(next) =>
          startTransition(async () => {
            await setMockTestPublished(testId, next);
            toast.success(next ? "Mock test published" : "Mock test unpublished");
          })
        }
      />
    </div>
  );
}

export function DeleteMockTestButton({ testId, attempts }: { testId: string; attempts: number }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-destructive" disabled={isPending}>
          <Trash2 className="size-3.5" /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this mock test?</AlertDialogTitle>
          <AlertDialogDescription>
            {attempts > 0
              ? `This permanently deletes the paper and all ${attempts} student attempt${attempts === 1 ? "" : "s"} recorded against it. To hide it from students without losing those, unpublish it instead.`
              : "This permanently deletes the paper and its questions."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              startTransition(async () => {
                await deleteMockTest(testId);
                toast.success("Mock test deleted");
                router.push("/admin/mock-tests");
              })
            }
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
