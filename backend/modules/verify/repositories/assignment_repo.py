import json
import decimal
import datetime
from typing import Optional, List, Dict, Any
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

def _json_dumps(obj: Any) -> str:
    def _default(o):
        if isinstance(o, decimal.Decimal):
            return int(o) if o % 1 == 0 else float(o)
        if isinstance(o, (datetime.datetime, datetime.date)):
            return o.isoformat()
        return str(o)
    return json.dumps(obj, default=_default)

class AssignmentRepository:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id

    def _set_search_path(self, cur):
        cur.execute(f'SET search_path TO "{self.tenant_id}", public')

    def get_assignable_users(self, assessment_id: Optional[int] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                if assessment_id is not None:
                    cur.execute('''
                        SELECT u.id, u.username, u.role, u.is_active,
                               aa.id AS assignment_id, aa.status AS assignment_status,
                               CASE 
                                   WHEN LOWER(u.username) = 'cluxssy25@gmail.com' THEN FALSE
                                   WHEN aa.id IS NOT NULL THEN TRUE 
                                   ELSE FALSE 
                               END AS is_assigned
                        FROM users u
                        LEFT JOIN assessment_assignments aa ON aa.user_id = u.id AND aa.assessment_id = %s
                        WHERE u.role != 'candidate' AND u.is_active = 1
                        ORDER BY (CASE WHEN LOWER(u.username) = 'cluxssy25@gmail.com' THEN FALSE ELSE (aa.id IS NOT NULL) END) ASC, u.username ASC
                    ''', (assessment_id,))
                else:
                    cur.execute('''
                        SELECT id, username, role, is_active,
                               FALSE AS is_assigned, NULL AS assignment_status
                        FROM users 
                        WHERE role != 'candidate' AND is_active = 1
                        ORDER BY username ASC
                    ''')
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def get_user_info(self, user_id: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute(
                    """
                    SELECT u.id AS user_id, u.username AS email,
                           COALESCE(
                               NULLIF(e.name, ''),
                               NULLIF((SELECT full_name FROM candidates c WHERE c.user_id = u.id OR c.email = u.username ORDER BY c.id DESC LIMIT 1), '')
                           ) AS name
                    FROM users u
                    LEFT JOIN employees e ON e.employee_code = u.employee_code
                    WHERE u.id = %s
                    """,
                    (user_id,)
                )
                row = cur.fetchone()
                return dict(row) if row else None
        finally:
            conn.close()

    def get_user_assignments(self, user_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute(
                    """
                    SELECT
                        aa.id              AS assignment_id,
                        a.id               AS assessment_id,
                        a.title,
                        a.description,
                        a.time_limit_minutes,
                        a.pass_score,
                        aa.proctoring_config,
                        a.sections,
                        aa.status,
                        aa.deadline,
                        aa.started_at,
                        aa.strike_count,
                        aa.resume_count,
                        aa.terminated_by_proctor,
                        aa.created_at      AS assigned_at,
                        ar.id              AS result_id,
                        ar.score           AS score_percentage,
                        ar.pass_status     AS passed,
                        ar.submitted_at    AS graded_at
                    FROM assessment_assignments aa
                    JOIN assessments a ON a.id = aa.assessment_id
                    LEFT JOIN assessment_results ar ON ar.assessment_id = a.id AND ar.user_id = aa.user_id
                    WHERE aa.user_id = %s AND a.is_deleted = FALSE
                    ORDER BY aa.created_at DESC
                    """,
                    (user_id,),
                )
                rows = []
                for r in cur.fetchall():
                    row = dict(r)
                    for k, v in list(row.items()):
                        if isinstance(v, decimal.Decimal):
                            row[k] = int(v) if v % 1 == 0 else float(v)
                    rows.append(row)
                return rows
        finally:
            conn.close()

    def get_assignment(self, asm_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute(
                    "SELECT id, status FROM assessment_assignments WHERE assessment_id = %s AND user_id = %s",
                    (asm_id, user_id),
                )
                row = cur.fetchone()
                return dict(row) if row else None
        finally:
            conn.close()

    def update_assignment_status(
        self, asm_id: int, user_id: int, status: str, 
        deadline: Optional[str] = None, proctoring_config: Optional[Dict[str, Any]] = None
    ) -> None:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    """
                    UPDATE assessment_assignments
                    SET status = %s, 
                        deadline = COALESCE(%s, deadline),
                        proctoring_config = COALESCE(%s, proctoring_config),
                        started_at = CASE WHEN %s = 'pending' THEN NULL ELSE started_at END,
                        strike_count = CASE WHEN %s = 'pending' THEN 0 ELSE strike_count END,
                        resume_count = CASE WHEN %s = 'pending' THEN 0 ELSE resume_count END,
                        terminated_by_proctor = CASE WHEN %s = 'pending' THEN FALSE ELSE terminated_by_proctor END,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE assessment_id = %s AND user_id = %s
                    """,
                    (status, deadline, _json_dumps(proctoring_config) if proctoring_config else None, status, status, status, status, asm_id, user_id),
                )
                conn.commit()
        finally:
            conn.close()

    def create_assignment(
        self, asm_id: int, user_id: int, assigned_by: int, 
        deadline: Optional[str] = None, proctoring_config: Optional[Dict[str, Any]] = None
    ) -> None:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    """
                    INSERT INTO assessment_assignments
                        (assessment_id, user_id, assigned_by, deadline, proctoring_config, status)
                    VALUES (%s, %s, %s, %s, %s, 'pending')
                    """,
                    (asm_id, user_id, assigned_by, deadline, _json_dumps(proctoring_config) if proctoring_config else None),
                )
                conn.commit()
        finally:
            conn.close()

    def get_assignment_candidates(self, asm_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute(
                    """
                    SELECT
                        aa.id              AS assignment_id,
                        u.id               AS user_id,
                        e.name,
                        u.username         AS email,
                        aa.status,
                        aa.deadline,
                        aa.started_at,
                        aa.created_at      AS assigned_at
                    FROM assessment_assignments aa
                    JOIN users u ON u.id = aa.user_id
                    LEFT JOIN employees e ON e.employee_code = u.employee_code
                    WHERE aa.assessment_id = %s
                    ORDER BY aa.created_at DESC
                    """,
                    (asm_id,),
                )
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def get_recent_assignments(self, limit: int = 10) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute(
                    """
                    SELECT
                        aa.id              AS assignment_id,
                        u.id               AS user_id,
                        u.username         AS email,
                        a.title            AS assessment_title,
                        aa.status,
                        aa.created_at      AS assigned_at
                    FROM assessment_assignments aa
                    JOIN users u ON u.id = aa.user_id
                    JOIN assessments a ON a.id = aa.assessment_id
                    ORDER BY aa.created_at DESC
                    LIMIT %s
                    """,
                    (limit,)
                )
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def update_custom_questions(self, asm_id: int, user_id: int, custom_questions: List[Dict[str, Any]]) -> None:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    """
                    UPDATE assessment_assignments
                    SET custom_questions = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE assessment_id = %s AND user_id = %s
                    """,
                    (_json_dumps(custom_questions), asm_id, user_id),
                )
                conn.commit()
        finally:
            conn.close()

    def start_session(self, asm_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Start or resume a session.
        - Fresh start: sets started_at, status='in_progress'. Returns session meta.
        - Resume (already started): increments resume_count. Returns session meta.
        - Not assigned: auto-creates assignment on the fly if assessment exists.
        """
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute(
                    """
                    SELECT aa.id, aa.started_at, aa.resume_count, aa.strike_count,
                           aa.terminated_by_proctor, aa.proctoring_config, aa.status,
                           a.time_limit_minutes
                    FROM assessment_assignments aa
                    JOIN assessments a ON a.id = aa.assessment_id
                    WHERE aa.assessment_id = %s AND aa.user_id = %s
                    """,
                    (asm_id, user_id)
                )
                row = cur.fetchone()
                if not row:
                    cur.execute(
                        "SELECT id, time_limit_minutes FROM assessments WHERE id = %s AND is_deleted = FALSE",
                        (asm_id,)
                    )
                    asm_row = cur.fetchone()
                    if not asm_row:
                        return None
                    
                    cur.execute(
                        """
                        INSERT INTO assessment_assignments (assessment_id, user_id, assigned_by, status, started_at)
                        VALUES (%s, %s, %s, 'in_progress', CURRENT_TIMESTAMP)
                        RETURNING id, started_at, strike_count, resume_count, terminated_by_proctor, proctoring_config, status
                        """,
                        (asm_id, user_id, user_id)
                    )
                    new_aa = cur.fetchone()
                    conn.commit()
                    limit_mins = int(asm_row['time_limit_minutes']) if asm_row.get('time_limit_minutes') else None
                    return {
                        "assignment_id": new_aa['id'],
                        "session_already_started": False,
                        "strike_count": 0,
                        "terminated_by_proctor": False,
                        "proctoring_config": None,
                        "time_remaining_seconds": (limit_mins * 60) if limit_mins else None,
                    }

                limit_mins = int(row['time_limit_minutes']) if row.get('time_limit_minutes') else None
                if row['started_at'] is None:
                    # Fresh start
                    cur.execute(
                        """
                        UPDATE assessment_assignments
                        SET status = 'in_progress', started_at = CURRENT_TIMESTAMP,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE assessment_id = %s AND user_id = %s
                        RETURNING started_at
                        """,
                        (asm_id, user_id)
                    )
                    new_row = cur.fetchone()
                    started_at = new_row['started_at'] if new_row else None
                    time_remaining = (limit_mins * 60) if limit_mins else None
                else:
                    # Resume — bump resume_count, do NOT reset started_at
                    cur.execute(
                        """
                        UPDATE assessment_assignments
                        SET resume_count = COALESCE(resume_count, 0) + 1,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE assessment_id = %s AND user_id = %s
                        """,
                        (asm_id, user_id)
                    )
                    started_at = row['started_at']
                    if limit_mins and started_at:
                        from datetime import datetime, timezone
                        now = datetime.now(timezone.utc)
                        if started_at.tzinfo is None:
                            from datetime import timezone as tz
                            started_at = started_at.replace(tzinfo=tz.utc)
                        elapsed = (now - started_at).total_seconds()
                        time_remaining = max(0, int(limit_mins * 60 - elapsed))
                    else:
                        time_remaining = None

                conn.commit()
                return {
                    "assignment_id": row['id'],
                    "session_already_started": row['started_at'] is not None,
                    "strike_count": row['strike_count'] or 0,
                    "terminated_by_proctor": row['terminated_by_proctor'] or False,
                    "proctoring_config": row['proctoring_config'],
                    "time_remaining_seconds": time_remaining,
                }
        finally:
            conn.close()

    def record_strike(
        self,
        asm_id: int,
        user_id: int,
        violation_name: str = "proctoring_violation",
        flag_type: str = "proctoring_violation",
        is_terminal: bool = False,
        max_strikes: int = 5,
    ) -> Dict[str, Any]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)

                # Fetch current assignment
                cur.execute(
                    """
                    SELECT id, strike_count, terminated_by_proctor
                    FROM assessment_assignments
                    WHERE assessment_id = %s AND user_id = %s
                    """,
                    (asm_id, user_id)
                )
                row = cur.fetchone()
                if not row:
                    return {"strike_count": 0, "terminated_by_proctor": False}

                assignment_id = row['id']

                # If already terminated, return current state without incrementing
                if row['terminated_by_proctor']:
                    return {"strike_count": row['strike_count'], "terminated_by_proctor": True}

                new_count = (row['strike_count'] or 0) + 1
                should_terminate = is_terminal or new_count >= max_strikes

                cur.execute(
                    """
                    UPDATE assessment_assignments
                    SET strike_count = %s,
                        terminated_by_proctor = %s,
                        status = CASE WHEN %s THEN 'terminated' ELSE status END,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (new_count, should_terminate, should_terminate, assignment_id)
                )

                # Write detailed strike record to proctoring_strikes
                try:
                    cur.execute(
                        """
                        INSERT INTO proctoring_strikes
                            (assignment_id, violation_name, flag_type, strike_index)
                        VALUES (%s, %s, %s, %s)
                        """,
                        (assignment_id, violation_name, flag_type, new_count)
                    )
                except Exception as e:
                    logger.warning("Failed to write proctoring_strike detail: %s", e)

                conn.commit()
                return {"strike_count": new_count, "terminated_by_proctor": should_terminate}
        finally:
            conn.close()
