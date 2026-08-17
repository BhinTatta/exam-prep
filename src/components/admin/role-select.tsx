"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { promoteUser } from "@/app/admin/actions";
import type { Role } from "@prisma/client";

const ROLES: Role[] = ["USER", "MENTOR", "MODERATOR", "ADMIN"];

export function RoleSelect({ userId, role, disabled }: { userId: string; role: Role; disabled?: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      defaultValue={role}
      disabled={isPending || disabled}
      onValueChange={(value) =>
        startTransition(async () => {
          await promoteUser(userId, value as Role);
          toast.success(`Role updated to ${value}`);
        })
      }
    >
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {r}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
