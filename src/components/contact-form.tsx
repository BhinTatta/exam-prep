"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { submitContactMessage } from "@/app/contact/actions";

export function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await submitContactMessage(formData);
        formRef.current?.reset();
        setSent(true);
      } catch {
        toast.error("Couldn't send your message — check the fields and try again");
      }
    });
  }

  if (sent) {
    return <p className="text-sm text-muted-foreground">Thanks — we&apos;ll get back to you by email.</p>;
  }

  return (
    <form ref={formRef} action={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required maxLength={100} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required maxLength={200} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="message">Message</Label>
        <Textarea id="message" name="message" required minLength={10} maxLength={5000} rows={5} />
      </div>
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Sending..." : "Send"}
      </Button>
    </form>
  );
}
