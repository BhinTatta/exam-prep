import { KatexContent } from "@/components/katex-content";
import { cn } from "@/lib/utils";
import type { MockOption } from "@/lib/mock-tests/types";

/**
 * A diagram from the paper. Always on a white plate: figures are cropped from
 * the official PDF (black ink on white) and would be unreadable dropped
 * straight onto the dark theme.
 */
export function Figure({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    // Plain <img>: diagrams come in arbitrary sizes from arbitrary hosts, and
    // next/image would need each one's dimensions declared up front.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn("h-auto max-w-full rounded-md border bg-white p-2", className)}
    />
  );
}

/** Prompt text plus its diagram, as shown in the exam, the review and the admin preview. */
export function QuestionPrompt({
  number,
  prompt,
  imageUrl,
  className,
}: {
  number: number;
  prompt: string;
  imageUrl: string | null;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <KatexContent text={prompt} className="leading-relaxed [overflow-wrap:anywhere]" />
      {imageUrl && <Figure src={imageUrl} alt={`Figure for question ${number}`} className="max-h-96 w-auto self-start" />}
    </div>
  );
}

/** An option's label and/or picture. */
export function OptionContent({ option }: { option: MockOption }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {option.label && <KatexContent text={option.label} className="[overflow-wrap:anywhere]" />}
      {option.imageUrl && <Figure src={option.imageUrl} alt={`Option ${option.id}`} className="max-h-56 w-auto self-start" />}
    </div>
  );
}
