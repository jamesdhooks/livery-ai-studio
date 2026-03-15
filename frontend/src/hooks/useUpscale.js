import { useState, useCallback } from 'react';
import upscaleService from '../services/UpscaleService';

/**
 * useUpscale — orchestrates GPU upscaling and iRacing deployment.
 *
 * Calls `UpscaleService.upscale()` (Real-ESRGAN 4×) and
 * `UpscaleService.deploy()` (copy TGA to iRacing paint folder).
 * Duplicate calls while an operation is in progress are silently ignored.
 *
 * @returns {{
 *   upscaling: boolean,
 *   deploying: boolean,
 *   result: Object|null,
 *   error: string|null,
 *   status: {type: 'info'|'success'|'error', message: string}|null,
 *   upscale: (sourcePath: string) => Promise<Object|null>,
 *   deploy: (liveryPath: string, carName: string, customerId: string) => Promise<boolean>,
 *   clearStatus: () => void,
 * }}
 */
export function useUpscale() {
  const [upscaling, setUpscaling] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  const upscale = useCallback(async (sourcePath) => {
    if (upscaling) return null;
    
    setUpscaling(true);
    setError(null);
    setStatus({ type: 'info', message: 'Upscaling livery (this may take 30-60s)…' });
    
    try {
      const data = await upscaleService.upscale(sourcePath);
      setResult(data);
      setStatus({ type: 'success', message: 'Upscale complete!' });
      return data;
    } catch (e) {
      setError(e.message);
      setStatus({ type: 'error', message: `Upscale failed: ${e.message}` });
      return null;
    } finally {
      setUpscaling(false);
    }
  }, [upscaling]);

  const deploy = useCallback(async (liveryPath, carName, customerId) => {
    if (deploying) return false;
    
    setDeploying(true);
    setStatus({ type: 'info', message: 'Deploying to iRacing…' });
    
    try {
      await upscaleService.deploy(liveryPath, carName, customerId);
      setStatus({ type: 'success', message: 'Deployed to iRacing!' });
      return true;
    } catch (e) {
      setError(e.message);
      setStatus({ type: 'error', message: `Deploy failed: ${e.message}` });
      return false;
    } finally {
      setDeploying(false);
    }
  }, [deploying]);

  const clearStatus = useCallback(() => setStatus(null), []);

  return {
    upscaling,
    deploying,
    result,
    error,
    status,
    upscale,
    deploy,
    clearStatus,
  };
}
