import { useEffect } from 'react';

// Prompts the browser's native "leave site?" confirmation on refresh/close/back
// while `active` is true. Wire this up wherever a form is mid-edit so unsaved
// work isn't silently lost to an accidental reload.
export default function useUnsavedChangesWarning(active) {
    useEffect(() => {
        if (!active) return;

        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = '';
            return '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [active]);
}
