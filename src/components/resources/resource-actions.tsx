"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { MoreVertical, Pin, PinOff, Star, StarOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { deleteResource, togglePinResource, toggleFeatureResource } from "@/app/resources/actions";

export function ResourceActions({
  id,
  pinned,
  featured,
  isAdmin,
}: {
  id: string;
  pinned: boolean;
  featured: boolean;
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>, successMsg: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(successMsg);
      } catch {
        toast.error("Something went wrong");
      }
    });
  }

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" disabled={isPending}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => run(() => togglePinResource(id, !pinned), pinned ? "Unpinned" : "Pinned")}>
            {pinned ? <PinOff className="mr-2 size-4" /> : <Pin className="mr-2 size-4" />}
            {pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem
              onClick={() => run(() => toggleFeatureResource(id, !featured), featured ? "Unfeatured" : "Featured")}
            >
              {featured ? <StarOff className="mr-2 size-4" /> : <Star className="mr-2 size-4" />}
              {featured ? "Unfeature" : "Feature"}
            </DropdownMenuItem>
          )}
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => e.preventDefault()}
            >
              <Trash2 className="mr-2 size-4" /> Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this resource?</AlertDialogTitle>
          <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => run(() => deleteResource(id), "Deleted")}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
