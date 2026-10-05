"""
PHYGITRON 360 — Production Permission Migration Script
=========================================================
Canonical DB migration script to seed & update all role permissions across
all tenant schemas (and public) for Deploy, Source, Verify, and Forge modules.

WHAT IT DOES:
  1. Auto-discovers every tenant_* schema plus public.
  2. Cleans up stale/deprecated permission keys for base roles.
  3. Re-seeds the complete DEFAULT_PERMISSIONS matrix (Deploy, Source, Verify, Forge)
     for the 4 base roles: org_admin, manager, employee, candidate.
  4. Preserves custom role templates and user-level overrides intact.

USAGE ON PRODUCTION (DigitalOcean / Server):
  cd /path/to/phygitron360
  source backend/venv/bin/activate

  # 1. Dry run (verify what will change without modifying DB):
  python backend/scripts/migrate_permissions.py --dry-run

  # 2. Live migration:
  python backend/scripts/migrate_permissions.py
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.core.database import get_db_connection
from backend.core.permissions import DEFAULT_PERMISSIONS

# Base roles managed by the seed matrix (dynamically pulled from DEFAULT_PERMISSIONS)
BASE_ROLES = list(DEFAULT_PERMISSIONS.keys())  # ['org_admin', 'manager', 'employee', 'trainee']

# Deprecated/stale keys replaced during module PBAC refactors
STALE_KEYS = [
    "verify.assessments.view_results",   # replaced by verify.results.view
    "verify.submissions.manage",         # replaced by verify.results.manage + verify.queries.manage
]


def get_tenant_schemas(cur) -> list:
    """Return all tenant schemas (tenant_*) plus 'public'."""
    cur.execute("""
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name LIKE 'tenant_%'
        ORDER BY schema_name
    """)
    schemas = [row[0] for row in cur.fetchall()]
    schemas.insert(0, "public")  # always include public schema
    return schemas


def has_role_permissions_table(cur, schema: str) -> bool:
    """Check if role_permissions table exists in schema."""
    cur.execute("""
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = %s AND table_name = 'role_permissions'
    """, (schema,))
    return cur.fetchone() is not None


def migrate_schema(cur, schema: str, dry_run: bool = False) -> dict:
    """Migrates a single schema."""
    report = {"schema": schema, "status": "skipped", "deleted": 0, "inserted": 0, "stale_removed": 0}

    if not has_role_permissions_table(cur, schema):
        report["status"] = "no_table"
        return report

    cur.execute(f'SET search_path TO "{schema}"')

    # 1. Remove stale keys for base roles
    if STALE_KEYS:
        cur.execute(
            "DELETE FROM role_permissions WHERE role = ANY(%s) AND permission = ANY(%s)",
            (BASE_ROLES, STALE_KEYS)
        )
        report["stale_removed"] = cur.rowcount

    # 2. Delete existing base-role permissions to prepare clean re-seed
    cur.execute(
        "DELETE FROM role_permissions WHERE role = ANY(%s)",
        (BASE_ROLES,)
    )
    report["deleted"] = cur.rowcount

    # 3. Insert full DEFAULT_PERMISSIONS matrix (Deploy, Source, Verify, Forge)
    inserted = 0
    for role, perms in DEFAULT_PERMISSIONS.items():
        for perm in perms:
            cur.execute(
                "INSERT INTO role_permissions (role, permission, is_allowed) VALUES (%s, %s, 1)",
                (role, perm)
            )
            inserted += 1

    report["inserted"] = inserted
    report["status"] = "dry_run" if dry_run else "migrated"
    return report


def print_report(reports: list, dry_run: bool):
    print()
    print("=" * 72)
    print(f"  PHYGITRON 360 — Permission Migration Report {'(DRY RUN)' if dry_run else ''}")
    print("=" * 72)

    total_keys = sum(len(v) for v in DEFAULT_PERMISSIONS.values())
    print(f"\n  Base roles updated : {', '.join(BASE_ROLES)}")
    print(f"  Total keys in seed : {total_keys}")
    print(f"  Stale keys removed : {STALE_KEYS}")
    print()

    for r in reports:
        icon = "DRY" if dry_run else ("OK " if r["status"] == "migrated" else "ERR")
        print(f"  [{icon}]  {r['schema']:<32} deleted={r['deleted']:>3} | inserted={r['inserted']:>3} | stale_removed={r['stale_removed']:>2}")

    print()
    print("=" * 72)

    if dry_run:
        print("\n  DRY RUN complete — no changes were written to the DB.")
    else:
        print(f"\n  Migration complete across {len(reports)} schema(s).")
    print()


def main():
    dry_run = "--dry-run" in sys.argv

    print()
    print("  PHYGITRON 360 - Permission Migration")
    print(f"  Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print()

    conn = get_db_connection()
    reports = []

    try:
        with conn.cursor() as cur:
            schemas = get_tenant_schemas(cur)
            print(f"  Found {len(schemas)} schema(s) to migrate: {schemas}")

            if not dry_run:
                confirm = input("\n  Proceed with live migration? [yes/no]: ").strip().lower()
                if confirm != "yes":
                    print("  Aborted.")
                    return

            for schema in schemas:
                r = migrate_schema(cur, schema, dry_run=dry_run)
                reports.append(r)

        if dry_run:
            conn.rollback()
        else:
            conn.commit()

        print_report(reports, dry_run)

    except Exception as e:
        conn.rollback()
        print(f"\n  ERROR — transaction rolled back: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
