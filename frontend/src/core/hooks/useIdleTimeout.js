import { useEffect, useRef, useCallback } from 'react';

/**
 * useIdleTimeout
 * Logs the user out automatically after `idleMs` milliseconds of inactivity.
 * Inactivity is defined as no mouse, keyboard, touch, or scroll events.
 *
 * @param {Function} onIdle   - Callback to invoke when idle timeout fires
 * @param {number}   idleMs   - Idle timeout in milliseconds (default: 30 min)
 * @param {boolean}  enabled  - Only run when user is logged in
 */
export default function useIdleTimeout(onIdle, idleMs = 30 * 60 * 1000, enabled = true) {
  const timerRef = useRef(null);
  const onIdleRef = useRef(onIdle);

  // Keep callback ref current so we never capture a stale closure
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onIdleRef.current();
    }, idleMs);
  }, [idleMs]);

  useEffect(() => {
    if (!enabled) return;

    const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel', 'click'];

    EVENTS.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer(); // start the clock immediately

    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, resetTimer]);
}
