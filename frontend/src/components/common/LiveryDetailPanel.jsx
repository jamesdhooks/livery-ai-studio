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
 * @param {Function} [props.onIterate]     - "Iterate on This" handler
 * @param {Function} [props.onDelete]      - Delete handler (omit to hide button)
 * @param {boolean}  [props.generating]    - Show generating overlay on image
 */
export function LiveryDetailPanel({
  imageUrl,
  imagePath,
  downloadName = 'livery.png',
  meta = [],
  prompt,
  context,
  conversationLog,
  onDeploy,
  deploying,
  onIterate,
  onDelete,
  generating = false,
}) {
  const [showConvo, setShowConvo] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { containerRef, transform, isZoomed, handlers: zoomHandlers } = useZoomPan({ imageUrl });

  const handleCopy = async () => {
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    } catch {
      try { await navigator.clipboard.writeText(imageUrl); } catch { /* ignore */ }
    }
  };

  const handleDownload = async () => {
    if (!imagePath) return;
    try {
      await upscaleService.downloadFile(imagePath, downloadName.replace(/\.png$/i, '.tga'));
    } catch { /* ignore — user cancelled or window not available */ }
  };

  const handleOpenExplorer = async () => {
    if (!imagePath) return;
    try { await upscaleService.openExplorer(imagePath); } catch { /* ignore */ }
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
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt="Livery preview"
              className="max-w-full max-h-full object-contain rounded shadow-2xl select-none"
              draggable={false}
              style={{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transformOrigin: 'center center',
                transition: isZoomed ? 'none' : 'transform 0.2s ease-out',
              }}
            />
            {/* Zoom indicator */}
            {isZoomed && (
              <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/60 text-[11px] text-white font-mono pointer-events-none z-10">
                {Math.round(transform.scale * 100)}%
              </div>
            )}
            {generating && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span className="text-[13px] text-text-secondary">Generating…</span>
                </div>
              </div>
            )}
            <ImageActionTray
              imageUrl={imageUrl}
              imagePath={imagePath}
              downloadName={downloadName}
              onDeploy={onDeploy}
              deploying={deploying}
            />
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            {generating ? (
              <>
                <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-text-secondary">Generating livery…</span>
                <span className="text-xs text-text-muted">This takes 15–30 seconds</span>
              </>
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

      {/* Action button row */}
      {(imageUrl || generating) && (
        <div className="flex-shrink-0 px-4 py-2.5 flex items-center gap-2 border-t border-border-default bg-bg-panel/50 flex-wrap">
          {/* Primary actions */}
          <Button
            variant="primary"
            size="sm"
            className="min-w-[130px]"
            onClick={onDeploy}
            disabled={!onDeploy || deploying}
            loading={deploying}
          >
            Deploy to iRacing
          </Button>
          {onIterate && (
            <Button
              variant="secondary"
              size="sm"
              className="min-w-[110px]"
              onClick={onIterate}
            >
              Iterate on This
            </Button>
          )}

          {/* Divider */}
          <div className="w-px h-5 bg-border-default flex-shrink-0" />

          {/* Utility actions */}
          <Button variant="secondary" size="sm" onClick={handleCopy} disabled={!imageUrl}>
            Copy
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDownload} disabled={!imagePath}>
            Download
          </Button>
          {imagePath && (
            <Button variant="secondary" size="sm" onClick={handleOpenExplorer}>
              Open in Explorer
            </Button>
          )}
          {conversationLog && (
            <Button variant="secondary" size="sm" onClick={() => setShowConvo(true)}>
              View Conversation
            </Button>
          )}

          {/* Delete — only shown when onDelete provided */}
          {onDelete && (
            <>
              <div className="w-px h-5 bg-border-default flex-shrink-0" />
              {confirmDelete ? (
                <>
                  <span className="text-[11px] text-error font-medium">Delete this?</span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => { onDelete(); setConfirmDelete(false); }}
                  >
                    Confirm
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              )}
            </>
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
                {meta.map(({ label, value, className }) => (
                  <div key={label} className="flex flex-col">
                    <span className="text-[9px] text-text-muted uppercase tracking-wide">{label}</span>
                    <span className={`text-[11px] truncate max-w-[140px] ${className || 'text-text-primary'}`}>{value}</span>
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
