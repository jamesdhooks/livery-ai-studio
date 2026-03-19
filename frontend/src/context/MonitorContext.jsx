/**
 * MonitorContext — provides folder-monitor state and actions app-wide.
 *
 * Wrap with MonitorProvider and consume via useMonitorContext().
 */
import React, { createContext, useContext } from 'react';
import { useMonitor } from '../hooks/useMonitor';

const MonitorContext = createContext(null);

export function MonitorProvider({ children }) {
  const value = useMonitor();
  return (
    <MonitorContext.Provider value={value}>
      {children}
    </MonitorContext.Provider>
  );
}

export function useMonitorContext() {
  const ctx = useContext(MonitorContext);
  if (!ctx) {
    // Return a safe default if called outside MonitorProvider
    // This prevents errors in edge cases like during SSR or early renders
    return {
      active: false,
      monitor: null,
      loading: false,
      error: null,
      startMonitor: async () => {},
      stopMonitor: async () => {},
      refreshStatus: async () => {},
    };
  }
  return ctx;
}
