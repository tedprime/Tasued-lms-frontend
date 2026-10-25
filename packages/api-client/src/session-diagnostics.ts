// Only a timestamp survives the Microsoft redirect. Never store credentials or account data.
const key = 'lms-sign-in-attempt';
const windowMs = 15 * 60_000;
let attempt = 0;
let diagnostic = '';
const listeners = new Set<() => void>();
function publish(value: string) {
  diagnostic = value;
  listeners.forEach(fn => fn());
}
export function beginSignInDiagnostic() {
  attempt = Date.now();
  try { sessionStorage.setItem(key, String(attempt)); } catch { /* Private storage may be unavailable. */ }
  publish('');
}
export function clearSignInDiagnostic() {
  attempt = 0;
  try { sessionStorage.removeItem(key); } catch { /* Optional storage. */ }
  publish('');
}
export function recordSessionDiagnostic(portal: string, status: number | 'NETWORK') {
  let started = attempt;
  try { started ||= Number(sessionStorage.getItem(key)); } catch { /* Use memory fallback. */ }
  if (!started || Date.now() - started > windowMs || started > Date.now()) return;
  publish(`LMS-${portal === 'admin' ? 'ADMIN' : 'STUDENT'}-SESSION-${status}`);
}
export function sessionDiagnosticSucceeded() { publish(''); }
export const sessionDiagnostics = {
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  snapshot: () => diagnostic,
};
