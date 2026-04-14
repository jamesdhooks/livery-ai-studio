import { useState, useCallback, useRef, useEffect } from 'react';
import upscaleService from '../services/UpscaleService';

/**
 * useUpscale — orchestrates GPU upscaling, SeedVR2 resampling, and iRacing deployment.
 *
 * Calls `UpscaleService.upscale()` (Real-ESRGAN 4×),
 * `UpscaleService.resample()` (SeedVR2 diffusion), and
 * `UpscaleService.deploy()` (copy TGA to iRacing paint folder).
 * Duplicate calls while an operation is in progress are silently ignored.
 *
 * @param {Object} options
 * @param {Function} [options.onNotify] - Toast callback
 * @param {Function} [options.onError] - Service error callback (for modal display)
 * @param {Function} [options.onUpscaleComplete] - Called after upscale/resample completes successfully
 *
 * @returns {{
 *   upscaling: boolean,
 *   resampling: boolean,
 *   deploying: boolean,
 *   result: Object|null,
 *   error: string|null,
 *   status: {type: 'info'|'success'|'error', message: string}|null,
 *   upscale: (sourcePath: string) => Promise<Object|null>,
 *   resample: (sourcePath: string) => Promise<Object|null>,
 *   deploy: (liveryPath: string, carName: string, customerId: string) => Promise<boolean>,
 *   clearStatus: () => void,
 * }}
 */
export function useUpscale({ onNotify, onError, onUpscaleComplete } = {}) {
  const [upscaling, setUpscaling] = useState(false);
  const [resampling, setResampling] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const elapsedIntervalRef = useRef(null);
  const startTimeRef = useRef(null);
  // stable ref to setter so interval closure never goes stale
  const setElapsedRef = useRef(setElapsedSeconds);
  useEffect(() => { setElapsedRef.current = setElapsedSeconds; }, [setElapsedSeconds]);

  const stopTimer = useCallback(() => {
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setElapsedRef.current(0);
    startTimeRef.current = Date.now();
    elapsedIntervalRef.current = setInterval(() => {
      setElapsedRef.current(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, [stopTimer]);

  // Clean up on unmount
  useEffect(() => () => stopTimer(), [stopTimer]);

  // Route success/error notifications to onNotify (toast) if provided, else inline status
  const notify = useCallback((type, message) => {
    if (onNotify) {
      onNotify(message, type);
    } else {
      setStatus({ type, message });
    }
  }, [onNotify]);

  const upscale = useCallback(async (sourcePath, targetSize = 2048) => {
    if (upscaling) return null;
    
    setUpscaling(true);
    setError(null);
    startTimer();
    setStatus({ type: 'info', message: 'Upscaling livery (this may take 30-60s)…' });
    
    // Show initial "upscaling" toast
    notify('info', 'Upscaling livery (this may take 30-60 seconds)…');

    try {
      const data = await upscaleService.upscale(sourcePath, targetSize);
      console.log('[useUpscale] Response received:', {
        has_preview_b64: !!data.preview_b64,
        has_full_res_b64: !!data.full_res_b64,
        preview_b64_len: data.preview_b64?.length,
        full_res_b64_len: data.full_res_b64?.length,
      });
      if (data.preview_b64) data.preview_url = `data:image/png;base64,${data.preview_b64}`;
      if (data.full_res_b64) data.full_res_url = `data:image/png;base64,${data.full_res_b64}`;
      console.log('[useUpscale] After conversion:', {
        has_preview_url: !!data.preview_url,
        has_full_res_url: !!data.full_res_url,
        preview_url_len: data.preview_url?.length,
        full_res_url_len: data.full_res_url?.length,
      });
      setResult(data);
      notify('success', 'Upscale complete!');
      onUpscaleComplete?.();
      return data;
    } catch (e) {
      setError(e.message);
      notify('error', `Upscale failed: ${e.message}`);
      
      // Show service error modal for API errors
      if (onError) {
        onError({
          message: e.message,
          code: e.code,
        });
      }
      
      return null;
    } finally {
      setUpscaling(false);
      stopTimer();
    }
  }, [upscaling, notify, onError, onUpscaleComplete, startTimer, stopTimer]);

  const resample = useCallback(async (sourcePath, opts = {}) => {
    if (resampling) return null;

    setResampling(true);
    setError(null);
    startTimer();
    setStatus({ type: 'info', message: 'Resampling (this may take 30s–2 minutes)…' });

    notify('info', 'Resampling (this may take 30s–2 minutes)…');

    try {
      const data = await upscaleService.resample(sourcePath, opts);
      console.log('[useUpscale] Resample response received:', {
        has_preview_b64: !!data.preview_b64,
        has_full_res_b64: !!data.full_res_b64,
        preview_b64_len: data.preview_b64?.length,
        full_res_b64_len: data.full_res_b64?.length,
      });
      if (data.preview_b64) data.preview_url = `data:image/png;base64,${data.preview_b64}`;
      if (data.full_res_b64) data.full_res_url = `data:image/png;base64,${data.full_res_b64}`;
      if (data.noised_input_b64) data.noised_input_url = `data:image/png;base64,${data.noised_input_b64}`;
      console.log('[useUpscale] Resample after conversion:', {
        has_preview_url: !!data.preview_url,
        has_full_res_url: !!data.full_res_url,
        has_noised_input_url: !!data.noised_input_url,
      });
      setResult(data);
      notify('success', 'Resample complete!');
      onUpscaleComplete?.();
      return data;
    } catch (e) {
      setError(e.message);
      notify('error', `Resample failed: ${e.message}`);
      
      // Show service error modal for API errors
      if (onError) {
        onError({
          message: e.message,
          code: e.code,
        });
      }
      
      return null;
    } finally {
      setResampling(false);
      stopTimer();
    }
  }, [resampling, notify, onError, onUpscaleComplete, startTimer, stopTimer]);

  const deploy = useCallback(async (liveryPath, carName, customerId) => {
    if (deploying) return false;
    
    setDeploying(true);
    setStatus({ type: 'info', message: 'Deploying to iRacing…' });
    
    try {
      await upscaleService.deploy(liveryPath, carName, customerId);
      notify('success', 'Deployed to iRacing!');
      if (onNotify) setStatus(null);
      return true;
    } catch (e) {
      setError(e.message);
      notify('error', `Deploy failed: ${e.message}`);
      if (onNotify) setStatus(null);
      return false;
    } finally {
      setDeploying(false);
    }
  }, [deploying, notify]);

  const clearStatus = useCallback(() => setStatus(null), []);

  return {
    upscaling,
    resampling,
    deploying,
    elapsedSeconds,
    result,
    error,
    status,
    upscale,
    resample,
    deploy,
    clearStatus,
  };
}
