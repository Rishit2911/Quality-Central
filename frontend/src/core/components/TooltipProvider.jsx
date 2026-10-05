import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

const ICON_LABELS = {
  'refresh-cw': 'Refresh',
  'trash-2': 'Delete',
  'trash': 'Delete',
  edit: 'Edit',
  'edit-3': 'Edit',
  eye: 'View',
  upload: 'Upload file',
  'upload-cloud': 'Upload file',
  copy: 'Copy',
  ban: 'Revoke',
  lock: 'Lock user',
  unlock: 'Restore user',
  bell: 'Notifications',
  'log-out': 'Log out',
  send: 'Send',
  download: 'Download',
};

const STATUS_TOOLTIPS = {
  'Pending Invite': 'An invitation has been created and is waiting for the recipient to act.',
  Submitted: 'Submitted and waiting for review.',
  Reviewed: 'Reviewed by an authorized user.',
  Finalized: 'Finalized and no longer editable.',
  'Malpractice Flagged': 'Potential assessment malpractice was detected and needs review.',
  Locked: 'This account cannot sign in until it is restored.',
  Inactive: 'This account is not currently active.',
};

const iconLabel = (element) => {
  const icon = element.querySelector?.('svg[class*="lucide-"]');
  const className = [...(icon?.classList || [])].find((name) => name.startsWith('lucide-'));
  return className ? ICON_LABELS[className.replace('lucide-', '')] : '';
};

/**
 * Makes existing titles use the shared in-product tooltip instead of the
 * browser's default title bubble. Icon-only buttons without an explicit
 * title still get a fallback label; buttons with visible text are left
 * alone since a tooltip would just repeat what's already on screen.
 */
export default function TooltipProvider({ children }) {
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    const decorate = (element) => {
      if (!(element instanceof HTMLElement)) return;
      if (element.closest('.hub-tab, .hub-tabs, [data-no-tooltip]')) return;

      if (element.hasAttribute('title')) {
        const title = element.getAttribute('title');
        if (title) {
          element.dataset.tooltip = title;
          if (!element.hasAttribute('aria-label')) element.setAttribute('aria-label', title);
        }
        element.removeAttribute('title');
      }

      if (element.matches('button, [role="button"]') && !element.dataset.tooltip) {
        const visibleText = element.innerText?.replace(/\s+/g, ' ').trim();
        if (!visibleText) {
          const label = element.getAttribute('aria-label') || element.querySelector('img')?.alt || iconLabel(element);
          if (label) element.dataset.tooltip = label;
        }
      }

      if (element.matches('img.icon, img.cursor-pointer') && !element.dataset.tooltip) {
        const label = element.alt === 'bell' ? 'Open notifications'
          : element.alt === 'logout' ? 'Log out'
          : element.alt;
        if (label) element.dataset.tooltip = label;
      }

      if (element.matches('span, [class*="badge"]') && !element.dataset.tooltip) {
        const statusTooltip = STATUS_TOOLTIPS[element.innerText?.replace(/\s+/g, ' ').trim()];
        if (statusTooltip) element.dataset.tooltip = statusTooltip;
      }
    };

    const decorateTree = (root) => {
      decorate(root);
      root.querySelectorAll?.('[title], button, [role="button"], img.icon, img.cursor-pointer, span, [class*="badge"]').forEach(decorate);
    };

    decorateTree(document.body);
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === 'attributes') decorate(record.target);
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) decorateTree(node);
        });
      });
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['title'],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const showTooltip = (target) => {
      const element = target instanceof Element
        ? target.closest('[data-tooltip], [aria-label]')
        : null;
      if (element?.closest('.hub-tab, .hub-tabs, [data-no-tooltip]')) return;
      const text = element?.dataset.tooltip || element?.getAttribute('aria-label');
      if (!element || !text) return;

      const rect = element.getBoundingClientRect();
      const below = rect.top < 64;
      setTooltip({
        text,
        left: rect.left + rect.width / 2,
        top: below ? rect.bottom + 8 : rect.top - 8,
        placement: below ? 'below' : 'above',
      });
    };
    const hideTooltip = (event) => {
      const current = event?.target instanceof Element
        ? event.target.closest('[data-tooltip], [aria-label]')
        : null;
      const next = event?.relatedTarget instanceof Element
        ? event.relatedTarget.closest('[data-tooltip], [aria-label]')
        : null;
      if (current && current === next) return;
      setTooltip(null);
    };
    const handlePointerOver = (event) => showTooltip(event.target);
    const handleFocusIn = (event) => showTooltip(event.target);

    document.addEventListener('pointerover', handlePointerOver);
    document.addEventListener('pointerout', hideTooltip);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', hideTooltip);

    return () => {
      document.removeEventListener('pointerover', handlePointerOver);
      document.removeEventListener('pointerout', hideTooltip);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', hideTooltip);
    };
  }, []);

  return <>
    {children}
    {tooltip && (
      <div className={`app-tooltip app-tooltip--${tooltip.placement}`} style={{ left: tooltip.left, top: tooltip.top }} role="tooltip">
        {tooltip.text}
      </div>
    )}
  </>;
}
