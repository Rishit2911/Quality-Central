import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.core.database import get_db_connection
from backend.core.permissions import DEFAULT_PERMISSIONS

def reset():
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # 1. Reset tenant_dev
            cur.execute('SET search_path TO "tenant_dev"')
            cur.execute("UPDATE role_permissions SET is_allowed = 1 WHERE role = 'org_admin'")
            
            # 2. Reset public
            cur.execute('SET search_path TO "public"')
            # Since public might be missing the granular permissions, let's just delete and re-seed
            cur.execute("DELETE FROM role_permissions WHERE role = 'org_admin'")
            for p in DEFAULT_PERMISSIONS['org_admin']:
                cur.execute(
                    "INSERT INTO role_permissions (role, permission, is_allowed) VALUES (%s, %s, 1)",
                    ('org_admin', p)
                )
            
            conn.commit()
            print("Permissions reset successfully!")
    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    reset()
