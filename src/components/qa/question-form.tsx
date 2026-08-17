"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KatexContent } from "@/components/katex-content";
import { FileInput } from "@/components/ui/file-input";
import { subjects } from "@/config/site";
import { createQuestion } from "@/app/qa/actions";

export function QuestionForm() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    formData.set("body", body);
    startTransition(async () => {
      try {
        const id = await createQuestion(formData);
        toast.success("Question posted");
        router.push(`/qa/${id}`);
      } catch {
        toast.error("Couldn't post — check the fields and try again.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="Why does the propagator diverge here?" required />
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
          <div className="grid gap-2">
            <Label>Body</Label>
            <Tabs defaultValue="write">
              <TabsList>
                <TabsTrigger value="write">Write</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="write">
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Describe your question. Use $E=mc^2$ or $$\int_0^\infty e^{-x} dx$$ for math."
                  rows={8}
                  required
                />
              </TabsContent>
              <TabsContent value="preview">
                <div className="min-h-[10rem] rounded-md border p-3 text-sm">
                  {body ? <KatexContent text={body} /> : <p className="text-muted-foreground">Nothing to preview yet.</p>}
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="image">Image (optional)</Label>
            <FileInput id="image" name="image" accept="image/*" />
          </div>
          <Button type="submit" disabled={isPending} className="mt-2">
            {isPending ? "Posting..." : "Post question"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
