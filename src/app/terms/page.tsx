import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { TermsContent } from "@/components/terms-content";
import { Button } from "@/components/ui/button";
import { acceptTerms } from "@/app/terms/actions";

export const metadata = { title: "Terms & Conditions" };

export default async function TermsPage() {
  const session = await auth();
  const needsAcceptance = !!session?.user && !session.user.termsAcceptedAt;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader title="Terms & Conditions" description="Please read before using the platform." />
      <TermsContent />

      {needsAcceptance && (
        <form
          action={async () => {
            "use server";
            await acceptTerms();
          }}
          className="mt-6"
        >
          <Button type="submit">I agree to these terms</Button>
        </form>
      )}
    </div>
  );
}
