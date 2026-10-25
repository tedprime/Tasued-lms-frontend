import { useState, useSyncExternalStore } from 'react';
import { sessionDiagnostics } from '@tasued/api-client';
import { Alert, Button } from './primitives';

export function SessionDiagnostic({ retry, loading }: { retry: () => unknown; loading: boolean }) {
  const code = useSyncExternalStore(sessionDiagnostics.subscribe, sessionDiagnostics.snapshot, () => '');
  const [copied, setCopied] = useState(false);
  if (!code) return null;
  const explanation = code.endsWith('-401')
    ? 'The server could not confirm your session after sign-in. Your browser may have blocked the sign-in cookie, or the session may no longer be valid.'
    : code.endsWith('-403')
      ? 'The server refused access to this portal. Your account or portal permissions need to be checked.'
      : code.endsWith('-NETWORK')
        ? 'We could not reach the session check. A connection problem or browser restriction may be preventing it.'
        : 'The session check failed on the server. Please try again shortly.';
  return <Alert tone="red" title="We couldn't confirm your sign-in" className="my-4">
    <p>{explanation}</p>
    <p className="mt-2">Share the code below with support. You do not need to inspect your browser.</p>
    <p className="mt-2 break-all font-mono text-xs" aria-live="polite">{code}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => { void retry(); }}>{loading ? 'Checking...' : 'Check session again'}</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => { void navigator.clipboard?.writeText(code).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? 'Copied' : 'Copy code'}</Button>
    </div>
  </Alert>;
}
