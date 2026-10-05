import { useRef, useCallback } from 'react';

// Closes an overlay only on a genuine click on the backdrop itself —
// mousedown and mouseup must both land on the backdrop. Without this,
// selecting text inside the dialog and releasing the mouse outside the
// content box (a common drag-selection edge case) fires a "click" on the
// backdrop and closes the dialog mid-edit.
export default function useOverlayClose(onClose) {
  const mouseDownOnOverlay = useRef(false);

  const onMouseDown = useCallback((e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  }, []);

  const onClick = useCallback((e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onClose(e);
    }
    mouseDownOnOverlay.current = false;
  }, [onClose]);

  return { onMouseDown, onClick };
}
