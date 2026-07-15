import { Fragment, type ReactNode } from "react";

/**
 * Minimal, dependency-free Markdown renderer (§6 "Safe Markdown rendering").
 * It only emits headings, paragraphs, list items, blockquotes and bold spans —
 * no raw HTML is ever injected (React escapes all text), so model or feed output
 * cannot inject markup.
 */
function renderInline(text: string, keyBase: string) {
  // Split on **bold** while keeping the delimiters out of the output.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={`${keyBase}-b-${i}`} className="text-slate-100">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={`${keyBase}-t-${i}`}>{p}</Fragment>;
  });
}

export function SafeMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];

  const flushList = (key: string) => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={key} className="my-1 list-inside list-disc space-y-0.5 text-slate-300">
        {list.map((li, i) => (
          <li key={`${key}-${i}`}>{renderInline(li, `${key}-${i}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const key = `l-${idx}`;
    if (/^#{3,}\s/.test(line)) {
      flushList(`${key}-fl`);
      blocks.push(<h4 key={key} className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{line.replace(/^#{3,}\s/, "")}</h4>);
    } else if (/^##\s/.test(line)) {
      flushList(`${key}-fl`);
      blocks.push(<h3 key={key} className="mt-3 text-sm font-bold text-status-live">{line.replace(/^##\s/, "")}</h3>);
    } else if (/^[-*]\s/.test(line)) {
      list.push(line.replace(/^[-*]\s/, ""));
    } else if (/^>\s?/.test(line)) {
      flushList(`${key}-fl`);
      blocks.push(<blockquote key={key} className="my-1 border-l-2 border-amber-500/50 pl-2 text-xs italic text-amber-200">{renderInline(line.replace(/^>\s?/, ""), key)}</blockquote>);
    } else if (line.trim() === "") {
      flushList(`${key}-fl`);
    } else {
      flushList(`${key}-fl`);
      blocks.push(<p key={key} className="my-1 text-slate-300">{renderInline(line, key)}</p>);
    }
  });
  flushList("final-fl");

  return <div className="text-sm leading-relaxed">{blocks}</div>;
}
