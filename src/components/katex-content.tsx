import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";

// Splits on $$...$$ (block) and $...$ (inline) so questions/comments can mix
// plain text with LaTeX without needing a full markdown pipeline.
function tokenize(text: string) {
  return text.split(/(\$\$[^$]+\$\$|\$[^$\n]+\$)/g).filter((s) => s.length > 0);
}

export function KatexContent({ text, className }: { text: string; className?: string }) {
  const tokens = tokenize(text);

  return (
    <div className={className}>
      {tokens.map((token, i) => {
        if (token.startsWith("$$") && token.endsWith("$$")) {
          return <BlockMath key={i} math={token.slice(2, -2)} errorColor="var(--destructive)" />;
        }
        if (token.startsWith("$") && token.endsWith("$")) {
          return <InlineMath key={i} math={token.slice(1, -1)} errorColor="var(--destructive)" />;
        }
        return (
          <span key={i} className="whitespace-pre-wrap">
            {token}
          </span>
        );
      })}
    </div>
  );
}
