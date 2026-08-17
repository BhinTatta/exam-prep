import { requireUser } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { QuestionForm } from "@/components/qa/question-form";

export const metadata = { title: "Ask a question" };

export default async function NewQuestionPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader title="Ask a question" description="Use $...$ for inline math and $$...$$ for block equations." />
      <QuestionForm />
    </div>
  );
}
