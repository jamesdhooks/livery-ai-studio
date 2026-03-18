import React from 'react';
import upscaleService from '../../services/UpscaleService';

/**
 * ImageActionTray — floating action buttons for image previews.
 *
 * Place inside a `relative` container wrapping an `<img>`.
 *
 * @param {Object}   props
 * @param {string}   [props.imagePath]    - Absolute file path (enables Open in Explorer)
 * @param {string}   [props.imageUrl]     - Data-URL / src for Copy & Download
 * @param {string}   [props.downloadName] - Filename for the download (default "livery.png")
 * @param {Function} [props.onDeploy]     - If provided, shows a Deploy button
 * @param {boolean}  [props.deploying]    - Loading state for deploy
 * @param {Function} [props.onNotify]     - Toast callback: (message, type)
 * @param {string}   [props.className]    - Extra wrapper classes
 */
export function ImageActionTray({
  imagePath,
  imageUrl,
  downloadName = 'livery.png',
  onDeploy,
  deploying,
  onNotify,
  className = '',
}) {
  const handleCopy = async () => {
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      onNotify?.('Image copied to clipboard', 'success');
    } catch {
      // Fallback — copy URL text
      try { 
        await navigator.clipboard.writeText(imageUrl);
        onNotify?.('Image link copied to clipboard', 'success');
      } catch { 
        onNotify?.('Failed to copy image', 'error');
      }
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = downloadName;
    a.click();
    onNotify?.('Download started', 'success');
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

  return (
    <div
      className={`absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-bg-panel/90 backdrop-blur-sm rounded-lg border border-border-default p-1 shadow-lg ${className}`}
    >
      {imageUrl && (
        <ActionBtn title="Copy image" onClick={handleCopy}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        </ActionBtn>
      )}
      {imageUrl && (
        <ActionBtn title="Download" onClick={handleDownload}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </ActionBtn>
      )}
      {imagePath && (
        <ActionBtn title="Open in Explorer" onClick={handleOpenExplorer}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
        </ActionBtn>
      )}
      {onDeploy && (
        <ActionBtn title="Deploy to iRacing" onClick={onDeploy} disabled={deploying}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </ActionBtn>
      )}

    </div>
  );
}

function ActionBtn({ title, onClick, disabled, children }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-40 cursor-pointer"
    >
      {children}
    </button>
  );
}

export default ImageActionTray;
