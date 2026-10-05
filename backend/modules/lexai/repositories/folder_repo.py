from typing import List, Dict, Any, Optional
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class LexAIFolderRepository:
    def _set_path(self, cur, tenant_id: str = 'public'):
        cur.execute(f'SET search_path TO "{tenant_id}", public')

    def get_root_folders(self, tenant_id: str, employee_code: str) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("""
                SELECT f.*,
                       COALESCE(
                           (SELECT json_agg(fl) FROM lexai_files fl WHERE fl.folder_id = f.id),
                           '[]'::json
                       ) AS files
                FROM lexai_folders f
                WHERE f.employee_code = %s AND f.parent_id IS NULL
                ORDER BY f.created_at ASC
            """, (employee_code,))
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_folder_detail(self, tenant_id: str, folder_id: int, employee_code: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("""
                SELECT * FROM lexai_folders
                WHERE id = %s AND employee_code = %s
            """, (folder_id, employee_code))
            row = cur.fetchone()
            if not row:
                return None
            folder = dict(row)

            # Get files in folder
            cur.execute("""
                SELECT * FROM lexai_files
                WHERE folder_id = %s AND employee_code = %s
                ORDER BY created_at DESC
            """, (folder_id, employee_code))
            folder["files"] = [dict(r) for r in cur.fetchall()]

            # Get subfolders
            cur.execute("""
                SELECT f.*,
                       COALESCE(
                           (SELECT json_agg(fl) FROM lexai_files fl WHERE fl.folder_id = f.id),
                           '[]'::json
                       ) AS files
                FROM lexai_folders f
                WHERE f.parent_id = %s AND f.employee_code = %s
                ORDER BY f.created_at ASC
            """, (folder_id, employee_code))
            folder["subfolders"] = [dict(r) for r in cur.fetchall()]

            return folder
        finally:
            conn.close()

    def create_folder(self, tenant_id: str, employee_code: str, name: str, parent_id: Optional[int] = None) -> Dict[str, Any]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("""
                INSERT INTO lexai_folders (name, parent_id, employee_code)
                VALUES (%s, %s, %s)
                RETURNING *
            """, (name, parent_id, employee_code))
            row = cur.fetchone()
            conn.commit()
            result = dict(row) if row else {}
            result["files"] = []
            return result
        finally:
            conn.close()

    def delete_folder(self, tenant_id: str, folder_id: int, employee_code: str) -> bool:
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute("""
                DELETE FROM lexai_folders
                WHERE id = %s AND employee_code = %s
            """, (folder_id, employee_code))
            deleted = cur.rowcount > 0
            conn.commit()
            return deleted
        finally:
            conn.close()
