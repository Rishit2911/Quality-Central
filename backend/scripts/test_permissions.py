import asyncio
from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor
from backend.modules.deploy.services.auth_service import AuthService
def test_auth():
    svc = AuthService()
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET search_path TO public")
            cur.execute("SELECT session_token FROM sessions ORDER BY created_at DESC LIMIT 1")
            row = cur.fetchone()
            if not row:
                print("No active sessions found.")
                return
            
            token = row['session_token']
            user = svc.get_session_user(token)
            if not user:
                print("Failed to resolve user for latest session token.")
                return
            
            print(f"User: {user['username']}")
            print(f"Role: {user['role']}")
            print(f"Roles: {user['roles']}")
            print(f"Templates: {user.get('templates')}")
            print(f"Permissions: {user['permissions']}")
            
    finally:
        conn.close()

if __name__ == "__main__":
    test_auth()
