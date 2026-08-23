"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { togglePublishTest, deleteTest, deleteQuestion } from "@/app/admin/tests/actions";

export function PublishToggle({ testId, published }: { testId: string; published: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
      <Label htmlFor="published" className="cursor-pointer text-sm">
        {published ? "Published" : "Draft"}
      </Label>
      <Switch
        id="published"
        checked={published}
        disabled={isPending}
        onCheckedChange={(next) =>
          startTransition(async () => {
            await togglePublishTest(testId, next);
            toast.success(next ? "Test published" : "Test unpublished");
          })
        }
      />
    </div>
  );
}

export function DeleteTestButton({ testId }: { testId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-destructive" disabled={isPending}>
          <Trash2 className="size-3.5" /> Delete test
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this test?</AlertDialogTitle>
          <AlertDialogDescription>
            All questions and attempts (including past results) for this test will be permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              startTransition(async () => {
                await deleteTest(testId);
                toast.success("Test deleted");
                router.push("/admin/tests");
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

export function DeleteQuestionButton({ questionId }: { questionId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 text-destructive"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await deleteQuestion(questionId);
          toast.success("Question deleted");
        })
      }
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
