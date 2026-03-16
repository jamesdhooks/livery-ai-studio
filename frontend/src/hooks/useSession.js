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
    console.log('[FRONTEND_SAVE] saveSession called with:', Object.keys(data));
    sessionService.saveSession(data)
      .then(() => console.log('[FRONTEND_SAVE] Success!'))
      .catch(err => console.error('[FRONTEND_SAVE] Error:', err));
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

  // Debounced save for modeState (for text input changes)
  const debouncedSaveModeState = useCallback((modeState, delay = 500) => {
    console.log('[FRONTEND_DEBOUNCE] Timer queued, delay:', delay, 'prompt:', modeState?.new?.prompt?.substring(0, 40));
    if (saveTimerRef.current.modeState) {
      clearTimeout(saveTimerRef.current.modeState);
    }
    saveTimerRef.current.modeState = setTimeout(() => {
      console.log('[FRONTEND_DEBOUNCE] Timer fired! Calling saveSession with modeState');
      saveSession({ modeState });
    }, delay);
  }, [saveSession]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  return { session, loadSession, saveSession, debouncedSave, debouncedSaveModeState };
}
