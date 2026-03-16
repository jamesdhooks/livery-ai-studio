import React, { useState } from 'react';
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
 * @param {Function} [props.onDelete]      - Delete handler (omit to hide button)
 * @param {boolean}  [props.generating]    - Show generating overlay on image
 * @param {Function} [props.onNotify]      - Toast callback: (message, type) type='success'|'error'|'warning'|'info'
 * @param {Function} [props.onSwitchTab]   - Tab switch callback: (tabName) — 'generate', 'specular'
 */
export function LiveryDetailPanel({
  imageUrl,
  previewUrl,
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
  onDelete,
  generating = false,
  onNotify,
  onSwitchTab,
}) {
  const [showConvo, setShowConvo] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset imageLoaded when imageUrl changes
  React.useEffect(() => {
    setImageLoaded(false);
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

  return (
    <>
      {/* Preview area — zoom/pan enabled */}
      <div
        ref={containerRef}
        className={`flex-1 flex items-center justify-center p-4 overflow-hidden relative group ${isZoomed ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onMouseDown={zoomHandlers.onMouseDown}
        onDoubleClick={zoomHandlers.onDoubleClick}
      >
        {(imageUrl || previewUrl) ? (
          <>
            {/* Blurred preview placeholder — shown behind full-res while loading */}
            {previewUrl && !imageLoaded && (
              <img
                src={previewUrl}
                alt=""
                aria-hidden
                className="max-w-full max-h-full rounded shadow-2xl select-none absolute pointer-events-none"
                style={{
                  transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale * scaleFactor})`,
                  transformOrigin: 'center center',
                  filter: `blur(${Math.max(4, scaleFactor * 2)}px)`,
                  opacity: 0.8,
                }}
              />
            )}
            {/* Full-res image — fades in once loaded */}
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Livery preview"
                className="max-w-full max-h-full rounded shadow-2xl select-none relative"
                onLoad={() => setImageLoaded(true)}
                style={{
                  transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                  transformOrigin: 'center center',
                  transition: isZoomed ? 'none' : 'transform 0.2s ease-out',
                  opacity: imageLoaded ? 1 : 0,
                  transitionProperty: 'opacity',
                  transitionDuration: '400ms',
                }}
              />
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
            <ImageActionTray
              imageUrl={imageUrl}
              imagePath={imagePath}
              downloadName={downloadName}
              onDeploy={onDeploy}
              deploying={deploying}
              deployLabel={deployLabel}
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
      {(imageUrl || generating) && (
        <div className="flex-shrink-0 px-3 py-2 flex items-center gap-3 border-t border-border-default bg-bg-panel/50">

          {/* ── GROUP 1: Deploy ──────────────────────────── */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="primary"
              size="sm"
              onClick={onDeploy}
              disabled={!onDeploy || deploying}
              loading={deploying}
            >
              {deployLabel}
            </Button>
            {onLoadAsBase && (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleLoadAsBase} 
                title="Load as Base: Inserts this livery into the base texture slot and switches to Generate tab. Stays in current mode."
              >
                Load as Base
              </Button>
            )}
          </div>

          {/* ── GROUP 2: In-app actions ───────────────────── */}
          {(onIterate || onRegenerate || onMakeSpec) && (
            <>
              <Divider />
              <div className="flex items-center gap-1.5">
                {onIterate && (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={onIterate}
                    title="Modify: Loads this livery as base texture and switches to Modify mode in Generate tab. Clears prompt/context to iterate freely on the design."
                  >
                    Modify
                  </Button>
                )}
                {onRegenerate && (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={onRegenerate}
                    title="Re-generate: Reloads the original prompt and context in New mode in Generate tab, without a base texture. Regenerates from scratch."
                  >
                    Re-generate
                  </Button>
                )}
                {onMakeSpec && (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={onMakeSpec}
                    title="Make Spec Map: Loads this livery as base texture and switches to Specular tab. Generates a metallic/shininess map for this design."
                  >
                    Make Spec Map
                  </Button>
                )}
              </div>
            </>
          )}

          {/* ── GROUP 3: Export (icon buttons) ───────────── */}
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

function IconBtn({ title, onClick, children, danger = false }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded transition-colors cursor-pointer ${
        danger
          ? 'text-text-muted hover:text-error hover:bg-error/10'
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
