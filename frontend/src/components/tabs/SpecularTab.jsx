import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../common/Button';
import { StatusBar } from '../common/StatusBar';
import { FileUploader } from '../common/FileUploader';
import { LiveryDetailPanel } from '../common/LiveryDetailPanel';
import { BrowseUploadsModal } from '../modals/BrowseUploadsModal';
import { ModelSelector } from '../common/ModelSelector';
import { GenerationProgress } from '../common/GenerationProgress';
import { calculateCost } from '../../utils/pricing';
import upscaleService from '../../services/UpscaleService';
import { useSessionContext } from '../../context/SessionContext';
import { useConfigContext } from '../../context/ConfigContext';
import { useCarsContext } from '../../context/CarsContext';
import { useGenerationPrefs } from '../../context/GenerationPrefsContext';
import { useSpecularContext } from '../../context/SpecularContext';
import { useGenerateContext } from '../../context/GenerateContext';

const DEFAULT_SPEC_PROMPT =
  'Standard automotive paint finish — glossy clear coat on all painted body panels, matte black rubber on tyres, semi-gloss metallic trim on exhausts and diffuser edges.';

export function SpecularTab({
  capabilities,
}) {
  // ── Contexts ─────────────────────────────────────────────────────────────
  const { session, saveSession } = useSessionContext();
  const { config } = useConfigContext();
  const {
    selectedCar, carWireUrl,
    wireOverride, baseOverride, overridesLoading,
    setWireOverride, setBaseOverride, clearWireOverride, clearBaseOverride,
  } = useCarsContext();
  const { genModel, genIs2K, setGenModel: onModelChange, setGenIs2K: onIs2KChange } = useGenerationPrefs();
  const {
    generating, deploying, elapsedSeconds, result: specResult, status,
    generate: onGenerate, abort: onAbort, deploySpec: onDeploySpec, clearStatus: onClearStatus,
  } = useSpecularContext();
  const { uploadFile: onUploadFile, browseUploads: onBrowseUploads, deleteUpload: onDeleteUpload } = useGenerateContext();

  const model = genModel ?? 'pro';
  const is2K = genIs2K ?? true;
  const [prompt, setPrompt] = useState(
    session?.last_spec_prompt != null ? session.last_spec_prompt : DEFAULT_SPEC_PROMPT
  );
  // model and is2K come from GenerationPrefsContext (shared with GenerateTab)
  const [wireframePath, setWireframePath] = useState('');
  const [liveryPath, setLiveryPath] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [hoverPreviewUrl, setHoverPreviewUrl] = useState('');
  const [browseCategory, setBrowseCategory] = useState(null);
  const [channels, setChannels] = useState(null);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const sessionRestoredRef = useRef(false);

  // Restore session once loaded
  useEffect(() => {
    if (!session || sessionRestoredRef.current) return;
    sessionRestoredRef.current = true;
    if (session.last_spec_prompt != null) setPrompt(session.last_spec_prompt);
  }, [session]);

  // Resolve wireframe path: override > library default
  useEffect(() => {
    if (wireOverride) {
      setWireframePath(wireOverride);
    } else if (carWireUrl) {
      setWireframePath(carWireUrl);
    } else {
      setWireframePath('');
    }
  }, [wireOverride, carWireUrl]);

  // Resolve livery path from base override
  useEffect(() => {
    setLiveryPath(baseOverride || '');
  }, [baseOverride]);

  // Update preview when result or livery changes
  useEffect(() => {
    if (specResult?.livery_path) {
      setPreviewUrl(`/api/uploads/preview?path=${encodeURIComponent(specResult.livery_path)}`);
    } else if (specResult?.preview_b64) {
      setPreviewUrl(`data:image/png;base64,${specResult.preview_b64}`);
    } else if (liveryPath) {
      setPreviewUrl(
        liveryPath.startsWith('/api/')
          ? liveryPath
          : `/api/uploads/preview?path=${encodeURIComponent(liveryPath)}`
      );
    }
  }, [specResult, liveryPath]);

  // Fetch RGB channels when a spec result is available
  useEffect(() => {
    if (!specResult?.livery_path) {
      setChannels(null);
      return;
    }
    let cancelled = false;
    setChannelsLoading(true);
    upscaleService.extractChannels(specResult.livery_path)
      .then(data => { if (!cancelled) setChannels(data); })
      .catch(() => { if (!cancelled) setChannels(null); })
      .finally(() => { if (!cancelled) setChannelsLoading(false); });
    return () => { cancelled = true; };
  }, [specResult?.livery_path]);

  const carMeta = { car_folder: selectedCar || '', car_display: selectedCar || '' };

  const handleWireframeUpload = async (file) => {
    const result = await onUploadFile?.('wire', file, carMeta);
    if (result?.path) await setWireOverride?.(result.path);
  };

  const handleLiveryUpload = async (file) => {
    const result = await onUploadFile?.('base', file, carMeta);
    if (result?.path) await setBaseOverride?.(result.path);
  };

  const handleBrowseSelect = (item) => {
    if (!browseCategory) return;
    if (browseCategory === 'wire') {
      setWireOverride?.(item.path);
    } else if (browseCategory === 'base') {
      setBaseOverride?.(item.path);
    }
    setBrowseCategory(null);
  };

  const canGenerate = selectedCar && prompt.trim() && !generating;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    const customerId = config?.customer_id?.trim() || '';
    await onGenerate({
      prompt: prompt.trim(),
      car_folder: selectedCar || '',
      wireframe_path: wireframePath,
      livery_path: liveryPath,
      model,
      resolution_2k: model === 'pro' || is2K,
      customer_id: customerId,
      auto_deploy: false,
    });
  };

  const handleDeploySpec = () => {
    if (!specResult?.livery_path || !selectedCar) return;
    onDeploySpec?.(specResult.livery_path, selectedCar, config?.customer_id || '');
  };

  const cost = calculateCost(model, is2K, config);
  const activePreview = hoverPreviewUrl || previewUrl;
  const hasApiKey = !!(config?.gemini_api_key_set || config?.gemini_api_key?.trim());
  const hasCustomerId = !!(config?.customer_id?.trim());

  const meta = specResult
    ? [
        { label: 'Car', value: selectedCar },
        { label: 'Model', value: model === 'flash' ? 'Flash' : 'Pro', className: model === 'pro' ? 'text-accent-wine' : 'text-accent' },
        { label: 'Resolution', value: (model === 'pro' || is2K) ? '2K (2048×2048)' : '1K (1024×1024)', className: model === 'pro' ? 'text-accent-wine/80' : 'text-accent/80' },
        { label: 'Cost', value: specResult.cost != null ? `$${parseFloat(specResult.cost).toFixed(4)}` : '—', className: 'text-warning' },
        { label: 'File', value: specResult.livery_path || '—' },
      ]
    : [];

  // Gate: no API key
  if (config && !hasApiKey) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="w-14 h-14 rounded-full bg-warning/10 border border-warning/30 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div>
          <p className="text-base font-semibold text-text-primary mb-1">Gemini API key required</p>
          <p className="text-sm text-text-muted max-w-[340px]">
            Add a Gemini API key in <strong className="text-text-secondary">Settings</strong> to generate specular maps.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {!selectedCar ? (
        /* ── No-car empty state ────────────────────────────────────────── */
        <div className="flex-1 flex flex-col items-center justify-center relative select-none overflow-hidden">
          <div className="absolute top-0 left-[110px]">
            <svg width="100" height="120" viewBox="0 0 100 120" fill="none" className="text-accent opacity-50">
              <path d="M 30 12 L 22 24 M 30 12 L 38 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 30 14 C 28 50, 50 80, 80 110" stroke="currentColor" strokeWidth="2" strokeDasharray="6 5" strokeLinecap="round" />
            </svg>
            <p className="text-[11px] text-accent/60 font-medium whitespace-nowrap -mt-1 ml-16">select a car here</p>
          </div>
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-20 h-20 rounded-2xl bg-bg-card border border-border-default flex items-center justify-center shadow-sm">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                <path d="M5 17H3a2 2 0 01-2-2v-4l2.5-5h13L19 11v4a2 2 0 01-2 2h-2" />
                <circle cx="7.5" cy="17.5" r="2.5" /><circle cx="16.5" cy="17.5" r="2.5" />
                <path d="M5 11h14" />
              </svg>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-base font-semibold text-text-primary">No car selected</p>
              <p className="text-sm text-text-muted max-w-[260px] leading-relaxed">
                Use the <span className="text-text-secondary font-medium">car picker</span> in the bar above to choose a car first.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ── Left panel ───────────────────────────────────────────────── */}
          <div className="w-[420px] min-w-[340px] flex-shrink-0 flex flex-col border-r border-border-default overflow-hidden">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 flex flex-col gap-3">

              {/* Info banner */}
              <div className="flex items-start gap-2 px-3 py-2.5 rounded border border-accent/30 bg-accent/5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent mt-0.5 flex-shrink-0">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <div className="flex flex-col gap-1">
                  <p className="text-[12px] text-accent/90 leading-snug font-semibold">Experimental Feature</p>
                  <p className="text-[12px] text-accent/90 leading-snug">
                    Specular maps control surface shininess and reflectivity. Results may vary — success rates are low. Deploy as{' '}
                    <code className="font-mono text-[11px]">car_spec_&lt;id&gt;.tga</code>.
                  </p>
                </div>
              </div>

              {/* Warning: no customer ID */}
              {!hasCustomerId && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded border border-warning/40 bg-warning/5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning mt-0.5 flex-shrink-0">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <p className="text-[12px] text-warning/90 leading-snug">
                    No iRacing Customer ID set — add your ID in <strong>Settings</strong> to enable deploy.
                  </p>
                </div>
              )}

              {/* ── Wireframe + Source Livery — side by side ─────────────── */}
              <div className="flex flex-col gap-1">
                <div className="grid grid-cols-2 gap-2">
                  <FileUploader
                    label="Wireframe"
                    tooltip="UV wireframe image for the car. Helps the AI understand panel boundaries."
                    accept="image/*"
                    onUpload={handleWireframeUpload}
                    onClear={wireOverride ? clearWireOverride : undefined}
                    onBrowse={() => setBrowseCategory('wire')}
                    currentPath={wireframePath}
                    previewUrl={wireframePath
                      ? wireframePath.startsWith('/api/')
                        ? wireframePath
                        : `/api/uploads/preview?path=${encodeURIComponent(wireframePath)}`
                      : ''}
                    placeholder="Auto-loaded from car library"
                    disabled={overridesLoading}
                    onHoverPreview={(url) => setHoverPreviewUrl(url)}
                    onHoverPreviewEnd={() => setHoverPreviewUrl('')}
                  />
                  <FileUploader
                    label="Source Livery"
                    tooltip="Optional: the livery this spec map is for. Helps the AI identify material zones (painted panels, tyres, glass, trim)."
                    accept="image/*,.tga"
                    onUpload={handleLiveryUpload}
                    onClear={baseOverride ? clearBaseOverride : undefined}
                    onBrowse={() => setBrowseCategory('base')}
                    currentPath={liveryPath}
                    previewUrl={liveryPath
                      ? liveryPath.startsWith('/api/')
                        ? liveryPath
                        : `/api/uploads/preview?path=${encodeURIComponent(liveryPath)}`
                      : ''}
                    placeholder="Upload livery or leave blank"
                    disabled={overridesLoading}
                    onHoverPreview={(url) => setHoverPreviewUrl(url)}
                    onHoverPreviewEnd={() => setHoverPreviewUrl('')}
                  />
                </div>
                {(wireOverride || baseOverride) && (
                  <div className="flex gap-3">
                    {wireOverride && (
                      <p className="text-[10px] text-accent flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        Custom wireframe
                      </p>
                    )}
                    {baseOverride && (
                      <p className="text-[10px] text-accent flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        Source livery loaded
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ── Prompt ───────────────────────────────────────────────── */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Spec map description</span>
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => { setPrompt(e.target.value); saveSession?.({ last_spec_prompt: e.target.value }); }}
                  placeholder="Describe surface finishes…"
                  rows={4}
                  className="w-full bg-bg-input border border-border-default rounded px-3 py-2 text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent transition-colors"
                />
                <button
                  onClick={() => { setPrompt(DEFAULT_SPEC_PROMPT); saveSession?.({ last_spec_prompt: DEFAULT_SPEC_PROMPT }); }}
                  className="self-start text-[10px] text-text-secondary hover:text-accent transition-colors"
                >
                  Reset to default
                </button>
              </div>

              </div>
            </div>

            {/* Fixed bottom section — model selector + generate button */}
            <div className="border-t border-border-default p-3 flex flex-col gap-3">

              {/* ── Model selector ───────────────────────────────────────── */}
              <ModelSelector
                model={model}
                onModelChange={onModelChange}
                is2K={is2K}
                onIs2KChange={onIs2KChange}
                cost={cost}
                config={config}
              />

              {/* ── Generate button ──────────────────────────────────────── */}
              <div className="flex flex-col gap-2">
                <GenerationProgress
                  generating={generating}
                  elapsedSeconds={elapsedSeconds}
                  onAbort={onAbort}
                />
                <Button
                  variant="primary"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  loading={generating}
                  className="w-full"
                >
                  {generating ? 'Generating…' : 'Generate Specular Map'}
                </Button>
              </div>

              {/* Status bar */}
              {status && (
                <StatusBar
                  type={status.type}
                  message={status.message}
                  onDismiss={onClearStatus}
                />
              )}
            </div>
          </div>

          {/* ── Right panel ──────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden bg-bg-dark">
            {specResult ? (
              <>
                <LiveryDetailPanel
                  imageUrl={activePreview || previewUrl}
                  imagePath={specResult.livery_path}
                  downloadName={`${selectedCar}_spec.tga`}
                  prompt={specResult.prompt || prompt}
                  meta={meta}
                  onDeploy={hasCustomerId ? handleDeploySpec : undefined}
                  deploying={deploying}
                  deployLabel="Deploy Spec to iRacing"
                />
                {/* RGB channel strip */}
                {(channels || channelsLoading) && (
                  <div className="flex-shrink-0 border-t border-border-default bg-bg-panel px-4 py-2.5">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-text-muted mb-1.5">RGB Channels</div>
                    <div className="flex gap-2">
                      {channelsLoading ? (
                        <div className="flex items-center gap-2 text-[11px] text-text-muted">
                          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                          Extracting channels…
                        </div>
                      ) : (
                        [
                          { key: 'r', label: 'R — Specular', color: '#ef4444', borderColor: 'border-[#ef4444]' },
                          { key: 'g', label: 'G — Gloss', color: '#22c55e', borderColor: 'border-[#22c55e]' },
                          { key: 'b', label: 'B — Clearcoat', color: '#3b82f6', borderColor: 'border-[#3b82f6]' },
                        ].map(({ key, label, color, borderColor }) => (
                          <div
                            key={key}
                            className="flex flex-col items-center gap-1 cursor-pointer group"
                            onMouseEnter={() => channels?.[key] && setHoverPreviewUrl(`data:image/jpeg;base64,${channels[key]}`)}
                            onMouseLeave={() => setHoverPreviewUrl('')}
                          >
                            <div className={`w-16 h-16 rounded border-2 ${borderColor} overflow-hidden bg-bg-card transition-transform group-hover:scale-105`}>
                              {channels?.[key] ? (
                                <img
                                  src={`data:image/jpeg;base64,${channels[key]}`}
                                  alt={`${key.toUpperCase()} channel`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-text-muted text-[10px]">—</div>
                              )}
                            </div>
                            <span className="text-[9px] font-medium" style={{ color }}>{label}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                <div className="w-24 h-24 rounded-2xl bg-bg-card border border-border-default flex items-center justify-center shadow-sm">
                  <svg width="52" height="52" viewBox="0 0 52 52" fill="none" className="opacity-30">
                    <rect x="2" y="2" width="22" height="22" rx="3" fill="#ef4444" opacity="0.7" />
                    <text x="13" y="17" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">R</text>
                    <rect x="28" y="2" width="22" height="22" rx="3" fill="#22c55e" opacity="0.7" />
                    <text x="39" y="17" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">G</text>
                    <rect x="15" y="28" width="22" height="22" rx="3" fill="#3b82f6" opacity="0.7" />
                    <text x="26" y="43" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">B</text>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary mb-1">No specular map yet</p>
                  <p className="text-xs text-text-muted max-w-[260px] leading-relaxed">
                    Configure settings on the left and click{' '}
                    <strong className="text-text-secondary">Generate Specular Map</strong>.
                  </p>
                </div>
                <div className="mt-2 bg-bg-card border border-border-default rounded p-3 text-left max-w-[320px]">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">RGB channel guide</p>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-[#ef4444] flex-shrink-0" />
                      <span className="text-[11px] text-text-secondary"><strong className="text-text-primary">R</strong> — Specular intensity</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-[#22c55e] flex-shrink-0" />
                      <span className="text-[11px] text-text-secondary"><strong className="text-text-primary">G</strong> — Gloss / roughness</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-[#3b82f6] flex-shrink-0" />
                      <span className="text-[11px] text-text-secondary"><strong className="text-text-primary">B</strong> — Clearcoat presence</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Browse uploads modal */}
      {browseCategory && (
        <BrowseUploadsModal
          isOpen
          category={browseCategory}
          onClose={() => setBrowseCategory(null)}
          onSelect={handleBrowseSelect}
          onDelete={onDeleteUpload}
          onBrowse={onBrowseUploads}
        />
      )}
    </div>
  );
}

export default SpecularTab;
