import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../common/Button';
import { Toggle } from '../common/Toggle';
import { FileUploader } from '../common/FileUploader';
import { ModelSelector } from '../common/ModelSelector';
import { calculateCost, formatCost, getModelDisplayName, getResolutionDisplayName } from '../../utils/pricing';
import { EnhanceGuidanceModal } from '../modals/EnhanceGuidanceModal';
import { BrowseUploadsModal } from '../modals/BrowseUploadsModal';
import { ReferenceContextSamplesModal } from '../modals/ReferenceContextSamplesModal';
import { InfoTooltip } from '../common/InfoTooltip';
import { LiveryDetailPanel } from '../common/LiveryDetailPanel';
import { GenerationProgress } from '../common/GenerationProgress';
import { useSessionContext } from '../../context/SessionContext';
import { useConfigContext } from '../../context/ConfigContext';
import { useCarsContext } from '../../context/CarsContext';
import { useGenerationPrefs } from '../../context/GenerationPrefsContext';
import { useGenerateContext } from '../../context/GenerateContext';
import { useUpscaleContext } from '../../context/UpscaleContext';

// ─── Icons ──────────────────────────────────────────────────────────────────

function IconPlus({ className = '' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconPencil({ className = '' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function IconWand({ className = '' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M12.2 11.8L11 13M12.2 6.2L11 5M15 9a3 3 0 11-6 0 3 3 0 016 0z" />
      <path d="M3 21l9-9" />
    </svg>
  );
}

function IconCog({ className = '' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function IconGemini({ className = '' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2L13.5 9.5L20 12L13.5 14.5L12 22L10.5 14.5L4 12L10.5 9.5L12 2Z" />
    </svg>
  );
}

export function GenerateTab({
  // Only props that are truly local to App (injection state, navigation callbacks)
  capabilities,
  injectedPrompt,
  onInjectedPromptUsed,
  onEnhancePrompt,
  iteratePath,
  onIteratePathUsed,
  regenerateData,
  onRegenerateDataUsed,
  onNavigateToSpecular,
  onNavigateToUpscale,
  onNavigateToResample,
  onOpenSamplePrompts,
  onOpenPromptHistory,
}) {
  // ── Contexts ─────────────────────────────────────────────────────────────
  const { session, saveSession, debouncedSaveModeState } = useSessionContext();
  const { config } = useConfigContext();
  const {
    selectedCar, carWireUrl, carDiffuseUrl,
    wireOverride, baseOverride, overridesLoading,
    setWireOverride, setBaseOverride, clearWireOverride, clearBaseOverride,
  } = useCarsContext();
  const { genModel: model, genIs2K: is2K, genAutoUpscale: autoUpscale, setGenModel: onModelChange, setGenIs2K: onIs2KChange, setGenAutoUpscale: onAutoUpscaleChange } = useGenerationPrefs();
  const {
    generating, elapsedSeconds, result: lastResult, status: generateStatus,
    generate: onGenerate, abort: onAbort, uploadFile: onUploadFile,
    browseUploads: onBrowseUploads, deleteUpload: onDeleteUpload, clearStatus: onClearStatus,
  } = useGenerateContext();
  const { deploying, deploy } = useUpscaleContext();

  const handleDeploy = useCallback(async (liveryPath, carName, customerId) => {
    const cid = customerId || config?.customer_id;
    await deploy(liveryPath, carName || selectedCar, cid);
  }, [deploy, config, selectedCar]);
  // ── Mode ─────────────────────────────────────────────────────────────────
  // 'new' and 'modify' each have their own fully independent state bag.
  // `mode` is just the key that says which bag is currently displayed.
  // Nothing ever copies fields between bags — switching mode just changes the key.

  const [mode, setMode] = useState('new');

  // One state object per mode.  Fields: { prompt, context, referencePaths, referenceContext }
  // Default (empty) bag shape — used as a fallback when a mode key is missing
  const EMPTY_MODE_BAG = { prompt: '', context: '', referencePaths: [], referenceContext: '' };

  // Merge an incoming modeState from session with the local defaults.
  // Ensures both 'new' and 'modify' bags always exist and have every required field.
  const sanitizeModeState = (incoming) => ({
    new:    { ...EMPTY_MODE_BAG, ...(incoming?.new    || {}) },
    modify: { ...EMPTY_MODE_BAG, ...(incoming?.modify || {}) },
  });

  // Initialize with empty state — restoration effect will populate from session
  const [modeState, setModeState] = useState(sanitizeModeState(null));

  // Convenience: current mode's state bag — always a complete object, never undefined
  const ms = modeState[mode] ?? EMPTY_MODE_BAG;

  // Update one field in one mode's bag and persist it to session
  const updateModeField = useCallback((m, field, value) => {
    setModeState(prev => {
      const updated = { ...prev, [m]: { ...prev[m], [field]: value } };
      // Save the full modeState structure to session
      saveSession?.({ modeState: updated });
      return updated;
    });
  }, [saveSession]);

  const [iterateEnabled, setIterateEnabled] = useState(false);
  // model, is2K, autoUpscale are lifted to App — received as props
  // wireframePath/basePath are the effective paths used for generation.
  // They resolve: override (if set and file exists) > library default
  const [wireframePath, setWireframePath] = useState('');
  const [basePath, setBasePath] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [hoverPreviewUrl, setHoverPreviewUrl] = useState('');
  const [enhancing, setEnhancing] = useState(false);
  const [autoEnhance, setAutoEnhance] = useState(session?.last_auto_enhance === true);
  const [showEnhanceGuidance, setShowEnhanceGuidance] = useState(false);
  const [browseCategory, setBrowseCategory] = useState(null); // null | 'wire' | 'base' | 'reference'
  const [showReferenceExamples, setShowReferenceExamples] = useState(false);
  const sessionRestoredRef = useRef(false);

  // Derived flags — an override is active when the override path is non-empty
  const wireframeIsOverride = !!wireOverride;
  const baseIsOverride = !!baseOverride;

  // Restore session state once it loads
  useEffect(() => {
    if (!session || sessionRestoredRef.current) return;
    sessionRestoredRef.current = true;
    
    const restoredMode = session.last_mode === 'modify' ? 'modify' : 'new';
    setMode(restoredMode);
    
    if (session.modeState) {
      setModeState(sanitizeModeState(session.modeState));
    }
    
    if (session.last_auto_enhance === true) setAutoEnhance(true);
  }, [session]);

  // Apply injected prompt from modals into whichever mode is active
  useEffect(() => {
    if (injectedPrompt == null) return;
    updateModeField(mode, 'prompt', injectedPrompt);
    onInjectedPromptUsed?.();
  }, [injectedPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Iterate: switch to modify mode. Base override already set by App.
  // We only change mode — each mode's own state is untouched.
  useEffect(() => {
    if (!iteratePath) return;
    setMode('modify');
    onIteratePathUsed?.();
  }, [iteratePath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Regenerate: switch to new mode and load the result's prompt/context into the new bag
  useEffect(() => {
    if (!regenerateData) return;

    const data =
      typeof regenerateData === 'string'
        ? { prompt: regenerateData, context: '' }
        : regenerateData;

    if (!data || typeof data !== 'object') {
      onRegenerateDataUsed?.();
      return;
    }

    setMode('new');
    setModeState(prev => {
      const updated = {
        ...prev,
        new: {
          ...prev.new,
          prompt: data?.prompt ?? '',
          context: data?.context ?? '',
        },
      };
      saveSession?.({ modeState: updated });
      return updated;
    });
    onRegenerateDataUsed?.();
  }, [regenerateData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update preview when result or base changes
  useEffect(() => {
    if (lastResult?.livery_path) {
      // Use the full-res TGA served via the preview endpoint (TGA→PNG on-the-fly)
      setPreviewUrl(`/api/uploads/preview?path=${encodeURIComponent(lastResult.livery_path)}`);
    } else if (lastResult?.preview_b64) {
      // Fallback: inline thumbnail (e.g. older responses without livery_path)
      setPreviewUrl(`data:image/png;base64,${lastResult.preview_b64}`);
    } else if (lastResult?.preview_url) {
      setPreviewUrl(lastResult.preview_url);
    } else if (basePath) {
      // basePath may be an absolute filesystem path (override) or a library URL — don't double-wrap
      setPreviewUrl(
        basePath.startsWith('/api/')
          ? basePath
          : `/api/uploads/preview?path=${encodeURIComponent(basePath)}`
      );
    }
  }, [lastResult, basePath]);

  // Resolve effective wireframe path: override > library default
  useEffect(() => {
    if (wireOverride) {
      setWireframePath(wireOverride);
    } else if (carWireUrl) {
      setWireframePath(carWireUrl);
    } else {
      setWireframePath('');
    }
  }, [wireOverride, carWireUrl]);

  // Resolve effective base path: override > library default
  useEffect(() => {
    if (baseOverride) {
      setBasePath(baseOverride);
    } else if (carDiffuseUrl) {
      setBasePath(carDiffuseUrl);
    } else {
      setBasePath('');
    }
  }, [baseOverride, carDiffuseUrl]);

  const handlePromptChange = (value) => {
    console.log('[FRONTEND_HANDLER] handlePromptChange called, value:', value.substring(0, 40));
    // Ensure modeState has entry for current mode
    const modeEntry = modeState[mode] || {
      prompt: '',
      context: '',
      referencePaths: [],
      referenceContext: '',
    };
    const updated = {
      ...modeState,
      [mode]: { ...modeEntry, prompt: value },
    };
    setModeState(updated);
    debouncedSaveModeState?.(updated, 500);
  };

  const handleContextChange = (value) => {
    // Ensure modeState has entry for current mode
    const modeEntry = modeState[mode] || {
      prompt: '',
      context: '',
      referencePaths: [],
      referenceContext: '',
    };
    const updated = {
      ...modeState,
      [mode]: { ...modeEntry, context: value },
    };
    setModeState(updated);
    debouncedSaveModeState?.(updated, 500);
  };

  // Switching mode: just flip the key — each mode's bag is already up-to-date in state and session.
  // Persist last_mode so the correct mode is restored on next load.
  const handleModeChange = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    saveSession?.({ last_mode: newMode });
  };

  // Car metadata for upload association.
  // selectedCar is the iRacing folder string (e.g. "porsche911GT3R992"), not an object.
  const carMeta = {
    car_folder: selectedCar || '',
    car_display: selectedCar || '',
  };

  const handleWireframeUpload = async (file) => {
    const result = await onUploadFile?.('wire', file, carMeta);
    if (result?.path) {
      // Persist override for this car
      await setWireOverride?.(result.path);
    }
  };

  const handleBaseUpload = async (file) => {
    const result = await onUploadFile?.('base', file, carMeta);
    if (result?.path) {
      // Persist override for this car
      await setBaseOverride?.(result.path);
    }
  };

  const handleReferenceUpload = async (file) => {
    const result = await onUploadFile?.('reference', file, carMeta);
    if (result?.path && ms) {
      const newPaths = [...(ms.referencePaths || []), result.path];
        updateModeField(mode, 'referencePaths', newPaths);
    }
  };

  const handleClearReference = (path) => {
    const newPaths = (ms?.referencePaths || []).filter((p) => p !== path);
    updateModeField(mode, 'referencePaths', newPaths);
    if (newPaths.length === 0 && ms?.referenceContext) {
      updateModeField(mode, 'referenceContext', '');
    }
  };

  const handleClearWireframe = async () => {
    await clearWireOverride?.();
  };

  const handleClearBase = async () => {
    await clearBaseOverride?.();
  };

  // Browse modal handlers
  const handleBrowseSelect = (item) => {
    if (!browseCategory || !ms) return;
    if (browseCategory === 'wire') {
      setWireOverride?.(item.path);
    } else if (browseCategory === 'base') {
      setBaseOverride?.(item.path);
    } else if (browseCategory === 'reference') {
      const refPaths = ms.referencePaths || [];
      if (!refPaths.includes(item.path)) {
        const newPaths = [...refPaths, item.path];
        updateModeField(mode, 'referencePaths', newPaths);
      }
    }
  };

  const handleEnhance = async () => {
    if (!ms?.prompt?.trim() || enhancing) return;
    setEnhancing(true);
    try {
      const enhanced = await onEnhancePrompt?.(ms.prompt.trim(), ms.context.trim(), mode);
      if (enhanced) {
        updateModeField(mode, 'prompt', enhanced);
      }
    } finally {
      setEnhancing(false);
    }
  };

  const canGenerate = selectedCar && ms?.prompt?.trim() && !generating;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    const customerId = config?.customer_id?.trim() || '';

    // Auto-enhance prompt if enabled
    let finalPrompt = ms.prompt.trim();
    if (autoEnhance) {
      try {
        const enhanced = await onEnhancePrompt?.(finalPrompt, ms.context.trim(), mode);
        if (enhanced) finalPrompt = enhanced;
      } catch { /* continue with original prompt */ }
    }

    const result = await onGenerate({
      prompt: finalPrompt,
      context: ms.context.trim(),
      model,
      car_folder: selectedCar || '',
      wireframe_path: wireframePath,
      base_texture_path: mode === 'modify' || iterateEnabled ? basePath : '',
      reference_paths: ms.referencePaths,
      reference_context: ms.referenceContext.trim(),
      resolution_2k: model === 'pro' || is2K,
      upscale: autoUpscale && model === 'flash' && !is2K,
      mode: iterateEnabled ? 'iterate' : mode,
      customer_id: customerId,
      auto_deploy: !!customerId,
      estimatedCost: calculateCost(model, is2K, config),
    });

    if (iterateEnabled && result?.livery_path) {
      setBaseOverride?.(result.livery_path);
    }
  };

  const cost = calculateCost(model, is2K, config);
  const showUpscaleToggle = model === 'flash' && !is2K && capabilities?.upscale_available;
  const showUpscaleDisabled = model === 'flash' && !is2K && !capabilities?.upscale_available;
  const activePreview = hoverPreviewUrl || previewUrl;
  const hasApiKey = !!(config?.gemini_api_key_set || config?.gemini_api_key?.trim());
  const hasCustomerId = !!(config?.customer_id?.trim());

  // Gate: no API key set
  if (config && !hasApiKey) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="w-14 h-14 rounded-full bg-warning/10 border border-warning/30 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div>
          <p className="text-base font-semibold text-text-primary mb-1">Gemini API key required</p>
          <p className="text-sm text-text-muted max-w-[340px]">
            You need to add a Gemini API key before generating liveries. Head to the{' '}
            <strong className="text-text-secondary">Settings</strong> tab to add your key.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {!selectedCar ? (
        /* ── No-car empty state ─────────────────────────────────────────── */
        <div className="flex-1 flex flex-col items-center justify-center relative select-none overflow-hidden">

          {/*
            Arrow anchored to top-left of the content area, horizontally offset
            to ~110px — roughly the centre of the "Car" label + dropdown in SubBar.
            SVG draws a curve starting at the top (near the SubBar) and sweeping
            down-right toward the centred message block.
          */}
          <div className="absolute top-0 left-[110px]">
            <svg width="100" height="120" viewBox="0 0 100 120" fill="none" className="text-accent opacity-50">
              {/* Arrowhead at the top pointing up */}
              <path
                d="M 30 12 L 22 24 M 30 12 L 38 24"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Dashed curve from arrowhead down-right toward centre message */}
              <path
                d="M 30 14 C 28 50, 50 80, 80 110"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="6 5"
                strokeLinecap="round"
              />
            </svg>
            <p className="text-[10px] text-accent/60 font-medium whitespace-nowrap -mt-1 ml-16">
              select a car here
            </p>
          </div>

          {/* Central icon + message */}
          <div className="flex flex-col items-center gap-4 text-center">
            {/* Car silhouette icon */}
            <div className="w-20 h-20 rounded-2xl bg-bg-card border border-border-default flex items-center justify-center shadow-sm">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                <path d="M5 17H3a2 2 0 01-2-2v-4l2.5-5h13L19 11v4a2 2 0 01-2 2h-2" />
                <circle cx="7.5" cy="17.5" r="2.5" />
                <circle cx="16.5" cy="17.5" r="2.5" />
                <path d="M5 11h14" />
              </svg>
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-base font-semibold text-text-primary">No car selected</p>
              <p className="text-sm text-text-muted max-w-[260px] leading-relaxed">
                Use the <span className="text-text-secondary font-medium">car picker</span> in the bar above to choose a car and start designing your livery.
              </p>
            </div>
          </div>
        </div>
      ) : (
      <>
      {/* Left panel */}
      <div className="w-[420px] min-w-[340px] flex-shrink-0 flex flex-col border-r border-border-default overflow-hidden">
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 flex flex-col gap-3">

          {/* Warning: no customer ID — deploy will be skipped */}
          {!hasCustomerId && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded border border-warning/40 bg-warning/5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning mt-0.5 flex-shrink-0">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-[12px] text-warning/90 leading-snug">
                No iRacing Customer ID set — generated liveries won't be auto-deployed to iRacing. Add your ID in{' '}
                <strong>Settings</strong>.
              </p>
            </div>
          )}

          {/* Mode toggle — segmented control */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Mode</label>
              <InfoTooltip position="right" maxWidth={280} text="New: Start a fresh livery from scratch. Modify: Iterate on an existing livery — upload a base texture and describe changes." />
            </div>
            <div className="flex rounded-lg border border-border-default overflow-hidden">
              {[
                { id: 'new', label: 'New', icon: <IconPlus className="w-3.5 h-3.5" /> },
                { id: 'modify', label: 'Modify', icon: <IconPencil className="w-3.5 h-3.5" /> },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModeChange(m.id)}
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
          </div>

          {/* Wireframe + Base texture — side by side */}
          <div className="grid grid-cols-2 gap-2">
            <FileUploader
              label="Wireframe"
              tooltip="A UV wireframe image of the car body. The app auto-loads the wireframe for the selected car from the built-in library. Upload a custom one if you have a higher-quality template."
              accept="image/*"
              onUpload={handleWireframeUpload}
              onClear={wireframeIsOverride ? handleClearWireframe : null}
              onBrowse={() => setBrowseCategory('wire')}
              currentPath={wireframePath}
              previewUrl={
                wireframePath
                  ? wireframeIsOverride
                    ? `/api/uploads/preview?path=${encodeURIComponent(wireframePath)}`
                    : wireframePath
                  : ''
              }
              placeholder="Drop wireframe or click"
              onHoverPreview={setHoverPreviewUrl}
              onHoverPreviewEnd={() => setHoverPreviewUrl('')}
              fixedHeight="h-48"
            />
            <FileUploader
              label="Base Texture"
              tooltip={mode === 'modify' ? 'The livery you want to modify — the AI paints on top of it. Describe the changes you want in the prompt.' : 'In New mode this acts as a colour/style reference — the AI uses it for guidance only. Accepts PNG or JPG.'}
              accept="image/*"
              onUpload={handleBaseUpload}
              onClear={baseIsOverride ? handleClearBase : null}
              onBrowse={() => setBrowseCategory('base')}
              currentPath={basePath}
              previewUrl={
                basePath
                  ? baseIsOverride
                    ? `/api/uploads/preview?path=${encodeURIComponent(basePath)}`
                    : basePath
                  : ''
              }
              placeholder="Drop base texture or click"
              onHoverPreview={setHoverPreviewUrl}
              onHoverPreviewEnd={() => setHoverPreviewUrl('')}
              fixedHeight="h-48"
            />
          </div>

          {/* Reference images */}
          <div className="flex flex-col gap-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
              References
              <InfoTooltip position="right" maxWidth={280} text="Extra images the AI can draw inspiration from — real-world liveries, sponsor logos, colour palettes, mood boards. These nudge the AI toward a particular aesthetic without constraining the output." />
              <button
                onClick={() => setBrowseCategory('reference')}
                className="ml-auto text-[9px] font-semibold uppercase tracking-wider text-text-secondary hover:text-accent transition-colors px-1.5 py-0.5 rounded hover:bg-bg-hover"
                title="Browse previous uploads"
              >
                Browse
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {ms.referencePaths.map((path, i) => (
                <div key={path} className="relative group">
                  <img
                    src={`/api/uploads/preview?path=${encodeURIComponent(path)}`}
                    alt={`Reference ${i + 1}`}
                    className="w-full h-12 object-cover rounded border border-border-default"
                  />
                  <button
                    onClick={() => handleClearReference(path)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-bg-dark/80 text-error text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <label className="h-12 flex items-center justify-center border border-dashed border-border-default rounded cursor-pointer hover:border-accent/50 transition-colors" onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-accent/80', 'bg-accent/5'); }} onDragLeave={(e) => { e.currentTarget.classList.remove('border-accent/80', 'bg-accent/5'); }} onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-accent/80', 'bg-accent/5'); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) handleReferenceUpload(f); }}>
                <span className="text-text-muted text-lg leading-none">+</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files[0];
                    if (f) handleReferenceUpload(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            {/* Reference context — visible when references are added */}
            {ms.referencePaths.length > 0 && (
              <div className="flex flex-col gap-1 mt-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  Reference Guidance
                  <InfoTooltip position="right" maxWidth={260} text="Tell the AI how to use these reference images — describe which elements to copy, what to take inspiration from, or how to combine multiple references." />
                  <button
                    onClick={() => setShowReferenceExamples(true)}
                    className="ml-auto text-[9px] font-semibold uppercase tracking-wider text-text-secondary hover:text-accent transition-colors px-1.5 py-0.5 rounded hover:bg-bg-hover"
                    title="Browse example guidance phrases"
                  >
                    Examples
                  </button>
                </div>
                <textarea
                  value={ms.referenceContext}
                  onChange={(e) => {
                    const value = e.target.value;
                    const modeEntry = modeState[mode] || {
                      prompt: '',
                      context: '',
                      referencePaths: [],
                      referenceContext: '',
                    };
                    const updated = {
                      ...modeState,
                      [mode]: { ...modeEntry, referenceContext: value },
                    };
                    setModeState(updated);
                    debouncedSaveModeState?.(updated, 500);
                  }}
                  placeholder="e.g. Use the colour scheme from this livery, match the stripe placement, inspired by this real car…"
                  rows={2}
                  className="w-full bg-bg-input border border-border-default rounded px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted/50 resize-none focus:outline-none focus:border-accent/50 transition-colors"
                />
              </div>
            )}
          </div>

          {/* Context */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
              Context (optional)
              <InfoTooltip position="right" maxWidth={260} text="Additional background information that guides the AI without being part of the main prompt. Use it for consistent style rules such as 'always use matte finish' or sponsor guidelines." />
            </label>
            <textarea
              value={ms.context}
              onChange={(e) => handleContextChange(e.target.value)}
              placeholder="Car number, driver name, team info…"
              rows={2}
              className="w-full px-2.5 py-2 text-[13px] bg-bg-input border border-border-default rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-accent resize-none transition-colors"
            />
          </div>

          {/* Prompt */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                Prompt *
                <InfoTooltip position="right" maxWidth={280} text="Your main design description. Be as specific as possible — mention colours (use hex codes), patterns, themes, sponsors, number placement, and finish type (matte, gloss, carbon-fibre)." />
              </label>
              <div className="flex gap-1.5 items-center">
                <button
                  onClick={() => setShowEnhanceGuidance(true)}
                  className="flex items-center text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                  title="Enhance prompt settings"
                >
                  <IconCog className="w-3 h-3" />
                </button>
                <button
                  onClick={handleEnhance}
                  disabled={!ms.prompt.trim() || enhancing || autoEnhance}
                  className="text-[9px] font-semibold uppercase tracking-wider text-text-secondary hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title={autoEnhance ? 'Manual enhance disabled — auto-enhance is enabled' : 'Enhance prompt with AI'}
                >
                  {enhancing ? 'Enhancing…' : 'Enhance'}
                </button>
                <span className="text-border-default">|</span>
                <button
                  onClick={onOpenPromptHistory}
                  className="text-[9px] font-semibold uppercase tracking-wider text-text-secondary hover:text-accent transition-colors cursor-pointer"
                  title="Prompt history"
                >
                  History
                </button>
                <span className="text-border-default">|</span>
                <button
                  onClick={onOpenSamplePrompts}
                  className="text-[9px] font-semibold uppercase tracking-wider text-text-secondary hover:text-accent transition-colors cursor-pointer"
                  title="Sample prompts"
                >
                  Examples
                </button>
              </div>
            </div>
            <textarea
              value={ms.prompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              placeholder="Describe the livery design…"
              rows={5}
              className="w-full px-2.5 py-2 text-[13px] bg-bg-input border border-border-default rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-accent resize-none transition-colors"
            />
          </div>

          {/* Auto-enhance toggle */}
          <div className="flex items-center justify-between py-2 px-3 bg-bg-card rounded border border-border-default">
            <div>
              <div className="text-[13px] font-medium text-text-primary flex items-center gap-1">Auto-enhance <InfoTooltip position="right" maxWidth={300}>
                <div>Automatically improves your prompt with AI before each generation — adding detail and structure without changing your intent.</div>
                <div className="mt-1.5 pt-1.5 border-t border-border-default text-text-muted">Uses <span className="text-text-secondary">Gemini Flash Lite</span> (text-only) at ~$0.10 / 1M tokens. A typical enhancement costs less than $0.001.</div>
              </InfoTooltip></div>
              <div className="text-[10px] text-text-muted">AI-improve prompt before generating</div>
            </div>
            <Toggle checked={autoEnhance} onChange={(v) => { setAutoEnhance(v); saveSession?.({ last_auto_enhance: v }); }} id="autoEnhance" size="sm" />
          </div>

          {/* Auto-iterate toggle (modify mode only) */}
          {mode === 'modify' && (
            <div className="flex items-center justify-between py-2 px-3 bg-bg-card rounded border border-border-default">
              <div>
                <div className="text-[13px] font-medium text-text-primary flex items-center gap-1">Auto-iterate <InfoTooltip position="right" maxWidth={260} text="When enabled, the most recently generated livery is automatically used as the base texture for the next generation — so you can keep refining without manually re-uploading." /></div>
                <div className="text-[10px] text-text-muted">Loads result as base for next generation</div>
              </div>
              <Toggle checked={iterateEnabled} onChange={setIterateEnabled} id="iterateToggle" size="sm" />
            </div>
          )}

          </div>
        </div>

        {/* Fixed bottom section — model selector + generate button */}
        <div className="border-t border-border-default p-3 flex flex-col gap-3">
          {/* Model selector — via ModelSelector component */}
          <ModelSelector
            model={model}
            onModelChange={onModelChange}
            is2K={is2K}
            onIs2KChange={onIs2KChange}
            cost={cost}
            config={config}
          />

          {/* Auto-upscale toggle */}
          {showUpscaleToggle && (
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-text-secondary flex items-center gap-1">
                Auto-upscale 1K→2K 
                <InfoTooltip 
                  position="right" 
                  maxWidth={280} 
                  text={`After generating at 1K, runs ${config?.upscale_engine === 'seedvr2' ? 'SeedVR2' : 'Real-ESRGAN'} ${config?.upscale_engine === 'seedvr2' ? 'upsampling' : '4× upscaling'} on your ${config?.upscale_engine === 'seedvr2' ? 'GPU' : 'NVIDIA GPU'} to produce a crisp 2048×2048 texture. The cheapest way to get 2K-quality results (~$0.067 with GPU vs ~$0.101 for Flash 2K).`}
                />
              </span>
              <Toggle checked={autoUpscale} onChange={onAutoUpscaleChange} id="upscaleResult" size="sm" />
            </div>
          )}
          {showUpscaleDisabled && (
            <div className="flex items-center gap-2 px-3 py-2 bg-bg-card rounded border border-border-default text-[10px] text-text-muted">
              <span className="flex-1">GPU Upscale unavailable</span>
              <InfoTooltip position="left" maxWidth={300}>
                <div className="space-y-1.5">
                  <p className="font-semibold text-text-primary">GPU upscaling requires a custom build</p>
                  <p>To enable Real-ESRGAN 4× upscaling you need an NVIDIA GPU (6+ GB VRAM) and must launch with GPU dependencies installed:</p>
                  <p className="font-mono text-accent text-[10px]">start.bat --gpu</p>
                  <p>If you are using the pre-built .exe, see the <strong className="text-text-primary">Building the EXE</strong> section of the README for instructions on creating a GPU-enabled build.</p>
                </div>
              </InfoTooltip>
            </div>
          )}

          {/* Progress bar (visible during generation) */}
          <GenerationProgress
            generating={generating}
            elapsedSeconds={elapsedSeconds}
            onAbort={onAbort}
          />

          <Button
            variant="primary"
            size="lg"
            disabled={!canGenerate}
            loading={generating}
            onClick={handleGenerate}
            className="w-full"
          >
            <span className="flex items-center justify-center gap-1.5">
              <IconGemini className="w-4 h-4" />
              {generating ? 'Generating…' : 'Generate Livery'}
            </span>
          </Button>
        </div>
      </div>

      {/* Right panel — preview */}
      <div className="flex-1 flex flex-col bg-bg-dark overflow-hidden">
        <LiveryDetailPanel
          imageUrl={activePreview}
          imagePath={lastResult?.livery_path}
          downloadName={`${selectedCar || 'livery'}.png`}
          meta={lastResult ? [
            { label: 'Car', value: selectedCar || '—' },
            { label: 'Model', value: model === 'pro' ? 'Pro' : 'Flash', className: model === 'pro' ? 'text-accent-wine' : 'text-accent' },
            { label: 'Resolution', value: (model === 'pro' || is2K) ? '2K (2048×2048)' : '1K (1024×1024)' },
            { label: 'Cost', value: lastResult.cost != null ? `$${parseFloat(lastResult.cost).toFixed(2)}` : '—', className: 'text-warning' },
          ] : []}
          prompt={lastResult?.prompt}
          context={lastResult?.context}
          conversationLog={lastResult?.conversation_log}
          onDeploy={lastResult && hasCustomerId ? () => handleDeploy?.(lastResult.livery_path, selectedCar, config?.customer_id) : undefined}
          deploying={deploying}
          onLoadAsBase={lastResult?.livery_path ? () => {
            setBaseOverride?.(lastResult.livery_path);
          } : undefined}
          onIterate={lastResult?.livery_path ? () => {
            setMode('modify');
            setIterateEnabled(true);
            setBaseOverride?.(lastResult.livery_path);
          } : undefined}
          onRegenerate={lastResult ? () => {
            setMode('new');
            setModeState(prev => ({ ...prev, new: { ...prev.new, prompt: lastResult.prompt || '', context: lastResult.context || '' } }));
            saveSession?.({ last_prompt_new: lastResult.prompt || '', last_context_new: lastResult.context || '' });
          } : undefined}
          onMakeSpec={lastResult?.livery_path ? () => {
            setBaseOverride?.(lastResult.livery_path);
            onNavigateToSpecular?.();
          } : undefined}
          onUpscale={lastResult?.livery_path ? () => {
            onNavigateToUpscale?.(lastResult.livery_path);
          } : undefined}
          onResample={lastResult?.livery_path ? () => {
            onNavigateToResample?.(lastResult.livery_path);
          } : undefined}
          generating={generating}
          onNotify={() => {}} 
          onSwitchTab={() => {}}
        />
      </div>

      {/* Enhance Guidance Modal */}
      <EnhanceGuidanceModal
        isOpen={showEnhanceGuidance}
        onClose={() => setShowEnhanceGuidance(false)}
      />

      {/* Browse Uploads Modal */}
      <BrowseUploadsModal
        isOpen={!!browseCategory}
        onClose={() => setBrowseCategory(null)}
        category={browseCategory}
        currentCarFolder={selectedCar || ''}
        currentCarDisplay={selectedCar || ''}
        onBrowse={onBrowseUploads}
        onSelect={handleBrowseSelect}
        onDelete={onDeleteUpload}
      />

      {/* Reference context examples modal */}
      <ReferenceContextSamplesModal
        isOpen={showReferenceExamples}
        onClose={() => setShowReferenceExamples(false)}
        onSelect={(text) => {
          updateModeField(mode, 'referenceContext', text);
          setShowReferenceExamples(false);
        }}
      />
      </>
      )}
    </div>
  );
}

export default GenerateTab;
