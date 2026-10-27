import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, MessageCircle, RotateCw, X } from "lucide-react";
import { cn } from "../lib/cn";

// Public embed URL only. Never append LMS credentials or account data.
const CHAT_URL = "https://copilotstudio.microsoft.com/environments/Default-3b8d2f05-74fd-4bce-8103-c6d5f55eac08/bots/crbbc_tasuedlms_7Sa742/webchat?__version__=2&enableFileAttachment=false&cliAgent=true";

export function LmsAssistant({ aboveMobileNavigation = false }: { aboveMobileNavigation?: boolean }) {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const panel = dialog.current;
    const previousOverflow = document.body.style.overflow;
    panel?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      panel?.close();
      document.body.style.overflow = previousOverflow;
      trigger.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoaded(false);
    setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), 15000);
    return () => window.clearTimeout(timer);
  }, [open, attempt]);

  return <>
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen(true)}
      className={cn("fixed right-4 z-30 inline-flex items-center gap-2 rounded-full bg-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-pop hover:bg-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
        aboveMobileNavigation ? "bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6" : "bottom-[calc(1rem+env(safe-area-inset-bottom))] md:bottom-6")}>
      <MessageCircle className="size-5" aria-hidden /> LMS Assistant
    </button>
    {open && createPortal(
      <dialog ref={dialog} aria-labelledby={titleId} onCancel={() => setOpen(false)}
        className="fixed inset-0 m-auto h-dvh max-h-dvh w-full max-w-full overflow-hidden border-0 bg-white p-0 text-tertiary-500 shadow-pop backdrop:bg-black/40 sm:h-[85dvh] sm:max-w-2xl sm:rounded-2xl">
        <div className="flex h-full min-h-0 flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
            <h2 id={titleId} className="min-w-0 font-headline text-lg font-bold">TASFUED LMS Assistant</h2>
            <button autoFocus type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="shrink-0 rounded-lg p-2 hover:bg-neutral-100"><X className="size-5" /></button>
          </header>
          <p className="shrink-0 px-4 py-2 text-xs text-neutral-600">Help with learning and using the LMS. This chat cannot access your personal LMS records.</p>
          {!loaded && <p role="status" className="px-4 py-2 text-sm text-neutral-600">{slow ? "Taking longer than expected. Try reloading or open the chat in a new tab." : "Loading assistant…"}</p>}
          <iframe key={attempt} src={CHAT_URL} title="TASFUED LMS Assistant chat" referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)} className="min-h-0 w-full flex-1 border-0" />
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-neutral-200 px-4 py-2 text-sm">
            <button type="button" onClick={() => setAttempt(value => value + 1)} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-neutral-100"><RotateCw className="size-4" aria-hidden />Reload chat</button>
            <a href={CHAT_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-neutral-100">Open in new tab <ExternalLink className="size-4" aria-hidden /></a>
          </footer>
        </div>
      </dialog>, document.body)}
  </>;
}
