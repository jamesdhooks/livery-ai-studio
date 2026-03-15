import React, { useRef, useState } from 'react';
import { getFilename } from '../../utils/helpers';
import { InfoTooltip } from './InfoTooltip';

export function FileUploader({
  label,
  tooltip,
  accept = 'image/*',
  onUpload,
  onClear,
  onBrowse,
  currentPath = '',
  previewUrl = '',
  placeholder = 'Drop file or click to browse',
  disabled = false,
  onHoverPreview,
  onHoverPreviewEnd,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file) => {
    if (!file || disabled) return;
    onUpload?.(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const filename = currentPath ? getFilename(currentPath) : '';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
          {label}
          {tooltip && <InfoTooltip position="right" maxWidth={280} text={tooltip} />}
          {onBrowse && (
            <button
              onClick={(e) => { e.stopPropagation(); onBrowse(); }}
              className="ml-auto text-[9px] font-semibold uppercase tracking-wider text-text-secondary hover:text-accent transition-colors px-1.5 py-0.5 rounded hover:bg-bg-hover"
              disabled={disabled}
              title="Browse previous uploads"
            >
              Browse
            </button>
          )}
        </div>
      )}
      
      <div
        className={`
          relative flex flex-col items-center justify-center
          border rounded cursor-pointer transition-all duration-150
          min-h-[80px] p-2 text-center
          ${dragOver
            ? 'border-accent bg-accent/10'
            : currentPath
              ? 'border-border-default bg-bg-card hover:border-accent/50'
              : 'border-dashed border-border-default bg-bg-input hover:border-accent/50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onMouseEnter={() => previewUrl && onHoverPreview?.(previewUrl)}
        onMouseLeave={() => onHoverPreviewEnd?.()}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={label}
            className="max-h-16 max-w-full object-contain rounded"
          />
        ) : (
          <div className="text-text-muted text-xs">{placeholder}</div>
        )}
        
        {filename && (
          <div className="mt-1 text-[10px] text-text-secondary truncate max-w-full px-1">
            {filename}
          </div>
        )}
        
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
        />
      </div>
      
      {currentPath && onClear && (
        <button
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="text-[10px] text-error hover:text-red-400 transition-colors text-left"
          disabled={disabled}
        >
          ✕ Clear
        </button>
      )}
    </div>
  );
}

export default FileUploader;
