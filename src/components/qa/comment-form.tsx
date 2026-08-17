"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createComment } from "@/app/qa/actions";

export function CommentForm({ questionId }: { questionId: string }) {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!body.trim()) return;
    startTransition(async () => {
      try {
        await createComment(questionId, body);
        setBody("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't post comment");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply... ($...$ for math)"
        rows={3}
      />
      <Button onClick={submit} disabled={isPending || !body.trim()} className="self-end">
        {isPending ? "Posting..." : "Reply"}
      </Button>
    </div>
  );
}
