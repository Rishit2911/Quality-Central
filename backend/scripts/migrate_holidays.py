"""
Standalone migration script for Phygitron360 Company Holidays.
Creates the `company_holidays` table and indexes across all tenant schemas and public,
and migrates legacy category types.

Usage:
    python -m backend.scripts.migrate_holidays
"""
import sys
import backend.core.database as db

def run_migration():
    print("=== Starting Company Holidays Database Migration ===")
    
    # 1. Migrate public schema
    print("[1/3] Migrating 'public' schema...")
    try:
        db.create_tables(schema_name='public')
        print("  ✓ Public schema table created/verified.")
    except Exception as e:
        print(f"  ✗ Failed to migrate public schema: {e}")
        sys.exit(1)

    # 2. Retrieve all tenant schemas
    conn = db.get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute('SET search_path TO public')
            cur.execute("SELECT id FROM tenants")
            tenant_ids = [row[0] for row in cur.fetchall()]
    finally:
        conn.close()

    print(f"[2/3] Found {len(tenant_ids)} tenant schema(s): {tenant_ids}")

    # 3. Create tables and update types for each tenant
    for t_id in tenant_ids:
        if t_id == 'public':
            continue
        try:
            db.create_tables(schema_name=t_id)
            print(f"  ✓ Schema migration OK for tenant: {t_id}")
        except Exception as e:
            print(f"  ✗ Schema migration FAILED for tenant {t_id}: {e}")

    # 4. Migrate existing data / legacy holiday types
    print("[3/3] Normalizing holiday categories across all schemas...")
    conn = db.get_db_connection()
    try:
        with conn.cursor() as cur:
            for s in ['public'] + tenant_ids:
                try:
                    cur.execute(f'SET search_path TO "{s}", public')
                    cur.execute('''
                        UPDATE company_holidays 
                        SET holiday_type = 'regular_holiday' 
                        WHERE holiday_type IN ('company_holiday', 'festival')
                    ''')
                    cur.execute('''
                        UPDATE company_holidays 
                        SET holiday_type = 'restricted_holiday' 
                        WHERE holiday_type = 'optional_holiday'
                    ''')
                    conn.commit()
                    print(f"  ✓ Category types normalized in schema: {s}")
                except Exception as e:
                    conn.rollback()
                    print(f"  ✗ Category normalization error in {s}: {e}")
    finally:
        conn.close()

    print("=== Migration Completed Successfully! ===")

if __name__ == "__main__":
    run_migration()
