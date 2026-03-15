import { useReducer, useRef, useCallback, useEffect, useLayoutEffect } from 'react';

/**
 * useZoomPan — scroll-to-zoom + drag-to-pan image viewer hook.
 *
 * Design notes:
 * - useReducer so the native wheel closure calls dispatch (always stable),
 *   avoiding stale-closure and passive-event issues.
 * - Non-passive wheel listener registered natively so e.preventDefault()
 *   actually prevents page scroll (React 17+ synthetic onWheel is passive).
 * - ref writes happen in useLayoutEffect, never during render.
 * - imageUrl changes reset view via dispatch from useLayoutEffect.
 */

const INIT_VIEW = { scale: 1, x: 0, y: 0 };

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function constrainXY(x, y, scale, el) {
  if (scale <= 1 || !el) return { x: 0, y: 0 };
  const { clientWidth: cw, clientHeight: ch } = el;
  const ox = Math.max(0, (cw * scale - cw) / 2);
  const oy = Math.max(0, (ch * scale - ch) / 2);
  return { x: clamp(x, -ox, ox), y: clamp(y, -oy, oy) };
}

function viewReducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return INIT_VIEW;

    case 'WHEEL': {
      const { deltaY, cx, cy, el, opts } = action;
      const { minScale, maxScale, step } = opts;
      const factor = 1 + step;
      const dir = deltaY < 0 ? 1 : -1;
      const nextScale = dir > 0
        ? Math.min(state.scale * factor, maxScale)
        : Math.max(state.scale / factor, minScale);
      const ratio = 1 - nextScale / state.scale;
      const pos = constrainXY(
        state.x + (cx - state.x) * ratio,
        state.y + (cy - state.y) * ratio,
        nextScale,
        el,
      );
      return { scale: nextScale, ...pos };
    }

    case 'DRAG': {
      const { origX, origY, dx, dy, scale, el } = action;
      const pos = constrainXY(origX + dx, origY + dy, scale, el);
      return { ...state, ...pos };
    }

    default:
      return state;
  }
}

export function useZoomPan({ imageUrl, minScale = 1, maxScale = 8, step = 0.15 } = {}) {
  const containerRef = useRef(null);
  const [view, dispatch] = useReducer(viewReducer, INIT_VIEW);
  const dragRef = useRef(null);

  // Options stored in a ref, updated via layout-effect (never during render)
  const optsRef = useRef({ minScale, maxScale, step });
  useLayoutEffect(() => {
    optsRef.current = { minScale, maxScale, step };
  }, [minScale, maxScale, step]);

  // Reset view when imageUrl changes (layout-effect → dispatch, not setState)
  const prevUrlRef = useRef(imageUrl);
  useLayoutEffect(() => {
    if (prevUrlRef.current !== imageUrl) {
      prevUrlRef.current = imageUrl;
      dispatch({ type: 'RESET' });
    }
  }, [imageUrl]);

  // ── Native non-passive wheel listener ────────────────────────────────────
  // Empty dep array: dispatch is always stable, optsRef is a ref.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      dispatch({
        type: 'WHEEL',
        deltaY: e.deltaY,
        cx: e.clientX - rect.left - rect.width / 2,
        cy: e.clientY - rect.top - rect.height / 2,
        el,
        opts: optsRef.current,
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── Mouse drag pan ───────────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    const el = containerRef.current;
    if (e.button !== 0 || !el || view.scale <= 1) return;
    e.preventDefault();
    const origX = view.x;
    const origY = view.y;
    const scale = view.scale;
    dragRef.current = { startX: e.clientX, startY: e.clientY };

    const onMove = (me) => {
      const d = dragRef.current;
      if (!d) return;
      dispatch({
        type: 'DRAG',
        origX,
        origY,
        dx: me.clientX - d.startX,
        dy: me.clientY - d.startY,
        scale,
        el,
      });
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [view.x, view.y, view.scale]);

  const onDoubleClick = useCallback(() => dispatch({ type: 'RESET' }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return {
    containerRef,
    transform: view,
    isZoomed: view.scale > 1,
    // NOTE: onWheel is registered natively inside this hook.
    // Do NOT add an onWheel prop to the container in JSX.
    handlers: { onMouseDown, onDoubleClick },
    reset,
  };
}
