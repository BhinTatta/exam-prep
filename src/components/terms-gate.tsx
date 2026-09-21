"use client";

import { useSession } from "next-auth/react";
import { TermsDialog } from "@/components/terms-dialog";

/**
 * Blocks the app behind a must-accept Terms dialog for signed-in users who
 * haven't accepted yet.
 *
 * Client-side so the root layout stays free of cookie reads (see Navbar).
 * The dialog appears once the session resolves rather than in the first paint
 * — acceptable here because this gates continued use, not access to data:
 * every action that matters is still authorised server-side.
 */
export function TermsGate() {
  const { data: session, status } = useSession();

  if (status !== "authenticated") return null;
  if (session.user?.termsAcceptedAt) return null;

  return <TermsDialog />;
}
