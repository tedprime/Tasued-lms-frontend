import React, { type ReactNode } from 'react';

const Fragment = React.Fragment;

function inline(text: string): ReactNode {
  return text.split(/(`[^`\n]+`|\[[^\]\n]+\]\(https:\/\/[^\s)]+\)|https:\/\/[^\s<>]+|\*\*[^*\n]+\*\*)/g).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="rounded bg-neutral-100 px-1 font-mono text-[0.9em]">{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const link = /^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/.exec(part);
    if (link || part.startsWith('https://')) {
      const target = link ? link[2] : part.replace(/[.,;!?]+$/, '');
      try {
        const url = new URL(target);
        if (url.protocol === 'https:' && !url.username && !url.password) return <Fragment key={i}><a href={url.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{link ? link[1] : target}</a>{link ? '' : part.slice(target.length)}</Fragment>;
      } catch { /* Malformed links remain plain text. */ }
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

// A small text-only Markdown renderer. React escapes HTML from the provider.
export function AssistantMessage({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  const item = (line: string) => /^\s*(?:(\d+)[.)]|([-*+]))\s+(.+)$/.exec(line);
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].trim()) { i++; continue; }
    if (/^\s*```/.test(lines[i])) {
      const code: string[] = []; i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push(<pre key={blocks.length} className="max-w-full overflow-x-auto rounded-lg bg-neutral-100 p-2 text-xs"><code>{code.join('\n')}</code></pre>);
      continue;
    }
    const match = item(lines[i]);
    if (match) {
      const ordered = !!match[1];
      const start = ordered ? Number(match[1]) : undefined;
      const items: string[] = [];
      while (i < lines.length) {
        const next = item(lines[i]);
        if (!next || !!next[1] !== ordered) break;
        let content = next[3]; i++;
        while (i < lines.length && lines[i].trim() && !item(lines[i]) && !/^\s*(?:```|#{1,6}\s)/.test(lines[i])) content += '\n' + lines[i++].trim();
        items.push(content);
        if (!lines[i]?.trim() && i + 1 < lines.length && item(lines[i + 1])) i++;
      }
      const children = items.map((content, index) => <li key={index} className="pl-1 whitespace-pre-wrap">{inline(content)}</li>);
      blocks.push(ordered
        ? <ol key={blocks.length} start={start} className="list-decimal space-y-2 pl-5 marker:font-semibold">{children}</ol>
        : <ul key={blocks.length} className="list-disc space-y-2 pl-5">{children}</ul>);
      continue;
    }
    const heading = /^\s*#{1,6}\s+(.+)$/.exec(lines[i]);
    if (heading) { blocks.push(<p key={blocks.length} className="font-semibold">{inline(heading[1])}</p>); i++; continue; }
    const paragraph: string[] = [lines[i++]];
    while (i < lines.length && lines[i].trim() && !item(lines[i]) && !/^\s*(?:```|#{1,6}\s)/.test(lines[i])) paragraph.push(lines[i++]);
    blocks.push(<p key={blocks.length} className="whitespace-pre-wrap">{inline(paragraph.join('\n'))}</p>);
  }
  return <div className="min-w-0 space-y-3 break-words [overflow-wrap:anywhere]">{blocks}</div>;
}
