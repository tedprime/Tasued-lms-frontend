import { Component, useState, type ReactNode } from "react";
import { RichTextEditor, type RichTextEditorProps } from "@tasued/editor";
import { RichContent, SegmentedControl, Textarea } from "@tasued/ui";

/**
 * Local guard around the shared RichTextEditor. If the editor fails to mount
 * (e.g. Lexical's dev-only node checks), staff can still edit the HTML directly
 * instead of losing the whole page to the route error boundary.
 */
class EditorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.warn("RichTextEditor failed; using the HTML fallback.", e);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function HtmlFallback({ value, onChange, placeholder, minHeight = 200 }: RichTextEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-warning-50/40 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-warning">The rich-text editor couldn't load — you're editing HTML directly.</p>
        <SegmentedControl<"edit" | "preview"> value={mode} onChange={setMode} options={[{ key: "edit", label: "HTML" }, { key: "preview", label: "Preview" }]} />
      </div>
      {mode === "edit" ? (
        <Textarea aria-label="Content (HTML)" className="font-mono text-xs" style={{ minHeight }} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <div className="rounded-lg bg-white p-3" style={{ minHeight }}><RichContent html={value} /></div>
      )}
    </div>
  );
}

export function Editor(props: RichTextEditorProps) {
  return (
    <EditorBoundary fallback={<HtmlFallback {...props} />}>
      <RichTextEditor {...props} />
    </EditorBoundary>
  );
}
