from typing import List, Dict, Any, Optional
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

class AdminRepository:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id

    def get_all_users(self) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(f'SET search_path TO "{self.tenant_id}"')
            cur.execute("SELECT id, username, role, employee_code FROM users ORDER BY id")
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def list_tenants(self) -> List[Dict[str, Any]]:
        return self.get_all_tenants()

    def get_all_tenants(self) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("SET search_path TO public")
            cur.execute("SELECT * FROM tenants ORDER BY created_at DESC")
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def register_tenant(self, tenant_id: str, company_name: str, admin_email: str, subdomain: str):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SET search_path TO public")
                cur.execute("""
                    INSERT INTO tenants (id, company_name, admin_email, subdomain)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET company_name = EXCLUDED.company_name, admin_email = EXCLUDED.admin_email
                """, (tenant_id, company_name, admin_email, subdomain))
                conn.commit()
        finally:
            conn.close()

    def create_tenant_admin(self, schema_name: str, email: str, password_hash: str):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f'SET search_path TO "{schema_name}"')
                
                # We no longer auto-create EMP-0001. 
                # Org Admin will fill their own onboarding form to become an employee.
                cur.execute("""
                    INSERT INTO users (username, password_hash, role, roles, employee_code, is_active)
                    VALUES (%s, %s, 'org_admin', ARRAY['org_admin'], NULL, 1)
                    ON CONFLICT DO NOTHING
                """, (email, password_hash))
                conn.commit()
        finally:
            conn.close()

    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(f'SET search_path TO "{self.tenant_id}"')
            cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def log_action(self, username: str, action: str, details: str, ip: str = None, module: str = 'admin'):
        conn = get_db_connection()
        try:
             cur = conn.cursor()
             cur.execute(f'SET search_path TO "{self.tenant_id}"')
             cur.execute("INSERT INTO audit_logs (username, action, details, module, ip_address) VALUES (%s, %s, %s, %s, %s)", 
                          (username, action, details, module, ip))
             conn.commit()
        finally:
            conn.close()

    def get_logs(self, limit: int = 500) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(f'SET search_path TO "{self.tenant_id}"')
            cur.execute("SELECT id, username, action, details, module, ip_address, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT %s", (limit,))
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_role_permissions(self) -> Dict[str, List[str]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(f'SET search_path TO "{self.tenant_id}"')
            cur.execute("SELECT role, permission FROM role_permissions WHERE is_allowed = 1")
            rows = cur.fetchall()
            perms = {}
            for r in rows:
                if r['role'] not in perms:
                    perms[r['role']] = []
                perms[r['role']].append(r['permission'])
            return perms
        finally:
            conn.close()

    def get_templates(self) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(f'SET search_path TO "{self.tenant_id}"')
            cur.execute("SELECT name, description, created_at FROM permission_templates ORDER BY created_at DESC")
            rows = cur.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def create_template(self, name: str, description: str):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute(f'SET search_path TO "{self.tenant_id}"')
            cur.execute(
                "INSERT INTO permission_templates (name, description) VALUES (%s, %s)",
                (name, description)
            )
            conn.commit()
        finally:
            conn.close()

    def delete_template(self, name: str):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute(f'SET search_path TO "{self.tenant_id}"')
            cur.execute("DELETE FROM permission_templates WHERE name = %s", (name,))
            # Also clean up role_permissions
            cur.execute("DELETE FROM role_permissions WHERE role = %s", (name,))
            conn.commit()
        finally:
            conn.close()

    def rename_template(self, old_name: str, new_name: str):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute(f'SET search_path TO "{self.tenant_id}"')
            cur.execute("UPDATE permission_templates SET name = %s WHERE name = %s", (new_name, old_name))
            cur.execute("UPDATE role_permissions SET role = %s WHERE role = %s", (new_name, old_name))
            cur.execute(
                "UPDATE users SET templates = array_replace(templates, %s, %s) WHERE %s = ANY(templates)",
                (old_name, new_name, old_name)
            )
            conn.commit()
        finally:
            conn.close()

    def update_role_permissions(self, role: str, permissions: List[str]):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute(f'SET search_path TO "{self.tenant_id}"')
            # First delete all existing permissions for this role
            cur.execute("DELETE FROM role_permissions WHERE role = %s", (role,))
            # Then insert the new ones
            for p in permissions:
                cur.execute('''
                    INSERT INTO role_permissions (role, permission, is_allowed) 
                    VALUES (%s, %s, 1)
                ''', (role, p))
            conn.commit()
        finally:
            conn.close()

    def seed_default_permissions(self, schema_name: str):
        """Seeds default role permissions from the canonical registry in core.permissions."""
        from backend.core.permissions import DEFAULT_PERMISSIONS
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute(f'SET search_path TO "{schema_name}"')
            for role, perms in DEFAULT_PERMISSIONS.items():
                for perm in perms:
                    cur.execute(
                        "INSERT INTO role_permissions (role, permission, is_allowed) VALUES (%s, %s, 1) ON CONFLICT (role, permission) DO UPDATE SET is_allowed = 1",
                        (role, perm)
                    )
            conn.commit()
        finally:
            conn.close()

    def get_user_overrides(self, user_id: int) -> Dict[str, bool]:
        conn = get_db_connection()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(f'SET search_path TO "{self.tenant_id}"')
            cur.execute("SELECT permission, is_allowed FROM user_permissions WHERE user_id = %s", (user_id,))
            rows = cur.fetchall()
            return {r['permission']: bool(r['is_allowed']) for r in rows}
        finally:
            conn.close()

    def update_user_overrides(self, user_id: int, permissions: Dict[str, Optional[bool]]):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute(f'SET search_path TO "{self.tenant_id}"')
            for p, allowed in permissions.items():
                if allowed is None:
                    cur.execute("DELETE FROM user_permissions WHERE user_id = %s AND permission = %s", (user_id, p))
                else:
                    is_allowed = 1 if allowed else 0
                    cur.execute('''
                        INSERT INTO user_permissions (user_id, permission, is_allowed) 
                        VALUES (%s, %s, %s)
                        ON CONFLICT(user_id, permission) DO UPDATE SET is_allowed = %s
                    ''', (user_id, p, is_allowed, is_allowed))
            conn.commit()
        finally:
            conn.close()

    def update_employee_code(self, user_id: int, employee_code: Optional[str]):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute(f'SET search_path TO "{self.tenant_id}"')
            cur.execute("UPDATE users SET employee_code = %s WHERE id = %s", (employee_code, user_id))
            conn.commit()
        finally:
            conn.close()

    def update_role(self, user_id: int, role: str, templates: List[str] = None):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute(f'SET search_path TO "{self.tenant_id}"')
            cur.execute("UPDATE users SET role = %s, templates = %s WHERE id = %s", (role, templates or [], user_id))
            conn.commit()
        finally:
            conn.close()

    def delete_tenant(self, tenant_id: str):
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                # 1. Drop the isolated schema and all its tables
                cur.execute(f'DROP SCHEMA IF EXISTS "{tenant_id}" CASCADE')
                
                # 2. Remove from master registry
                cur.execute("SET search_path TO public")
                cur.execute("DELETE FROM tenants WHERE id = %s", (tenant_id,))
                
                # 3. Cleanup global sessions related to this tenant
                cur.execute("DELETE FROM sessions WHERE tenant_id = %s", (tenant_id,))

                # 4. Cleanup onboarding invites — stored in public schema keyed by tenant_id,
                #    NOT inside the tenant schema, so CASCADE does not catch these.
                #    Without this, old invite history reappears if the tenant is recreated
                #    with the same name/ID.
                cur.execute("DELETE FROM onboarding_invites WHERE tenant_id = %s", (tenant_id,))
                
                conn.commit()
        finally:
            conn.close()

    def update_tenant_ops(self, tenant_id: str, company_name: str = None, plan: str = None, modules: List[str] = None, is_active: bool = None):
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute("SET search_path TO public")
            
            updates = []
            params = []
            
            if company_name is not None:
                updates.append("company_name = %s")
                params.append(company_name)
            if plan is not None:
                updates.append("plan = %s")
                params.append(plan)
            if modules is not None:
                updates.append("modules_enabled = %s")
                params.append(modules)
            if is_active is not None:
                updates.append("is_active = %s")
                params.append(is_active)
                
            if not updates:
                return
                
            params.append(tenant_id)
            query = f"UPDATE tenants SET {', '.join(updates)} WHERE id = %s"
            cur.execute(query, params)
            conn.commit()
        finally:
            conn.close()

    def get_tenant_stats(self, tenant_id: str) -> Dict[str, int]:
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute(f'SET search_path TO "{tenant_id}"')
            
            stats = {}
            # List of tables to count
            tables = [('users', 'Users'), ('candidates', 'Candidates'), ('employees', 'Employees')]
            
            for table_name, label in tables:
                try:
                    cur.execute(f"SELECT COUNT(*) FROM {table_name}")
                    stats[label] = cur.fetchone()[0]
                except:
                    stats[label] = 0
                    conn.rollback() # Reset if table doesn't exist
                    cur.execute(f'SET search_path TO "{tenant_id}"')
            
            return stats
        finally:
            conn.close()

