"""
Shared audit logging utility.
Import and call `audit_log(...)` from any service/endpoint to write to the
tenant-scoped `audit_logs` table.
"""
from datetime import datetime
from backend.core.database import get_db_connection
import logging

logger = logging.getLogger(__name__)


def audit_log(
    tenant_id: str,
    username: str,
    action: str,
    details: str,
    module: str = "system",
    ip: str = None,
):
    """
    Write one row to audit_logs for the given tenant.

    Args:
        tenant_id:  Postgres schema name (e.g. 'tenant_ewandz')
        username:   The actor's username / email
        action:     Short uppercase constant like 'CREATE_EMPLOYEE'
        details:    Human-readable description of what happened
        module:     Which module emitted this (admin/deploy/source/verify/forge)
        ip:         Optional requester IP
    """
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute(
                    """
                    INSERT INTO audit_logs (username, action, details, module, ip_address)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (username, action, details, module, ip),
                )
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        # Never crash the caller because of a logging failure
        logger.warning("audit_log write failed: %s", e)
