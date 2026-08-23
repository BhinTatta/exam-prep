"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TermsContent } from "@/components/terms-content";
import { acceptTerms } from "@/app/terms/actions";

export function TermsDialog() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Before you continue</DialogTitle>
        </DialogHeader>
        <TermsContent />
        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await acceptTerms();
                router.refresh();
              })
            }
          >
            I agree to these terms
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
