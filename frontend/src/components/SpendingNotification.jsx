import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * SpendingNotification — Portal-based animated spending ticker
 *
 * Appears near the spending button in the top-right, slightly below it.
 * Animates from below and shrinks upward INTO the spending button area.
 * Shows estimated/actual/cancelled status with appropriate colors.
 *
 * Props:
 *   transaction: { amount, type ('estimated'|'actual'|'cancelled'), model, id }
 */
export function SpendingNotification({ transaction }) {
  const [visible, setVisible] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);
  const timerRef = useRef(null);
  const lastIdRef = useRef(null);

  useEffect(() => {
    if (!transaction) return;

    // Only trigger effect when transaction ID changes
    if (lastIdRef.current === transaction.id) return;
    lastIdRef.current = transaction.id;

    // Clear any pending timers
    if (timerRef.current) clearTimeout(timerRef.current);

    // Show the notification and reset animation state
    setVisible(true);
    setAnimatingOut(false);

    // Auto-dismiss after 2.8s with 0.4s fade-out
    timerRef.current = setTimeout(() => {
      setAnimatingOut(true);
      const dismissTimer = setTimeout(() => setVisible(false), 400);
      timerRef.current = dismissTimer;
    }, 2800);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction?.id]);

  if (!visible || !transaction) return null;

  const isCancelled = transaction.type === 'cancelled';
  const isActual = transaction.type === 'actual';

  // Color scheme
  const borderColor = isCancelled
    ? 'border-error/40'
    : isActual
      ? 'border-success/50'
      : 'border-warning/50';

  const bgColor = isCancelled
    ? 'bg-error/5'
    : isActual
      ? 'bg-success/5'
      : 'bg-warning/5';

  const textColor = isCancelled
    ? 'text-error'
    : isActual
      ? 'text-success'
      : 'text-warning';

  const label = isCancelled ? 'cancelled' : isActual ? 'charged' : 'est.';
  const prefix = isCancelled ? '~' : isActual ? '' : '~';

  return createPortal(
    <div
      className="fixed pointer-events-none select-none"
      style={{
        top: '50px',
        right: '16px',
        zIndex: 9999,
      }}
    >
      {/* Animated pill that appears below and grows into view */}
      <div
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-full border
          font-semibold text-sm shadow-lg
          transition-all duration-500 ease-out
          ${borderColor} ${bgColor} ${textColor}
          ${animatingOut
            ? 'opacity-0 scale-75 translate-y-2'
            : 'opacity-100 scale-100 translate-y-0'
          }
        `}
      >
        <span className="text-xs opacity-70">{label}</span>
        <span className="font-bold">
          {prefix}${transaction.amount.toFixed(4)}
        </span>
      </div>
    </div>,
    document.body
  );
}

export default SpendingNotification;

