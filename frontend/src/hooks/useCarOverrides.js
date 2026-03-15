import { useState, useEffect, useCallback, useRef } from 'react';
import carOverrideService from '../services/CarOverrideService';

/**
 * useCarOverrides — loads and persists per-car wireframe/base overrides.
 *
 * When `carFolder` changes the hook fetches that car's stored overrides from
 * the server. The server validates file existence at read time — if a file has
 * been deleted it returns '' so the consumer can fall back to the library
 * default.
 *
 * @param {string|null} carFolder  — the currently selected car folder slug
 * @returns {{
 *   wireOverride: string,   // abs path, or '' if none / file missing
 *   baseOverride: string,   // abs path, or '' if none / file missing
 *   loading: boolean,
 *   setWireOverride: (path: string) => Promise<void>,
 *   setBaseOverride: (path: string) => Promise<void>,
 *   clearWireOverride: () => Promise<void>,
 *   clearBaseOverride: () => Promise<void>,
 * }}
 */
export function useCarOverrides(carFolder) {
  const [wireOverride, setWireOverrideState] = useState('');
  const [baseOverride, setBaseOverrideState] = useState('');
  const [loading, setLoading] = useState(false);
  // Track which car we last loaded so rapid car switches don't race
  const loadedForRef = useRef(null);

  const loadOverrides = useCallback(async (folder) => {
    if (!folder) {
      setWireOverrideState('');
      setBaseOverrideState('');
      loadedForRef.current = null;
      return;
    }
    setLoading(true);
    try {
      const result = await carOverrideService.getOverride(folder);
      // Only apply if the car hasn't changed while we were fetching
      if (loadedForRef.current === folder) {
        setWireOverrideState(result.wire || '');
        setBaseOverrideState(result.base || '');
      }
    } catch (e) {
      console.warn('[useCarOverrides] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadedForRef.current = carFolder;
    loadOverrides(carFolder);
  }, [carFolder, loadOverrides]);

  const setWireOverride = useCallback(async (path) => {
    if (!carFolder) return;
    setWireOverrideState(path);
    try {
      await carOverrideService.setOverride(carFolder, { wire: path || null });
    } catch (e) {
      console.warn('[useCarOverrides] save wire failed:', e);
    }
  }, [carFolder]);

  const setBaseOverride = useCallback(async (path) => {
    if (!carFolder) return;
    setBaseOverrideState(path);
    try {
      await carOverrideService.setOverride(carFolder, { base: path || null });
    } catch (e) {
      console.warn('[useCarOverrides] save base failed:', e);
    }
  }, [carFolder]);

  const clearWireOverride = useCallback(async () => {
    if (!carFolder) return;
    setWireOverrideState('');
    try {
      await carOverrideService.setOverride(carFolder, { wire: null });
    } catch (e) {
      console.warn('[useCarOverrides] clear wire failed:', e);
    }
  }, [carFolder]);

  const clearBaseOverride = useCallback(async () => {
    if (!carFolder) return;
    setBaseOverrideState('');
    try {
      await carOverrideService.setOverride(carFolder, { base: null });
    } catch (e) {
      console.warn('[useCarOverrides] clear base failed:', e);
    }
  }, [carFolder]);

  return {
    wireOverride,
    baseOverride,
    loading,
    setWireOverride,
    setBaseOverride,
    clearWireOverride,
    clearBaseOverride,
  };
}
