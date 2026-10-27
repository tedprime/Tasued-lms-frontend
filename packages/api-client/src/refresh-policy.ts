/** Feature families affected by a successful API write. No response data is broadcast. */
export function affectedQueryRoots(path: string): string[] {
  const parts = path.split('?')[0].split('/').filter(Boolean);
  const root = parts[0];
  if (root === 'assistant' || root === 'auth' || root === 'push' || root === 'integrations') return [];
  // High-frequency answer/video autosaves have their own local reconciliation.
  if (parts.includes('answers') || parts.includes('position') || parts.at(-1) === 'draft' || parts.at(-1) === 'preview') return [];
  const related: Record<string, string[]> = {
    courses: ['courses', 'content', 'classes', 'assignments', 'quizzes', 'grades', 'attendance', 'recordings', 'forum', 'announcements', 'people', 'auth'],
    modules: ['content', 'courses'], units: ['content', 'courses', 'recordings'],
    classes: ['classes', 'attendance', 'recordings', 'courses'],
    recordings: ['recordings', 'content', 'courses'],
    assignments: ['assignments', 'submissions', 'grades', 'courses'],
    submissions: ['assignments', 'submissions', 'grades'],
    quizzes: ['quizzes', 'quiz-attempts', 'grades', 'courses'],
    'quiz-attempts': ['quizzes', 'quiz-attempts', 'grades'],
    'question-banks': ['quizzes'], questions: ['quizzes'],
    users: ['people', 'courses', 'auth', 'roles', 'attendance', 'grades'],
    roles: ['roles', 'people', 'auth', 'courses'],
    imports: ['people', 'courses', 'imports'],
    forum: ['forum'], threads: ['forum'], posts: ['forum'],
    announcements: ['announcements'], settings: ['settings', 'auth'],
    grades: ['grades', 'assignments', 'quizzes'],
    me: parts.includes('notifications') ? ['notifications']
      : parts.includes('teams-invitation') ? ['teams-setup', 'teams-invitation', 'auth']
      : ['auth', 'preferences'],
  };
  if (root === 'courses' && parts.includes('gradebook')) return ['grades', 'reports', 'dashboard', 'audit'];
  if (root === 'me' && parts.includes('notifications')) return ['notifications', 'dashboard'];
  return [...new Set([...(related[root] ?? [root]), 'dashboard', 'dashboards', 'reports', 'search', 'audit', 'notifications'])];
}

/** These query results drive local autosave/player state and must not be replaced by generic refresh. */
export function refreshProtected(key: readonly unknown[]): boolean {
  return key.includes('playback') || key.includes('position') || key[0] === 'quiz-attempts';
}

const listeners = new Set<(roots: string[]) => void>();
export function onApiWrite(listener: (roots: string[]) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function notifyApiWrite(path: string) {
  const roots = affectedQueryRoots(path);
  if (roots.length) for (const listener of listeners) {
    // A refresh failure must not turn an accepted write into a failed mutation.
    try { listener(roots); } catch { /* query errors are presented by the consuming page */ }
  }
}

export function blocksCachedData(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'status' in error &&
    [401, 403, 404, 410].includes(Number(error.status));
}

