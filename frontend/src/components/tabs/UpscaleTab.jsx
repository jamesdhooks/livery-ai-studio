import React, { useState, useRef, useCallback } from 'react';
import { Button } from '../common/Button';
import { LiveryDetailPanel } from '../common/LiveryDetailPanel';
import { GenerationProgress } from '../common/GenerationProgress';
import { FileUploader } from '../common/FileUploader';
import { BrowseUploadsModal } from '../modals/BrowseUploadsModal';
import upscaleService from '../../services/UpscaleService';
import generateService from '../../services/GenerateService';
import configService from '../../services/ConfigService';
import { useUpscaleContext } from '../../context/UpscaleContext';
import { useConfigContext } from '../../context/ConfigContext';
import { useHistoryContext } from '../../context/HistoryContext';
import { useCarsContext } from '../../context/CarsContext';
import { useToastContext } from '../../context/ToastContext';
import { useSessionContext } from '../../context/SessionContext';

export function UpscaleTab({
  capabilities,
  initialPath,
  initialMode,
  onInitialConsumed,
  onIterateFrom,
  onRegenerateFrom,
  onNavigateToSpecular,
  onSwitchTab,
}) {
  // ── Contexts ─────────────────────────────────────────────────────────────
  const {
    upscaling, resampling, result: upscaleResult, status: upscaleStatus,
    upscale: onUpscale, resample: onResample, deploy: onDeploy,
    deploying, elapsedSeconds, clearStatus: onClearStatus,
  } = useUpscaleContext();
  const { config } = useConfigContext();
  const { loadHistory } = useHistoryContext();
  const { setBaseOverride } = useCarsContext();
  const { toast: onNotify } = useToastContext();
  const { session, debouncedSave } = useSessionContext();
  
  const [mode, setMode] = useState('upscale'); // 'upscale' | 'resample'
  const [sourcePath, setSourcePath] = useState('');
  const [sourcePreview, setSourcePreview] = useState('');
  const [compareEnabled, setCompareEnabled] = useState(true);
  const [compareSource, setCompareSource] = useState('source'); // 'source' | 'noise'
  const [showBrowseUploads, setShowBrowseUploads] = useState(false);
  const [ggufStatus, setGgufStatus] = useState(null);
  // Track whether we've done the initial session restore
  const sessionRestoredRef = useRef(false);

  // Load GGUF status on mount
  React.useEffect(() => {
    configService.getUpscaleStatus()
      .then(status => setGgufStatus(status))
      .catch(err => console.warn('Failed to fetch upscale status:', err));
  }, []);

  // ── Upscale config ──────────────────────────────────────────────────────────
  const [upscaleSize, setUpscaleSize] = useState(2048);

  // ── Resample config ───────────────────────────────────────────────────────
  const [downsampleSize, setDownsampleSize] = useState(1024);
  const [upsampleSize, setUpsampleSize]     = useState(2048);
  const [final2k, setFinal2k]               = useState(false);
  const [addNoise, setAddNoise]             = useState(false);
  const [noiseAmount, setNoiseAmount]       = useState(15);

  // Constrain downscale and upscale to valid ranges
  const PO2_STEPS = [128, 256, 512, 1024, 2048, 4096];
  const maxDownsample = 2048;
  const downsampleIdx = PO2_STEPS.indexOf(downsampleSize);
  const minUpsampleIdx = downsampleIdx + 1; // Next PO2 after downscale
  const minUpsample = PO2_STEPS[minUpsampleIdx] || 4096;

  // Auto-constrain upsampleSize if it goes below the new minimum
  React.useEffect(() => {
    if (upsampleSize < minUpsample) {
      setUpsampleSize(minUpsample);
    }
  }, [minUpsample, upsampleSize]);

  // Restore resample config from session on mount
  React.useEffect(() => {
    if (sessionRestoredRef.current) return;
    if (!session) return;
    sessionRestoredRef.current = true;
    
    if (session.upscale_size !== undefined) setUpscaleSize(session.upscale_size);
    if (session.resample_config) {
      const cfg = session.resample_config;
      if (cfg.downsampleSize !== undefined) setDownsampleSize(cfg.downsampleSize);
      if (cfg.upsampleSize !== undefined) setUpsampleSize(cfg.upsampleSize);
      if (cfg.final2k !== undefined) setFinal2k(cfg.final2k);
      if (cfg.addNoise !== undefined) setAddNoise(cfg.addNoise);
      if (cfg.noiseAmount !== undefined) setNoiseAmount(cfg.noiseAmount);
    }
  }, [session]);

  // Restore source path from session whenever it changes (e.g. after tab switch)
  React.useEffect(() => {
    if (!session) return;
    const savedPath = session.upscale_source_path;
    if (savedPath && !sourcePath) {
      // Only restore if source is currently empty
      setSourcePath(savedPath);
      setSourcePreview(`/api/uploads/preview?path=${encodeURIComponent(savedPath)}`);
    }
  }, [session?.upscale_source_path]);

  // Persist upscale size to session
  React.useEffect(() => {
    debouncedSave('upscale_size', upscaleSize, 500);
  }, [upscaleSize, debouncedSave]);

  // Persist resample config to session when any value changes
  React.useEffect(() => {
    debouncedSave('resample_config', {
      downsampleSize,
      upsampleSize,
      final2k,
      addNoise,
      noiseAmount,
    }, 500);
  }, [downsampleSize, upsampleSize, final2k, addNoise, noiseAmount, debouncedSave]);

  const loadSource = useCallback((path) => {
    setSourcePath(path);
    setSourcePreview(`/api/uploads/preview?path=${encodeURIComponent(path)}`);
    debouncedSave('upscale_source_path', path, 800);
  }, [debouncedSave]);

  const handleSourceUpload = useCallback((file) => {
    if (!file) return;
    upscaleService.uploadFile(file, 'upscale')
      .then(data => {
        if (data.path) loadSource(data.path);
      })
      .catch(e => console.error('Upload failed:', e));
  }, [loadSource]);

  const handleSourceBrowse = useCallback(() => {
    setShowBrowseUploads(true);
  }, []);

  // Create action handlers
  const handleLoadAsBase = useCallback((path) => {
    setBaseOverride(path);
  }, [setBaseOverride]);

  const handleResample = useCallback((path) => {
    setMode('resample');
    loadSource(path);
  }, [loadSource]);

  const handleClearSource = () => {
    setSourcePath('');
    setSourcePreview('');
    debouncedSave('upscale_source_path', '', 200);
  };

  const busy = upscaling || resampling;

  // Derived engine info from config
  const preferredEngine = config?.upscale_engine || 'realesrgan';
  const engineLabel = preferredEngine === 'seedvr2' ? 'SeedVR2' : 'Real-ESRGAN';
  const engineSpeed = preferredEngine === 'seedvr2' ? '30s–2 min' : '~30s';
  const isUpscaleAvailable = capabilities?.upscale_available;
  const isResampleAvailable = capabilities?.seedvr_available;
  const engineAvailable = preferredEngine === 'seedvr2' ? isResampleAvailable : isUpscaleAvailable;
  const engineInstallCmd = preferredEngine === 'seedvr2' ? '--seedvr' : '--realesrgan';

  // Consume injected path/mode (e.g. from "Resample" button in history tray)
  React.useEffect(() => {
    if (initialPath) {
      if (initialMode) setMode(initialMode);
      loadSource(initialPath);
      onInitialConsumed?.();
    }
  }, [initialPath]);

  // Restore source from session on first load (only if no initialPath override)
  React.useEffect(() => {
    if (sessionRestoredRef.current) return;
    if (initialPath) { sessionRestoredRef.current = true; return; }
    if (!session) return;
    sessionRestoredRef.current = true;
    const savedPath = session.upscale_source_path;
    if (savedPath) {
      setSourcePath(savedPath);
      setSourcePreview(`/api/uploads/preview?path=${encodeURIComponent(savedPath)}`);
    }
  }, [session, initialPath]);

  // Reload history when upscale/resample completes
  React.useEffect(() => {
    if (upscaleResult) {
      console.log('[UpscaleTab] upscaleResult received:', {
        has_full_res_url: !!upscaleResult.full_res_url,
        has_preview_url: !!upscaleResult.preview_url,
        full_res_length: upscaleResult.full_res_url?.length,
        preview_length: upscaleResult.preview_url?.length,
      });
      loadHistory?.();
    }
  }, [upscaleResult, loadHistory]);

  const handleAction = async () => {
    if (!sourcePath || busy) return;
    if (mode === 'resample') {
      await onResample?.(sourcePath, {
        downsampleSize,
        upsampleSize,
        final2k: final2k && upsampleSize > 2048,
        addNoise,
        noiseAmount,
      });
    } else {
      await onUpscale?.(sourcePath, upscaleSize);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left panel — input & controls */}
      <div className="w-[420px] min-w-[340px] max-w-[420px] flex-shrink-0 flex flex-col border-r border-border-default overflow-y-auto">
        <div className="p-3 flex flex-col gap-3">

          {/* Mode toggle — segmented control */}
          <div className="flex rounded-lg border border-border-default overflow-hidden">
            {[
              { id: 'upscale', label: 'Upscale', icon: (
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

          {/* Engine info chip */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] ${
            engineAvailable
              ? 'bg-bg-card border-border-default text-text-muted'
              : 'bg-warning/5 border-warning/30 text-warning'
          }`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            {engineAvailable ? (
              <span>Engine: <span className="text-text-secondary font-medium">{engineLabel}</span> · {engineSpeed} · Change in <span className="text-text-secondary">Settings</span></span>
            ) : (
              <span>{engineLabel} not installed — re-launch with <code className="font-mono text-warning">start.bat {engineInstallCmd}</code></span>
            )}
          </div>

          {/* Mode description + resample config */}
          {mode === 'upscale' ? (
            <div className="flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary mb-1">Upscale Configuration</h2>
                <p className="text-[11px] text-text-muted">
                  Upscales a livery using your configured engine, preserving aspect ratio. No API cost.
                </p>
              </div>
              <ResampleSizeSlider
                label="Upscale to"
                value={upscaleSize}
                onChange={setUpscaleSize}
                min={2048}
                max={4096}
                tip={preferredEngine === 'seedvr2' ? '4K requires significant VRAM' : 'Target output size (longest side)'}
                vramWarning={preferredEngine === 'seedvr2'}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary mb-1">Resample Configuration</h2>
                <p className="text-[11px] text-text-muted">
                  Downscales first to give the upscaler a clean starting point, then upscales.
                  Produces higher fidelity results on AI-generated textures.
                </p>
              </div>

              {/* Downsample size */}
              <ResampleSizeSlider
                label="Downscale to"
                value={downsampleSize}
                onChange={setDownsampleSize}
                min={128}
                max={maxDownsample}
                tip="Smaller = more aggressive smoothing before upscale"
              />

              {/* Upsample size */}
              <ResampleSizeSlider
                label="Upscale to"
                value={upsampleSize}
                onChange={setUpsampleSize}
                min={minUpsample}
                tip={preferredEngine === 'seedvr2' ? 'Higher values require more VRAM' : 'Target output resolution'}
                vramWarning={preferredEngine === 'seedvr2'}
              />

              {/* Final 2K toggle — only appears when upsampleSize > 2048 */}
              {upsampleSize > 2048 && (
                <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-bg-card border border-border-default cursor-pointer group">
                  <div>
                    <span className="text-[12px] font-medium text-text-primary">Scale final result to 2K</span>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      Downsamples the {upsampleSize}px result to 2048px for iRacing compatibility
                    </p>
                  </div>
                  <ToggleSwitch checked={final2k} onChange={setFinal2k} />
                </label>
              )}

              {/* Add noise */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-bg-card border border-border-default cursor-pointer group">
                  <div>
                    <span className="text-[12px] font-medium text-text-primary">Add noise</span>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      Re-introduces texture detail before upscaling — helps with over-smooth AI art
                    </p>
                  </div>
                  <ToggleSwitch checked={addNoise} onChange={setAddNoise} />
                </label>
                {addNoise && (
                  <div className="px-3 py-2 rounded-lg bg-bg-input border border-border-default">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-text-muted">Noise amount</span>
                      <span className="text-[11px] font-mono text-accent">{noiseAmount}%</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      step={1}
                      value={noiseAmount}
                      onChange={e => setNoiseAmount(Number(e.target.value))}
                      className="w-full h-1.5 accent-accent cursor-pointer"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-text-muted">Subtle</span>
                      <span className="text-[9px] text-text-muted">Heavy</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Source */}
          <FileUploader
            label="Source"
            tooltip="A livery to upscale or resample. Drop a TGA, PNG, or JPG."
            accept="image/*"
            onUpload={handleSourceUpload}
            onClear={sourcePath ? handleClearSource : null}
            onBrowse={handleSourceBrowse}
            currentPath={sourcePath}
            previewUrl={sourcePreview}
            placeholder="Drop livery or click"
            fixedHeight="h-[280px]"
          />

        </div>

        {/* Action buttons */}
        <div className="p-3 pt-0 flex flex-col gap-2 mt-auto">
          <GenerationProgress
            active={busy}
            elapsedSeconds={elapsedSeconds}
            expectedMax={mode === 'resample' ? 180 : 40}
            slowThreshold={mode === 'resample' ? 240 : 60}
            hint={mode === 'resample' ? '~30s–2 min expected' : '~30–60s expected'}
            slowHint={mode === 'resample' ? 'SeedVR2 is taking longer than expected' : 'Taking longer than expected'}
          />
          <Button
            variant="primary"
            size="lg"
            disabled={!sourcePath || busy || !engineAvailable}
            loading={busy}
            onClick={handleAction}
            className="w-full"
          >
            {mode === 'resample'
              ? (resampling ? 'Resampling…' : 'Resample')
              : (upscaling ? 'Upscaling…' : 'Upscale')
            }
          </Button>
        </div>
      </div>

      {/* Right panel — result preview using LiveryDetailPanel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {upscaleResult ? (
          <LiveryDetailPanel
            imageUrl={upscaleResult.full_res_url}
            previewUrl={upscaleResult.preview_url}
            noisedInputUrl={upscaleResult.noised_input_url}
            beforeUrl={
              compareSource === 'noise' && upscaleResult.noised_input_url
                ? upscaleResult.noised_input_url
                : sourcePreview || undefined
            }
            imagePath={upscaleResult.output_path}
            downloadName={mode === 'resample' ? 'livery_resampled.png' : 'livery_upscaled.png'}
            meta={[
              { label: 'Size', value: `${upscaleResult.size?.[0] || 2048}×${upscaleResult.size?.[1] || 2048}` },
              { label: 'Engine', value: mode === 'resample' ? 'SeedVR2' : 'Real-ESRGAN' },
              { label: 'Mode', value: mode === 'resample' ? 'Resample' : 'Upscale' },
            ]}
            onDeploy={() => onDeploy?.(upscaleResult.output_path, null, config?.customer_id)}
            deploying={deploying}
            deployLabel="Deploy to iRacing"
            onLoadAsBase={() => {
              handleLoadAsBase(upscaleResult.output_path);
              onSwitchTab?.('generate');
            }}
            onIterate={() => onIterateFrom?.({ livery_path: upscaleResult.output_path })}
            onResample={() => handleResample(upscaleResult.output_path)}
            onMakeSpec={() => {
              onNavigateToSpecular?.(upscaleResult.output_path);
            }}
            compareEnabled={compareEnabled}
            onToggleCompare={() => setCompareEnabled(v => !v)}
            compareSource={compareSource}
            onSetCompareSource={setCompareSource}
            hasNoiseSource={!!upscaleResult.noised_input_url}
            onNotify={onNotify}
            onSwitchTab={onSwitchTab}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-bg-dark p-4 overflow-hidden">
            <div className="flex flex-col items-center gap-3 text-center">
              {busy ? (
                <>
                  <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-text-secondary">
                    {mode === 'resample' ? 'Resampling…' : 'Upscaling…'}
                  </span>
                  <span className="text-xs text-text-muted">
                    {mode === 'resample' ? 'SeedVR2 may take 30s–2 minutes' : 'This may take a moment'}
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
          </div>
        )}

        {showBrowseUploads && (
          <BrowseUploadsModal
            category="upscale"
            isOpen={showBrowseUploads}
            onClose={() => setShowBrowseUploads(false)}
            onBrowse={(cat) => generateService.browseUploads(cat)}
            onSelect={(item) => {
              loadSource(item.path);
              setShowBrowseUploads(false);
            }}
            onDelete={async (path) => {
              try {
                await generateService.deleteUpload(path);
                return true;
              } catch { return false; }
            }}
          />
        )}
      </div>
    </div>
  );
}

export default UpscaleTab;

// ── Helpers ──────────────────────────────────────────────────────────────────────

const PO2_STEPS = [128, 256, 512, 1024, 2048, 4096];

function ResampleSizeSlider({ label, value, onChange, min = 128, max = 4096, tip, vramWarning = false }) {
  // Only include PO2 steps within [min, max]
  const steps = PO2_STEPS.filter(s => s >= min && s <= max);
  const idx   = steps.indexOf(value);

  const handleChange = (e) => {
    const i = Number(e.target.value);
    onChange(steps[i]);
  };

  // If current value is not in filtered steps, snap to nearest valid value
  React.useEffect(() => {
    if (!steps.includes(value)) {
      // Snap to closest valid step
      const closest = steps.reduce((a, b) => Math.abs(b - value) < Math.abs(a - value) ? b : a);
      onChange(closest);
    }
  }, [steps, value, onChange]);

  return (
    <div className="px-3 py-2 rounded-lg bg-bg-input border border-border-default flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-muted">{label}</span>
        <span className="text-[11px] font-mono text-accent">{value}&times;{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={steps.length - 1}
        step={1}
        value={idx < 0 ? 0 : idx}
        onChange={handleChange}
        className="w-full h-1.5 accent-accent cursor-pointer"
      />
      <div className="flex justify-between">
        {steps.map(s => (
          <span key={s} className={`text-[9px] ${s === value ? 'text-accent font-semibold' : 'text-text-muted'}`}>{s}</span>
        ))}
      </div>
      {tip && (
        <p className={`text-[10px] mt-0.5 ${vramWarning && value > 2048 ? 'text-warning' : 'text-text-muted'}`}>
          {vramWarning && value > 2048 ? `⚠️ ${value}px requires significant VRAM — ${tip}` : tip}
        </p>
      )}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-9 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer ${
        checked ? 'bg-accent' : 'bg-bg-hover border border-border-default'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
