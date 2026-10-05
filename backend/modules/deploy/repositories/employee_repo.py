from typing import List, Dict, Any, Optional
import json
import random
from datetime import datetime
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class EmployeeRepository:
    def _set_path(self, cur, tenant_id='public'):
        cur.execute(f'SET search_path TO "{tenant_id}", public')

    def get_all_employees_basic(self, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("""
                SELECT e.employee_code, e.name, e.designation, e.team, e.reporting_manager, e.email_id,
                       e.photo_path, e.employment_status, e.exit_date, e.doj, e.location, e.employment_type,
                       e.hr_approved, e.finance_approved,
                       MAX(u.role) as role,
                       (
                           COALESCE(e.dob, '') <> '' AND
                           COALESCE(e.contact_number, '') <> '' AND
                           COALESCE(e.emergency_contact, '') <> '' AND
                           COALESCE(e.current_address, '') <> '' AND
                           COALESCE(e.permanent_address, '') <> '' AND
                           COALESCE(e.designation, '') <> '' AND
                           COALESCE(e.team, '') <> '' AND
                           COALESCE(e.location, '') <> '' AND
                           COALESCE(e.reporting_manager, '') <> '' AND
                           COALESCE(e.doj, '') <> '' AND
                           COALESCE(e.pan_no, '') <> '' AND
                           COALESCE(e.pf_included, '') <> '' AND
                           COALESCE(e.mediclaim_included, '') <> '' AND
                           COALESCE(e.cv_path, '') <> '' AND
                           COALESCE(e.id_proofs, '') <> '' AND
                           e.education_details IS NOT NULL AND
                           e.education_details::text NOT IN ('[]', 'null') AND
                           COALESCE(MAX(s.primary_skillset), '') <> ''
                       ) AS profile_complete
                FROM employees e
                LEFT JOIN users u ON e.employee_code = u.employee_code
                LEFT JOIN skill_matrix s ON e.employee_code = s.employee_code
                GROUP BY e.employee_code, e.name, e.designation, e.team, e.reporting_manager, e.email_id,
                         e.photo_path, e.employment_status, e.exit_date, e.doj, e.location, e.employment_type,
                         e.hr_approved, e.finance_approved, e.dob, e.contact_number, e.emergency_contact,
                         e.current_address, e.permanent_address, e.pan_no, e.pf_included, e.mediclaim_included,
                         e.cv_path, e.id_proofs, e.education_details
            """)
            rows = cur.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()

    def get_team_employees(self, tenant_id: str, manager_code: str) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("""
                WITH RECURSIVE team_hierarchy AS (
                    -- Anchor: the manager
                    SELECT employee_code, name, designation, team, reporting_manager, email_id,
                           photo_path, employment_status, exit_date, doj, location, employment_type,
                           hr_approved, finance_approved, dob, contact_number, emergency_contact,
                           current_address, permanent_address, pan_no, pf_included, mediclaim_included,
                           cv_path, id_proofs, education_details,
                           ARRAY[employee_code] AS path
                    FROM employees
                    WHERE employee_code = %s
                    
                    UNION ALL
                    
                    -- Recursive: reports (with cycle prevention)
                    SELECT e.employee_code, e.name, e.designation, e.team, e.reporting_manager, e.email_id,
                           e.photo_path, e.employment_status, e.exit_date, e.doj, e.location, e.employment_type,
                           e.hr_approved, e.finance_approved, e.dob, e.contact_number, e.emergency_contact,
                           e.current_address, e.permanent_address, e.pan_no, e.pf_included, e.mediclaim_included,
                           e.cv_path, e.id_proofs, e.education_details,
                           th.path || e.employee_code
                    FROM employees e
                    INNER JOIN team_hierarchy th ON e.reporting_manager = th.employee_code
                    WHERE NOT (e.employee_code = ANY(th.path))
                )
                SELECT e.employee_code, e.name, e.designation, e.team, e.reporting_manager, e.email_id,
                       e.photo_path, e.employment_status, e.exit_date, e.doj, e.location, e.employment_type,
                       e.hr_approved, e.finance_approved,
                       MAX(u.role) as role,
                       (
                           COALESCE(e.dob, '') <> '' AND
                           COALESCE(e.contact_number, '') <> '' AND
                           COALESCE(e.emergency_contact, '') <> '' AND
                           COALESCE(e.current_address, '') <> '' AND
                           COALESCE(e.permanent_address, '') <> '' AND
                           COALESCE(e.designation, '') <> '' AND
                           COALESCE(e.team, '') <> '' AND
                           COALESCE(e.location, '') <> '' AND
                           COALESCE(e.reporting_manager, '') <> '' AND
                           COALESCE(e.doj, '') <> '' AND
                           COALESCE(e.pan_no, '') <> '' AND
                           COALESCE(e.pf_included, '') <> '' AND
                           COALESCE(e.mediclaim_included, '') <> '' AND
                           COALESCE(e.cv_path, '') <> '' AND
                           COALESCE(e.id_proofs, '') <> '' AND
                           e.education_details IS NOT NULL AND
                           e.education_details::text NOT IN ('[]', 'null') AND
                           COALESCE(MAX(s.primary_skillset), '') <> ''
                       ) AS profile_complete
                FROM team_hierarchy e
                LEFT JOIN users u ON e.employee_code = u.employee_code
                LEFT JOIN skill_matrix s ON e.employee_code = s.employee_code
                GROUP BY e.employee_code, e.name, e.designation, e.team, e.reporting_manager, e.email_id,
                         e.photo_path, e.employment_status, e.exit_date, e.doj, e.location, e.employment_type,
                         e.hr_approved, e.finance_approved, e.dob, e.contact_number, e.emergency_contact,
                         e.current_address, e.permanent_address, e.pan_no, e.pf_included, e.mediclaim_included,
                         e.cv_path, e.id_proofs, e.education_details
            """, (manager_code,))
            rows = cur.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()


    def get_employee_by_code(self, employee_code: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("""
                SELECT e.*, u.role
                FROM employees e
                LEFT JOIN users u ON e.employee_code = u.employee_code
                WHERE e.employee_code = %s
            """, (employee_code,))
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def get_employee_by_email(self, email_id: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("""
                SELECT e.*, u.role
                FROM employees e
                LEFT JOIN users u ON e.employee_code = u.employee_code
                WHERE LOWER(e.email_id) = LOWER(%s)
            """, (str(email_id or "").strip(),))
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def get_skill_matrix(self, employee_code: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
             cur = conn.cursor(cursor_factory=RealDictCursor)
             self._set_path(cur, tenant_id)
             cur.execute("SELECT * FROM skill_matrix WHERE employee_code = %s", (employee_code,))
             row = cur.fetchone()
             return dict(row) if row else {}
        finally:
            conn.close()

    def get_assets(self, employee_code: str, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("SELECT * FROM assets WHERE employee_code = %s", (employee_code,))
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_performance(self, employee_code: str, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("SELECT * FROM performance WHERE employee_code = %s", (employee_code,))
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_hr_activity(self, employee_code: str, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("SELECT * FROM hr_activity WHERE employee_code = %s", (employee_code,))
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_assessments(self, employee_code: str, tenant_id: str = 'public') -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            cur.execute("""
                SELECT 
                    id,
                    year,
                    period_type,
                    period_value,
                    status,
                    total_score,
                    percentage,
                    updated_at
                FROM performance_assessments
                WHERE employee_code = %s
                ORDER BY year DESC, created_at DESC
            """, (employee_code,))
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        except Exception:
            return []
        finally:
            conn.close()

    def create_employee(self, data: Dict[str, Any], tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            
            # Generate employee code if not provided
            employee_code = data.get('code')
            if not employee_code:
                employee_code = f"EMP{random.randint(1000, 9999)}"
                # Ensure the generated code doesn't already exist
                cur.execute("SELECT 1 FROM employees WHERE employee_code = %s", (employee_code,))
                while cur.fetchone():
                    employee_code = f"EMP{random.randint(1000, 9999)}"
                    cur.execute("SELECT 1 FROM employees WHERE employee_code = %s", (employee_code,))
            
            # Set defaults for ALL fields
            cur.execute('''
                INSERT INTO employees (
                    employee_code, name, first_name, middle_name, last_name, guardian_name, dob, contact_number, emergency_contact, email_id, doj,
                    team, designation, employment_type, reporting_manager, location,
                    current_address, permanent_address, education_details,
                    pf_included, mediclaim_included,
                    photo_path, cv_path, id_proofs, passbook_path, notes,
                    bank_name, bank_account_no, pan_no, ifsc_code,
                    employment_status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                employee_code,
                data.get('name', 'Unknown'),
                data.get('first_name', None),
                data.get('middle_name', None),
                data.get('last_name', None),
                data.get('guardian_name', None),
                data.get('dob', None),
                data.get('phone', None),
                data.get('emergency', None),
                data.get('email', None),
                data.get('doj', datetime.now().strftime('%Y-%m-%d')),
                data.get('team', None),
                data.get('designation', None),
                data.get('type', 'Full-time'),
                data.get('manager', None),
                data.get('location', None),
                data.get('current_address', None),
                data.get('permanent_address', None),
                json.dumps(data.get('education_details', [])),
                data.get('pf', 'No'),
                data.get('mediclaim', 'No'),
                data.get('photo_path', None),
                data.get('cv_path', None),
                data.get('id_proofs', None),
                data.get('passbook_path', None),
                data.get('notes', None),
                data.get('bank_name', None),
                data.get('bank_account_no', None),
                data.get('pan_no', None),
                data.get('ifsc_code', None),
                data.get('employment_status', 'Active')
            ))
            
            # Skill Matrix - with defaults
            cur.execute('''
                INSERT INTO skill_matrix (
                    employee_code, candidate_name, primary_skillset,
                    secondary_skillset, experience_years, cv_upload
                ) VALUES (%s, %s, %s, %s, %s, %s)
            ''', (
                employee_code,
                data.get('name', 'Unknown'),
                data.get('primary_skillset', None),
                data.get('secondary_skillset', None),
                data.get('experience_years', 0),
                data.get('cv_path', None)
            ))
            
            conn.commit()
        finally:
            conn.close()

    def update_employee_rehire(self, old_employee_code: str, data: Dict[str, Any], tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            
            # Use provided code or generate one
            new_code = data.get('code')
            if not new_code:
                new_code = f"EMP{random.randint(1000, 9999)}"
                cur.execute("SELECT 1 FROM employees WHERE employee_code = %s", (new_code,))
                while cur.fetchone():
                    new_code = f"EMP{random.randint(1000, 9999)}"
                    cur.execute("SELECT 1 FROM employees WHERE employee_code = %s", (new_code,))
            
            cur.execute('''
                UPDATE employees
                SET employee_code = %s,
                    name = %s,
                    first_name = %s,
                    middle_name = %s,
                    last_name = %s,
                    dob = %s,
                    contact_number = %s,
                    emergency_contact = %s,
                    doj = %s,
                    team = %s,
                    designation = %s,
                    employment_type = %s,
                    reporting_manager = %s,
                    location = %s,
                    current_address = %s,
                    permanent_address = %s,
                    education_details = %s,
                    pf_included = %s,
                    mediclaim_included = %s,
                    photo_path = %s,
                    cv_path = %s,
                    id_proofs = %s,
                    notes = %s,
                    bank_name = %s,
                    bank_account_no = %s,
                    pan_no = %s,
                    employment_status = %s,
                    exit_date = NULL,
                    exit_reason = NULL,
                    clearance_status = NULL
                WHERE employee_code = %s
            ''', (
                new_code,
                data.get('name', 'Unknown'),
                data.get('first_name', None),
                data.get('middle_name', None),
                data.get('last_name', None),
                data.get('dob', None),
                data.get('phone', None),
                data.get('emergency', None),
                data.get('doj', datetime.now().strftime('%Y-%m-%d')),
                data.get('team', None),
                data.get('designation', None),
                data.get('type', 'Full-time'),
                data.get('manager', None),
                data.get('location', None),
                data.get('current_address', None),
                data.get('permanent_address', None),
                json.dumps(data.get('education_details', [])),
                data.get('pf', 'No'),
                data.get('mediclaim', 'No'),
                data.get('photo_path', None),
                data.get('cv_path', None),
                data.get('id_proofs', None),
                data.get('notes', None),
                data.get('bank_name', None),
                data.get('bank_account_no', None),
                data.get('pan_no', None),
                data.get('employment_status', 'Active'),
                old_employee_code
            ))
            
            cur.execute('''
                UPDATE skill_matrix
                SET candidate_name = %s, primary_skillset = %s, secondary_skillset = %s, experience_years = %s, cv_upload = %s
                WHERE employee_code = %s
            ''', (
                data.get('name', 'Unknown'),
                data.get('primary_skillset', None),
                data.get('secondary_skillset', None),
                data.get('experience_years', 0),
                data.get('cv_path', None),
                new_code
            ))
            conn.commit()
        finally:
            conn.close()

    def update_employee_fields(self, employee_code: str, fields: List[str], values: List[Any], tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            values.append(employee_code)
            query = f"UPDATE employees SET {', '.join([f'{f} = %s' for f in fields])} WHERE employee_code = %s"
            
            # Ensure all values are psycopg2-friendly
            safe_values = []
            for v in values:
                if isinstance(v, (dict, list)):
                    safe_values.append(json.dumps(v))
                else:
                    safe_values.append(v)
                    
            cur.execute(query, tuple(safe_values))
            conn.commit()
        finally:
            conn.close()

    def update_user_role(self, employee_code: str, role: str, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            # First verify user exists for this employee
            cur.execute("SELECT id FROM users WHERE employee_code = %s", (employee_code,))
            user = cur.fetchone()
            if user:
                cur.execute("UPDATE users SET role = %s WHERE employee_code = %s", (role, employee_code))
                conn.commit()
        finally:
            conn.close()

    def update_skill_matrix(self, employee_code: str, primary: str, secondary: str, tenant_id: str = 'public', experience_years: Any = None):
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            # Check exist
            cur.execute("SELECT id FROM skill_matrix WHERE employee_code = %s", (employee_code,))
            exists = cur.fetchone()
            if exists:
                updates = []
                vals = []
                if primary is not None:
                    updates.append("primary_skillset = %s")
                    vals.append(primary)
                if secondary is not None:
                    updates.append("secondary_skillset = %s")
                    vals.append(secondary)
                if experience_years is not None:
                    updates.append("experience_years = %s")
                    vals.append(str(experience_years))
                
                if updates:
                    vals.append(employee_code)
                    query = f"UPDATE skill_matrix SET {', '.join(updates)} WHERE employee_code = %s"
                    cur.execute(query, tuple(vals))
            else:
                cur.execute("INSERT INTO skill_matrix (employee_code, primary_skillset, secondary_skillset, experience_years) VALUES (%s, %s, %s, %s)", 
                          (employee_code, primary or '', secondary or '', str(experience_years or '0')))
            conn.commit()
        finally:
            conn.close()

    def delete_employee_cascade(self, employee_code: str, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute("DELETE FROM skill_matrix WHERE employee_code = %s", (employee_code,))
            cur.execute("DELETE FROM assets WHERE employee_code = %s", (employee_code,))
            cur.execute("DELETE FROM performance WHERE employee_code = %s", (employee_code,))
            cur.execute("DELETE FROM hr_activity WHERE employee_code = %s", (employee_code,))
            cur.execute("DELETE FROM employees WHERE employee_code = %s", (employee_code,))
            conn.commit()
        finally:
            conn.close()

    def get_dropdown_options(self, tenant_id: str = 'public') -> Dict[str, Any]:
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute("SELECT DISTINCT team FROM employees WHERE team IS NOT NULL AND team != '' ORDER BY team")
            teams = [r[0] for r in cur.fetchall()]
            
            cur.execute("SELECT DISTINCT designation FROM employees WHERE designation IS NOT NULL AND designation != '' ORDER BY designation")
            designations = [r[0] for r in cur.fetchall()]

            cur.execute("SELECT DISTINCT location FROM employees WHERE location IS NOT NULL AND location != '' ORDER BY location")
            locations = [r[0] for r in cur.fetchall()]
            
            cur.execute("""
                SELECT e.name, u.employee_code, u.role
                FROM employees e
                JOIN users u ON e.employee_code = u.employee_code
                WHERE u.role NOT IN ('employee', 'trainee', 'candidate')
                ORDER BY e.name
            """)
            managers = [{"name": r[0], "code": r[1], "role": r[2]} for r in cur.fetchall()]

            cur.execute("SELECT name FROM permission_templates WHERE lower(name) != 'candidate' ORDER BY name")
            custom_roles = [r[0] for r in cur.fetchall()]

            return {
                "teams": teams,
                "designations": designations,
                "managers": managers,
                "locations": locations,
                "custom_roles": custom_roles
            }
        finally:
             conn.close()

    def offboard_employee(self, employee_code: str, exit_date: str, exit_reason: str, status: str = 'Exited', deactivate: bool = True, tenant_id: str = 'public'):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            self._set_path(cur, tenant_id)
            cur.execute("""
                UPDATE employees 
                SET employment_status = %s, 
                    exit_date = %s, 
                    exit_reason = %s,
                    clearance_status = 'Pending'
                WHERE employee_code = %s
            """, (status, exit_date, exit_reason, employee_code))
            
            if deactivate:
                cur.execute("UPDATE users SET is_active = 0, role = 'trainee', roles = ARRAY['trainee']::varchar[] WHERE employee_code = %s", (employee_code,))
            
            conn.commit()
        finally:
            conn.close()

    def update_user_active_by_employee(self, employee_code: str, is_active: int, tenant_id: str = 'public', fallback_email: Optional[str] = None):
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            self._set_path(cur, tenant_id)
            if fallback_email and str(fallback_email).strip():
                cur.execute(
                    """
                    SELECT id FROM users 
                    WHERE employee_code = %s OR LOWER(username) = LOWER(%s)
                    """,
                    (employee_code, str(fallback_email).strip())
                )
            else:
                cur.execute(
                    "SELECT id FROM users WHERE employee_code = %s",
                    (employee_code,)
                )
            rows = cur.fetchall()
            user_ids = [r['id'] for r in rows if r.get('id')]
            if user_ids:
                cur.execute(
                    "UPDATE users SET is_active = %s WHERE id = ANY(%s)",
                    (is_active, user_ids)
                )
                if not is_active:
                    cur.execute(
                        "DELETE FROM public.sessions WHERE user_id = ANY(%s)",
                        (user_ids,)
                    )
            conn.commit()
        finally:
            conn.close()