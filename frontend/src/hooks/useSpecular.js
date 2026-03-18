import { useState, useCallback, useRef, useEffect } from 'react';
import generateService from '../services/GenerateService';
import logService from '../services/LogService';

/**
 * useSpecular — orchestrates specular map generation.
 *
 * Calls `GenerateService.generateSpecular()` and manages in-flight,
 * result, and status states.
 *
 * Also exposes `abort` to cancel an in-flight request and `elapsedSeconds`
 * for real-time elapsed time tracking during generation.
 *
 * @param {Object} options
 * @param {Function} [options.onNotify] - Toast callback
 * @param {Function} [options.onError] - Service error callback (for modal display)
 *
 * @returns {{
 *   generating: boolean,
 *   elapsedSeconds: number,
 *   result: Object|null,
 *   status: {type: 'info'|'success'|'error', message: string}|null,
 *   generate: (params: Object) => Promise<Object|null>,
 *   abort: () => void,
 *   deploySpec: (tgaPath: string, carFolder: string, customerId: string) => Promise<Object|null>,
 *   clearStatus: () => void,
 * }}
 */
export function useSpecular({ onNotify, onError } = {}) {
  const [generating, setGenerating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const abortControllerRef = useRef(null);
  const elapsedIntervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const setElapsedSecondsRef = useRef(setElapsedSeconds);
  useEffect(() => { setElapsedSecondsRef.current = setElapsedSeconds; }, [setElapsedSeconds]);

  // Route success/error notifications to onNotify (toast) if provided, else inline status
  const notify = useCallback((type, message) => {
    if (onNotify) {
      onNotify(message, type);
    } else {
      setStatus({ type, message });
    }
  }, [onNotify]);

  const stopTimer = useCallback(() => {
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    setElapsedSecondsRef.current(0);
    startTimeRef.current = Date.now();
    elapsedIntervalRef.current = setInterval(() => {
      setElapsedSecondsRef.current(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    stopTimer();
    abortControllerRef.current?.abort();
  }, [stopTimer]);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopTimer();
    setGenerating(false);
    setElapsedSeconds(0);
    notify('error', 'Generation cancelled.');
    logService.log('[specular] Aborted by user');
  }, [stopTimer, notify]);

  const generate = useCallback(async (params) => {
    if (generating) return null;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setGenerating(true);
    setStatus({ type: 'info', message: 'Generating specular map…' });
    startTimer();

    // Show initial "generating" toast
    notify('info', 'Generating specular map…');

    try {
      logService.log(`[specular] Starting generation: ${JSON.stringify({ car: params.car_folder })}`);
      const data = await generateService.generateSpecular(params, controller.signal);
      setResult(data);
      notify('success', 'Specular map generated successfully!');
      logService.log(`[specular] Success: ${data.livery_path}`);
      return data;
    } catch (e) {
      if (e.name === 'AbortError') return null;
      notify('error', `Generation failed: ${e.message}`);
      
      // Show service error modal for API errors
      if (onError) {
        onError({
          message: e.message,
          code: e.code,
        });
      }
      
      logService.log(`[specular] Error: ${e.message}`);
      return null;
    } finally {
      abortControllerRef.current = null;
      stopTimer();
      setElapsedSeconds(0);
      setGenerating(false);
    }
  }, [generating, startTimer, stopTimer, notify, onError]);

  const deploySpec = useCallback(async (tgaPath, carFolder, customerId) => {
    if (deploying) return null;
    try {
      setDeploying(true);
      setStatus({ type: 'info', message: 'Deploying specular map…' });
      const data = await generateService.deploySpec(tgaPath, carFolder, customerId);
      notify('success', 'Specular map deployed to iRacing!');
      if (onNotify) setStatus(null);
      return data;
    } catch (e) {
      notify('error', `Deploy failed: ${e.message}`);
      
      // Show service error modal for API errors
      if (onError) {
        onError({
          message: e.message,
          code: e.code,
        });
      }
      
      if (onNotify) setStatus(null);
      return null;
    } finally {
      setDeploying(false);
    }
  }, [deploying, notify, onError]);

  const clearStatus = useCallback(() => setStatus(null), []);

  return {
    generating,
    deploying,
    elapsedSeconds,
    result,
    status,
    generate,
    abort,
    deploySpec,
    clearStatus,
  };
}
