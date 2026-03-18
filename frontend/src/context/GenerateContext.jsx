import React, { createContext, useContext } from 'react';
import { useGenerate } from '../hooks/useGenerate';
import { useToastContext } from './ToastContext';
import { useSpendingContext } from './SpendingContext';
import { useServiceError } from '../hooks/useServiceError';

const GenerateContext = createContext(null);

/**
 * GenerateProvider — wraps the app and provides livery generation state.
 *
 * Automatically integrates with SpendingContext for transaction tracking,
 * ToastContext for notifications, and ServiceErrorContext for error modals.
 */
export function GenerateProvider({ children }) {
  const { toast } = useToastContext();
  const { handleTransaction } = useSpendingContext();
  const { showError } = useServiceError();
  const value = useGenerate({ onNotify: toast, onTransaction: handleTransaction, onError: showError });

  return (
    <GenerateContext.Provider value={value}>
      {children}
    </GenerateContext.Provider>
  );
}

/**
 * useGenerateContext — returns the full useGenerate interface:
 *   { generating, elapsedSeconds, result, error, status,
 *     generate, abort, uploadFile, browseUploads, deleteUpload,
 *     clearStatus, clearError }
 */
export function useGenerateContext() {
  const ctx = useContext(GenerateContext);
  if (!ctx) throw new Error('useGenerateContext must be used inside <GenerateProvider>');
  return ctx;
}
