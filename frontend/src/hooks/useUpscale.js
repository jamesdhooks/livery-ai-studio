import { useState, useCallback } from 'react';
import upscaleService from '../services/UpscaleService';

/**
 * useUpscale — orchestrates GPU upscaling, SeedVR2 resampling, and iRacing deployment.
 *
 * Calls `UpscaleService.upscale()` (Real-ESRGAN 4×),
 * `UpscaleService.resample()` (SeedVR2 diffusion), and
 * `UpscaleService.deploy()` (copy TGA to iRacing paint folder).
 * Duplicate calls while an operation is in progress are silently ignored.
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
export function useUpscale({ onNotify } = {}) {
  const [upscaling, setUpscaling] = useState(false);
  const [resampling, setResampling] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  // Route success/error notifications to onNotify (toast) if provided, else inline status
  const notify = useCallback((type, message) => {
    if (onNotify) {
      onNotify(message, type);
    } else {
      setStatus({ type, message });
    }
  }, [onNotify]);

  const upscale = useCallback(async (sourcePath) => {
    if (upscaling) return null;
    
    setUpscaling(true);
    setError(null);
    setStatus({ type: 'info', message: 'Upscaling livery (this may take 30-60s)…' });
    
    // Show initial "upscaling" toast
    notify('info', 'Upscaling livery (this may take 30-60 seconds)…');

    try {
      const data = await upscaleService.upscale(sourcePath);
      if (data.preview_b64) data.preview_url = `data:image/png;base64,${data.preview_b64}`;
      setResult(data);
      notify('success', 'Upscale complete!');
      return data;
    } catch (e) {
      setError(e.message);
      notify('error', `Upscale failed: ${e.message}`);
      return null;
    } finally {
      setUpscaling(false);
    }
  }, [upscaling, notify]);

  const resample = useCallback(async (sourcePath) => {
    if (resampling) return null;

    setResampling(true);
    setError(null);
    setStatus({ type: 'info', message: 'Resampling with SeedVR2 (this may take 2-5 minutes)…' });

    notify('info', 'Resampling with SeedVR2 (this may take 2-5 minutes)…');

    try {
      const data = await upscaleService.resample(sourcePath);
      if (data.preview_b64) data.preview_url = `data:image/png;base64,${data.preview_b64}`;
      setResult(data);
      notify('success', 'SeedVR2 resample complete!');
      return data;
    } catch (e) {
      setError(e.message);
      notify('error', `Resample failed: ${e.message}`);
      return null;
    } finally {
      setResampling(false);
    }
  }, [resampling, notify]);

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
    result,
    error,
    status,
    upscale,
    resample,
    deploy,
    clearStatus,
  };
}
