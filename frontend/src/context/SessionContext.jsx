import React, { createContext, useContext } from 'react';
import { useSession } from '../hooks/useSession';

const SessionContext = createContext(null);

/**
 * SessionProvider — wraps the app and provides session persistence.
 *
 * Exposes `session`, `saveSession`, `debouncedSave`, and `debouncedSaveModeState`
 * to any descendant via `useSessionContext()`.
 */
export function SessionProvider({ children }) {
  const value = useSession();
  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

/**
 * useSessionContext — returns the full useSession interface:
 *   { session, loadSession, saveSession, debouncedSave, debouncedSaveModeState }
 */
export function useSessionContext() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSessionContext must be used inside <SessionProvider>');
  return ctx;
}
