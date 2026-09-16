"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/**
 * A submit button that reports its own form's pending state.
 *
 * `useFormStatus` only reads the status of the form it is rendered *inside*,
 * so this has to be its own component — that's the whole reason it exists.
 * Use it for every `<form action={serverAction}>`: without it a submit that
 * hits the network looks identical to a click that did nothing, which is the
 * single biggest reason the app feels slow.
 */
export function SubmitButton({
  children,
  loadingText,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" loading={pending} loadingText={loadingText} {...props}>
      {children}
    </Button>
  );
}
