from typing import Optional, Tuple


def split_full_name(full_name: Optional[str]) -> Tuple[str, str, str]:
    """Split a single name string into (first_name, middle_name, last_name).

    First word -> first_name, last word -> last_name, everything in
    between -> middle_name. Missing parts come back as ''.
    """
    words = (full_name or "").split()
    if not words:
        return "", "", ""
    if len(words) == 1:
        return words[0], "", ""
    if len(words) == 2:
        return words[0], "", words[1]
    return words[0], " ".join(words[1:-1]), words[-1]


def join_name_parts(first_name: Optional[str], middle_name: Optional[str], last_name: Optional[str]) -> str:
    """Combine first/middle/last name parts into a single display name."""
    parts = [p.strip() for p in (first_name, middle_name, last_name) if p and p.strip()]
    return " ".join(parts)
