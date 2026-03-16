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
 *   getTotalSpend: () => number,
 * }}
 */
export function useHistory(autoLoad = false) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const raw = await historyService.getHistory();
      // Normalize API fields to component-expected fields
      const data = (raw || []).map(item => ({
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

  const deleteItem = useCallback(async (id) => {
    try {
      await historyService.deleteHistory(id);
      setItems(prev => prev.filter(item => item.id !== id));
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

  return { items, loading, error, loadHistory, deleteItem, updateItemCar, getTotalSpend };
}
