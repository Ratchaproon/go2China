import { Fragment, type ReactNode } from "react";

// Minimal, safe markdown subset for agent replies: paragraphs, bullet and
// numbered lists, headings, **bold**, `code`. No raw HTML is ever rendered.

function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

/** External link that always shows its domain, so students can see where it leads. */
export function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  const u = safeUrl(href);
  if (!u) return <>{children}</>;
  return (
    <a href={u.href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-brand underline underline-offset-2">
      {children}
      <span className="ml-1 inline-block text-xs text-muted">↗ {u.hostname.replace(/^www\./, "")}</span>
    </a>
  );
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<b key={m.index}>{tok.slice(2, -2)}</b>);
    else if (tok.startsWith("`")) out.push(<code key={m.index} className="rounded bg-surface-2 px-1">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("[")) {
      const [, label, href] = /^\[([^\]]+)\]\((.+)\)$/.exec(tok)!;
      out.push(<ExtLink key={m.index} href={href}>{label}</ExtLink>);
    } else {
      const href = tok.replace(/[.,;:]+$/, "");
      out.push(<ExtLink key={m.index} href={href}>{href}</ExtLink>);
      if (href.length < tok.length) out.push(tok.slice(href.length));
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={`my-1 space-y-1 pl-5 ${list.ordered ? "list-decimal" : "list-disc"}`}>
        {list.items.map((it, i) => <li key={i}>{inline(it)}</li>)}
      </Tag>,
    );
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || num) {
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? num)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const h = /^#{1,4}\s+(.*)$/.exec(line);
    if (h) blocks.push(<p key={blocks.length} className="mt-2 font-bold">{inline(h[1])}</p>);
    else blocks.push(<p key={blocks.length} className="my-1">{inline(line)}</p>);
  }
  flush();
  return <Fragment>{blocks}</Fragment>;
}
