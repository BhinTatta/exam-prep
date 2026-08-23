import { PageHeader } from "@/components/page-header";
import { ContactForm } from "@/components/contact-form";
import { siteConfig } from "@/config/site";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <PageHeader
        title="Contact admins"
        description={`Copyright takedown request, bug report, or anything else — this goes straight to the ${siteConfig.name} admins.`}
      />
      <ContactForm />
    </div>
  );
}
