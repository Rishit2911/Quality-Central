import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.core.database import get_db_connection
from backend.core.permissions import DEFAULT_PERMISSIONS

def reset_schema(cur, schema_name):
    cur.execute(f'SET search_path TO "{schema_name}"')
    cur.execute("DELETE FROM role_permissions WHERE role = 'org_admin'")
    for p in DEFAULT_PERMISSIONS['org_admin']:
        cur.execute(
            "INSERT INTO role_permissions (role, permission, is_allowed) VALUES (%s, %s, 1)",
            ('org_admin', p)
        )

def reset():
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            reset_schema(cur, 'tenant_dev')
            reset_schema(cur, 'public')
            conn.commit()
            print("Full permissions reset successfully!")
    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    reset()
