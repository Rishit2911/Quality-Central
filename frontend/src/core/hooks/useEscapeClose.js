import { useEffect } from 'react';

// Calls onClose when Escape is pressed, while active is true.
export default function useEscapeClose(onClose, active = true) {
  useEffect(() => {
    if (!active || !onClose) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, active]);
}
