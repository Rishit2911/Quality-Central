export function getInitials(value) {
  let str = (value || '').trim();
  if (!str) return '';

  // Email fallback: strip domain, e.g. "bhupesh.mangla3@gmail.com" -> "bhupesh.mangla3"
  if (str.includes('@')) {
    str = str.split('@')[0];
  }

  // Real names are space-separated; email local-parts use . _ - as separators
  let parts = str.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    parts = str.split(/[._-]+/).filter(Boolean);
  }

  // Strip trailing digits from each segment, e.g. "mangla3" -> "mangla"
  parts = parts.map(p => p.replace(/[0-9]+$/, '')).filter(Boolean);

  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
