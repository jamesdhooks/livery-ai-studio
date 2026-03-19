import React, { useState, useRef, useCallback } from 'react';
import { Button } from './Button';
import { ImageActionTray } from './ImageActionTray';
import { Modal } from './Modal';
import { useZoomPan } from '../../hooks/useZoomPan';
import upscaleService from '../../services/UpscaleService';

/**
 * LiveryDetailPanel — shared right-panel used by both GenerateTab and HistoryTab.
 *
 * Shows:
 *   - Full-res image preview with hover ImageActionTray
 *   - Action button row (Deploy, Iterate, Copy, Download, Open in Explorer,
 *     View Conversation, and optionally Delete)
 *   - Metadata + prompt detail bar at the bottom
 *
 * @param {Object}   props
 * @param {string}   props.imageUrl        - Preview image URL / data-URI
 * @param {string}   [props.imagePath]     - Absolute file path (enables Open in Explorer)
 * @param {string}   [props.downloadName]  - Download filename
 * @param {Object}   [props.meta]          - Array of { label, value, className? }
 * @param {string}   [props.prompt]        - Prompt text to show in detail bar
 * @param {string}   [props.context]       - Context text to show in detail bar
 * @param {Object}   [props.conversationLog] - Raw conversation log object
 * @param {Function} [props.onDeploy]      - Deploy handler
 * @param {boolean}  [props.deploying]     - Deploy loading state
 * @param {string}   [props.deployLabel]   - Deploy button label (default "Deploy to iRacing")
 * @param {Function} [props.onLoadAsBase]  - "Load as Base" handler (inserts result into base slot)
 * @param {Function} [props.onIterate]     - "Modify" handler (modify mode)
 * @param {Function} [props.onRegenerate]   - "Re-generate" handler (new mode, same prompt)
 * @param {Function} [props.onMakeSpec]    - "Make Spec Map" handler
 * @param {Function} [props.onResample]   - "Resample" handler (load into Upscale tab, Resample mode)
 * @param {Function} [props.onUpscale]    - "Upscale" handler (load into Upscale tab, Upscale mode)
 * @param {Function} [props.onDelete]      - Delete handler (omit to hide button)
 * @param {boolean}  [props.generating]    - Show generating overlay on image
 * @param {string}   [props.beforeUrl]      - URL of the "before" image for wipe comparison
 * @param {boolean}  [props.compareEnabled]  - Whether the before/after wipe is active
 * @param {Function} [props.onToggleCompare] - Toggle compare mode callback
 * @param {Function} [props.onNotify]      - Toast callback: (message, type) type='success'|'error'|'warning'|'info'
 * @param {Function} [props.onSwitchTab]   - Tab switch callback: (tabName) — 'generate', 'specular', 'upscale'
 */
export function LiveryDetailPanel({
  imageUrl,
  previewUrl,
  noisedInputUrl,
  beforeUrl,
  imagePath,
  downloadName = 'livery.png',
  meta = [],
  prompt,
  context,
  conversationLog,
  onDeploy,
  deploying,
  deployLabel = 'Deploy to iRacing',
  onLoadAsBase,
  onIterate,
  onRegenerate,
  onMakeSpec,
  onResample,
  onUpscale,
  onDelete,
  generating = false,
  compareEnabled = false,
  onToggleCompare,
  compareSource = 'source',
  onSetCompareSource,
  hasNoiseSource = false,
  onNotify,
  onSwitchTab,
}) {
  const [showConvo, setShowConvo] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [noiseHovered, setNoiseHovered] = useState(false);
  // Wipe compare state
  const [wipePos, setWipePos] = useState(null); // null = mouse outside → show full after
  const wipeContainerRef = useRef(null);
  const prevImageUrlRef = useRef(imageUrl);
  const isFirstRenderRef = useRef(true);

  // Log whenever imageLoaded changes
  React.useEffect(() => {
    console.log('[LiveryDetailPanel] imageLoaded changed to:', imageLoaded);
  }, [imageLoaded]);

  // Reset imageLoaded BEFORE paint when imageUrl TRULY changes (not on first mount)
  React.useLayoutEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevImageUrlRef.current = imageUrl;
      console.log('[LiveryDetailPanel] First render, not resetting');
      return;
    }
    
    if (prevImageUrlRef.current !== imageUrl) {
      console.log('[LiveryDetailPanel] imageUrl truly changed from', prevImageUrlRef.current?.substring(0, 20), 'to', imageUrl?.substring(0, 20), '— resetting imageLoaded');
      setImageLoaded(false);
    }
    prevImageUrlRef.current = imageUrl;
  }, [imageUrl]);

  // Extract final resolution from meta (e.g., "2K (2048×2048)" → 2048)
  const getTargetResolution = () => {
    const resolutionMeta = meta?.find((m) => m.label === 'Resolution');
    if (!resolutionMeta) return null;
    const match = resolutionMeta.value.match(/(\d+)×\d+/);
    return match ? parseInt(match[1], 10) : null;
  };

  // Assume preview is 512px, calculate scale factor
  const PREVIEW_SIZE = 512;
  const targetRes = getTargetResolution();
  const scaleFactor = targetRes ? targetRes / PREVIEW_SIZE : 1;
  const previewScaledSize = PREVIEW_SIZE * scaleFactor;

  const { containerRef, transform, isZoomed, handlers: zoomHandlers } = useZoomPan({ imageUrl });

  const handleCopy = async () => {
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      onNotify?.('Image copied to clipboard', 'success');
    } catch (e) {
      try { 
        await navigator.clipboard.writeText(imageUrl);
        onNotify?.('Image link copied to clipboard', 'success');
      } catch { 
        onNotify?.('Failed to copy image', 'error');
      }
    }
  };

  const handleDownload = async () => {
    if (!imagePath) return;
    try {
      await upscaleService.downloadFile(imagePath, downloadName.replace(/\.png$/i, '.tga'));
      onNotify?.('Download started', 'success');
    } catch { 
      onNotify?.('Download cancelled or failed', 'warning');
    }
  };

  const handleOpenExplorer = async () => {
    if (!imagePath) return;
    try { 
      await upscaleService.openExplorer(imagePath);
      onNotify?.('Folder opened', 'success');
    } catch { 
      onNotify?.('Could not open folder', 'error');
    }
  };

  const handleLoadAsBase = () => {
    onLoadAsBase?.();
  };

  const handleWipeMouseMove = useCallback((e) => {
    const el = wipeContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // clamp 0..1
    setWipePos(Math.max(0, Math.min(1, x / rect.width)));
  }, []);

  const handleWipeMouseLeave = useCallback(() => {
    setWipePos(null);
  }, []);

  return (
    <>
      {/* Preview area — zoom/pan enabled */}
      <div
        ref={(el) => {
          containerRef.current = el;
          wipeContainerRef.current = el;
        }}
        className={`flex-1 flex items-center justify-center p-4 overflow-hidden relative group ${isZoomed ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onMouseDown={zoomHandlers.onMouseDown}
        onDoubleClick={zoomHandlers.onDoubleClick}
        onMouseMove={(compareEnabled && beforeUrl && imageLoaded) ? handleWipeMouseMove : undefined}
        onMouseLeave={(compareEnabled && beforeUrl && imageLoaded) ? handleWipeMouseLeave : undefined}
      >
        {(imageUrl || previewUrl) ? (
          <>
            {/* Blurred preview placeholder — shown behind full-res while loading, fades out when loaded */}
            {previewUrl && (
              <img
                src={previewUrl}
                alt=""
                aria-hidden
                className="rounded shadow-2xl select-none absolute pointer-events-none"
                style={{
                  // Use the captured dimensions of the full-res image to constrain the blurred preview
                  // This ensures the blurred preview matches the final image size exactly
                  width: imageDimensions.width || 'auto',
                  height: imageDimensions.height || 'auto',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                  transformOrigin: 'center center',
                  filter: `blur(${Math.max(4, scaleFactor * 2)}px)`,
                  // Fade OUT when imageLoaded becomes true
                  opacity: imageLoaded ? 0 : 0.8,
                  transition: 'opacity 400ms ease-out',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              />
            )}
            {/* Full-res "after" image */}
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Livery preview"
                className="max-w-full max-h-full rounded shadow-2xl select-none relative"
                onLoad={(e) => {
                  console.log('[LiveryDetailPanel] onLoad fired for imageUrl');
                  // Capture the rendered dimensions of the full-res image
                  const img = e.currentTarget;
                  setImageDimensions({
                    width: img.clientWidth,
                    height: img.clientHeight,
                  });
                  setImageLoaded(true);
                }}
                onError={() => {
                  console.error('[LiveryDetailPanel] onError fired for imageUrl');
                  setImageLoaded(true);
                }}
                style={{
                  transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                  transformOrigin: 'center center',
                  transition: isZoomed ? 'none' : 'transform 0.2s ease-out',
                  opacity: 1,
                  zIndex: 0,
                }}
              />
            )}
            {/* "Before" wipe overlay — clipped in container space via a wrapper div */}
            {compareEnabled && beforeUrl && imageLoaded && (
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none overflow-hidden"
                style={{
                  // Clip the wrapper to the left of the wipe position (container coordinates)
                  clipPath: wipePos !== null
                    ? `inset(0 ${Math.round((1 - wipePos) * 10000) / 100}% 0 0)`
                    : 'inset(0 100% 0 0)',
                  zIndex: 2,
                }}
              >
                {/* The before image is explicitly sized to match the after image's rendered dimensions */}
                <img
                  src={beforeUrl}
                  alt="Before"
                  className="absolute inset-0 m-auto rounded shadow-2xl select-none pointer-events-none"
                  style={{
                    width: imageDimensions.width || 'auto',
                    height: imageDimensions.height || 'auto',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                    transformOrigin: 'center center',
                  }}
                  onError={() => {}}
                />
              </div>
            )}
            {/* Wipe divider line + labels */}
            {compareEnabled && beforeUrl && imageLoaded && wipePos !== null && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 5 }}
              >
                {/* Vertical line */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-white/80 shadow-[0_0_6px_rgba(0,0,0,0.8)]"
                  style={{ left: `${wipePos * 100}%` }}
                />
                {/* Handle circle */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white/90 border border-white shadow-lg flex items-center justify-center"
                  style={{ left: `${wipePos * 100}%` }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 3 12 9 6" />
                    <polyline points="15 6 21 12 15 18" />
                  </svg>
                </div>
                {/* Before label */}
                {wipePos > 0.08 && (
                  <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/60 text-[11px] text-white font-medium pointer-events-none">
                    Before
                  </div>
                )}
                {/* After label */}
                {wipePos < 0.92 && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/60 text-[11px] text-white font-medium pointer-events-none">
                    After
                  </div>
                )}
              </div>
            )}
            {/* Noise input overlay — shown when hovering noise thumbnail in detail bar */}
            {noiseHovered && noisedInputUrl && imageLoaded && (
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ zIndex: 4 }}
              >
                <img
                  src={noisedInputUrl}
                  alt="Noised input"
                  className="max-w-full max-h-full rounded shadow-2xl select-none"
                  style={{
                    width: imageDimensions.width || 'auto',
                    height: imageDimensions.height || 'auto',
                    objectFit: 'contain',
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                    transformOrigin: 'center center',
                  }}
                />
                {/* Label */}
                <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/60 text-[11px] text-white font-medium pointer-events-none" style={{ zIndex: 6 }}>
                  Noise Input
                </div>
              </div>
            )}
            {/* Spinner while loading */}
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              </div>
            )}
            {/* Zoom indicator */}
            {isZoomed && (
              <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/60 text-[11px] text-white font-mono pointer-events-none z-10">
                {Math.round(transform.scale * 100)}%
              </div>
            )}
            {generating && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center rounded z-20">
                <div className="bg-bg-panel/95 border border-border-default rounded-2xl px-10 py-7 flex flex-col items-center gap-4 shadow-2xl">
                  <div className="w-12 h-12 border-[3px] border-accent border-t-transparent rounded-full animate-spin" />
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-base font-semibold text-text-primary">Generating…</span>
                    <span className="text-[12px] text-text-muted">This may take 15–30 seconds</span>
                  </div>
                </div>
              </div>
            )}
            {/* Skeleton placeholder for action tray — prevents layout shift while loading */}
            {!imageLoaded && (
              <div className="absolute bottom-2 right-2 h-10 w-40 bg-gradient-to-r from-bg-panel/50 via-bg-hover/30 to-bg-panel/50 rounded-lg border border-border-default/30 animate-pulse" />
            )}
            <ImageActionTray
              imageUrl={imageUrl}
              imagePath={imagePath}
              downloadName={downloadName}
              onDeploy={onDeploy}
              deploying={deploying}
              deployLabel={deployLabel}
              onNotify={onNotify}
            />
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            {generating ? (
              <div className="bg-bg-panel/95 border border-border-default rounded-2xl px-10 py-7 flex flex-col items-center gap-4 shadow-2xl">
                <div className="w-12 h-12 border-[3px] border-accent border-t-transparent rounded-full animate-spin" />
                <div className="flex flex-col items-center gap-1">
                  <span className="text-base font-semibold text-text-primary">Generating livery…</span>
                  <span className="text-[12px] text-text-muted">This takes 15–30 seconds</span>
                </div>
              </div>
            ) : (
              <>
                <div className="opacity-20">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
                <p className="text-sm text-text-muted">Enter a prompt and click Generate</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      {(imageUrl || generating) ? (
        <div className="flex-shrink-0 min-h-10 px-3 py-1.5 flex items-center gap-0 border-t border-border-default bg-bg-panel/50 flex-wrap">

          {/* ── Deploy ──────────────────────────────────────────────────── */}
          <div className="flex items-center gap-1.5 pr-3 mr-1">
            <Button
              variant="primary"
              size="sm"
              onClick={onDeploy}
              disabled={!onDeploy || deploying}
              loading={deploying}
            >
              {deployLabel}
            </Button>
          </div>

          {/* ── Generate group ──────────────────────────────────────────── */}
          {(onLoadAsBase || onIterate || onRegenerate) && (
            <>
              <Divider />
              <div className="flex items-center gap-0 px-1.5">
                <TabIcon tab="generate" className="mr-1.5 flex-shrink-0" />
                <div className="flex items-center gap-0.5">
                  {onLoadAsBase && (
                    <ActionTextBtn onClick={handleLoadAsBase} title="Load as Base: Inserts this livery into the base texture slot and switches to Generate tab. Stays in current mode.">
                      Load as Base
                    </ActionTextBtn>
                  )}
                  {onIterate && (
                    <ActionTextBtn onClick={onIterate} title="Modify: Loads this livery as base texture and switches to Modify mode in Generate tab. Clears prompt/context to iterate freely on the design.">
                      Modify
                    </ActionTextBtn>
                  )}
                  {onRegenerate && (
                    <ActionTextBtn onClick={onRegenerate} title="Re-generate: Reloads the original prompt and context in New mode in Generate tab, without a base texture. Regenerates from scratch.">
                      Re-generate
                    </ActionTextBtn>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── Upscale group ───────────────────────────────────────────── */}
          {(onUpscale || onResample) && (
            <>
              <Divider />
              <div className="flex items-center gap-0 px-1.5">
                <TabIcon tab="upscale" className="mr-1.5 flex-shrink-0" />
                <div className="flex items-center gap-0.5">
                  {onUpscale && (
                    <ActionTextBtn onClick={onUpscale} title="Upscale: Loads this livery into the Upscale tab's Upscale mode. Upscales to 2048px using your configured engine.">
                      Upscale
                    </ActionTextBtn>
                  )}
                  {onResample && (
                    <ActionTextBtn onClick={onResample} title="Resample: Loads this livery into the Upscale tab's Resample mode. Downres to 1024 then re-upscales to 2048 for a cleaner result.">
                      Resample
                    </ActionTextBtn>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── Specular group ──────────────────────────────────────────── */}
          {onMakeSpec && (
            <>
              <Divider />
              <div className="flex items-center gap-0 px-1.5">
                <TabIcon tab="specular" className="mr-1.5 flex-shrink-0" />
                <div className="flex items-center gap-0.5">
                  <ActionTextBtn onClick={onMakeSpec} title="Make Spec Map: Loads this livery as base texture and switches to Specular tab. Generates a metallic/shininess map for this design.">
                    Make Spec Map
                  </ActionTextBtn>
                </div>
              </div>
            </>
          )}

          {/* ── Compare toggle ──────────────────────────────────────────── */}
          {onToggleCompare && (
            <>
              <Divider />
              <div className="flex items-center gap-1">
                <button
                  title={compareEnabled ? 'Hide before/after wipe comparison' : 'Drag to compare before/after with source livery'}
                  onClick={onToggleCompare}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    compareEnabled
                      ? 'text-accent bg-accent/15 hover:bg-accent/25'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="12" y1="3" x2="12" y2="21" />
                  </svg>
                  Compare
                </button>
                {compareEnabled && hasNoiseSource && onSetCompareSource && (
                  <div className="flex items-center rounded border border-border-default overflow-hidden text-[10px]">
                    <button
                      onClick={() => onSetCompareSource('source')}
                      title="Compare against original source image"
                      className={`px-1.5 py-0.5 transition-colors cursor-pointer ${compareSource === 'source' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:bg-bg-hover'}`}
                    >
                      Source
                    </button>
                    <button
                      onClick={() => onSetCompareSource('noise')}
                      title="Compare against noised downscale input"
                      className={`px-1.5 py-0.5 transition-colors cursor-pointer ${compareSource === 'noise' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:bg-bg-hover'}`}
                    >
                      Noise
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Export (icon buttons) ───────────────────────────────────── */}
          {imageUrl && (
            <>
              <Divider />
              <div className="flex items-center gap-0.5">
                <IconBtn title="Copy image" onClick={handleCopy}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                </IconBtn>
                {imagePath && (
                  <IconBtn title="Download .tga" onClick={handleDownload}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </IconBtn>
                )}
                {imagePath && (
                  <IconBtn title="Open folder" onClick={handleOpenExplorer}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                    </svg>
                  </IconBtn>
                )}
              </div>
            </>
          )}

          {/* ── GROUP 4: Info / meta ──────────────────────── */}
          {conversationLog && (
            <>
              <Divider />
              <Button variant="ghost" size="sm" onClick={() => setShowConvo(true)}>Conversation</Button>
            </>
          )}

          {/* ── GROUP 5: Danger — pushed to far right ─────── */}
          {onDelete && (
            <div className="ml-auto flex items-center gap-1.5">
              {confirmDelete ? (
                <>
                  <span className="text-[11px] text-error font-medium">Delete?</span>
                  <Button variant="danger" size="sm" onClick={() => { onDelete(); setConfirmDelete(false); }}>Confirm</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                </>
              ) : (
                <IconBtn title="Delete" onClick={() => setConfirmDelete(true)} danger>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                  </svg>
                </IconBtn>
              )}
            </div>
          )}
        </div>
      ) : (
        // Skeleton placeholder for action bar — reserves 40px space to prevent layout shift
        <div className="flex-shrink-0 h-10 px-3 py-2 border-t border-border-default bg-bg-panel/50">
          <div className="h-6 bg-gradient-to-r from-bg-input/60 via-bg-hover/40 to-bg-input/60 rounded animate-pulse" />
        </div>
      )}

      {/* Detail bar */}
      {(prompt || context || meta.length > 0) && (
        <div className="flex-shrink-0 border-t border-border-default bg-bg-panel p-3">
          <div className="flex gap-4">
            {/* Prompt / context */}
            {(prompt || context) && (
              <div className="flex-1 min-w-0">
                {prompt && (
                  <div className="mb-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-0.5">Prompt</div>
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">{prompt}</p>
                  </div>
                )}
                {context && (
                  <div className="mb-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-0.5">Context</div>
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">{context}</p>
                  </div>
                )}
              </div>
            )}

            {/* Meta grid */}
            {meta.length > 0 && (
              <div className="flex-shrink-0 grid grid-cols-3 gap-x-4 gap-y-1 self-start">
                {meta.map(({ label, value, className, onEdit }) => (
                  <div key={label} className="flex flex-col">
                    <span className="text-[9px] text-text-muted uppercase tracking-wide">{label}</span>
                    <span className={`text-[11px] truncate max-w-[140px] flex items-center gap-1 ${className || 'text-text-primary'}`}>
                      {value}
                      {onEdit && (
                        <button onClick={onEdit} className="text-text-muted hover:text-accent transition-colors flex-shrink-0 cursor-pointer" title={`Edit ${label}`}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Noise input thumbnail — hover replaces main preview */}
            {noisedInputUrl && (
              <div className="flex-shrink-0 flex flex-col items-center gap-1 self-start">
                <span className="text-[9px] text-text-muted uppercase tracking-wide">Noise Input</span>
                <div
                  className="relative cursor-pointer"
                  onMouseEnter={() => setNoiseHovered(true)}
                  onMouseLeave={() => setNoiseHovered(false)}
                >
                  <img
                    src={noisedInputUrl}
                    alt="Noised downscaled input"
                    className={`h-10 w-10 object-cover rounded border transition-all ${noiseHovered ? 'border-accent shadow-lg shadow-accent/20' : 'border-border-default'}`}
                  />
                  <span className="text-[9px] text-text-muted mt-0.5 block text-center">Hover</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conversation modal */}
      {showConvo && conversationLog && (
        <ConversationModal log={conversationLog} onClose={() => setShowConvo(false)} />
      )}
    </>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Divider() {
  return <div className="w-px h-4 bg-border-default flex-shrink-0" />;
}

/** Inline icon matching the nav tab icon for a given tab id. */
function TabIcon({ tab, className = '' }) {
  const base = `flex-shrink-0 opacity-60 ${className}`;
  if (tab === 'generate') return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className={base}>
      <path d="M12 2L13.5 9.5L20 12L13.5 14.5L12 22L10.5 14.5L4 12L10.5 9.5L12 2Z" />
    </svg>
  );
  if (tab === 'upscale') return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className={base}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
  if (tab === 'specular') return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={base}>
      {/* Main sphere */}
      <circle cx="12" cy="12" r="8" />
      {/* Highlight on top-left */}
      <ellipse cx="9" cy="8" rx="2" ry="3" />
    </svg>
  );
  return null;
}

/** Text-only action button for the grouped action bar. */
function ActionTextBtn({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="px-2 py-1 rounded text-[11px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer whitespace-nowrap"
    >
      {children}
    </button>
  );
}

function IconBtn({ title, onClick, children, danger = false, active = false }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded transition-colors cursor-pointer ${
        danger
          ? 'text-text-muted hover:text-error hover:bg-error/10'
          : active
          ? 'text-accent bg-accent/15 hover:bg-accent/25'
          : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
      }`}
    >
      {children}
    </button>
  );
}

// ── ConversationModal (moved here from HistoryTab) ────────────────────────────

export function ConversationModal({ log, onClose }) {
  const sections = [];

  if (log.user_prompt) sections.push({ id: 'user-prompt', label: 'User Prompt', content: log.user_prompt });
  if (log.full_system_prompt) {
    sections.push({ id: 'system-prompt', label: `Full System Prompt → ${log.model || 'Gemini'}`, content: log.full_system_prompt });
  }
  if (log.images_sent) {
    const imgs = [];
    if (log.images_sent.wireframe) imgs.push('Wireframe (UV guide)');
    if (log.images_sent.base_or_reference) imgs.push('Base texture or reference');
    if (log.images_sent.reference) imgs.push('Reference image');
    if (log.images_sent.base_texture) imgs.push('Base texture');
    if (log.images_sent.reference_count > 0) imgs.push(`${log.images_sent.reference_count} reference image(s)`);
    if (log.images_sent.sponsor_logos > 0) imgs.push(`${log.images_sent.sponsor_logos} sponsor logo(s)`);
    if (imgs.length > 0) sections.push({ id: 'images', label: 'Images Included', content: imgs.join('\n') });
  }
  if (log.model_response) sections.push({ id: 'model-response', label: 'Model Response', content: log.model_response });
  if (log.sponsor_names?.length) sections.push({ id: 'sponsors', label: 'Sponsor Names', content: log.sponsor_names.join(', ') });

  return (
    <Modal isOpen onClose={onClose} title="Gemini Conversation Log" size="xl">
      <div className="flex flex-col p-4 gap-4">
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {sections.length === 0 && (
            <p className="text-sm text-text-muted py-4 text-center">No conversation data recorded for this generation.</p>
          )}
          {sections.map((s) => (
            <div key={s.id} id={`convo-${s.id}`} className="scroll-mt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">{s.label}</h4>
              <pre className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap break-words bg-bg-input border border-border-default rounded-lg p-3 max-h-[40vh] overflow-y-auto font-sans">
                {s.content}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export default LiveryDetailPanel;
