import { useState, useEffect, useCallback } from 'react';
import historyService from '../services/HistoryService';

/**
 * useHistory — manages the list of past livery generations.
 *
 * @param {boolean} [autoLoad=false] - When `true`, fetch history on mount.
 *   Typically `false` for the Generate tab (loads on tab switch) and `true`
 *   for the History tab (loads immediately).
 *
 * @returns {{
 *   items: Array<Object>,
 *   loading: boolean,
 *   error: string|null,
 *   loadHistory: () => Promise<Array>,
 *   deleteItem: (id: string) => Promise<boolean>,
 *   trashMany: (ids: string[]) => Promise<boolean>,
 *   getTotalSpend: () => number,
 *   trashItems: Array<Object>,
 *   trashCount: number,
 *   trashLoading: boolean,
 *   loadTrash: () => Promise<Array>,
 *   restoreFromTrash: (path: string) => Promise<boolean>,
 *   restoreManyFromTrash: (paths: string[]) => Promise<boolean>,
 *   clearTrash: () => Promise<boolean>,
 * }}
 */
export function useHistory(autoLoad = false) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Trash state ──────────────────────────────────────────────────────────
  const [trashItems, setTrashItems] = useState([]);
  const [trashCount, setTrashCount] = useState(0);
  const [trashLoading, setTrashLoading] = useState(false);

  const _normalize = (raw) =>
    (raw || []).map(item => ({
      ...item,
      id:           item.id || item.filename || item.path,
      display_name: item.display_name || item.car_folder || item.car || item.name,
      livery_path:  item.livery_path || item.path,
      timestamp:    item.timestamp || item.modified || item.generated_at,
      cost:         item.cost ?? item.estimated_cost ?? null,
      preview_url:  item.preview_url || (item.preview_jpg
        ? `/api/uploads/preview?path=${encodeURIComponent(item.preview_jpg)}`
        : null),
    }));

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const raw  = await historyService.getHistory();
      const data = _normalize(raw);
      setItems(data);
      setError(null);
      return data;
    } catch (e) {
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrash = useCallback(async () => {
    try {
      setTrashLoading(true);
      const raw  = await historyService.getTrash();
      const data = _normalize(raw);
      setTrashItems(data);
      setTrashCount(data.length);
      return data;
    } catch (e) {
      setError(e.message);
      return [];
    } finally {
      setTrashLoading(false);
    }
  }, []);

  const refreshTrashCount = useCallback(async () => {
    try {
      const { count } = await historyService.getTrashCount();
      setTrashCount(count);
    } catch { /* ignore */ }
  }, []);

  /** Soft-delete a single item (move to trash). */
  const deleteItem = useCallback(async (id) => {
    const item = items.find(i => i.id === id);
    const path = item?.livery_path || id;
    try {
      await historyService.deleteHistory(path);
      setItems(prev => prev.filter(i => i.id !== id));
      setTrashCount(prev => prev + 1);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }, [items]);

  /** Soft-delete multiple items (move to trash). */
  const trashMany = useCallback(async (ids) => {
    const paths = ids
      .map(id => items.find(i => i.id === id))
      .filter(Boolean)
      .map(i => i.livery_path)
      .filter(Boolean);
    if (!paths.length) return false;
    try {
      await historyService.trashMany(paths);
      setItems(prev => prev.filter(i => !ids.includes(i.id)));
      setTrashCount(prev => prev + paths.length);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }, [items]);

  /** Restore a single item from trash. */
  const restoreFromTrash = useCallback(async (path) => {
    try {
      await historyService.restoreFromTrash(path);
      setTrashItems(prev => prev.filter(i => i.livery_path !== path && i.path !== path));
      setTrashCount(prev => Math.max(0, prev - 1));
      // Reload history so restored item appears
      await loadHistory();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }, [loadHistory]);

  /** Restore multiple items from trash. */
  const restoreManyFromTrash = useCallback(async (paths) => {
    try {
      await historyService.restoreManyFromTrash(paths);
      setTrashItems(prev => prev.filter(i => !paths.includes(i.livery_path) && !paths.includes(i.path)));
      setTrashCount(prev => Math.max(0, prev - paths.length));
      await loadHistory();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }, [loadHistory]);

  /** Permanently delete all trash. */
  const clearTrash = useCallback(async () => {
    try {
      await historyService.clearTrash();
      setTrashItems([]);
      setTrashCount(0);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }, []);

  const updateItemCar = useCallback(async (id, carFolder, carDisplay) => {
    const item = items.find(i => i.id === id);
    if (!item?.livery_path) return false;
    try {
      await historyService.updateItem(item.livery_path, { car_folder: carFolder, car: carDisplay || carFolder });
      setItems(prev => prev.map(i =>
        i.id === id ? { ...i, car_folder: carFolder, car: carDisplay || carFolder, display_name: carDisplay || carFolder } : i
      ));
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }, [items]);

  const getTotalSpend = useCallback((filterId = 'overall') => {
    const now = Date.now();
    const filtered = filterId === 'overall' ? items : items.filter((item) => {
      const cutoff = filterId === 'today'
        ? now - 24 * 60 * 60 * 1000
        : now - 7  * 24 * 60 * 60 * 1000;
      return (item.timestamp || 0) * 1000 >= cutoff;
    });
    return filtered.reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);
  }, [items]);

  useEffect(() => {
    if (autoLoad) loadHistory();
  }, [autoLoad, loadHistory]);

  // Load trash count on mount
  useEffect(() => {
    refreshTrashCount();
  }, [refreshTrashCount]);

  return {
    items,
    loading,
    error,
    loadHistory,
    deleteItem,
    trashMany,
    updateItemCar,
    getTotalSpend,
    trashItems,
    trashCount,
    trashLoading,
    loadTrash,
    restoreFromTrash,
    restoreManyFromTrash,
    clearTrash,
  };
}

