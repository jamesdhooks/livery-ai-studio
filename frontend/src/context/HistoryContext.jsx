import React, { createContext, useContext, useEffect } from 'react';
import { useHistory } from '../hooks/useHistory';

const HistoryContext = createContext(null);

/**
 * HistoryProvider — wraps the app and provides history state.
 *
 * Loads history on mount so spend totals are available immediately.
 */
export function HistoryProvider({ children }) {
  const value = useHistory();

  // Load history on mount
  useEffect(() => {
    value.loadHistory();
  }, []);

  return (
    <HistoryContext.Provider value={value}>
      {children}
    </HistoryContext.Provider>
  );
}

/**
 * useHistoryContext — returns the full useHistory interface:
 *   { items, loading, error, loadHistory, deleteItem, trashMany,
 *     updateItemCar, getTotalSpend,
 *     trashItems, trashCount, trashLoading,
 *     loadTrash, restoreFromTrash, restoreManyFromTrash, clearTrash }
 */
export function useHistoryContext() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistoryContext must be used inside <HistoryProvider>');
  return ctx;
}
