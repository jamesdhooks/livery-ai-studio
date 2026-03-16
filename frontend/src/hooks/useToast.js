import { useState, useCallback, useRef } from 'react';

let _nextId = 1;

/**
 * useToast — manages a list of toast notifications with auto-dismiss.
 *
 * Returns:
 *   toasts    — array of { id, type, message, duration }
 *   toast     — (message, type?, duration?) => void
 *   dismiss   — (id) => void
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message, type = 'info', duration = 4000) => {
    const id = _nextId++;
    setToasts((prev) => [...prev, { id, type, message }]);
    if (duration > 0) {
      timers.current[id] = setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  return { toasts, toast, dismiss };
}
