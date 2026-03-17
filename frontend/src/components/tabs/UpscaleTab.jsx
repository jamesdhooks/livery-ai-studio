import React, { useState, useRef, useCallback } from 'react';
import { Button } from '../common/Button';
import { ImageActionTray } from '../common/ImageActionTray';
import { StatusBar } from '../common/StatusBar';
import upscaleService from '../../services/UpscaleService';
import { useUpscaleContext } from '../../context/UpscaleContext';
import { useConfigContext } from '../../context/ConfigContext';

export function UpscaleTab({
  capabilities,
}) {
  // ── Contexts ─────────────────────────────────────────────────────────────
  const {
    upscaling, resampling, result: upscaleResult, status: upscaleStatus,
    upscale: onUpscale, resample: onResample, deploy: onDeploy,
    deploying, clearStatus: onClearStatus,
  } = useUpscaleContext();
  const { config } = useConfigContext();
  const [mode, setMode] = useState('upscale'); // 'upscale' | 'resample'
  const [sourcePath, setSourcePath] = useState('');
  const [sourcePreview, setSourcePreview] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const busy = upscaling || resampling;

  const loadSource = useCallback((path) => {
    setSourcePath(path);
    setSourcePreview(`/api/uploads/preview?path=${encodeURIComponent(path)}`);
  }, []);

  const handlePickFile = async () => {
    try {
      const data = await upscaleService.pickFile(['Image Files (*.png;*.jpg;*.jpeg;*.tga)']);
      if (data.path) loadSource(data.path);
    } catch (e) {
      console.error('File picker failed:', e);
    }
  };

  const handleFileDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    try {
      const data = await upscaleService.uploadFile(file, 'upscale');
      if (data.path) loadSource(data.path);
    } catch (e) {
      console.error('Upload failed:', e);
    }
  };

  const handleFileInput = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const data = await upscaleService.uploadFile(file, 'upscale');
      if (data.path) loadSource(data.path);
    } catch (e) {
      console.error('Upload failed:', e);
    }
  };

  const handleAction = async () => {
    if (!sourcePath || busy) return;
    if (mode === 'resample') {
      await onResample?.(sourcePath);
    } else {
      await onUpscale?.(sourcePath);
    }
  };

  const handleClearSource = () => {
    setSourcePath('');
    setSourcePreview('');
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };

  // Mode-dependent labels and availability
  const isUpscaleAvailable = capabilities?.upscale_available;
  const isResampleAvailable = capabilities?.seedvr_available;
  const isModeAvailable = mode === 'resample' ? isResampleAvailable : isUpscaleAvailable;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel — input & controls */}
      <div className="w-[420px] min-w-[340px] flex-shrink-0 flex flex-col border-r border-border-default overflow-y-auto">
        <div className="p-3 flex flex-col gap-3">

          {/* Mode toggle — segmented control */}
          <div className="flex rounded-lg border border-border-default overflow-hidden">
            {[
              { id: 'upscale', label: 'Upscale 4×', icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              )},
              { id: 'resample', label: 'Resample', icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M12.2 11.8L11 13M12.2 6.2L11 5M15 9a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path d="M3 21l9-9" />
                </svg>
              )},
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[13px] font-medium transition-all cursor-pointer ${
                  mode === m.id
                    ? 'bg-accent/20 text-accent'
                    : 'bg-bg-input text-text-secondary hover:bg-bg-hover'
                }`}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>

          {/* Mode description */}
          {mode === 'upscale' ? (
            <div>
              <h2 className="text-sm font-semibold text-text-primary mb-1">GPU Upscaling (4×)</h2>
              <p className="text-[11px] text-text-muted">
                Use Real-ESRGAN to upscale a 1K livery to 2048×2048 for higher quality at no extra API cost.
                {!isUpscaleAvailable && (
                  <span className="text-warning block mt-1">
                    GPU upscaling not available — requires NVIDIA GPU with Real-ESRGAN installed.
                    Run <code className="text-text-secondary">start.bat --gpu</code> to install.
                  </span>
                )}
              </p>
            </div>
          ) : (
            <div>
              <h2 className="text-sm font-semibold text-text-primary mb-1">SeedVR2 Resample</h2>
              <p className="text-[11px] text-text-muted">
                Use SeedVR2 diffusion upscaling to enhance a livery with AI-generated detail.
                Downresizes to 1024 then upscales back to 2048×2048 — produces higher fidelity results
                than traditional upscaling, especially on AI-generated textures.
                {!isResampleAvailable && (
                  <span className="text-warning block mt-1">
                    SeedVR2 not available — requires NVIDIA GPU with SeedVR2 installed.
                    Run <code className="text-text-secondary">start.bat --seedvr</code> to install.
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Source */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Source</label>

            {!sourcePath ? (
              <button
                onClick={handlePickFile}
                onDrop={handleFileDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`min-h-[180px] flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl transition-all cursor-pointer ${
                  isDragging
                    ? 'border-accent bg-accent/10'
                    : 'border-border-default hover:border-accent/50 hover:bg-bg-hover'
                }`}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted opacity-50">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div className="text-center">
                  <p className="text-[13px] text-text-secondary">Drop a livery file here</p>
                  <p className="text-[11px] text-text-muted mt-1">or click to browse (.tga, .png, .jpg)</p>
                </div>
              </button>
            ) : (
              <div className="min-h-[180px] relative group flex items-center justify-center bg-bg-card border border-border-default rounded-xl overflow-hidden">
                <img
                  src={sourcePreview}
                  alt="Source livery"
                  className="max-w-full max-h-[180px] object-contain"
                />
                <button
                  onClick={handleClearSource}
                  className="absolute top-2 right-2 w-6 h-6 bg-bg-dark/80 text-text-muted hover:text-error rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Remove source"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
                <div className="absolute bottom-2 left-2 right-2 text-center">
                  <span className="text-[10px] text-text-muted bg-bg-dark/80 px-2 py-0.5 rounded">
                    {sourcePath.split(/[/\\]/).pop()}
                  </span>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".tga,.png,.jpg,.jpeg"
            className="hidden"
            onChange={handleFileInput}
          />

          <StatusBar status={upscaleStatus} onDismiss={onClearStatus} />
        </div>

        {/* Action buttons */}
        <div className="p-3 pt-0 flex flex-col gap-2 mt-auto">
          <Button
            variant="primary"
            size="lg"
            disabled={!sourcePath || busy || !isModeAvailable}
            loading={busy}
            onClick={handleAction}
            className="w-full"
          >
            {mode === 'resample'
              ? (resampling ? 'Resampling…' : 'Resample')
              : (upscaling ? 'Upscaling…' : 'Upscale 4×')
            }
          </Button>

          {upscaleResult && (
            <Button
              variant="success"
              size="md"
              disabled={deploying}
              loading={deploying}
              onClick={() => onDeploy?.(upscaleResult.output_path, null, config?.customer_id)}
              className="w-full"
            >
              {deploying ? 'Deploying…' : 'Deploy to iRacing'}
            </Button>
          )}
        </div>
      </div>

      {/* Right panel — result preview */}
      <div className="flex-1 flex items-center justify-center bg-bg-dark p-4 overflow-hidden">
        {upscaleResult?.preview_url ? (
          <div className="relative max-w-full max-h-full group">
            <img
              src={upscaleResult.preview_url}
              alt={mode === 'resample' ? 'Resampled livery' : 'Upscaled livery'}
              className="max-w-full max-h-full object-contain rounded shadow-2xl"
              style={{ maxHeight: 'calc(100vh - 120px)' }}
            />
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
              <span className="text-[10px] text-text-muted bg-bg-dark/80 px-2 py-0.5 rounded">
                2048 × 2048
              </span>
            </div>
            <ImageActionTray
              imageUrl={upscaleResult.preview_url}
              imagePath={upscaleResult.output_path}
              downloadName={mode === 'resample' ? 'livery_resampled.png' : 'livery_upscaled.png'}
              onDeploy={() => onDeploy?.(upscaleResult.output_path, null, config?.customer_id)}
              deploying={deploying}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            {busy ? (
              <>
                <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-text-secondary">
                  {mode === 'resample' ? 'Resampling…' : 'Upscaling…'}
                </span>
                <span className="text-xs text-text-muted">
                  {mode === 'resample' ? 'SeedVR2 may take 2-5 minutes' : 'This may take a moment'}
                </span>
              </>
            ) : (
              <>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted opacity-20">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                </svg>
                <p className="text-sm text-text-muted">
                  {sourcePath
                    ? (mode === 'resample' ? 'Click Resample to start' : 'Click Upscale to start')
                    : 'Select a source image'
                  }
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default UpscaleTab;
