import React, { createContext, useContext } from 'react';
import { useSpecular } from '../hooks/useSpecular';
import { useToastContext } from './ToastContext';
import { useServiceError } from '../hooks/useServiceError';

const SpecularContext = createContext(null);

/**
 * SpecularProvider — wraps the app and provides specular generation state.
 */
export function SpecularProvider({ children }) {
  const { toast } = useToastContext();
  const { showError } = useServiceError();
  const value = useSpecular({ onNotify: toast, onError: showError });

  return (
    <SpecularContext.Provider value={value}>
      {children}
    </SpecularContext.Provider>
  );
}

/**
 * useSpecularContext — returns the full useSpecular interface:
 *   { generating, deploying, elapsedSeconds, result, status,
 *     generate, abort, deploySpec, clearStatus }
 */
export function useSpecularContext() {
  const ctx = useContext(SpecularContext);
  if (!ctx) throw new Error('useSpecularContext must be used inside <SpecularProvider>');
  return ctx;
}
