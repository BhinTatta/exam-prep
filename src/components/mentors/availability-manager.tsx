"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { DAYS } from "@/lib/days";
import { addAvailability, removeAvailability } from "@/app/mentors/actions";

type Slot = { id: string; dayOfWeek: number; startTime: string; duration: number; isBooked: boolean };

export function AvailabilityManager({ slots }: { slots: Slot[] }) {
  const [isPending, startTransition] = useTransition();

  function onAdd(formData: FormData) {
    startTransition(async () => {
      try {
        await addAvailability(formData);
        toast.success("Slot added");
      } catch {
        toast.error("Couldn't add slot");
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <form action={onAdd} className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="dayOfWeek">Day</Label>
            <Select name="dayOfWeek" defaultValue="1">
              <SelectTrigger id="dayOfWeek" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d, i) => (
                  <SelectItem key={d} value={String(i)}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="startTime">Start time</Label>
            <Input id="startTime" name="startTime" type="time" defaultValue="18:00" className="w-32" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="duration">Duration (min)</Label>
            <Input id="duration" name="duration" type="number" min={15} step={15} defaultValue={30} className="w-24" required />
          </div>
          <Button type="submit" disabled={isPending}>
            Add slot
          </Button>
        </form>

        <div className="flex flex-col divide-y">
          {slots.length === 0 && <p className="py-4 text-sm text-muted-foreground">No slots yet.</p>}
          {slots.map((slot) => (
            <div key={slot.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{DAYS[slot.dayOfWeek]}</span>
                <span className="text-muted-foreground">
                  {slot.startTime} · {slot.duration} min
                </span>
                {slot.isBooked && <Badge variant="secondary">Booked</Badge>}
              </div>
              {!slot.isBooked && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  disabled={isPending}
                  onClick={() => startTransition(() => removeAvailability(slot.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
