import faviconDark from '../assets/favicon.png';
import faviconLight from '../assets/Favicon_black.png';

export function initFaviconThemeSync() {
  const link = document.getElementById('favicon');
  if (!link) return;

  const mql = window.matchMedia('(prefers-color-scheme: dark)');

  const applyFavicon = (isDark) => {
    link.href = isDark ? faviconDark : faviconLight;
  };

  applyFavicon(mql.matches);
  mql.addEventListener('change', (e) => applyFavicon(e.matches));
}
