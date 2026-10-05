import os
import sys

# Add the parent directory of backend to the python path so imports work
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(os.path.dirname(current_dir))
sys.path.append(parent_dir)

from backend.core.database import get_db_connection
from backend.common.utils.name_utils import split_full_name

# (table, source column holding the existing single name)
TABLES = [
    ("employees", "name"),
    ("onboarding_invites", "name"),
    ("candidates", "full_name"),
]


def backfill_schema(cur, schema: str):
    cur.execute(f'SET search_path TO "{schema}"')
    for table, name_col in TABLES:
        cur.execute(
            f"SELECT id, {name_col} FROM {table} WHERE first_name IS NULL AND {name_col} IS NOT NULL"
        )
        rows = cur.fetchall()
        for row_id, full in rows:
            first, middle, last = split_full_name(full)
            cur.execute(
                f"UPDATE {table} SET first_name = %s, middle_name = %s, last_name = %s WHERE id = %s",
                (first, middle or None, last, row_id),
            )
        print(f"  {schema}.{table}: backfilled {len(rows)} row(s)")


def migrate():
    conn = get_db_connection()
    try:
        cur = conn.cursor()

        cur.execute("SET search_path TO public")
        cur.execute("SELECT id FROM tenants")
        tenant_ids = [row[0] for row in cur.fetchall()]

        for schema in ["public"] + tenant_ids:
            print(f"Backfilling schema: {schema}")
            backfill_schema(cur, schema)

        conn.commit()
        print("Migration completed successfully.")
    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
