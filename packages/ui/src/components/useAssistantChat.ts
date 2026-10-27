import { useCallback, useEffect, useRef, useState } from 'react';
import { api, isApiError } from '@tasued/api-client';

type Message = { id: string; role: 'user' | 'assistant'; text: string; links?: { title: string; url: string }[]; suggestions?: { title: string; value: string }[] };
export function useAssistantChat(open: boolean) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [slow, setSlow] = useState(false);
  const session = useRef<{ ticket: string; watermark?: string } | null>(null);
  const running = useRef(false);
  const blocked = useRef(false);
  const request = useRef<AbortController | null>(null);
  const waitingSince = useRef(0);
  const nextPoll = useRef(0);
  const generation = useRef(0);

  useEffect(() => () => { generation.current++; request.current?.abort(); session.current = null; }, []);
  const fail = useCallback((e: unknown) => {
    blocked.current = true;
    setWaiting(false);
    setError(isApiError(e) ? e.message : 'We could not connect to the assistant. Check your connection and try again.');
    setExpired(isApiError(e) && e.code === 'CHAT_EXPIRED');
  }, []);
  const poll = useCallback(async () => {
    if (running.current || blocked.current || !session.current) return;
    running.current = true;
    const gen = generation.current;
    const controller = new AbortController(); request.current = controller;
    try {
      const result = await api.assistant.poll(session.current.ticket, session.current.watermark, AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]));
      if (gen !== generation.current) return;
      session.current = { ticket: result.ticket, watermark: result.watermark };
      setMessages(old => {
        const ids = new Set(old.map(m => m.id));
        return [...old, ...result.messages.filter(m => !ids.has(m.id)).map(m => ({ ...m, role: 'assistant' as const }))].slice(-200);
      });
      if (result.messages.length) { waitingSince.current = 0; setWaiting(false); setSlow(false); }
      nextPoll.current = Date.now() + (waitingSince.current ? 2000 : 10000);
      if (waitingSince.current && Date.now() - waitingSince.current > 45000) setSlow(true);
      if (waitingSince.current && Date.now() - waitingSince.current > 120000) { waitingSince.current = 0; setWaiting(false); blocked.current = true; setError('The assistant has not replied yet. Check again, or start a new conversation.'); }
    } catch (e) { if (gen === generation.current && !controller.signal.aborted) fail(e); }
    finally { if (gen === generation.current) running.current = false; }
  }, [fail]);
  useEffect(() => {
    if (!open) return;
    const tick = () => { if (document.visibilityState === 'visible' && Date.now() >= nextPoll.current) void poll(); };
    tick(); const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [open, poll]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || text.length > 4000 || running.current || expired || waitingSince.current) return false;
    running.current = true; blocked.current = false; setBusy(true); setError(''); setSlow(false);
    const gen = generation.current;
    const controller = new AbortController(); request.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]);
    try {
      if (!session.current) { const started = await api.assistant.start(signal); if (gen !== generation.current) return false; session.current = started; }
      if (gen !== generation.current) return false;
      const result = await api.assistant.send(session.current.ticket, text, signal);
      if (gen !== generation.current) return false;
      session.current.ticket = result.ticket;
      setMessages(old => [...old, { id: result.id, text, role: 'user' }]);
      waitingSince.current = Date.now(); setWaiting(true); nextPoll.current = 0;
      return true;
    } catch (e) { if (gen === generation.current && !controller.signal.aborted) fail(e); return false; }
    finally { if (gen === generation.current) { running.current = false; setBusy(false); } }
  };
  const reset = () => {
    generation.current++; request.current?.abort(); session.current = null;
    running.current = false; blocked.current = false; waitingSince.current = 0; nextPoll.current = 0;
    setMessages([]); setBusy(false); setWaiting(false); setError(''); setExpired(false); setSlow(false);
  };
  const retry = () => { blocked.current = false; setError(''); setWaiting(!!waitingSince.current); nextPoll.current = 0; if (session.current) void poll(); };
  return { messages, busy, waiting, error, expired, slow, send, reset, retry };
}

