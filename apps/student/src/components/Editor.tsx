import { Component, useState, type ReactNode } from "react";
import { RichTextEditor, type RichTextEditorProps } from "@tasued/editor";
import { Textarea } from "@tasued/ui";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toHtml = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escape(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
const toText = (html: string) => html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.error("[editor] falling back to plain text", e);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function PlainFallback({ value, onChange, placeholder, minHeight }: RichTextEditorProps) {
  const [text, setText] = useState(() => toText(value));
  return (
    <div>
      <Textarea
        value={text}
        placeholder={placeholder}
        style={minHeight ? { minHeight } : undefined}
        rows={8}
        onChange={(e) => {
          setText(e.target.value);
          onChange(toHtml(e.target.value));
        }}
      />
      <p className="mt-1 text-xs text-neutral-500">Formatting tools couldn't load, so you're writing plain text.</p>
    </div>
  );
}

/** The shared Lexical editor, guarded so an editor crash degrades to a plain textarea instead of an error page. */
export function Editor(props: RichTextEditorProps) {
  return (
    <Boundary fallback={<PlainFallback {...props} />}>
      <RichTextEditor {...props} />
    </Boundary>
  );
}
