import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'theme-preference';

/**
 * useTheme — manages light / dark / auto (system) theme.
 *
 * Applies a `light` or `dark` class on the `<html>` element.
 * "auto" follows the OS `prefers-color-scheme` media query.
 */
export function useTheme() {
  const [preference, setPreference] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'dark';
    } catch {
      return 'dark';
    }
  });

  const applyTheme = useCallback((pref) => {
    const root = document.documentElement;
    let resolved;

    if (pref === 'auto') {
      resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } else {
      resolved = pref;
    }

    root.classList.remove('light', 'dark');
    if (resolved === 'light') {
      root.classList.add('light');
    }
    // dark is the default (no class needed, but add for clarity)
    if (resolved === 'dark') {
      root.classList.add('dark');
    }
  }, []);

  // Apply on mount and when preference changes
  useEffect(() => {
    applyTheme(preference);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch { /* ignore */ }
  }, [preference, applyTheme]);

  // Listen for OS theme changes (relevant when preference === 'auto')
  useEffect(() => {
    if (preference !== 'auto') return;
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => applyTheme('auto');
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [preference, applyTheme]);

  const setTheme = useCallback((pref) => {
    setPreference(pref);
  }, []);

  return { theme: preference, setTheme };
}
