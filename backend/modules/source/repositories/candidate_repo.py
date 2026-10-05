import json
import logging
from typing import Optional, List, Dict, Any, Union

logger = logging.getLogger(__name__)
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class CandidateRepository:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id

    def _set_search_path(self, cur):
        cur.execute(f'SET search_path TO "{self.tenant_id}"')

    def create_candidate(self, data: Dict[str, Any], conn=None, cur=None) -> int:
        should_close = False
        if conn is None:
            conn = get_db_connection()
            cur = conn.cursor()
            should_close = True
        try:
            self._set_search_path(cur)
            
            # 1. Main Candidate Row
            cur.execute('''
                INSERT INTO candidates
                (full_name, first_name, middle_name, last_name, email, phone, location, total_experience_years,
                 current_designation, resume_path, resume_url, status, source, user_id, ai_summary, linkedin_url, portfolio_url, certifications, primary_skills, secondary_skills, folder_id, created_at, tags)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, COALESCE(%s, CURRENT_TIMESTAMP), %s)
                RETURNING id
            ''', (
                data.get("full_name"),
                data.get("first_name"),
                data.get("middle_name"),
                data.get("last_name"),
                data.get("email"),
                data.get("phone"),
                data.get("location"),
                data.get("total_experience_years", 0),
                data.get("current_designation"),
                data.get("resume_path"),
                data.get("resume_url"),
                data.get("status", "New"),
                data.get("source", "Manual"),
                data.get("user_id"),
                data.get("ai_summary"),
                data.get("linkedin_url"),
                data.get("portfolio_url"),
                json.dumps(data.get("certifications", [])),
                data.get("primary_skills", []),
                data.get("secondary_skills", []),
                data.get("folder_id"),
                data.get("created_at"),
                data.get("tags") or []
            ))
            candidate_id = cur.fetchone()[0]

            # 2. Experience
            for exp in data.get("experience", []):
                cur.execute('''
                    INSERT INTO candidate_experience 
                    (candidate_id, company, designation, start_date, end_date, is_current, description)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                ''', (
                    candidate_id,
                    exp.get("company"),
                    exp.get("designation"),
                    exp.get("start_date"),
                    exp.get("end_date"),
                    exp.get("is_current", False),
                    exp.get("description")
                ))

            # 3. Education
            for edu in data.get("education", []):
                cur.execute('''
                    INSERT INTO candidate_education 
                    (candidate_id, institution, degree, field_of_study, start_date, end_date)
                    VALUES (%s, %s, %s, %s, %s, %s)
                ''', (
                    candidate_id,
                    edu.get("institution"),
                    edu.get("degree"),
                    edu.get("field_of_study"),
                    edu.get("start_date"),
                    edu.get("end_date")
                ))

            if should_close:
                conn.commit()
            return candidate_id
        except Exception as e:
            if should_close:
                conn.rollback()
            raise e
        finally:
            if should_close:
                cur.close()
                conn.close()

    def get_candidate_by_email(self, email: str, conn=None, cur=None) -> Optional[Dict[str, Any]]:
        should_close = False
        if conn is None:
            conn = get_db_connection()
            should_close = True
            
        try:
            # Always use a RealDictCursor for this SELECT so dict(row) is safe,
            # regardless of what cursor type the caller is using on the shared conn.
            with conn.cursor(cursor_factory=RealDictCursor) as dict_cur:
                self._set_search_path(dict_cur)
                # Handle NULL or empty email
                if not email:
                    dict_cur.execute("SELECT * FROM candidates WHERE email IS NULL OR email = ''")
                else:
                    dict_cur.execute("SELECT * FROM candidates WHERE LOWER(email) = LOWER(%s)", (str(email).strip(),))
                row = dict_cur.fetchone()
                return dict(row) if row else None
        finally:
            if should_close:
                conn.close()

    def update_candidate(self, candidate_id: int, data: Dict[str, Any], conn=None, cur=None) -> bool:
        should_close = False
        if conn is None:
            conn = get_db_connection()
            cur = conn.cursor()
            should_close = True
        try:
            self._set_search_path(cur)
            
            # Update main table
            cur.execute('''
                UPDATE candidates
                SET full_name = %s, first_name = %s, middle_name = %s, last_name = %s, phone = %s, location = %s, total_experience_years = %s,
                    current_designation = %s,
                    ai_summary = %s, linkedin_url = %s, portfolio_url = %s,
                    certifications = %s, primary_skills = %s, secondary_skills = %s,
                    tags = COALESCE(%s, tags),
                    resume_path = COALESCE(%s, resume_path),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            ''', (
                data.get("full_name"),
                data.get("first_name"),
                data.get("middle_name"),
                data.get("last_name"),
                data.get("phone"),
                data.get("location"),
                data.get("total_experience_years", 0),
                data.get("current_designation"),
                data.get("ai_summary"),
                data.get("linkedin_url"),
                data.get("portfolio_url"),
                json.dumps(data.get("certifications", [])),
                data.get("primary_skills", []),
                data.get("secondary_skills", []),
                data.get("tags"),
                data.get("resume_path"),
                candidate_id
            ))

            # Clear old many-to-one data for refresh
            cur.execute("DELETE FROM candidate_experience WHERE candidate_id = %s", (candidate_id,))
            cur.execute("DELETE FROM candidate_education WHERE candidate_id = %s", (candidate_id,))

            # Re-insert fresh experience
            for exp in data.get("experience", []):
                cur.execute('''
                    INSERT INTO candidate_experience 
                    (candidate_id, company, designation, start_date, end_date, is_current, description)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                ''', (candidate_id, exp.get("company"), exp.get("designation"), exp.get("start_date"), exp.get("end_date"), exp.get("is_current", False), exp.get("description")))

            # Re-insert fresh education
            for edu in data.get("education", []):
                cur.execute('''
                    INSERT INTO candidate_education 
                    (candidate_id, institution, degree, field_of_study, start_date, end_date)
                    VALUES (%s, %s, %s, %s, %s, %s)
                ''', (candidate_id, edu.get("institution"), edu.get("degree"), edu.get("field_of_study"), edu.get("start_date"), edu.get("end_date")))

            if should_close:
                conn.commit()
            return True
        except Exception as e:
            if should_close:
                conn.rollback()
            raise e
        finally:
            if should_close:
                cur.close()
                conn.close()

    def get_all_candidates(self, page: int = 1, page_size: int = 20) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                offset = (page - 1) * page_size
                cur.execute('''
                    SELECT * FROM candidates ORDER BY created_at DESC LIMIT %s OFFSET %s
                ''', (page_size, offset))
                rows = cur.fetchall()
                return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_candidates_count(self) -> int:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute('SELECT COUNT(*) FROM candidates')
                return cur.fetchone()[0]
        finally:
            conn.close()

    def get_candidate_by_id(self, candidate_id: int, role_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                if role_id:
                    cur.execute("""
                        SELECT c.*, ca.status as job_status 
                        FROM candidates c
                        LEFT JOIN candidate_applications ca ON c.id = ca.candidate_id AND ca.job_role_id = %s
                        WHERE c.id = %s
                    """, (role_id, candidate_id))
                else:
                    cur.execute("SELECT * FROM candidates WHERE id = %s", (candidate_id,))
                row = cur.fetchone()
                if not row:
                    return None
                
                result = dict(row)
                if role_id:
                    result['status'] = result.get('job_status') or result['status']
                
                # Fetch related data
                cur.execute("SELECT * FROM candidate_experience WHERE candidate_id = %s", (candidate_id,))
                result['experience'] = [dict(r) for r in cur.fetchall()]
                
                cur.execute("SELECT * FROM candidate_education WHERE candidate_id = %s", (candidate_id,))
                result['education'] = [dict(r) for r in cur.fetchall()]
                
                cur.execute("SELECT * FROM candidate_notes WHERE candidate_id = %s ORDER BY created_at DESC", (candidate_id,))
                result['notes'] = [dict(r) for r in cur.fetchall()]
                
                cur.execute("SELECT * FROM candidate_activity_log WHERE candidate_id = %s ORDER BY created_at DESC", (candidate_id,))
                result['activity_log'] = [dict(r) for r in cur.fetchall()]
                
                cur.execute("SELECT * FROM ai_scores WHERE entity_type = 'candidate' AND entity_id = %s ORDER BY computed_at DESC", (candidate_id,))
                result['ai_scores'] = [dict(r) for r in cur.fetchall()]

                # Fetch Verify assessments and Forge courses if user_id is linked
                user_id = result.get('user_id')
                if user_id:
                    cur.execute("""
                        SELECT ar.*, a.title as assessment_title, a.pass_score
                        FROM assessment_results ar
                        JOIN assessments a ON ar.assessment_id = a.id
                        WHERE ar.user_id = %s
                        ORDER BY ar.submitted_at DESC
                    """, (user_id,))
                    result['assessment_results'] = [dict(r) for r in cur.fetchall()]

                    cur.execute("""
                        SELECT ce.*, c.title as course_title, c.difficulty_level
                        FROM course_enrollments ce
                        JOIN courses c ON ce.course_id = c.id
                        WHERE ce.user_id = %s
                        ORDER BY ce.created_at DESC
                    """, (user_id,))
                    result['course_enrollments'] = [dict(r) for r in cur.fetchall()]
                else:
                    result['assessment_results'] = []
                    result['course_enrollments'] = []

                # Cast Decimal to float and datetime to ISO string recursively
                from decimal import Decimal
                from datetime import datetime

                def serialize_special(obj):
                    if isinstance(obj, dict):
                        return {k: serialize_special(v) for k, v in obj.items()}
                    elif isinstance(obj, list):
                        return [serialize_special(i) for i in obj]
                    elif isinstance(obj, Decimal):
                        return float(obj)
                    elif isinstance(obj, datetime):
                        return obj.isoformat()
                    return obj
                
                return serialize_special(result)
        finally:
            conn.close()

    def update_candidate_status(self, candidate_id: int, new_status: str, role_id: Optional[int] = None) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                if role_id:
                    cur.execute('''
                        INSERT INTO candidate_applications (candidate_id, job_role_id, status)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (candidate_id, job_role_id) 
                        DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
                    ''', (candidate_id, role_id, new_status))
                # Always update the candidates table status too
                cur.execute(
                    "UPDATE candidates SET status = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (new_status, candidate_id)
                )
                conn.commit()
                return True
        finally:
            conn.close()

    def create_candidate_application(self, candidate_id: int, role_id: int, status: str = "New"):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute('''
                    INSERT INTO candidate_applications (candidate_id, job_role_id, status)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (candidate_id, job_role_id) DO NOTHING
                ''', (candidate_id, role_id, status))
                conn.commit()
        finally:
            conn.close()

    def add_candidate_note(self, candidate_id: int, author_name: str, content: str) -> Dict[str, Any]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    INSERT INTO candidate_notes (candidate_id, author_name, content)
                    VALUES (%s, %s, %s)
                    RETURNING *
                ''', (candidate_id, author_name, content))
                row = cur.fetchone()
                conn.commit()
                return dict(row) if row else None
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    def get_candidate_skills(self, candidate_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT cs.*, st.name as skill_name, st.category as skill_category
                    FROM candidate_skills cs
                    JOIN skill_taxonomy st ON cs.skill_id = st.id
                    WHERE cs.candidate_id = %s
                ''', (candidate_id,))
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def upsert_candidate_skill(self, candidate_id: int, skill_id: int, data: Dict[str, Any]):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute('''
                    INSERT INTO candidate_skills (candidate_id, skill_id, level, source, years_of_use, evidence)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (candidate_id, skill_id) DO UPDATE SET
                    level = EXCLUDED.level,
                    source = EXCLUDED.source,
                    years_of_use = EXCLUDED.years_of_use,
                    evidence = EXCLUDED.evidence,
                    updated_at = CURRENT_TIMESTAMP
                ''', (
                    candidate_id, skill_id, 
                    data.get("level", "beginner"), 
                    data.get("source", "resume"),
                    data.get("years_of_use"),
                    data.get("evidence")
                ))
                conn.commit()
        finally:
            conn.close()

    def search_candidates(self, pool: Optional[str] = None, location: Optional[str] = None, min_exp: Optional[float] = None, exp_range: Optional[str] = None, search: Optional[str] = None, sort_by: str = "newest", limit: int = 20, role_id: Optional[int] = None, upload_time: Optional[Union[str, List[str]]] = None, folder_id: Optional[Union[int, str, List[Union[int, str]]]] = None, tag: Optional[str] = None, tags: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                
                conditions = []
                params = []

                if role_id:
                    # When searching by role_id, check the job-specific status or fallback to global
                    if pool and pool != "all":
                        conditions.append("COALESCE(ca.status, c.status) = %s")
                        params.append(pool.capitalize())
                else:
                    if pool and pool != "all":
                        conditions.append("c.status = %s")
                        params.append(pool.capitalize())

                if location:
                    conditions.append("c.location ILIKE %s")
                    params.append(f"%{location}%")

                if min_exp is not None:
                    conditions.append("c.total_experience_years >= %s")
                    params.append(min_exp)

                if exp_range:
                    if exp_range == "fresher":
                        conditions.append("c.total_experience_years < 1")
                    elif exp_range == "1-2":
                        conditions.append("c.total_experience_years >= 1 AND c.total_experience_years <= 2")
                    elif exp_range == "2-5":
                        conditions.append("c.total_experience_years > 2 AND c.total_experience_years <= 5")
                    elif exp_range == "5+":
                        conditions.append("c.total_experience_years > 5")
                        
                if upload_time:
                    if isinstance(upload_time, str):
                        upload_time = [upload_time]
                    valid_times = [ut for ut in upload_time if isinstance(ut, str) and len(ut.split('-')) == 2]
                    if valid_times:
                        conditions.append("TO_CHAR(c.created_at, 'YYYY-MM') = ANY(%s)")
                        params.append(valid_times)

                if tag:
                    tag_clean = tag.strip().lower()
                    if tag_clean in ("untagged", "general_pool", "general pool", "unassigned", "null", "none", "__untagged__"):
                        conditions.append("(c.tags IS NULL OR c.tags = '{}'::text[])")
                    else:
                        conditions.append("EXISTS (SELECT 1 FROM unnest(c.tags) _t WHERE LOWER(_t) = LOWER(%s))")
                        params.append(tag.strip())

                if tags:
                    tag_conds = []
                    for t in tags:
                        if not t:
                            continue
                        t_clean = t.strip().lower()
                        if t_clean in ("untagged", "general_pool", "general pool", "unassigned", "null", "none", "__untagged__"):
                            tag_conds.append("(c.tags IS NULL OR c.tags = '{}'::text[])")
                        else:
                            tag_conds.append("EXISTS (SELECT 1 FROM unnest(c.tags) _t WHERE LOWER(_t) = LOWER(%s))")
                            params.append(t.strip())
                    if tag_conds:
                        conditions.append("(" + " OR ".join(tag_conds) + ")")

                if folder_id is not None:
                    if isinstance(folder_id, (int, str)):
                        f_list = [folder_id]
                    else:
                        f_list = list(folder_id)
                    
                    sub_conds = []
                    valid_ids = []
                    for f in f_list:
                        if str(f).lower() in ("unassigned", "null", "none", "0"):
                            sub_conds.append("c.folder_id IS NULL")
                        else:
                            try:
                                valid_ids.append(int(f))
                            except (ValueError, TypeError):
                                pass
                    if valid_ids:
                        sub_conds.append("c.folder_id = ANY(%s)")
                        params.append(valid_ids)
                    if sub_conds:
                        conditions.append("(" + " OR ".join(sub_conds) + ")")

                if search:
                    conditions.append("(c.full_name ILIKE %s OR c.email ILIKE %s OR c.current_designation ILIKE %s)")
                    params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

                where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""
                
                if sort_by == "required_score" and role_id:
                    order_clause = """ORDER BY 
                        COALESCE(NULLIF(SUBSTRING(a.reasoning FROM '"required_score":\\s*([0-9.]+)'), '')::numeric, a.score, 0) DESC NULLS LAST,
                        c.created_at DESC"""
                elif sort_by == "preferred_score" and role_id:
                    order_clause = """ORDER BY 
                        COALESCE(NULLIF(SUBSTRING(a.reasoning FROM '"preferred_score":\\s*([0-9.]+)'), '')::numeric, a.score, 0) DESC NULLS LAST,
                        c.created_at DESC"""
                elif sort_by == "fit_score" and role_id:
                    order_clause = "ORDER BY a.score DESC NULLS LAST, c.created_at DESC"
                elif sort_by == "newest":
                    order_clause = "ORDER BY c.created_at DESC"
                else:
                    order_clause = "ORDER BY c.total_experience_years DESC"

                params.append(limit)

                joins_rf = " LEFT JOIN resume_folders rf ON c.folder_id = rf.id"
                if role_id:
                    joins = f"LEFT JOIN candidate_applications ca ON c.id = ca.candidate_id AND ca.job_role_id = %s LEFT JOIN ai_scores a ON c.id = a.entity_id AND a.entity_type = 'candidate' AND a.job_role_id = %s AND a.score_type = 'role_fit'{joins_rf}"
                    select_fields = "c.*, ca.status as job_status, a.score as fit_score, a.reasoning as ats_detail_json, rf.name as folder_name, rf.job_role_id as folder_job_role_id"
                    
                    count_sql = f"""
                        SELECT COUNT(*) as total
                        FROM candidates c
                        {joins}
                        {where_clause}
                    """
                    count_params = [role_id, role_id] + params[:-1]

                    cur.execute(count_sql, tuple(count_params))
                    total_count = cur.fetchone()['total']

                    sql = f"""
                        SELECT {select_fields}
                        FROM candidates c
                        {joins}
                        {where_clause}
                        {order_clause}
                        LIMIT %s
                    """
                    params.insert(0, role_id) # for ai_scores join
                    params.insert(0, role_id) # for candidate_applications join
                else:
                    count_sql = f"""
                        SELECT COUNT(*) as total
                        FROM candidates c
                        {where_clause}
                    """
                    count_params = params[:-1]
                    cur.execute(count_sql, tuple(count_params))
                    total_count = cur.fetchone()['total']

                    sql = f"""
                        SELECT c.*, c.status as job_status, rf.name as folder_name, rf.job_role_id as folder_job_role_id
                        FROM candidates c
                        {joins_rf}
                        {where_clause}
                        {order_clause}
                        LIMIT %s
                    """
                cur.execute(sql, tuple(params))
                
                # Normalize job_status to status so frontend works seamlessly
                results = []
                for r in cur.fetchall():
                    row = dict(r)
                    row['status'] = row.get('job_status') or row['status']
                    row['name'] = row.get('full_name') or ''
                    results.append(row)
                return results, total_count
        finally:
            conn.close()

    def get_active_candidates(self) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute(
                    """SELECT 
                           c.*, 
                           u.last_login,
                           ci.job_role_id,
                           j.title as job_title,
                           fit.score as ai_fit_score,
                           conf.reasoning as confidence_signals
                       FROM candidates c
                       LEFT JOIN users u ON c.user_id = u.id
                       LEFT JOIN candidate_invites ci ON ci.candidate_id = c.id
                       LEFT JOIN job_roles j ON j.id = ci.job_role_id
                       LEFT JOIN ai_scores fit ON fit.entity_id = c.id AND fit.entity_type = 'candidate' AND fit.score_type = 'role_fit' AND fit.job_role_id = ci.job_role_id
                       LEFT JOIN ai_scores conf ON conf.entity_id = c.id AND conf.entity_type = 'candidate' AND conf.score_type = 'confidence_signals'
                       WHERE c.status = 'Invited'
                       ORDER BY c.created_at DESC"""
                )
                rows = []
                import json
                for r in cur.fetchall():
                    row = dict(r)
                    has_flags = False
                    signals_data = []
                    if row.get("confidence_signals"):
                        try:
                            signals = json.loads(row["confidence_signals"])
                            if isinstance(signals, list):
                                has_flags = any(s.get("flag", False) for s in signals)
                                signals_data = signals
                        except:
                            pass
                    row["insights"] = {
                        "final_score": float(row.get("ai_fit_score") or 0),
                        "has_malpractice": has_flags,
                        "signals": signals_data,
                        "job_title": row.get("job_title")
                    }
                    rows.append(row)
                return rows
        finally:
            conn.close()

    def get_candidate_latest_offer(self, candidate_id: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute(
                    "SELECT * FROM offer_letters WHERE candidate_id = %s ORDER BY created_at DESC LIMIT 1",
                    (candidate_id,)
                )
                row = cur.fetchone()
                return dict(row) if row else None
        finally:
            conn.close()

    def create_bulk_upload_job(self, user_id: int, total_files: int, override_date: Optional[str] = None, folder_id: Optional[int] = None, tags: Optional[List[str]] = None) -> int:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    """INSERT INTO bulk_upload_jobs (created_by, total_files, status, override_date, folder_id, tags)
                       VALUES (%s, %s, 'processing', %s, %s, %s) RETURNING id""",
                    (user_id, total_files, override_date, folder_id, tags or [])
                )
                job_id = cur.fetchone()[0]
                conn.commit()
                return job_id
        finally:
            conn.close()

    def update_bulk_upload_job(self, job_id: int, processed: int, details: str, status: str):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    """UPDATE bulk_upload_jobs
                       SET status = %s, processed_files = %s,
                           processed_details = %s, updated_at = CURRENT_TIMESTAMP
                       WHERE id = %s""",
                    (status, processed, details, job_id)
                )
                conn.commit()
        finally:
            conn.close()

    def create_bulk_upload_job_items(self, job_id: int, items: List[Dict[str, Any]]):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                from psycopg2.extras import execute_values
                query = """
                    INSERT INTO bulk_upload_job_items (job_id, filename, file_path, file_hash, extracted_text, candidate_id)
                    VALUES %s
                """
                values = [
                    (job_id, i["filename"], i["file_path"], i.get("file_hash"), i.get("extracted_text"), i.get("candidate_id"))
                    for i in items
                ]
                execute_values(cur, query, values)
                conn.commit()
        finally:
            conn.close()

    def get_candidates_for_reprocessing(
        self,
        folder_id: Optional[int] = None,
        month_year: Optional[str] = None,
        candidate_ids: Optional[List[int]] = None,
        reprocess_all: bool = False
    ) -> List[Dict[str, Any]]:
        """Fetch candidates matching criteria for skill re-extraction and ATS reprocessing."""
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                where_clauses = ["(c.resume_path IS NOT NULL OR c.id IN (SELECT candidate_id FROM bulk_upload_job_items WHERE extracted_text IS NOT NULL AND extracted_text != ''))"]
                params = []

                if candidate_ids and len(candidate_ids) > 0:
                    where_clauses.append("c.id = ANY(%s)")
                    params.append(candidate_ids)
                elif folder_id is not None:
                    where_clauses.append("c.folder_id = %s")
                    params.append(folder_id)
                elif month_year:
                    where_clauses.append("TO_CHAR(c.created_at, 'YYYY-MM') = %s")
                    params.append(month_year)
                elif not reprocess_all:
                    return []

                query = f"""
                    SELECT c.id, c.full_name, c.email, c.resume_path, c.folder_id,
                           COALESCE(
                             (
                               SELECT bi.extracted_text 
                               FROM bulk_upload_job_items bi 
                               WHERE bi.candidate_id = c.id AND bi.extracted_text IS NOT NULL AND bi.extracted_text != ''
                               ORDER BY bi.id DESC LIMIT 1
                             ),
                             ''
                           ) AS extracted_text
                    FROM candidates c
                    WHERE {' AND '.join(where_clauses)}
                    ORDER BY c.id ASC
                """
                cur.execute(query, tuple(params))
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def update_bulk_upload_job_item(self, item_id: int, status: str, candidate_id: Optional[int] = None, error_message: Optional[str] = None, conn=None, cur=None):
        should_close = False
        if conn is None:
            conn = get_db_connection()
            cur = conn.cursor()
            should_close = True
        try:
            self._set_search_path(cur)
            cur.execute(
                """UPDATE bulk_upload_job_items
                   SET status = %s, candidate_id = %s, error_message = %s, updated_at = CURRENT_TIMESTAMP
                   WHERE id = %s""",
                (status, candidate_id, error_message, item_id)
            )
            if should_close:
                conn.commit()
        except Exception as e:
            if should_close:
                conn.rollback()
            raise e
        finally:
            if should_close:
                cur.close()
                conn.close()

    def reset_stuck_processing_items(self, older_than_seconds: int = 0):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                if older_than_seconds > 0:
                    cur.execute(
                        """UPDATE bulk_upload_job_items
                           SET status = 'pending', updated_at = CURRENT_TIMESTAMP
                           WHERE status = 'processing' 
                             AND COALESCE(updated_at, created_at) < CURRENT_TIMESTAMP - (%s || ' seconds')::interval""",
                        (older_than_seconds,)
                    )
                else:
                    cur.execute(
                        """UPDATE bulk_upload_job_items
                           SET status = 'pending', updated_at = CURRENT_TIMESTAMP
                           WHERE status = 'processing'"""
                    )
                conn.commit()
        finally:
            conn.close()

    def reset_stuck_extracting_jobs(self):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    """UPDATE bulk_upload_jobs
                       SET status = 'failed', error_message = 'Server restarted during extraction. Please upload the zip file again.', updated_at = CURRENT_TIMESTAMP
                       WHERE status = 'extracting'"""
                )
                conn.commit()
        finally:
            conn.close()

    def get_pending_bulk_upload_job_items(self, limit: int = 1) -> List[Dict[str, Any]]:
        """Fetch one pending item at a time and mark as processing. Called by each parallel worker."""
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute(
                    """SELECT i.*, j.override_date, j.folder_id, j.tags, j.created_by FROM bulk_upload_job_items i
                       JOIN bulk_upload_jobs j ON i.job_id = j.id
                       WHERE i.status = 'pending' AND j.status IN ('processing', 'pending', 'extracting')
                       ORDER BY i.created_at ASC
                       LIMIT %s FOR UPDATE OF i SKIP LOCKED""",
                    (limit,)
                )
                rows = cur.fetchall()
                if rows:
                    item_ids = [r["id"] for r in rows]
                    cur.execute(
                        "UPDATE bulk_upload_job_items SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ANY(%s)",
                        (item_ids,)
                    )
                    conn.commit()
                return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_active_bulk_upload_job(self) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                # Find the most recent job that hasn't completed, failed, or been cancelled
                cur.execute(
                    """SELECT * 
                       FROM bulk_upload_jobs 
                       WHERE status IN ('extracting', 'processing', 'paused')
                       ORDER BY created_at DESC
                       LIMIT 1"""
                )
                row = cur.fetchone()
                if not row:
                    return None

                job = dict(row)

                # Helper to safely extract single count value from tuple or dict row
                def _extract_count(r):
                    if not r:
                        return 0
                    if isinstance(r, dict):
                        if 'cnt' in r:
                            return int(r['cnt'] or 0)
                        if 'count' in r:
                            return int(r['count'] or 0)
                        return int(list(r.values())[0] or 0)
                    return int(r[0] or 0)

                # Self-healing: if a 'processing' job has items stuck in 'processing' for >60s, reset them to 'pending'
                if job['status'] == 'processing':
                    cur.execute(
                        """UPDATE bulk_upload_job_items
                           SET status = 'pending', updated_at = CURRENT_TIMESTAMP
                           WHERE job_id = %s AND status = 'processing' 
                             AND COALESCE(updated_at, created_at) < CURRENT_TIMESTAMP - INTERVAL '60 seconds'""",
                        (job['id'],)
                    )
                    conn.commit()

                    cur.execute(
                        "SELECT COUNT(*) AS cnt FROM bulk_upload_job_items WHERE job_id = %s AND status IN ('pending', 'processing')",
                        (job['id'],)
                    )
                    remaining = _extract_count(cur.fetchone())
                    if remaining == 0:
                        # Make sure the job actually had items (avoid completing an empty extraction race)
                        cur.execute(
                            "SELECT COUNT(*) AS cnt FROM bulk_upload_job_items WHERE job_id = %s",
                            (job['id'],)
                        )
                        total_items = _extract_count(cur.fetchone())
                        if total_items > 0:
                            cur.execute(
                                "UPDATE bulk_upload_jobs SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                                (job['id'],)
                            )
                            conn.commit()
                            logger.info(f"[SelfHeal] Auto-completed stale job {job['id']} ({total_items} items, 0 remaining)")
                            return None
                        else:
                            created_at = job.get('created_at')
                            if created_at:
                                from datetime import datetime, timezone
                                now = datetime.now(timezone.utc) if getattr(created_at, 'tzinfo', None) else datetime.now()
                                age_minutes = (now - created_at).total_seconds() / 60
                                if age_minutes > 5:
                                    cur.execute(
                                        "UPDATE bulk_upload_jobs SET status = 'failed', error_message = 'Job ended with no files.', updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                                        (job['id'],)
                                    )
                                    conn.commit()
                                    return None

                # Staleness timeout: extracting jobs stuck with 0 items for >30 minutes
                if job['status'] == 'extracting':
                    cur.execute(
                        "SELECT COUNT(*) AS cnt FROM bulk_upload_job_items WHERE job_id = %s",
                        (job['id'],)
                    )
                    item_count = _extract_count(cur.fetchone())
                    created_at = job.get('created_at')
                    if item_count == 0 and created_at:
                        from datetime import datetime, timezone
                        now = datetime.now(timezone.utc) if getattr(created_at, 'tzinfo', None) else datetime.now()
                        age_minutes = (now - created_at).total_seconds() / 60
                        if age_minutes > 30:
                            cur.execute(
                                """UPDATE bulk_upload_jobs 
                                   SET status = 'failed', 
                                       error_message = 'Extraction timed out after 30 minutes with no files processed.',
                                       updated_at = CURRENT_TIMESTAMP 
                                   WHERE id = %s""",
                                (job['id'],)
                            )
                            conn.commit()
                            logger.info(f"[SelfHeal] Timed out stuck extracting job {job['id']} (age={age_minutes:.0f}m)")
                            return None

                return job
        finally:
            conn.close()

    def complete_job_if_done(self, job_id: int, conn=None, cur=None) -> bool:
        """Check if all items for a job are in terminal states. If so, mark job as 'completed'.
        Returns True if the job was completed. Can use an existing connection/cursor for transactional use."""
        should_close = False
        if conn is None:
            conn = get_db_connection()
            cur = conn.cursor()
            should_close = True
        try:
            self._set_search_path(cur)
            def _extract_count(r):
                if not r:
                    return 0
                if isinstance(r, dict):
                    if 'cnt' in r:
                        return int(r['cnt'] or 0)
                    if 'count' in r:
                        return int(r['count'] or 0)
                    return int(list(r.values())[0] or 0)
                return int(r[0] or 0)

            cur.execute(
                "SELECT COUNT(*) AS cnt FROM bulk_upload_job_items WHERE job_id = %s AND status IN ('pending', 'processing')",
                (job_id,)
            )
            remaining = _extract_count(cur.fetchone())
            if remaining == 0:
                cur.execute(
                    "SELECT COUNT(*) AS cnt FROM bulk_upload_job_items WHERE job_id = %s",
                    (job_id,)
                )
                total_items = _extract_count(cur.fetchone())
                if total_items > 0:
                    cur.execute(
                        "UPDATE bulk_upload_jobs SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = %s AND status IN ('processing', 'extracting')",
                        (job_id,)
                    )
                    if should_close:
                        conn.commit()
                    logger.info(f"[BulkWorker] Job {job_id} completed ({total_items} items processed)")
                    return True
            return False
        except Exception as e:
            if should_close:
                conn.rollback()
            raise e
        finally:
            if should_close:
                cur.close()
                conn.close()

    def cleanup_stale_processing_jobs(self):
        """On startup, complete any 'processing' jobs that have no pending/processing items remaining.
        These are jobs that finished processing but never transitioned to 'completed'."""
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                def _extract_count(r):
                    if not r:
                        return 0
                    if isinstance(r, dict):
                        if 'cnt' in r:
                            return int(r['cnt'] or 0)
                        if 'count' in r:
                            return int(r['count'] or 0)
                        return int(list(r.values())[0] or 0)
                    return int(r[0] or 0)

                cur.execute(
                    "SELECT id FROM bulk_upload_jobs WHERE status IN ('processing', 'extracting')"
                )
                active_jobs = cur.fetchall()
                completed_count = 0
                for job in active_jobs:
                    job_id = job['id'] if isinstance(job, dict) else job[0]
                    cur.execute(
                        "SELECT COUNT(*) AS cnt FROM bulk_upload_job_items WHERE job_id = %s AND status IN ('pending', 'processing')",
                        (job_id,)
                    )
                    remaining = _extract_count(cur.fetchone())
                    cur.execute(
                        "SELECT COUNT(*) AS cnt FROM bulk_upload_job_items WHERE job_id = %s",
                        (job_id,)
                    )
                    total = _extract_count(cur.fetchone())
                    if remaining == 0 and total > 0:
                        cur.execute(
                            "UPDATE bulk_upload_jobs SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                            (job_id,)
                        )
                        completed_count += 1
                conn.commit()
                if completed_count > 0:
                    logger.info(f"[Startup] Auto-completed {completed_count} stale processing job(s)")
        finally:
            conn.close()

    def pause_bulk_upload_job(self, job_id: int):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    "UPDATE bulk_upload_jobs SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (job_id,)
                )
                cur.execute(
                    "UPDATE bulk_upload_job_items SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE job_id = %s AND status = 'processing'",
                    (job_id,)
                )
                conn.commit()
                return True
        finally:
            conn.close()

    def resume_bulk_upload_job(self, job_id: int):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    "UPDATE bulk_upload_jobs SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (job_id,)
                )
                cur.execute(
                    "UPDATE bulk_upload_job_items SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE job_id = %s AND status = 'processing'",
                    (job_id,)
                )
                conn.commit()
                return True
        finally:
            conn.close()

    def get_bulk_upload_job_progress(self, job_id: int) -> Dict[str, Any]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                # Ensure we also aggregate any failed reasons
                cur.execute(
                    """SELECT status, COUNT(*) as count 
                       FROM bulk_upload_job_items 
                       WHERE job_id = %s 
                       GROUP BY status""",
                    (job_id,)
                )
                rows = cur.fetchall()
                
                cur.execute("SELECT * FROM bulk_upload_jobs WHERE id = %s", (job_id,))
                job = cur.fetchone()
                
                return {
                    "job": dict(job) if job else None,
                    "items_stats": [dict(r) for r in rows]
                }
        finally:
            conn.close()

    def retry_failed_bulk_upload_items(self, job_id: int) -> bool:
        """Mark all failed items for a job as pending so the workers pick them up again."""
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                # Reset items
                cur.execute(
                    """UPDATE bulk_upload_job_items
                       SET status = 'pending', error_message = NULL, updated_at = CURRENT_TIMESTAMP
                       WHERE job_id = %s AND status = 'failed'""",
                    (job_id,)
                )
                if cur.rowcount > 0:
                    # Reset job state back to processing
                    cur.execute(
                        """UPDATE bulk_upload_jobs
                           SET status = 'processing', updated_at = CURRENT_TIMESTAMP
                           WHERE id = %s""",
                        (job_id,)
                    )
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Failed to retry items for job {job_id}: {e}")
            return False
        finally:
            conn.close()

    def cancel_bulk_upload_job(self, job_id: int):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                # Mark all pending and processing items as cancelled immediately
                cur.execute("""
                    UPDATE bulk_upload_job_items 
                    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
                    WHERE job_id = %s AND status IN ('pending', 'processing')
                """, (job_id,))
                # Mark job as cancelled
                cur.execute("""
                    UPDATE bulk_upload_jobs 
                    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
                    WHERE id = %s
                """, (job_id,))
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    def check_file_hash_exists(self, file_hash: str) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute("SELECT 1 FROM bulk_upload_job_items WHERE file_hash = %s AND status = 'success' AND candidate_id IS NOT NULL LIMIT 1", (file_hash,))
                return cur.fetchone() is not None
        finally:
            conn.close()

    def create_offer(self, candidate_id: int, details: Dict[str, Any], content: Dict[str, Any]) -> int:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                start_date = details.get("start_date")
                if start_date:
                    from datetime import datetime
                    try:
                        start_date = datetime.fromisoformat(start_date)
                    except:
                        pass
                cur.execute(
                    """INSERT INTO offer_letters 
                       (candidate_id, role_title, salary, department, location, start_date, offer_content, status)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending') RETURNING id""",
                    (candidate_id, details.get("role_title"), details.get("salary"), details.get("department"), 
                     details.get("location"), start_date, json.dumps(content))
                )
                offer_id = cur.fetchone()[0]
                conn.commit()
                return offer_id
        finally:
            conn.close()

    def revert_employee(self, employee_id: int) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute(
                    "UPDATE candidates SET status = 'New', updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (employee_id,)
                )
                conn.commit()
                return cur.rowcount > 0
        finally:
            conn.close()

    def log_activity(self, candidate_id: int, actor_name: str, action: str, detail: str = None, conn=None, cur=None):
        should_close = False
        if conn is None:
            conn = get_db_connection()
            cur = conn.cursor()
            should_close = True
        try:
            self._set_search_path(cur)
            cur.execute('''
                INSERT INTO candidate_activity_log (candidate_id, actor_name, action, detail)
                VALUES (%s, %s, %s, %s)
            ''', (candidate_id, actor_name, action, detail))
            if should_close:
                conn.commit()
        except Exception as e:
            if should_close:
                conn.rollback()
            raise e
        finally:
            if should_close:
                cur.close()
                conn.close()

    def get_activity_log(self, candidate_id: int) -> List[Dict]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT * FROM candidate_activity_log WHERE candidate_id = %s ORDER BY created_at DESC
                ''', (candidate_id,))
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def delete_candidate(self, candidate_id: int) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                # Remove reference from bulk_upload_job_items to prevent FK violations
                cur.execute("UPDATE bulk_upload_job_items SET candidate_id = NULL WHERE candidate_id = %s", (candidate_id,))
                
                # Dependencies (experience, education, notes, skills) should cascade delete 
                # based on the FK constraint ON DELETE CASCADE in schema.
                cur.execute("DELETE FROM candidates WHERE id = %s", (candidate_id,))
                conn.commit()
                return cur.rowcount > 0
        finally:
            conn.close()

    def bulk_delete_candidates(self, candidate_ids: List[int]) -> int:
        if not candidate_ids:
            return 0
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                # Remove reference from bulk_upload_job_items to prevent FK violations
                cur.execute("UPDATE bulk_upload_job_items SET candidate_id = NULL WHERE candidate_id = ANY(%s)", (candidate_ids,))
                
                # Delete candidates
                cur.execute("DELETE FROM candidates WHERE id = ANY(%s)", (candidate_ids,))
                conn.commit()
                return cur.rowcount
        finally:
            conn.close()

    def get_global_activity(self, limit: int = 10) -> List[Dict]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT a.id, a.candidate_id, c.full_name as candidate_name, 
                           a.actor_name, a.action, a.detail, a.created_at
                    FROM candidate_activity_log a
                    JOIN candidates c ON a.candidate_id = c.id
                    ORDER BY a.created_at DESC
                    LIMIT %s
                ''', (limit,))
                rows = cur.fetchall()
                results = []
                for r in rows:
                    d = dict(r)
                    if d.get("created_at"):
                        d["created_at"] = d["created_at"].isoformat()
                    results.append(d)
                return results
        finally:
            conn.close()

    def get_repository_folders(self, conn=None, cur=None) -> List[Dict[str, Any]]:
        should_close = False
        if conn is None:
            conn = get_db_connection()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            should_close = True
        elif not isinstance(cur, RealDictCursor):
            cur = conn.cursor(cursor_factory=RealDictCursor)
            should_close = True
            
        try:
            self._set_search_path(cur)
            
            # 1. Fetch all distinct YYYY-MM from candidates where created_at IS NOT NULL
            cur.execute('''
                SELECT DISTINCT TO_CHAR(created_at, 'YYYY-MM') AS ym 
                FROM candidates 
                WHERE created_at IS NOT NULL AND TO_CHAR(created_at, 'YYYY-MM') ~ '^\d{4}-\d{2}$'
                ORDER BY ym DESC
            ''')
            month_rows = cur.fetchall()
            
            # 2. Total count and untagged count per month
            cur.execute('''
                SELECT 
                    TO_CHAR(created_at, 'YYYY-MM') AS ym,
                    COUNT(id) AS total_count,
                    COUNT(id) FILTER (WHERE tags IS NULL OR tags = '{}'::text[]) AS untagged_count
                FROM candidates
                WHERE created_at IS NOT NULL
                GROUP BY TO_CHAR(created_at, 'YYYY-MM')
            ''')
            cand_count_rows = cur.fetchall()
            month_counts = {r['ym']: {"total": r['total_count'], "untagged": r['untagged_count']} for r in cand_count_rows}

            # 3. Aggregated tags per month
            cur.execute('''
                SELECT 
                    TO_CHAR(c.created_at, 'YYYY-MM') AS ym,
                    t AS tag_name,
                    COUNT(*) AS tag_count
                FROM candidates c, unnest(c.tags) AS t
                WHERE c.created_at IS NOT NULL AND t IS NOT NULL AND TRIM(t) <> ''
                GROUP BY TO_CHAR(c.created_at, 'YYYY-MM'), t
                ORDER BY tag_count DESC, tag_name ASC
            ''')
            tag_rows = cur.fetchall()
            tags_by_month = {}
            for tr in tag_rows:
                ym = tr['ym']
                if ym not in tags_by_month:
                    tags_by_month[ym] = []
                tags_by_month[ym].append({
                    "name": tr['tag_name'],
                    "count": tr['tag_count']
                })
            
            import calendar
            folders = []
            for row in month_rows:
                ym = row['ym']
                try:
                    y_str, m_str = ym.split('-')
                    y = int(y_str)
                    m = int(m_str)
                except Exception:
                    continue
                month_name = calendar.month_name[m] if 1 <= m <= 12 else str(m)
                
                counts = month_counts.get(ym, {"total": 0, "untagged": 0})
                month_tags = tags_by_month.get(ym, [])
                
                folders.append({
                    "id": ym,
                    "year": y,
                    "month_num": m,
                    "label": f"{month_name} {y}",
                    "count": counts["total"],
                    "untagged_count": counts["untagged"],
                    "tags": month_tags,
                    "subfolders": []
                })
                
            return folders
        finally:
            if should_close:
                cur.close()
                conn.close()

    def create_subfolder(self, name: str, month_year: str, job_role_id: Optional[int] = None) -> Dict[str, Any]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                # Check if already exists in this month
                cur.execute(
                    "SELECT id, name, month_year, job_role_id FROM resume_folders WHERE month_year = %s AND LOWER(name) = LOWER(%s)",
                    (month_year, name.strip())
                )
                existing = cur.fetchone()
                if existing:
                    if job_role_id and not existing.get('job_role_id'):
                        cur.execute("UPDATE resume_folders SET job_role_id = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s", (job_role_id, existing['id']))
                        conn.commit()
                        existing['job_role_id'] = job_role_id
                    return dict(existing)
                
                cur.execute(
                    """INSERT INTO resume_folders (name, month_year, job_role_id)
                       VALUES (%s, %s, %s)
                       RETURNING id, name, month_year, job_role_id, created_at""",
                    (name.strip(), month_year, job_role_id)
                )
                row = cur.fetchone()
                conn.commit()
                res = dict(row)
                if res.get("created_at"):
                    res["created_at"] = res["created_at"].isoformat()
                return res
        finally:
            conn.close()

    def get_subfolders_for_month(self, month_year: str) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT 
                        rf.id, rf.name, rf.month_year, rf.job_role_id,
                        jr.title as job_role_title,
                        rf.created_at,
                        COUNT(c.id) as count
                    FROM resume_folders rf
                    LEFT JOIN job_roles jr ON rf.job_role_id = jr.id
                    LEFT JOIN candidates c ON c.folder_id = rf.id
                    WHERE rf.month_year = %s
                    GROUP BY rf.id, rf.name, rf.month_year, rf.job_role_id, jr.title, rf.created_at
                    ORDER BY rf.name ASC
                ''', (month_year,))
                rows = cur.fetchall()
                results = []
                for r in rows:
                    d = dict(r)
                    if d.get("created_at"):
                        d["created_at"] = d["created_at"].isoformat()
                    results.append(d)
                return results
        finally:
            conn.close()

    def get_all_subfolders(self) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT 
                        rf.id, rf.name, rf.month_year, rf.job_role_id,
                        jr.title as job_role_title,
                        rf.created_at,
                        COUNT(c.id) as count
                    FROM resume_folders rf
                    LEFT JOIN job_roles jr ON rf.job_role_id = jr.id
                    LEFT JOIN candidates c ON c.folder_id = rf.id
                    GROUP BY rf.id, rf.name, rf.month_year, rf.job_role_id, jr.title, rf.created_at
                    ORDER BY rf.month_year DESC, rf.name ASC
                ''')
                rows = cur.fetchall()
                results = []
                for r in rows:
                    d = dict(r)
                    if d.get("created_at"):
                        d["created_at"] = d["created_at"].isoformat()
                    results.append(d)
                return results
        finally:
            conn.close()

    def get_subfolder_by_id(self, folder_id: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT 
                        rf.id, rf.name, rf.month_year, rf.job_role_id,
                        jr.title as job_role_title,
                        rf.created_at,
                        COUNT(c.id) as count
                    FROM resume_folders rf
                    LEFT JOIN job_roles jr ON rf.job_role_id = jr.id
                    LEFT JOIN candidates c ON c.folder_id = rf.id
                    WHERE rf.id = %s
                    GROUP BY rf.id, rf.name, rf.month_year, rf.job_role_id, jr.title, rf.created_at
                ''', (folder_id,))
                row = cur.fetchone()
                if not row:
                    return None
                d = dict(row)
                if d.get("created_at"):
                    d["created_at"] = d["created_at"].isoformat()
                return d
        finally:
            conn.close()

    def delete_subfolder(self, folder_id: int) -> bool:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute("UPDATE candidates SET folder_id = NULL WHERE folder_id = %s", (folder_id,))
                cur.execute("UPDATE job_roles SET folder_id = NULL WHERE folder_id = %s", (folder_id,))
                cur.execute("DELETE FROM resume_folders WHERE id = %s", (folder_id,))
                deleted = cur.rowcount > 0
                conn.commit()
                return deleted
        finally:
            conn.close()

    def move_candidates(self, candidate_ids: List[int], target_month: Optional[str] = None, target_folder_id: Optional[int] = None) -> int:
        if not candidate_ids:
            return 0
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                target_folder_name = "Unassigned"
                resolved_month = target_month
                if target_folder_id:
                    cur.execute("SELECT id, name, month_year FROM resume_folders WHERE id = %s", (target_folder_id,))
                    rf_row = cur.fetchone()
                    if rf_row:
                        target_folder_name = rf_row[1]
                        if not resolved_month:
                            resolved_month = rf_row[2]

                updates = ["folder_id = %s"]
                params = [target_folder_id]

                if resolved_month and len(resolved_month) == 7 and '-' in resolved_month:
                    y, m = resolved_month.split('-')
                    updates.append("created_at = %s::timestamp")
                    params.append(f"{y}-{m}-01 12:00:00")

                params.append(candidate_ids)
                cur.execute(f"UPDATE candidates SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP WHERE id = ANY(%s)", tuple(params))
                updated = cur.rowcount
                conn.commit()

                for cid in candidate_ids:
                    try:
                        self.log_activity(cid, 'User', 'folder_moved', f"Moved to {target_folder_name}" + (f" ({resolved_month})" if resolved_month else ""))
                    except Exception:
                        pass
                return updated
        finally:
            conn.close()

    def get_candidates_by_folder(self, folder_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT c.*, rf.name as folder_name, rf.month_year as folder_month_year
                    FROM candidates c
                    JOIN resume_folders rf ON c.folder_id = rf.id
                    WHERE c.folder_id = %s AND c.status NOT IN ('Archived', 'Rejected')
                    ORDER BY c.created_at DESC
                ''', (folder_id,))
                rows = cur.fetchall()
                return [dict(r) for r in rows]
        finally:
            conn.close()

    def add_candidate_tags(self, candidate_ids: List[int], tags: List[str]) -> int:
        if not candidate_ids or not tags:
            return 0
        clean_tags = [t.strip() for t in tags if t and t.strip()]
        if not clean_tags:
            return 0
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute('''
                    UPDATE candidates
                    SET tags = ARRAY(
                        SELECT DISTINCT elem
                        FROM unnest(COALESCE(tags, '{}'::text[]) || %s::text[]) AS elem
                        WHERE elem IS NOT NULL AND TRIM(elem) <> ''
                    ), updated_at = CURRENT_TIMESTAMP
                    WHERE id = ANY(%s)
                ''', (clean_tags, candidate_ids))
                updated = cur.rowcount
                conn.commit()
                for cid in candidate_ids:
                    try:
                        self.log_activity(cid, 'User', 'tags_added', f"Added tags: {', '.join(clean_tags)}")
                    except Exception:
                        pass
                return updated
        finally:
            conn.close()

    def remove_candidate_tags(self, candidate_ids: List[int], tags: List[str]) -> int:
        if not candidate_ids or not tags:
            return 0
        clean_tags = [t.strip() for t in tags if t and t.strip()]
        if not clean_tags:
            return 0
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute('''
                    UPDATE candidates
                    SET tags = ARRAY(
                        SELECT elem
                        FROM unnest(COALESCE(tags, '{}'::text[])) AS elem
                        WHERE LOWER(TRIM(elem)) <> ALL(ARRAY(SELECT LOWER(TRIM(x)) FROM unnest(%s::text[]) x))
                    ), updated_at = CURRENT_TIMESTAMP
                    WHERE id = ANY(%s)
                ''', (clean_tags, candidate_ids))
                updated = cur.rowcount
                conn.commit()
                for cid in candidate_ids:
                    try:
                        self.log_activity(cid, 'User', 'tags_removed', f"Removed tags: {', '.join(clean_tags)}")
                    except Exception:
                        pass
                return updated
        finally:
            conn.close()

    def set_candidate_tags(self, candidate_id: int, tags: List[str]) -> List[str]:
        clean_tags = []
        seen = set()
        for t in tags:
            if t and t.strip():
                val = t.strip()
                if val.lower() not in seen:
                    seen.add(val.lower())
                    clean_tags.append(val)
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self._set_search_path(cur)
                cur.execute('''
                    UPDATE candidates
                    SET tags = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING tags
                ''', (clean_tags, candidate_id))
                row = cur.fetchone()
                conn.commit()
                try:
                    self.log_activity(candidate_id, 'User', 'tags_updated', f"Updated tags: {', '.join(clean_tags) if clean_tags else 'None'}")
                except Exception:
                    pass
                return row[0] if row and row[0] else []
        finally:
            conn.close()

    def get_all_tags(self) -> Dict[str, Any]:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                self._set_search_path(cur)
                cur.execute('''
                    SELECT t AS name, t AS tag, COUNT(DISTINCT c.id) AS count
                    FROM candidates c, unnest(c.tags) AS t
                    WHERE t IS NOT NULL AND TRIM(t) <> ''
                    GROUP BY t
                    ORDER BY count DESC, name ASC
                ''')
                tag_rows = [dict(r) for r in cur.fetchall()]
                
                cur.execute("SELECT COUNT(id) AS untagged_count FROM candidates WHERE tags IS NULL OR tags = '{}'::text[]")
                untagged_count = cur.fetchone()['untagged_count']
                
                cur.execute("SELECT COUNT(id) AS total_count FROM candidates")
                total_count = cur.fetchone()['total_count']
                
                return {
                    "tags": tag_rows,
                    "untagged_count": untagged_count,
                    "total_count": total_count
                }
        finally:
            conn.close()