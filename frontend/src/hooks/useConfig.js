import { useState, useEffect, useCallback } from 'react';
import configService from '../services/ConfigService';

/**
 * useConfig — loads and saves persistent application configuration.
 *
 * Fetches `config.json` on mount via `ConfigService`.  The `saveConfig`
 * function performs an optimistic local merge before persisting to the server.
 *
 * @returns {{
 *   config: Object|null,
 *   loading: boolean,
 *   error: string|null,
 *   saveConfig: (updates: Object) => Promise<boolean>,
 *   reloadConfig: () => Promise<void>,
 * }}
 */
export function useConfig() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await configService.getConfig();
      setConfig(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Silently re-fetch config without triggering the app-level loading gate.
   *  Preserves any sensitive fields (e.g. gemini_api_key) that the server
   *  intentionally strips from GET /api/config responses.
   */
  const reloadQuiet = useCallback(async () => {
    try {
      const data = await configService.getConfig();
      // The server never returns gemini_api_key in GET responses (security).
      // Merge the fresh data on top of the current state so we don't wipe
      // any locally-held sensitive keys.
      setConfig(prev => ({ ...prev, ...data }));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const saveConfig = useCallback(async (updates, { reloadFromServer = true } = {}) => {
    try {
      const updated = { ...config, ...updates };
      await configService.saveConfig(updated);
      
      // Optimistically update local state first
      setConfig(updated);
      
      // Only reload from server if requested and if sensitive fields changed
      // (e.g., gemini_api_key_set after setting API key).
      // Use quiet reload so the app-level loading splash doesn't flash.
      const sensitiveKeys = ['gemini_api_key'];
      const hasChanges = sensitiveKeys.some(key => updates[key] !== undefined);
      
      if (reloadFromServer && hasChanges) {
        await reloadQuiet();
      }
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }, [config, reloadQuiet]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return { config, loading, error, saveConfig, reloadConfig: loadConfig };
}
