import { useState, useCallback, useRef, useEffect } from 'react';
import generateService from '../services/GenerateService';
import logService from '../services/LogService';

/**
 * useGenerate — orchestrates the livery generation workflow.
 *
 * Calls `GenerateService.generate()` and manages the in-flight, result,
 * error, and status states.  Duplicate calls while a generation is in
 * progress are silently ignored.
 *
 * Also exposes `abort` to cancel an in-flight request and `elapsedSeconds`
 * for real-time elapsed time tracking during generation.
 *
 * @returns {{
 *   generating: boolean,
 *   elapsedSeconds: number,
 *   result: Object|null,
 *   error: string|null,
 *   status: {type: 'info'|'success'|'error', message: string}|null,
 *   generate: (params: Object) => Promise<Object|null>,
 *   abort: () => void,
 *   uploadFile: (category: string, file: File) => Promise<Object|null>,
 *   getUploads: (category: string) => Promise<Array>,
 *   clearStatus: () => void,
 *   clearError: () => void,
 * }}
 */
export function useGenerate({ onNotify, onTransaction, onError } = {}) {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
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

  // Keep a ref to the current generation params for abort cost estimation
  const currentParamsRef = useRef(null);

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
    // Fire transaction for the estimated cost of the cancelled request
    if (onTransaction && currentParamsRef.current) {
      onTransaction({ amount: currentParamsRef.current.estimatedCost ?? 0, type: 'cancelled', model: currentParamsRef.current.model });
    }
    currentParamsRef.current = null;
    logService.log('[generate] Aborted by user');
  }, [stopTimer, notify, onTransaction]);

  const generate = useCallback(async (params) => {
    if (generating) return null;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    currentParamsRef.current = params;

    setGenerating(true);
    setError(null);
    setStatus({ type: 'info', message: 'Generating livery…' });
    startTimer();

    // Show initial "generating" toast with estimated cost
    const costText = params.estimatedCost != null ? ` · $${parseFloat(params.estimatedCost).toFixed(2)}` : '';
    notify('info', `Generating livery…${costText}`);

    // Fire estimated cost transaction immediately on start
    if (onTransaction && params.estimatedCost != null) {
      onTransaction({ amount: params.estimatedCost, type: 'estimated', model: params.model });
    }

    try {
      logService.log(`[generate] Starting generation: ${JSON.stringify({ model: params.model, car: params.car_folder })}`);
      const data = await generateService.generate(params, controller.signal);
      setResult(data);
      notify('success', 'Livery generated successfully!');
      // Fire actual cost once we have the real number from the backend
      if (onTransaction) {
        const actualCost = data.cost != null ? parseFloat(data.cost) : (params.estimatedCost ?? 0);
        onTransaction({ amount: actualCost, type: 'actual', model: params.model });
      }
      logService.log(`[generate] Success: ${data.livery_path}`);
      currentParamsRef.current = null;
      return data;
    } catch (e) {
      if (e.name === 'AbortError') return null; // already handled in abort()
      setError(e.message);
      notify('error', `Generation failed: ${e.message}`);
      
      // Show service error modal for API errors
      if (onError) {
        onError({
          message: e.message,
          code: e.code,
        });
      }
      
      // Fire cancelled transaction for failed (non-abort) requests too
      if (onTransaction && currentParamsRef.current) {
        onTransaction({ amount: currentParamsRef.current.estimatedCost ?? 0, type: 'cancelled', model: params.model });
      }
      logService.log(`[generate] Error: ${e.message}`);
      currentParamsRef.current = null;
      return null;
    } finally {
      abortControllerRef.current = null;
      stopTimer();
      setElapsedSeconds(0);
      setGenerating(false);
    }
  }, [generating, startTimer, stopTimer, notify, onTransaction, onError]);

  const uploadFile = useCallback(async (category, file, meta = {}) => {
    try {
      const data = await generateService.uploadFile(category, file, meta);
      return data;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, []);

  const browseUploads = useCallback(async (category) => {
    try {
      return await generateService.browseUploads(category);
    } catch {
      return [];
    }
  }, []);

  const deleteUpload = useCallback(async (path) => {
    try {
      return await generateService.deleteUpload(path);
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, []);

  const getUploads = useCallback(async (category) => {
    try {
      return await generateService.getUploads(category);
    } catch {
      return [];
    }
  }, []);

  const clearStatus = useCallback(() => setStatus(null), []);
  const clearError = useCallback(() => setError(null), []);

  return {
    generating,
    elapsedSeconds,
    result,
    error,
    status,
    generate,
    abort,
    uploadFile,
    browseUploads,
    deleteUpload,
    getUploads,
    clearStatus,
    clearError,
  };
}
