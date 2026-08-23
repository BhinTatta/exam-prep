import { auth } from "@/auth";
import { TermsDialog } from "@/components/terms-dialog";

/** Blocks the app behind a must-accept Terms dialog for signed-in users who haven't accepted yet. */
export async function TermsGate() {
  const session = await auth();
  if (session?.user && !session.user.termsAcceptedAt) {
    return <TermsDialog />;
  }
  return null;
}
