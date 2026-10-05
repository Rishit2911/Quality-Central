from typing import List, Dict, Any, Optional
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class LexAIFileRepository:
    def _set_path(self, cur, tenant_id: str = 'public'):
        cur.execute(f'SET search_path TO "{tenant_id}", public')

    def create_file(
        self,
        tenant_id: str,
        employee_code: str,
        name: str,
        folder_id: Optional[int],
        file_type: str,
        file_path: str,
        file_size: Optional[int]
    ) -> Dict[str, Any]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("""
                INSERT INTO lexai_files (name, folder_id, employee_code, file_type, file_path, file_size)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (name, folder_id, employee_code, file_type, file_path, file_size))
            row = cur.fetchone()
            conn.commit()
            return dict(row) if row else {}
        finally:
            conn.close()

    def get_files(self, tenant_id: str, employee_code: str, folder_id: Optional[int] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            if folder_id is not None:
                cur.execute("""
                    SELECT * FROM lexai_files
                    WHERE employee_code = %s AND folder_id = %s
                    ORDER BY created_at DESC
                """, (employee_code, folder_id))
            else:
                cur.execute("""
                    SELECT * FROM lexai_files
                    WHERE employee_code = %s AND folder_id IS NULL
                    ORDER BY created_at DESC
                """, (employee_code,))
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_file(self, tenant_id: str, file_id: int, employee_code: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("""
                SELECT * FROM lexai_files
                WHERE id = %s AND employee_code = %s
            """, (file_id, employee_code))
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def delete_file(self, tenant_id: str, file_id: int, employee_code: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("""
                DELETE FROM lexai_files
                WHERE id = %s AND employee_code = %s
                RETURNING *
            """, (file_id, employee_code))
            row = cur.fetchone()
            conn.commit()
            return dict(row) if row else None
        finally:
            conn.close()
