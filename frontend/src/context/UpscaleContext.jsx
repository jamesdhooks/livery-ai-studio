import React, { createContext, useContext } from 'react';
import { useUpscale } from '../hooks/useUpscale';
import { useToastContext } from './ToastContext';
import { useServiceError } from '../hooks/useServiceError';

const UpscaleContext = createContext(null);

/**
 * UpscaleProvider — wraps the app and provides upscale/deploy state.
 */
export function UpscaleProvider({ children }) {
  const { toast } = useToastContext();
  const { showError } = useServiceError();
  const value = useUpscale({ onNotify: toast, onError: showError });

  return (
    <UpscaleContext.Provider value={value}>
      {children}
    </UpscaleContext.Provider>
  );
}

/**
 * useUpscaleContext — returns the full useUpscale interface:
 *   { upscaling, resampling, deploying, result, error, status, upscale, resample, deploy, clearStatus }
 */
export function useUpscaleContext() {
  const ctx = useContext(UpscaleContext);
  if (!ctx) throw new Error('useUpscaleContext must be used inside <UpscaleProvider>');
  return ctx;
}
