from typing import List, Dict, Any, Optional
import json
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor


class ProfileEditRequestRepository:
    def _set_path(self, cur, tenant_id='public'):
        cur.execute(f'SET search_path TO "{tenant_id}", public')

    def get_pending_request(self, employee_code: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute(
                "SELECT * FROM profile_edit_requests WHERE employee_code = %s AND status = 'Pending' ORDER BY created_at DESC LIMIT 1",
                (employee_code,)
            )
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def get_latest_unacknowledged_decision(self, employee_code: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute(
                "SELECT * FROM profile_edit_requests WHERE employee_code = %s AND status = 'Rejected' AND acknowledged = FALSE "
                "ORDER BY reviewed_at DESC LIMIT 1",
                (employee_code,)
            )
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def acknowledge_request(self, request_id: int, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute("UPDATE profile_edit_requests SET acknowledged = TRUE WHERE id = %s", (request_id,))
            conn.commit()
        finally:
            conn.close()

    def get_pending_requests(self, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute('''
                SELECT r.*, e.name AS employee_name, e.photo_path, e.designation, e.team
                FROM profile_edit_requests r
                LEFT JOIN employees e ON r.employee_code = e.employee_code
                WHERE r.status = 'Pending'
                ORDER BY r.created_at DESC
            ''')
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_request_by_id(self, request_id: int, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute('''
                SELECT r.*, e.name AS employee_name, e.photo_path, e.designation, e.team
                FROM profile_edit_requests r
                LEFT JOIN employees e ON r.employee_code = e.employee_code
                WHERE r.id = %s
            ''', (request_id,))
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def update_status(
        self,
        request_id: int,
        status: str,
        reviewed_by: str,
        review_notes: Optional[str],
        tenant_id: str = 'public'
    ):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute('''
                UPDATE profile_edit_requests
                SET status = %s, reviewed_by = %s, review_notes = %s, reviewed_at = CURRENT_TIMESTAMP
                WHERE id = %s
            ''', (status, reviewed_by, review_notes, request_id))
            conn.commit()
        finally:
            conn.close()

    def create_request(
        self,
        employee_code: str,
        requested_fields: List[Dict[str, Any]],
        supporting_docs: List[Dict[str, str]],
        notes: Optional[str],
        tenant_id: str = 'public'
    ) -> int:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute('''
                INSERT INTO profile_edit_requests (employee_code, requested_fields, supporting_docs, notes)
                VALUES (%s, %s, %s, %s)
                RETURNING id
            ''', (
                employee_code,
                json.dumps(requested_fields),
                json.dumps(supporting_docs or []),
                notes
            ))
            conn.commit()
            row = cur.fetchone()
            return row['id']
        finally:
            conn.close()
