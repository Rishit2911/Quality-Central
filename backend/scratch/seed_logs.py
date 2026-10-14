import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from backend.core.error_logger import log_server_error, get_available_log_dates

# 1. Error from 1 month ago (15 Sep 2026)
log_server_error(
    error_message="KeyError: 'contract_clauses' in document structure parser",
    traceback_str="""Traceback (most recent call last):
  File "backend/modules/lexai/services/sop_service.py", line 142, in extract_clauses_from_pdf
    clause_data = document["contract_clauses"]
KeyError: 'contract_clauses'
During handling of the above exception, another exception occurred:
  File "backend/modules/lexai/api/sop.py", line 88, in generate_sop_endpoint
    result = await extract_clauses_from_pdf(payload.document_id)
RuntimeError: Failed to extract clauses from PDF document structure""",
    endpoint="/api/lexai/sop/generate",
    method="POST",
    user_identifier="vidhi@phygitron.com",
    custom_date="2026-09-15"
)

# 2. Error from 1 week ago (02 Oct 2026)
log_server_error(
    error_message="psycopg2.errors.UniqueViolation: duplicate key value violates unique constraint",
    traceback_str="""Traceback (most recent call last):
  File "backend/modules/deploy/api/attendance.py", line 214, in record_clockin_entry
    cur.execute("INSERT INTO attendance (emp_code, date, time) VALUES (%s, %s, %s)", (emp_code, date, time))
psycopg2.errors.UniqueViolation: duplicate key value violates unique constraint "attendance_pkey"
DETAIL: Key (emp_code, date)=(EMP042, 2026-10-02) already exists.""",
    endpoint="/api/deploy/attendance/clock-in",
    method="POST",
    user_identifier="sriraj@phygitron.com",
    custom_date="2026-10-02"
)

# 3. Error from today (09 Oct 2026)
log_server_error(
    error_message="AttributeError: 'NoneType' object has no attribute 'get'",
    traceback_str="""Traceback (most recent call last):
  File "backend/modules/quality/api/dashboard.py", line 344, in compute_dashboard_metrics
    assignee = bug.get("assignee").lower()
AttributeError: 'NoneType' object has no attribute 'get'
  File "backend/modules/quality/api/dashboard.py", line 428, in get_metrics_endpoint
    metrics = compute_dashboard_metrics(user_filter=user_id)""",
    endpoint="/api/quality/metrics",
    method="GET",
    user_identifier="rishit@phygitron.com",
    custom_date="2026-10-09"
)

print("Available dates with logs:", get_available_log_dates())
