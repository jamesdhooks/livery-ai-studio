import { useState, useCallback } from 'react';
import generateService from '../services/GenerateService';
import logService from '../services/LogService';

/**
 * useGenerate — orchestrates the livery generation workflow.
 *
 * Calls `GenerateService.generate()` and manages the in-flight, result,
 * error, and status states.  Duplicate calls while a generation is in
 * progress are silently ignored.
 *
 * Also exposes `uploadFile` and `getUploads` for managing wireframe/base/
 * reference image uploads that feed into generation.
 *
 * @returns {{
 *   generating: boolean,
 *   result: Object|null,
 *   error: string|null,
 *   status: {type: 'info'|'success'|'error', message: string}|null,
 *   generate: (params: Object) => Promise<Object|null>,
 *   uploadFile: (category: string, file: File) => Promise<Object|null>,
 *   getUploads: (category: string) => Promise<Array>,
 *   clearStatus: () => void,
 *   clearError: () => void,
 * }}
 */
export function useGenerate() {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  const generate = useCallback(async (params) => {
    if (generating) return null;
    
    setGenerating(true);
    setError(null);
    setStatus({ type: 'info', message: 'Generating livery…' });
    
    try {
      logService.log(`[generate] Starting generation: ${JSON.stringify({ model: params.model, car: params.car_folder })}`);
      const data = await generateService.generate(params);
      setResult(data);
      setStatus({ type: 'success', message: 'Livery generated successfully!' });
      logService.log(`[generate] Success: ${data.livery_path}`);
      return data;
    } catch (e) {
      setError(e.message);
      setStatus({ type: 'error', message: `Generation failed: ${e.message}` });
      logService.log(`[generate] Error: ${e.message}`);
      return null;
    } finally {
      setGenerating(false);
    }
  }, [generating]);

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
    result,
    error,
    status,
    generate,
    uploadFile,
    browseUploads,
    deleteUpload,
    getUploads,
    clearStatus,
    clearError,
  };
}
