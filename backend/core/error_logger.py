import os
import re
import uuid
import logging
import traceback
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

# Base logs directory inside backend/logs
LOGS_DIR = Path(__file__).resolve().parent.parent / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

def get_log_file_for_date(date_str: Optional[str] = None) -> Path:
    """Returns the Path to the log file for a specific date (YYYY-MM-DD) or today."""
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")
    clean_date = date_str.strip()
    return LOGS_DIR / f"errors_{clean_date}.log"

def extract_broken_location_from_traceback(tb_str: str) -> Dict[str, Any]:
    """Parses a Python traceback to find the exact broken file and line number."""
    lines = tb_str.strip().splitlines()
    broken_file = "Unknown"
    line_number = "Unknown"
    broken_func = "Unknown"
    broken_code = ""

    # Look backwards from the traceback for the last File "...", line X entry
    pattern = re.compile(r'File "([^"]+)", line (\d+)(?:, in (\w+))?')
    for line in reversed(lines):
        match = pattern.search(line)
        if match:
            broken_file = match.group(1)
            line_number = match.group(2)
            broken_func = match.group(3) or "module"
            break

    # Look for the last code line snippet if available
    for i, line in enumerate(lines):
        if f'line {line_number}' in line and i + 1 < len(lines):
            broken_code = lines[i + 1].strip()

    # Get exception message (usually the very last line)
    exception_message = lines[-1].strip() if lines else "Unknown Error"

    return {
        "file": broken_file,
        "line": line_number,
        "function": broken_func,
        "code_snippet": broken_code,
        "exception": exception_message
    }

def log_server_error(
    error_message: str,
    traceback_str: str,
    endpoint: Optional[str] = None,
    method: Optional[str] = "GET",
    user_identifier: Optional[str] = None,
    custom_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Writes a structured error event into the date-specific error log file.
    Returns the parsed error metadata with its unique Error ID.
    """
    now = datetime.now()
    date_str = custom_date or now.strftime("%Y-%m-%d")
    timestamp_str = now.strftime("%Y-%m-%d %H:%M:%S")
    
    # Generate unique short Error ID e.g. ERR-20261009-8F21
    short_uuid = uuid.uuid4().hex[:6].upper()
    error_id = f"ERR-{now.strftime('%Y%m%d')}-{short_uuid}"

    location_info = extract_broken_location_from_traceback(traceback_str)

    log_entry = (
        f"\n{'='*70}\n"
        f"ERROR_ID: {error_id}\n"
        f"TIMESTAMP: {timestamp_str}\n"
        f"DATE: {date_str}\n"
        f"ENDPOINT: {method} {endpoint or 'Internal Background Task'}\n"
        f"USER: {user_identifier or 'Anonymous/System'}\n"
        f"EXCEPTION: {location_info['exception']}\n"
        f"LOCATION: File \"{location_info['file']}\", Line {location_info['line']} in {location_info['function']}\n"
        f"SNIPPET: {location_info['code_snippet']}\n"
        f"TRACEBACK:\n{traceback_str}\n"
        f"{'='*70}\n"
    )

    log_file = get_log_file_for_date(date_str)
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(log_entry)
    except Exception as e:
        print(f"[ErrorLogger] Failed writing to {log_file}: {e}")

    return {
        "error_id": error_id,
        "timestamp": timestamp_str,
        "date": date_str,
        "endpoint": f"{method} {endpoint or 'N/A'}",
        "location": location_info,
        "traceback": traceback_str
    }

def get_available_log_dates() -> List[str]:
    """Returns sorted list of dates (YYYY-MM-DD) that have logged errors."""
    if not LOGS_DIR.exists():
        return []
    dates = []
    pattern = re.compile(r"^errors_(\d{4}-\d{2}-\d{2})\.log$")
    for f in LOGS_DIR.iterdir():
        if f.is_file():
            m = pattern.match(f.name)
            if m:
                dates.append(m.group(1))
    dates.sort(reverse=True)
    return dates

def parse_log_entries_from_file(file_path: Path) -> List[Dict[str, Any]]:
    """Reads a date log file and parses individual structured error blocks."""
    if not file_path.exists():
        return []

    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except Exception:
        return []

    raw_blocks = content.split("=" * 70)
    entries = []

    for block in raw_blocks:
        b = block.strip()
        if not b or "ERROR_ID:" not in b:
            continue

        entry: Dict[str, Any] = {
            "error_id": "N/A",
            "timestamp": "N/A",
            "date": "N/A",
            "endpoint": "N/A",
            "user": "N/A",
            "exception": "N/A",
            "location_raw": "N/A",
            "code_snippet": "N/A",
            "traceback": ""
        }

        # Extract fields
        id_m = re.search(r"ERROR_ID:\s*(.+)", b)
        if id_m: entry["error_id"] = id_m.group(1).strip()

        ts_m = re.search(r"TIMESTAMP:\s*(.+)", b)
        if ts_m: entry["timestamp"] = ts_m.group(1).strip()

        dt_m = re.search(r"DATE:\s*(.+)", b)
        if dt_m: entry["date"] = dt_m.group(1).strip()

        ep_m = re.search(r"ENDPOINT:\s*(.+)", b)
        if ep_m: entry["endpoint"] = ep_m.group(1).strip()

        usr_m = re.search(r"USER:\s*(.+)", b)
        if usr_m: entry["user"] = usr_m.group(1).strip()

        exc_m = re.search(r"EXCEPTION:\s*(.+)", b)
        if exc_m: entry["exception"] = exc_m.group(1).strip()

        loc_m = re.search(r"LOCATION:\s*(.+)", b)
        if loc_m: entry["location_raw"] = loc_m.group(1).strip()

        snip_m = re.search(r"SNIPPET:\s*(.+)", b)
        if snip_m: entry["code_snippet"] = snip_m.group(1).strip()

        tb_split = b.split("TRACEBACK:\n")
        if len(tb_split) > 1:
            entry["traceback"] = tb_split[1].strip()

        # Parse location
        loc_parsed = extract_broken_location_from_traceback(entry["traceback"] or b)
        entry["file"] = loc_parsed["file"]
        entry["line"] = loc_parsed["line"]
        entry["function"] = loc_parsed["function"]

        entries.append(entry)

    # Return newest first
    entries.reverse()
    return entries

def search_error_logs(
    date_str: Optional[str] = None,
    query: Optional[str] = None,
    error_id: Optional[str] = None,
    limit: int = 15
) -> List[Dict[str, Any]]:
    """
    Searches error logs across dates.
    - If date_str is provided, searches that date's log file.
    - If error_id is provided, searches across all dates for that ID.
    - If query is provided, searches endpoints, messages, filenames, or exception types.
    """
    matched = []
    dates_to_search = [date_str] if date_str else get_available_log_dates()

    if not dates_to_search:
        today = datetime.now().strftime("%Y-%m-%d")
        dates_to_search = [today]

    clean_qid = (error_id or "").strip().upper()
    clean_q = (query or "").strip().lower()

    for d in dates_to_search:
        f = get_log_file_for_date(d)
        entries = parse_log_entries_from_file(f)
        for ent in entries:
            # Check Error ID match
            if clean_qid and clean_qid in ent["error_id"].upper():
                matched.append(ent)
                if len(matched) >= limit:
                    return matched
                continue

            # Check Query match
            if clean_q:
                combined_text = f"{ent['error_id']} {ent['endpoint']} {ent['exception']} {ent['file']} {ent['traceback']}".lower()
                if clean_q in combined_text:
                    matched.append(ent)
                    if len(matched) >= limit:
                        return matched
            elif not clean_qid:
                # If neither specified, grab latest entries
                matched.append(ent)
                if len(matched) >= limit:
                    return matched

    return matched

def get_latest_error(date_str: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Returns the most recent error entry."""
    results = search_error_logs(date_str=date_str, limit=1)
    return results[0] if results else None
