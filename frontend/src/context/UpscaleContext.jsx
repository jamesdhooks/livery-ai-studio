import React, { createContext, useContext } from 'react';
import { useUpscale } from '../hooks/useUpscale';
import { useToastContext } from './ToastContext';

const UpscaleContext = createContext(null);

/**
 * UpscaleProvider — wraps the app and provides upscale/deploy state.
 */
export function UpscaleProvider({ children }) {
  const { toast } = useToastContext();
  const value = useUpscale({ onNotify: toast });

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
