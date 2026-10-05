from backend.core.database import get_db_connection
from datetime import datetime
from typing import Dict, Any, Optional
from psycopg2.extras import RealDictCursor


class PasswordResetRepository:
    
    def get_user_by_email(self, email: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        """Get user by email, checking users table and falling back to employees table"""
        conn = get_db_connection()
        email_clean = str(email or "").strip().lower()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                # 1. Look in users table joined with employees
                cur.execute("""
                    SELECT u.*, e.name 
                    FROM users u
                    LEFT JOIN employees e ON (u.employee_code = e.employee_code OR LOWER(u.username) = LOWER(e.email_id))
                    WHERE LOWER(u.username) = %s OR (e.email_id IS NOT NULL AND LOWER(e.email_id) = %s)
                """, (email_clean, email_clean))
                
                user_row = cur.fetchone()
                if user_row:
                    return dict(user_row)
                
                # 2. If no user row exists in users, check employees table for employee with this email
                cur.execute("""
                    SELECT employee_code, name, email_id, role
                    FROM employees
                    WHERE LOWER(email_id) = %s
                """, (email_clean,))
                emp_row = cur.fetchone()
                if emp_row:
                    return {
                        "username": str(emp_row["email_id"]).strip().lower(),
                        "name": emp_row["name"],
                        "employee_code": emp_row["employee_code"],
                        "role": emp_row.get("role") or "employee",
                        "password_hash": None,
                        "is_active": 1,
                        "password_must_change": 0
                    }
                return None
        finally:
            conn.close()
    
    def get_employee_by_code(self, employee_code: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        """Get employee by code"""
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute("SELECT * FROM employees WHERE employee_code = %s", (employee_code,))
                employee = cur.fetchone()
                return dict(employee) if employee else None
        finally:
            conn.close()
    
    def create_reset_token(self, token_data: Dict[str, Any], tenant_id: str = 'public') -> None:
        """Create password reset token"""
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute("""
                    INSERT INTO password_reset_tokens 
                    (email, token, expires_at, reset_type, created_by)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    str(token_data['email']).strip().lower(),
                    token_data['token'],
                    token_data['expires_at'],
                    token_data.get('reset_type', 'self'),
                    token_data.get('created_by')
                ))
                conn.commit()
        finally:
            conn.close()
    
    def get_reset_token(self, token: str, tenant_id: str = 'public') -> Optional[Dict[str, Any]]:
        """Get reset token by token string"""
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute("""
                    SELECT * FROM password_reset_tokens 
                    WHERE token = %s
                """, (token,))
                
                token_row = cur.fetchone()
                return dict(token_row) if token_row else None
        finally:
            conn.close()
    
    def invalidate_existing_tokens(self, email: str, tenant_id: str = 'public') -> None:
        """Mark all existing tokens for email as used"""
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute("""
                    UPDATE password_reset_tokens 
                    SET used = 1, used_at = CURRENT_TIMESTAMP
                    WHERE LOWER(email) = LOWER(%s) AND used = 0
                """, (str(email).strip().lower(),))
                conn.commit()
        finally:
            conn.close()
    
    def mark_token_used(self, token: str, tenant_id: str = 'public') -> None:
        """Mark token as used"""
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute("""
                    UPDATE password_reset_tokens 
                    SET used = 1, used_at = CURRENT_TIMESTAMP
                    WHERE token = %s
                """, (token,))
                conn.commit()
        finally:
            conn.close()
    
    def update_password(
        self, 
        email: str, 
        password_hash: str, 
        changed_by: str,
        must_change: bool = False,
        tenant_id: str = 'public',
        employee_code: Optional[str] = None
    ) -> None:
        """Update user password with auto-provisioning fallback"""
        conn = get_db_connection()
        email_clean = str(email or "").strip().lower()
        try:
            with conn.cursor() as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                
                # First try updating existing user record
                if employee_code:
                    cur.execute("""
                        UPDATE users 
                        SET password_hash = %s,
                            password_changed_at = CURRENT_TIMESTAMP,
                            password_changed_by = %s,
                            password_must_change = %s,
                            username = LOWER(%s)
                        WHERE LOWER(username) = %s OR employee_code = %s
                    """, (password_hash, changed_by, 1 if must_change else 0, email_clean, email_clean, employee_code))
                else:
                    cur.execute("""
                        UPDATE users 
                        SET password_hash = %s,
                            password_changed_at = CURRENT_TIMESTAMP,
                            password_changed_by = %s,
                            password_must_change = %s
                        WHERE LOWER(username) = %s
                    """, (password_hash, changed_by, 1 if must_change else 0, email_clean))

                # If no row was updated, user row might not exist yet -> create one from employees table if present
                if cur.rowcount == 0:
                    emp_query = "SELECT employee_code, name, role FROM employees WHERE LOWER(email_id) = %s"
                    params = (email_clean,)
                    if employee_code:
                        emp_query += " OR employee_code = %s"
                        params = (email_clean, employee_code)
                    cur.execute(emp_query, params)
                    emp_row = cur.fetchone()
                    
                    emp_code_val = emp_row[0] if emp_row else employee_code
                    emp_role_val = emp_row[2] if emp_row and len(emp_row) > 2 and emp_row[2] else "employee"
                    
                    cur.execute("""
                        INSERT INTO users (username, password_hash, role, employee_code, password_must_change, is_active)
                        VALUES (%s, %s, %s, %s, %s, 1)
                        ON CONFLICT (username)
                        DO UPDATE SET
                            password_hash = EXCLUDED.password_hash,
                            password_must_change = EXCLUDED.password_must_change,
                            employee_code = COALESCE(EXCLUDED.employee_code, users.employee_code)
                    """, (email_clean, password_hash, emp_role_val, emp_code_val, 1 if must_change else 0))

                conn.commit()
        finally:
            conn.close()

