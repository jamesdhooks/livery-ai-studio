import React, { createContext, useContext } from 'react';
import { useConfig } from '../hooks/useConfig';

const ConfigContext = createContext(null);

/**
 * ConfigProvider — wraps the app and provides persistent configuration.
 *
 * Exposes `config`, `loading`, `error`, `saveConfig`, `reloadConfig`
 * to any descendant via `useConfigContext()`.
 */
export function ConfigProvider({ children }) {
  const value = useConfig();
  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

/**
 * useConfigContext — returns the full useConfig interface:
 *   { config, loading, error, saveConfig, reloadConfig }
 */
export function useConfigContext() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfigContext must be used inside <ConfigProvider>');
  return ctx;
}
