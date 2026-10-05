"""
Ensures permission_templates table exists in all tenant schemas.
Run this once on the live server via the App Platform Console.
"""
from backend.core.database import get_db_connection

conn = get_db_connection()
try:
    cur = conn.cursor()
    cur.execute("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')")
    schemas = [r[0] for r in cur.fetchall()]
    
    for schema in schemas:
        cur.execute(f'SET search_path TO "{schema}"')
        cur.execute("""
            CREATE TABLE IF NOT EXISTS permission_templates (
                name TEXT PRIMARY KEY,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print(f"✓ Ensured permission_templates in schema: {schema}")
    
    conn.commit()
    print("Done.")
finally:
    conn.close()
