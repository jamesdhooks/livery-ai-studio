import React, { useEffect, useState } from 'react';

const typeStyles = {
  success: 'bg-success/10 border-success/30 text-success',
  error: 'bg-error/10 border-error/30 text-error',
  info: 'bg-accent/10 border-accent/30 text-accent',
  warning: 'bg-warning/10 border-warning/30 text-warning',
};

export function StatusBar({ status, onDismiss, autoDismiss = 5000 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status) {
      setVisible(true);
      if (autoDismiss && status.type !== 'error') {
        const timer = setTimeout(() => {
          setVisible(false);
          onDismiss?.();
        }, autoDismiss);
        return () => clearTimeout(timer);
      }
    } else {
      setVisible(false);
    }
  }, [status, autoDismiss, onDismiss]);

  if (!status || !visible) return null;

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2 text-xs rounded border
        ${typeStyles[status.type] || typeStyles.info}
      `}
    >
      <span className="flex-1">{status.message}</span>
      {onDismiss && (
        <button
          onClick={() => { setVisible(false); onDismiss(); }}
          className="opacity-60 hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default StatusBar;
