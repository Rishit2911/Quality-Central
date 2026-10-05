import json
import logging
from typing import Optional, List, Dict, Any
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

def _format_row(row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not row:
        return None
    d = dict(row)
    for json_field in ("options", "test_cases", "tags", "images"):
        val = d.get(json_field)
        if isinstance(val, str):
            try:
                d[json_field] = json.loads(val)
            except Exception:
                d[json_field] = []
        elif val is None:
            d[json_field] = []
    return d

class QuestionBankRepository:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id

    def _set_search_path(self, cur):
        cur.execute(f'SET search_path TO "{self.tenant_id}", public')

    def create_question(self, data: Dict[str, Any]) -> int:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                
                # Normalize tags and other json fields
                tags = data.get("tags", [])
                if isinstance(tags, str):
                    try:
                        tags = json.loads(tags)
                    except Exception:
                        tags = [t.strip() for t in tags.split(",") if t.strip()]
                if not isinstance(tags, list):
                    tags = []
                tags = [t.strip() for t in tags if str(t).strip() and str(t).strip().lower() not in ("extracted", "extracted_tag")]

                options = data.get("options", [])
                if isinstance(options, str):
                    try:
                        options = json.loads(options)
                    except Exception:
                        options = []

                test_cases = data.get("test_cases", [])
                if isinstance(test_cases, str):
                    try:
                        test_cases = json.loads(test_cases)
                    except Exception:
                        test_cases = []

                images = data.get("images", [])
                if isinstance(images, str):
                    try:
                        images = json.loads(images)
                    except Exception:
                        images = []

                cur.execute('''
                    INSERT INTO question_bank (
                        question_text, question_type, options, correct_answer,
                        model_answer, starter_code, test_cases, programming_language,
                        accepted_file_types, marks, tags, images, topic, created_by
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                ''', (
                    data["question_text"],
                    data.get("question_type", "mcq"),
                    json.dumps(options),
                    data.get("correct_answer"),
                    data.get("model_answer"),
                    data.get("starter_code"),
                    json.dumps(test_cases),
                    data.get("programming_language"),
                    data.get("accepted_file_types"),
                    data.get("marks", 1.0),
                    json.dumps(tags),
                    json.dumps(images),
                    data.get("topic"),
                    data.get("created_by")
                ))
                new_id = cur.fetchone()[0]
                conn.commit()
                return new_id
        finally:
            conn.close()

    def update_question(self, question_id: int, data: Dict[str, Any]) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                
                updates = ["updated_at = NOW()"]
                values = []
                for field in ["question_text", "question_type", "correct_answer", "model_answer", 
                              "starter_code", "programming_language", "accepted_file_types", "marks", "topic"]:
                    if field in data:
                        updates.append(f"{field} = %s")
                        values.append(data[field])
                        
                for json_field in ["options", "test_cases", "tags", "images"]:
                    if json_field in data:
                        val = data[json_field]
                        if isinstance(val, str):
                            try:
                                val = json.loads(val)
                            except Exception:
                                if json_field == "tags":
                                    val = [t.strip() for t in val.split(",") if t.strip()]
                                else:
                                    val = []
                        if json_field == "tags" and isinstance(val, list):
                            val = [t.strip() for t in val if str(t).strip() and str(t).strip().lower() not in ("extracted", "extracted_tag")]
                        updates.append(f"{json_field} = %s")
                        values.append(json.dumps(val))
                        
                if not updates:
                    return False
                    
                updates_str = ", ".join(updates)
                values.append(question_id)
                
                cur.execute(f'''
                    UPDATE question_bank 
                    SET {updates_str}
                    WHERE id = %s AND is_deleted = FALSE
                ''', tuple(values))
                conn.commit()
                return cur.rowcount > 0
        finally:
            conn.close()

    def delete_question(self, question_id: int) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute('''
                    UPDATE question_bank 
                    SET is_deleted = TRUE 
                    WHERE id = %s
                ''', (question_id,))
                conn.commit()
                return cur.rowcount > 0
        finally:
            conn.close()

    def list_questions(self, tags: Optional[List[str]] = None, q_type: Optional[str] = None, topic: Optional[str] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                query = "SELECT * FROM question_bank WHERE is_deleted = FALSE"
                params = []
                
                if q_type and q_type != "All":
                    query += " AND question_type = %s"
                    params.append(q_type)
                    
                if topic and topic != "All":
                    query += " AND topic = %s"
                    params.append(topic)
                    
                if tags:
                    clean_tags = [t.strip() for t in tags if t.strip()]
                    if clean_tags:
                        query += " AND tags ?| %s"
                        params.append(clean_tags)
                        
                if search and search.strip():
                    term = f"%{search.strip()}%"
                    query += " AND (question_text ILIKE %s OR topic ILIKE %s OR tags::text ILIKE %s)"
                    params.extend([term, term, term])
                    
                query += " ORDER BY created_at DESC"
                cur.execute(query, tuple(params))
                rows = cur.fetchall()
                return [_format_row(row) for row in rows]
        finally:
            conn.close()

    def get_question_by_id(self, question_id: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT * FROM question_bank 
                    WHERE id = %s AND is_deleted = FALSE
                ''', (question_id,))
                row = cur.fetchone()
                return _format_row(row)
        finally:
            conn.close()
