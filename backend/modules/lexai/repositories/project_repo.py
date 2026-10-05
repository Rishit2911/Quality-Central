import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class LexAIProjectRepository:
    def _set_path(self, cur, tenant_id: str = 'public'):
        cur.execute(f'SET search_path TO "{tenant_id}", public')

    def create_project(self, tenant_id: str, employee_code: str, title: str, business_unit: Optional[str] = None) -> Dict[str, Any]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            project_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO lexai_projects (id, employee_code, tenant_id, title, business_unit)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING *
            """, (project_id, employee_code, tenant_id, title, business_unit))
            row = cur.fetchone()
            conn.commit()
            return dict(row) if row else {}
        finally:
            conn.close()

    def update_project_data(self, tenant_id: str, project_id: str, employee_code: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)

            allowed_fields = {"title", "business_unit", "intake_data", "extracted_content", "design_doc", "storyboard"}
            set_clauses = []
            values = []

            for field, val in update_data.items():
                if field in allowed_fields:
                    set_clauses.append(f"{field} = %s")
                    values.append(val)

            if not set_clauses:
                # Nothing to update, return current project
                cur.execute("SELECT * FROM lexai_projects WHERE id = %s AND employee_code = %s", (project_id, employee_code))
                row = cur.fetchone()
                return dict(row) if row else None

            set_clauses.append("updated_at = CURRENT_TIMESTAMP")
            sql = f"UPDATE lexai_projects SET {', '.join(set_clauses)} WHERE id = %s AND employee_code = %s RETURNING *"
            values.extend([project_id, employee_code])

            cur.execute(sql, tuple(values))
            row = cur.fetchone()
            conn.commit()
            return dict(row) if row else None
        finally:
            conn.close()

    def get_user_projects(self, tenant_id: str, employee_code: str) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("""
                SELECT * FROM lexai_projects
                WHERE employee_code = %s
                ORDER BY updated_at DESC
            """, (employee_code,))
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_all_tenant_projects(self, tenant_id: str) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("""
                SELECT * FROM lexai_projects
                ORDER BY updated_at DESC
            """)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_project(self, tenant_id: str, project_id: str, employee_code: Optional[str] = None) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            if employee_code:
                cur.execute("""
                    SELECT * FROM lexai_projects
                    WHERE id = %s AND employee_code = %s
                """, (project_id, employee_code))
            else:
                cur.execute("""
                    SELECT * FROM lexai_projects
                    WHERE id = %s
                """, (project_id,))
            row = cur.fetchone()
            if not row:
                return None
            project = dict(row)

            # Fetch chat messages
            cur.execute("""
                SELECT id, project_id, type, role, content, timestamp
                FROM lexai_chat_messages
                WHERE project_id = %s
                ORDER BY timestamp ASC
            """, (project_id,))
            msg_rows = cur.fetchall()
            project["messages"] = [dict(m) for m in msg_rows]
            return project
        finally:
            conn.close()

    def delete_project(self, tenant_id: str, project_id: str, employee_code: Optional[str] = None) -> bool:
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            if employee_code:
                cur.execute("DELETE FROM lexai_projects WHERE id = %s AND employee_code = %s", (project_id, employee_code))
            else:
                cur.execute("DELETE FROM lexai_projects WHERE id = %s", (project_id,))
            deleted = cur.rowcount > 0
            conn.commit()
            return deleted
        finally:
            conn.close()

    def get_chat_messages(self, tenant_id: str, project_id: str, doc_type: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            if doc_type:
                cur.execute("""
                    SELECT id, project_id, type, role, content, timestamp
                    FROM lexai_chat_messages
                    WHERE project_id = %s AND type = %s
                    ORDER BY timestamp ASC
                """, (project_id, doc_type))
            else:
                cur.execute("""
                    SELECT id, project_id, type, role, content, timestamp
                    FROM lexai_chat_messages
                    WHERE project_id = %s
                    ORDER BY timestamp ASC
                """, (project_id,))
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def add_chat_message(self, tenant_id: str, project_id: str, doc_type: str, role: str, content: str) -> Dict[str, Any]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("""
                INSERT INTO lexai_chat_messages (project_id, type, role, content)
                VALUES (%s, %s, %s, %s)
                RETURNING *
            """, (project_id, doc_type, role, content))
            row = cur.fetchone()
            conn.commit()
            return dict(row) if row else {}
        finally:
            conn.close()
