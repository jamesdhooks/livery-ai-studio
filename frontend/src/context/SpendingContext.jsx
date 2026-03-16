import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useSpending } from '../hooks/useSpending';
import { useHistoryContext } from './HistoryContext';

const SpendingContext = createContext(null);

/**
 * SpendingProvider — wraps the app and provides spending tracking.
 *
 * Also provides `handleTransaction` which integrates spending with history reloads.
 * Also provides `lastTransaction` for the TopBar flash animation.
 */
export function SpendingProvider({ children }) {
  const {
    entries, totalSpend, getTotalSpend, loading,
    reload, addOptimistic, settle, recordTransaction,
    serverEntries, optimisticEntries,
  } = useSpending();
  const { loadHistory } = useHistoryContext();
  const [lastTransaction, setLastTransaction] = useState(null);

  // Load spending on mount
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTransaction = useCallback(({ amount, type, model, car, resolution }) => {
    if (amount <= 0) return;
    setLastTransaction({ amount, type, model, id: Date.now() });
    if (type === 'estimated') {
      addOptimistic({ cost: amount, model, resolution: resolution || '1K', status: 'estimated', car: car || '' });
    } else if (type === 'actual') {
      reload();
      loadHistory();
    } else if (type === 'cancelled') {
      recordTransaction({ cost: amount, model, resolution: resolution || '1K', status: 'cancelled', car: car || '' });
    }
  }, [addOptimistic, reload, recordTransaction, loadHistory]);

  const value = {
    entries,
    serverEntries,
    optimisticEntries,
    totalSpend,
    getTotalSpend,
    loading,
    reload,
    addOptimistic,
    settle,
    recordTransaction,
    lastTransaction,
    handleTransaction,
  };

  return (
    <SpendingContext.Provider value={value}>
      {children}
    </SpendingContext.Provider>
  );
}

/**
 * useSpendingContext — returns the full useSpending interface plus:
 *   { lastTransaction, handleTransaction }
 */
export function useSpendingContext() {
  const ctx = useContext(SpendingContext);
  if (!ctx) throw new Error('useSpendingContext must be used inside <SpendingProvider>');
  return ctx;
}
