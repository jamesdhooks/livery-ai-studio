import React, { useEffect, useCallback } from 'react';

export function InfoModal({ 
  isOpen, 
  onClose, 
  title, 
  description,
  details,
  icon = 'info',
  variant = 'info',
  actionLabel = 'Dismiss',
}) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // Icon components
  const iconComponents = {
    info: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
    error: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-error">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    warning: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    success: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-success">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    memory: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-wine">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <line x1="8" y1="8" x2="8" y2="16" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="16" y1="8" x2="16" y2="16" />
      </svg>
    ),
  };

  const variantStyles = {
    info: {
      bgAccent: 'bg-accent/5',
      borderColor: 'border-accent/20',
    },
    error: {
      bgAccent: 'bg-error/5',
      borderColor: 'border-error/20',
    },
    warning: {
      bgAccent: 'bg-warning/5',
      borderColor: 'border-warning/20',
    },
    success: {
      bgAccent: 'bg-success/5',
      borderColor: 'border-success/20',
    },
    memory: {
      bgAccent: 'bg-accent-wine/5',
      borderColor: 'border-accent-wine/20',
    },
  };

  const styles = variantStyles[variant] || variantStyles.info;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div
        className={`
          relative z-10 bg-bg-panel border border-border-default rounded-xl
          shadow-2xl flex flex-col max-h-[85vh] w-full mx-4 max-w-lg
          ${styles.bgAccent} ${styles.borderColor}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Content */}
        <div className="flex flex-col items-center justify-center px-6 py-8 gap-4">
          {/* Icon */}
          <div className="flex-shrink-0">
            {iconComponents[icon] || iconComponents.info}
          </div>

          {/* Title */}
          <h2 className="text-lg font-bold text-text-primary text-center">
            {title}
          </h2>

          {/* Description */}
          {description && (
            <p className="text-sm text-text-secondary text-center">
              {description}
            </p>
          )}

          {/* Details */}
          {details && (
            <div className="w-full p-3 bg-bg-input rounded border border-border-default">
              {typeof details === 'string' ? (
                <p className="text-xs text-text-muted break-words whitespace-pre-wrap">
                  {details}
                </p>
              ) : (
                details
              )}
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={onClose}
            className="w-full mt-2 px-4 py-3 rounded-lg font-semibold text-sm transition-all bg-accent hover:bg-accent/80 text-white shadow-lg hover:shadow-xl"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InfoModal;
