import { useState, useEffect, useCallback, useRef } from 'react';
import sessionService from '../services/SessionService';

/**
 * useSession — persists and restores transient form state across page reloads.
 *
 * Loads the last session on mount and provides `saveSession` for immediate
 * persistence and `debouncedSave` for high-frequency field changes (e.g.
 * prompt textarea keystrokes) that should only persist after a short pause.
 *
 * @returns {{
 *   session: Object|null,
 *   loadSession: () => Promise<Object|null>,
 *   saveSession: (data: Object) => void,
 *   debouncedSave: (key: string, value: any, delay?: number) => void,
 * }}
 */
export function useSession() {
  const [session, setSession] = useState(null);
  const saveTimerRef = useRef({});

  const loadSession = useCallback(async () => {
    try {
      const data = await sessionService.getSession();
      setSession(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  const saveSession = useCallback((data) => {
    sessionService.saveSession(data).catch(() => {});
    setSession(prev => ({ ...prev, ...data }));
  }, []);

  const debouncedSave = useCallback((key, value, delay = 500) => {
    if (saveTimerRef.current[key]) {
      clearTimeout(saveTimerRef.current[key]);
    }
    saveTimerRef.current[key] = setTimeout(() => {
      saveSession({ [key]: value });
    }, delay);
  }, [saveSession]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  return { session, loadSession, saveSession, debouncedSave };
}
