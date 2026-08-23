import { siteConfig } from "@/config/site";

/** Shared Terms & Conditions body — used by both /terms and the sign-up gate dialog. Keep this the single source of truth. */
export function TermsContent() {
  return (
    <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
      <section>
        <h2 className="mb-1 font-medium text-foreground">1. What this platform is</h2>
        <p>
          {siteConfig.name} is a free, community-run platform for physics entrance exam prep. It is not affiliated
          with IIT, NTA, CSIR/UGC, or any exam-conducting body.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-medium text-foreground">2. User-generated content</h2>
        <p>
          Questions, comments, resource links, and mentor listings are posted by users, not by {siteConfig.name}.
          You are solely responsible for anything you post. Do not post content you don&apos;t have the right to
          share — including copyrighted books, papers, or materials you don&apos;t hold a license or permission to
          distribute.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-medium text-foreground">3. Reporting content</h2>
        <p>
          If you see content that infringes copyright, is spam, or is abusive, use the &quot;Report&quot; action on
          the post, or the{" "}
          <a href="/contact" className="underline underline-offset-2 hover:text-foreground">
            contact form
          </a>{" "}
          if you&apos;re not signed in. We review reports and remove content that violates these terms.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-medium text-foreground">4. Takedown requests</h2>
        <p>
          Rights holders may request removal of infringing content via the contact form or{" "}
          <a href={`mailto:${siteConfig.supportEmail}`} className="underline underline-offset-2 hover:text-foreground">
            {siteConfig.supportEmail}
          </a>
          . We act on valid requests promptly and will remove the flagged content pending review.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-medium text-foreground">5. Accounts</h2>
        <p>
          You&apos;re responsible for activity under your account. We may suspend accounts that repeatedly post
          infringing or abusive content.
        </p>
      </section>
    </div>
  );
}
