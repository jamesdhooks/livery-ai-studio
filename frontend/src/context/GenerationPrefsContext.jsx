import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useSessionContext } from './SessionContext';

const GenerationPrefsContext = createContext(null);

/**
 * GenerationPrefsProvider — app-wide generation preferences (model, 2K, autoUpscale).
 *
 * Shared across GenerateTab, SpecularTab, ModelSelector, etc.
 * Changes are automatically persisted to the session backend.
 */
export function GenerationPrefsProvider({ children }) {
  const { session, saveSession } = useSessionContext();

  const [genModel, setGenModel] = useState('pro');
  const [genIs2K, setGenIs2K] = useState(false);
  const [genAutoUpscale, setGenAutoUpscale] = useState(false);

  // Restore from session (once on load)
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!session || restoredRef.current) return;
    restoredRef.current = true;
    if (session.last_model === 'flash' || session.last_model === 'pro') {
      setGenModel(session.last_model);
    }
    if (session.last_is_2k === true) setGenIs2K(true);
     
  }, [session]);

  const handleModelChange = useCallback((m) => {
    setGenModel(m);
    saveSession({ last_model: m });
  }, [saveSession]);

  const handleIs2KChange = useCallback((v) => {
    setGenIs2K(v);
    saveSession({ last_is_2k: v });
  }, [saveSession]);

  const handleAutoUpscaleChange = useCallback((v) => {
    setGenAutoUpscale(v);
  }, []);

  const value = {
    genModel,
    genIs2K,
    genAutoUpscale,
    setGenModel: handleModelChange,
    setGenIs2K: handleIs2KChange,
    setGenAutoUpscale: handleAutoUpscaleChange,
  };

  return (
    <GenerationPrefsContext.Provider value={value}>
      {children}
    </GenerationPrefsContext.Provider>
  );
}

/**
 * useGenerationPrefs — returns generation preference state:
 *   { genModel, genIs2K, genAutoUpscale, setGenModel, setGenIs2K, setGenAutoUpscale }
 */
export function useGenerationPrefs() {
  const ctx = useContext(GenerationPrefsContext);
  if (!ctx) throw new Error('useGenerationPrefs must be used inside <GenerationPrefsProvider>');
  return ctx;
}
