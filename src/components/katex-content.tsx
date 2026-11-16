import "katex/dist/katex.min.css";
import katex from "katex";

// Splits on $$...$$ (block) and $...$ (inline) so questions/comments can mix
// plain text with LaTeX without needing a full markdown pipeline.
function tokenize(text: string) {
  return text.split(/(\$\$[^$]+\$\$|\$[^$\n]+\$)/g).filter((s) => s.length > 0);
}

// Rendered with the `katex` package directly, not through react-katex. That
// wrapper bundles its own older KaTeX, whose markup the stylesheet above (from
// the current KaTeX) does not fully style: subscripts sat on the baseline,
// exponents were full size and \neq drew as "/=". One package for both the
// markup and the CSS is what keeps them in step.
function render(math: string, displayMode: boolean) {
  return katex.renderToString(math, {
    displayMode,
    throwOnError: false,
    errorColor: "var(--destructive)",
    // KaTeX output is safe to inject: it escapes its input and, with `trust`
    // left off, refuses commands that could emit links or raw HTML.
    trust: false,
    strict: false,
  });
}

export function KatexContent({ text, className }: { text: string; className?: string }) {
  const tokens = tokenize(text);

  return (
    <div className={className}>
      {tokens.map((token, i) => {
        if (token.startsWith("$$") && token.endsWith("$$")) {
          return <div key={i} dangerouslySetInnerHTML={{ __html: render(token.slice(2, -2), true) }} />;
        }
        if (token.startsWith("$") && token.endsWith("$")) {
          return <span key={i} dangerouslySetInnerHTML={{ __html: render(token.slice(1, -1), false) }} />;
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
