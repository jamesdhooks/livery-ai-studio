import React, { useEffect, useState } from 'react';

const TYPE_STYLES = {
  success: {
    bar: 'bg-success',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
    iconColor: 'text-success',
  },
  error: {
    bar: 'bg-error',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    iconColor: 'text-error',
  },
  warning: {
    bar: 'bg-warning',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    iconColor: 'text-warning',
  },
  info: {
    bar: 'bg-accent',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    iconColor: 'text-accent',
  },
};

/**
 * Single toast item — slides in from the right, fades out when dismissed.
 */
function ToastItem({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false);

  // Mount animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const styles = TYPE_STYLES[toast.type] || TYPE_STYLES.info;

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  return (
    <div
      className={`
        flex items-start gap-3 w-80 bg-bg-panel border border-border-default rounded-lg shadow-2xl
        overflow-hidden pointer-events-auto transition-all duration-200
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
      `}
    >
      {/* Left colour bar */}
      <div className={`w-1 self-stretch flex-shrink-0 ${styles.bar}`} />

      {/* Icon */}
      <div className={`flex-shrink-0 mt-3 ${styles.iconColor}`}>
        {styles.icon}
      </div>

      {/* Message */}
      <p className="flex-1 py-3 text-[13px] text-text-primary leading-snug pr-1">
        {toast.message}
      </p>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 mt-2.5 mr-2 p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
        aria-label="Dismiss"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

/**
 * ToastContainer — fixed bottom-right stack of toasts.
 * Rendered once at the app root by ToastProvider.
 */
export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
