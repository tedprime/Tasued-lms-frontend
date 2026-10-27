import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, MessageCircle, Plus, Sparkles, X, LoaderCircle } from 'lucide-react';
import { cn } from '../lib/cn';
import { useAssistantChat } from './useAssistantChat';

// React escapes text. Provider HTML is never inserted into the document.
function MessageText({ text }: { text: string }) {
  return <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{text.split(/(\[[^\]\n]+\]\(https:\/\/[^\s)]+\)|\*\*[^*\n]+\*\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const link = /^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/.exec(part);
    if (link) { try { const url = new URL(link[2]); if (!url.username && !url.password) return <a key={i} href={url.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{link[1]}</a>; } catch { /* Render malformed links as text. */ } }
    return <Fragment key={i}>{part}</Fragment>;
  })}</div>;
}
const prompts = ['How do I join a class?', 'Help me understand a topic', 'How do I submit an assignment?'];
export function LmsAssistant({ aboveMobileNavigation = false }: { aboveMobileNavigation?: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const chat = useAssistantChat(open);
  const trigger = useRef<HTMLButtonElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const panelId = useId();
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => { if (open) closeButton.current?.focus(); }, [open]);
  useEffect(() => { if (open && follow.current && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight; }, [open, chat.messages, chat.waiting, chat.error]);
  const send = async (text = draft) => { follow.current = true; if (await chat.send(text)) setDraft(current => current === text ? '' : current); };
  const newChat = () => { chat.reset(); setDraft(''); setConfirmReset(false); composer.current?.focus(); };
  const suggestions = chat.messages.at(-1)?.role === 'assistant' ? chat.messages.at(-1)?.suggestions ?? [] : [];
  return createPortal(<div className={cn('pointer-events-none fixed right-3 z-40 flex flex-col items-end gap-3 md:right-4',
    aboveMobileNavigation ? 'bottom-[calc(5rem+env(safe-area-inset-bottom))] [--chat-space:calc(9.5rem+env(safe-area-inset-bottom)+env(safe-area-inset-top))] md:bottom-6 md:[--chat-space:6.5rem]' : 'bottom-[calc(1rem+env(safe-area-inset-bottom))] [--chat-space:calc(5.5rem+env(safe-area-inset-bottom)+env(safe-area-inset-top))] md:bottom-6 md:[--chat-space:6.5rem]')}>
    {open && <section id={panelId} role="dialog" aria-label="TASFUED LMS Assistant" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}
      className="pointer-events-auto flex h-[min(620px,calc(100dvh-var(--chat-space)))] w-[min(400px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-tertiary-500 shadow-pop">
      <header className="flex shrink-0 items-center gap-3 bg-primary-500 px-4 py-4 text-white">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15"><Sparkles className="size-5" aria-hidden /></span>
        <div className="min-w-0 flex-1"><h2 className="text-sm font-bold">TASFUED LMS Assistant</h2><p className="mt-0.5 text-xs text-white/75">Your learning companion</p></div>
        <button type="button" aria-label="New conversation" title="New conversation" onClick={() => chat.messages.length || draft ? setConfirmReset(true) : newChat()} className="rounded-lg p-2 hover:bg-white/15"><Plus className="size-4" /></button>
        <button ref={closeButton} type="button" aria-label="Minimise chat" title="Minimise chat" onClick={close} className="rounded-lg p-2 hover:bg-white/15"><X className="size-4" /></button>
      </header>
      {confirmReset && <div role="alert" className="shrink-0 border-b border-neutral-200 bg-neutral-50 p-3 text-sm">Start a new conversation? This clears the current chat.<div className="mt-2 flex gap-3"><button onClick={newChat} className="font-semibold text-primary-500">Start new</button><button onClick={() => setConfirmReset(false)}>Keep chatting</button></div></div>}
      <div ref={transcript} onScroll={e => { const el = e.currentTarget; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-neutral-50/60 p-4">
        {!chat.messages.length && <div className="py-3"><span className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-500"><Sparkles className="size-6" /></span><h3 className="text-lg font-bold">What can I help you learn?</h3><p className="mt-2 text-sm leading-relaxed text-neutral-500">Ask about a topic or get help finding your way around the LMS.</p><div className="mt-5 space-y-2">{prompts.map(p => <button key={p} disabled={chat.locked} onClick={() => void send(p)} className="block w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-left text-sm transition hover:border-primary-300 hover:bg-primary-50 disabled:opacity-50">{p}</button>)}</div></div>}
        <div role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions" className="space-y-4">{chat.messages.map(m => <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}><div className={cn('max-w-[92%] rounded-2xl px-3.5 py-3 text-sm leading-relaxed', m.role === 'user' ? 'rounded-br-md bg-primary-500 text-white' : 'rounded-bl-md border border-neutral-200 bg-white')}><span className="sr-only">{m.role === 'user' ? 'You: ' : 'Assistant: '}</span><MessageText text={m.text} />{!!m.links?.length && <div className="mt-3 border-t border-neutral-200 pt-2 text-xs">{m.links.map((link, i) => <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="mr-3 inline-block underline">{link.title}</a>)}</div>}</div></div>)}</div>
        {(chat.busy || chat.waiting) && <p role="status" className="flex items-center gap-2 text-xs text-neutral-500"><LoaderCircle className="size-4 animate-spin" />{chat.busy ? 'Sending…' : chat.slow ? 'Still working on your answer…' : 'Thinking…'}</p>}
        {!!suggestions.length && !chat.waiting && !chat.busy && <div className="flex flex-wrap gap-2">{suggestions.map((s, i) => <button key={i} disabled={chat.locked} onClick={() => void send(s.value)} className="rounded-xl border border-primary-200 bg-white px-3 py-2 text-left text-xs text-primary-600">{s.title}</button>)}</div>}
        {chat.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{chat.error}<button type="button" onClick={chat.expired ? newChat : chat.retry} className="mt-2 block font-semibold underline">{chat.expired ? 'Start new conversation' : 'Try again'}</button></div>}
      </div>
      <form onSubmit={e => { e.preventDefault(); void send(); }} className="shrink-0 border-t border-neutral-200 bg-white p-3">
        <div className="flex items-end gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2 focus-within:border-primary-400">
          <textarea ref={composer} aria-label="Message the assistant" rows={2} maxLength={4000} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Ask a question…" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} className="min-w-0 flex-1 resize-none bg-transparent px-1 py-1 text-base leading-6 outline-none" />
          <button type="submit" aria-label="Send message" disabled={!draft.trim() || chat.locked} className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40"><ArrowUp className="size-5" /></button>
        </div>
        <p className="mt-2 text-center text-[10px] leading-4 text-neutral-500">AI can make mistakes. No access to personal LMS records.</p>
      </form>
    </section>}
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} aria-label={open ? 'Minimise LMS Assistant' : 'LMS Assistant'} onClick={() => open ? close() : setOpen(true)} className="pointer-events-auto inline-flex h-12 items-center gap-2 rounded-full bg-primary-500 px-4 text-sm font-semibold text-white shadow-pop hover:bg-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500">{open ? <X className="size-5" aria-hidden /> : <MessageCircle className="size-5" aria-hidden />} LMS Assistant</button>
  </div>, document.body);
}
