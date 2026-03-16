import React, { createContext, useContext } from 'react';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/common/Toast';

const ToastContext = createContext(null);

/**
 * ToastProvider — wraps the app and provides the `useToastContext` hook.
 * Also renders the ToastContainer at the root level.
 */
export function ToastProvider({ children }) {
  const { toasts, toast, dismiss } = useToast();

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * useToastContext — returns { toast, dismiss }
 *
 * toast(message, type?, duration?)
 *   type: 'info' | 'success' | 'error' | 'warning'
 *   duration: ms (default 4000, 0 = sticky)
 */
export function useToastContext() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToastContext must be used inside <ToastProvider>');
  return ctx;
}
