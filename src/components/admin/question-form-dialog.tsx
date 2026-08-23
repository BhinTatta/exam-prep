"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { suggestedPhysicsTopics } from "@/config/site";
import { createQuestion, updateQuestion, type QuestionInput } from "@/app/admin/tests/actions";
import { parseQuestionOptions, type QuestionOption } from "@/lib/assessment/types";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import type { AssessmentQuestion } from "@prisma/client";

type Section = QuestionInput["section"];

function emptyOptions(): QuestionOption[] {
  return [
    { id: crypto.randomUUID().slice(0, 8), label: "" },
    { id: crypto.randomUUID().slice(0, 8), label: "" },
  ];
}

export function QuestionFormDialog({
  testId,
  mode,
  question,
  nextOrder,
}: {
  testId: string;
  mode: "create" | "edit";
  question?: AssessmentQuestion;
  nextOrder?: number;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [section, setSection] = useState<Section>((question?.section as Section) ?? "CONTENT");
  const [topic, setTopic] = useState(question?.topic ?? "");
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [imageUrl, setImageUrl] = useState(question?.imageUrl ?? "");
  const [options, setOptions] = useState<QuestionOption[]>(
    question ? parseQuestionOptions(question.options) : emptyOptions()
  );
  const [correctOptionId, setCorrectOptionId] = useState<string>(question?.correctOptionIds[0] ?? "");
  const [marks, setMarks] = useState(question?.marks ?? 4);
  const [negativeMarks, setNegativeMarks] = useState(question?.negativeMarks ?? 1);
  const [isActive, setIsActive] = useState(question?.isActive ?? true);

  function updateOption(id: string, label: string) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, label } : o)));
  }

  function addOption() {
    if (options.length >= 6) return;
    setOptions((prev) => [...prev, { id: crypto.randomUUID().slice(0, 8), label: "" }]);
  }

  function removeOption(id: string) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((o) => o.id !== id));
    if (correctOptionId === id) setCorrectOptionId("");
  }

  function onSubmit() {
    const input: QuestionInput = {
      testId,
      section,
      topic: topic.trim(),
      prompt: prompt.trim(),
      imageUrl: imageUrl.trim() || undefined,
      options: options.map((o) => ({ id: o.id, label: o.label.trim() })),
      correctOptionIds: section === "CONTENT" && correctOptionId ? [correctOptionId] : [],
      marks,
      negativeMarks,
      order: question?.order ?? nextOrder ?? 0,
      isActive,
    };

    startTransition(async () => {
      try {
        if (mode === "create") {
          await createQuestion(input);
          toast.success("Question added");
          setTopic("");
          setPrompt("");
          setImageUrl("");
          setOptions(emptyOptions());
          setCorrectOptionId("");
        } else if (question) {
          await updateQuestion(question.id, input);
          toast.success("Question updated");
        }
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save question");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" /> Add question
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="size-8">
            <Pencil className="size-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add question" : "Edit question"}</DialogTitle>
          <DialogDescription>
            Prompt supports LaTeX: <code>$E=mc^2$</code> inline, <code>$$...$$</code> block.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Section</Label>
              <Select value={section} onValueChange={(v) => setSection(v as Section)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONTENT">Content (scored)</SelectItem>
                  <SelectItem value="PROFILE">Profile (unscored)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="topic">{section === "CONTENT" ? "Topic" : "Profile key"}</Label>
              <Input
                id="topic"
                list="topic-suggestions"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={section === "CONTENT" ? "Rotational Mechanics" : "prep_level"}
                required
              />
              {section === "CONTENT" && (
                <datalist id="topic-suggestions">
                  {suggestedPhysicsTopics.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="imageUrl">Image URL (optional)</Label>
            <Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Options {section === "CONTENT" && "(select the correct one)"}</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addOption} disabled={options.length >= 6}>
                <Plus className="size-3.5" /> Add option
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {options.map((opt) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                  {section === "CONTENT" && (
                    <input
                      type="radio"
                      name="correctOption"
                      checked={correctOptionId === opt.id}
                      onChange={() => setCorrectOptionId(opt.id)}
                      className="size-4 shrink-0"
                      aria-label="Mark as correct"
                    />
                  )}
                  <Input
                    value={opt.label}
                    onChange={(e) => updateOption(opt.id, e.target.value)}
                    placeholder="Option text"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => removeOption(opt.id)}
                    disabled={options.length <= 2}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            {section === "CONTENT" && !correctOptionId && (
              <p className="text-xs text-destructive">Select the correct option before saving.</p>
            )}
          </div>

          {section === "CONTENT" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="marks">Marks (correct)</Label>
                <Input
                  id="marks"
                  type="number"
                  min={0}
                  max={20}
                  value={marks}
                  onChange={(e) => setMarks(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="negativeMarks">Negative marks (wrong)</Label>
                <Input
                  id="negativeMarks"
                  type="number"
                  min={0}
                  max={20}
                  value={negativeMarks}
                  onChange={(e) => setNegativeMarks(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="isActive" className="cursor-pointer">
              Active (shown to test-takers)
            </Label>
            <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={
              isPending ||
              !topic.trim() ||
              !prompt.trim() ||
              options.some((o) => !o.label.trim()) ||
              (section === "CONTENT" && !correctOptionId)
            }
          >
            {isPending ? "Saving..." : mode === "create" ? "Add question" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
