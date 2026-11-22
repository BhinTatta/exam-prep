"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { sessionPricing } from "@/config/site";
import { isValidPrice, mentorShare, platformCut } from "@/lib/pricing";
import { updateRate } from "@/app/mentors/actions";

/**
 * The mentor's own price, with what they take home worked out as they type.
 * The split rule lives in src/lib/pricing.ts and is the same one the booking
 * and payout use, so this preview can't disagree with the payout.
 */
export function RateEditor({ rate }: { rate: number }) {
  const [value, setValue] = useState(String(rate));
  const [isPending, startTransition] = useTransition();
  const price = Number(value);
  const valid = isValidPrice(price);
  const { minPrice, maxPrice, freeBelow } = sessionPricing;

  function onSave(formData: FormData) {
    if (!valid) return;
    startTransition(async () => {
      try {
        await updateRate(formData);
        toast.success(`Price set to ₹${price}`);
      } catch {
        toast.error("Couldn't save that price");
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <form action={onSave} className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rate">Students pay (₹)</Label>
            <Input
              id="rate"
              name="rate"
              type="number"
              inputMode="numeric"
              min={minPrice}
              max={maxPrice}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-32"
              required
            />
          </div>
          <Button type="submit" variant="outline" disabled={!valid || price === rate || isPending} loading={isPending}>
            Save price
          </Button>
        </form>

        {valid ? (
          <dl className="grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Student pays</dt>
            <dd className="text-right tabular-nums">₹{price}</dd>
            <dt className="text-muted-foreground">Platform fee</dt>
            <dd className="text-right tabular-nums">₹{platformCut(price)}</dd>
            <dt className="font-medium">You receive</dt>
            <dd className="text-right font-semibold text-primary tabular-nums">₹{mentorShare(price)}</dd>
          </dl>
        ) : (
          <p className="text-sm text-destructive">
            Pick a whole-rupee price from ₹{minPrice} to ₹{maxPrice}.
          </p>
        )}

        <p className="text-xs text-pretty text-muted-foreground">
          Anything from ₹{minPrice} to ₹{maxPrice}. Below ₹{freeBelow} there&apos;s no platform fee and
          you keep every rupee. From ₹{freeBelow} up, the fee is never more than ₹{sessionPricing.maxCut}{" "}
          and you always take home at least ₹{freeBelow - 1}. Students already booked keep the price they paid.
        </p>
      </CardContent>
    </Card>
  );
}
