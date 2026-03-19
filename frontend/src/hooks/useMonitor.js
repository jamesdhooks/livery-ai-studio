/**
 * useMonitor — manages folder-monitor state, SSE subscription, and
 * toast notifications for auto-deploy events.
 *
 * State shape:
 *   active      — boolean, monitor is running
 *   monitor     — { folder, car_name, diffuse_file, spec_file, ... } | null
 *   loading     — async operation in progress
 *   error       — last error string | null
 *
 * Actions:
 *   startMonitor(folder, carName)
 *   stopMonitor()
 *   refreshStatus()
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import MonitorService from '../services/MonitorService';
import { useToastContext } from '../context/ToastContext';

export function useMonitor() {
  const { toast } = useToastContext();

  const [active, setActive]   = useState(false);
  const [monitor, setMonitor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const sseRef = useRef(null);   // EventSource reference

  // ── SSE subscription ────────────────────────────────────────────────────

  const connectSSE = useCallback(() => {
    if (sseRef.current) return;   // already connected

    const es = new EventSource('/api/monitor/events');

    es.onmessage = (e) => {
      if (!e.data || e.data.startsWith(':')) return;
      try {
        const event = JSON.parse(e.data);
        if (event.type === 'monitor_deploy') {
          const icon = event.kind === 'spec' ? '✦' : '✓';
          toast(`${icon} ${event.message}`, 'success');
        } else if (event.type === 'monitor_error') {
          toast(`⚠ ${event.message}`, 'error');
        }
      } catch {
        // ignore malformed
      }
    };

    es.onerror = () => {
      // SSE will auto-reconnect — just leave it
    };

    sseRef.current = es;
  }, [toast]);

  const disconnectSSE = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  }, []);

  // Connect SSE once on mount; disconnect on unmount
  useEffect(() => {
    connectSSE();
    return disconnectSSE;
  }, [connectSSE, disconnectSSE]);

  // ── API actions ─────────────────────────────────────────────────────────

  const refreshStatus = useCallback(async () => {
    try {
      const data = await MonitorService.status();
      setActive(!!data.active);
      setMonitor(data.monitor || null);
    } catch {
      // silent — status is best-effort
    }
  }, []);

  // Hydrate on mount
  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const startMonitor = useCallback(async (folder, carName) => {
    setLoading(true);
    setError(null);
    try {
      const data = await MonitorService.start(folder, carName);
      setActive(true);
      setMonitor(data.monitor || null);
      toast(`Monitoring started — auto-deploying to iRacing`, 'success');
    } catch (err) {
      const msg = err.message || 'Failed to start monitor';
      setError(msg);
      toast(`Monitor error: ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const stopMonitor = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await MonitorService.stop();
      setActive(false);
      setMonitor(null);
      toast('Folder monitoring stopped', 'success');
    } catch (err) {
      const msg = err.message || 'Failed to stop monitor';
      setError(msg);
      toast(`Monitor error: ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    active,
    monitor,
    loading,
    error,
    startMonitor,
    stopMonitor,
    refreshStatus,
  };
}
