/** Identify the sending document, not the user. Never persist this across tabs. */
export function createAccountEvents(source = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`) {
  return {
    message: (type: 'changed' | 'clear') => ({ type, source }),
    isExternal: (data: unknown): boolean => {
      // Older open tabs still send strings during a rolling frontend deployment.
      if (data === 'changed' || data === 'clear') return true;
      if (!data || typeof data !== 'object' || !('type' in data) || !('source' in data)) return false;
      return (data.type === 'changed' || data.type === 'clear') &&
        typeof data.source === 'string' && data.source !== source;
    },
  };
}

export const accountEvents = createAccountEvents();
