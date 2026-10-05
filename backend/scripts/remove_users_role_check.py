import os
import sys

# Ensure backend modules can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.core.database import get_db_connection

def drop_role_check_constraint():
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # Get all tenant schemas
        cur.execute("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant_%' OR nspname = 'public'")
        schemas = [row[0] for row in cur.fetchall()]
        
        for schema in schemas:
            print(f"Removing role check constraint in schema: {schema}")
            cur.execute(f'SET search_path TO "{schema}"')
            
            # Find any check constraints on the users table related to role
            cur.execute("""
                SELECT conname
                FROM pg_constraint
                WHERE conrelid = 'users'::regclass AND contype = 'c'
            """)
            constraints = cur.fetchall()
            
            for constraint in constraints:
                conname = constraint[0]
                if 'role' in conname.lower() or 'check' in conname.lower():
                    try:
                        print(f"  Dropping constraint {conname}...")
                        cur.execute(f'ALTER TABLE users DROP CONSTRAINT IF EXISTS "{conname}"')
                    except Exception as e:
                        print(f"  Failed to drop constraint {conname}: {e}")
                        conn.rollback()
                        continue
                        
            conn.commit()
        print("Success! Check constraints removed.")
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    drop_role_check_constraint()
