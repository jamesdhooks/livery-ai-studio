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
  fixedHeight = null, // e.g., 'h-48' for fixed height, or null for min-height
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

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

  const handleImageLoad = () => {
    setImageLoading(false);
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
          ${fixedHeight || 'min-h-[80px]'} p-2 text-center
          ${dragOver
            ? 'border-accent bg-accent/10'
            : currentPath
              ? 'border-border-default bg-bg-card hover:border-accent/50'
              : 'border-dashed border-border-default bg-bg-input hover:border-accent/50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        title={filename || ''}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onMouseEnter={() => { setIsHovering(true); previewUrl && onHoverPreview?.(previewUrl); }}
        onMouseLeave={() => { setIsHovering(false); onHoverPreviewEnd?.(); }}
      >
        {previewUrl ? (
          <>
            {/* Loading spinner */}
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-bg-dark/40 rounded">
                <div className="w-6 h-6 border-2 border-border-default border-t-accent rounded-full animate-spin" />
              </div>
            )}
            {/* Image fills the container */}
            <img
              src={previewUrl}
              alt={label}
              className="w-full h-full object-contain rounded"
              onLoad={handleImageLoad}
              onLoadStart={() => setImageLoading(true)}
            />
          </>
        ) : (
          <div className="text-text-muted text-xs">{placeholder}</div>
        )}
        
        {/* Clear button — hover X in top right */}
        {currentPath && onClear && (
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className={`absolute top-1 right-1 w-6 h-6 bg-error/80 hover:bg-error text-white rounded-sm flex items-center justify-center transition-opacity duration-150 z-10 ${isHovering ? 'opacity-100' : 'opacity-0'}`}
            disabled={disabled}
            title="Clear"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
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
    </div>
  );
}

export default FileUploader;
