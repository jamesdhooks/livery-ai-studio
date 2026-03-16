import { useState, useCallback, useRef, useMemo } from 'react';
import spendingService from '../services/SpendingService';

/**
 * useSpending — authoritative spending tracker
 *
 * Replaces the previous pendingSpend + getTotalSpend(historyItems) approach.
 * The backend spending log is the single source of truth: it records every
 * transaction (success, failed, cancelled) independently of history TGA files,
 * so the total is never affected by history deletions or failed generations.
 *
 * For immediate UI feedback we maintain an `optimisticEntries` list that is
 * added to instantly (before the server round-trip completes), giving the user
 * real-time display without waiting for a reload.
 *
 * Usage:
 *   const { totalSpend, entries, addOptimistic, settle, reload } = useSpending();
 */
export function useSpending() {
  // Entries fetched from the backend (authoritative)
  const [serverEntries, setServerEntries] = useState([]);
  // Optimistic entries added locally before server confirms
  const [optimisticEntries, setOptimisticEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  // Keep a ref to pending optimistic IDs so we can remove them on settle
  const pendingIds = useRef(new Set());

  /** Fetch the full log from the server. */
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await spendingService.getEntries();
      setServerEntries(Array.isArray(data) ? data : []);
      // Clear optimistic entries — server is now authoritative
      setOptimisticEntries([]);
      pendingIds.current.clear();
    } catch (err) {
      console.error('[useSpending] reload failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Add an optimistic entry for immediate display.
   * Returns the temporary local ID so you can settle it later.
   *
   * @param {{ cost: number, model: string, resolution: string, status: string, car: string }} params
   * @returns {string} tempId
   */
  const addOptimistic = useCallback(({ cost, model, resolution, status, car }) => {
    const tempId = `opt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const entry = {
      id: tempId,
      ts: Date.now() / 1000,
      iso: new Date().toISOString(),
      model,
      resolution,
      cost,
      estimated: status !== 'success',
      status,
      car,
      livery_id: '',
    };
    setOptimisticEntries(prev => [entry, ...prev]);
    pendingIds.current.add(tempId);
    return tempId;
  }, []);

  /**
   * Settle (remove) an optimistic entry.
   * Call after the server has confirmed the transaction (or on cancel).
   * Follow with `reload()` if you want the updated total from the server.
   *
   * @param {string} tempId
   */
  const settle = useCallback((tempId) => {
    setOptimisticEntries(prev => prev.filter(e => e.id !== tempId));
    pendingIds.current.delete(tempId);
  }, []);

  /**
   * Record a failed or cancelled transaction on the server.
   * Automatically removes the matching optimistic entry and reloads.
   *
   * @param {{ cost: number, model: string, resolution: string, status: string, car: string }} params
   * @param {string} [tempId] - optimistic entry to settle
   */
  const recordTransaction = useCallback(async (params, tempId) => {
    try {
      await spendingService.recordTransaction(params);
    } catch (err) {
      console.error('[useSpending] recordTransaction failed:', err);
    } finally {
      if (tempId) settle(tempId);
      await reload();
    }
  }, [settle, reload]);

  // Combined entries: server (authoritative) + optimistic (not yet confirmed)
  // De-dupe by id — server entries win on conflict.
  const { entries, dedupedOptimistic, totalSpend } = useMemo(() => {
    const serverIds = new Set(serverEntries.map(e => e.id));
    const deduped = optimisticEntries.filter(e => !serverIds.has(e.id));
    const combined = [...deduped, ...serverEntries];
    const total = combined.reduce((sum, e) => sum + (e.cost ?? 0), 0);
    return { entries: combined, dedupedOptimistic: deduped, totalSpend: total };
  }, [serverEntries, optimisticEntries]);

  /**
   * Total spend up to (and including) a given ISO timestamp filter_id.
   * Mirrors the old getTotalSpend(filterId) from useHistory but now
   * uses the spending log so deleting history items has no effect.
   *
   * @param {string|null} filterId  ISO timestamp or null for all-time
   */
  const getTotalSpend = useCallback((filterId) => {
    if (!filterId) return totalSpend;
    const cutoff = new Date(filterId).getTime();
    return entries
      .filter(e => new Date(e.iso).getTime() <= cutoff)
      .reduce((sum, e) => sum + (e.cost ?? 0), 0);
  }, [entries, totalSpend]);

  return {
    entries,
    serverEntries,
    optimisticEntries: dedupedOptimistic,
    totalSpend,
    getTotalSpend,
    loading,
    reload,
    addOptimistic,
    settle,
    recordTransaction,
  };
}
