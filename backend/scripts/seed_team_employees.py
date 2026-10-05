import sys
import os

# Add root folder to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.core.database import get_db_connection
from psycopg2.extras import RealDictCursor

TEAM_MEMBERS = [
    {
        "employee_code": "EMP001",
        "name": "Rishit",
        "first_name": "Rishit",
        "email_id": "rishit@phygitron.com",
        "designation": "Lead Frontend Engineer",
        "team": "Engineering",
        "employment_status": "Active",
        "employment_type": "Full-Time"
    },
    {
        "employee_code": "EMP002",
        "name": "Bhupesh",
        "first_name": "Bhupesh",
        "email_id": "bhupesh@phygitron.com",
        "designation": "Engineering Lead & Principal Architect",
        "team": "Engineering",
        "employment_status": "Active",
        "employment_type": "Full-Time"
    },
    {
        "employee_code": "EMP003",
        "name": "Vidhi",
        "first_name": "Vidhi",
        "email_id": "vidhi@phygitron.com",
        "designation": "QA Lead & Automation Specialist",
        "team": "Quality Assurance",
        "employment_status": "Active",
        "employment_type": "Full-Time"
    },
    {
        "employee_code": "EMP004",
        "name": "Priyanshu",
        "first_name": "Priyanshu",
        "email_id": "priyanshu@phygitron.com",
        "designation": "Full Stack Engineer",
        "team": "Engineering",
        "employment_status": "Active",
        "employment_type": "Full-Time"
    },
    {
        "employee_code": "EMP005",
        "name": "Sriraj",
        "first_name": "Sriraj",
        "email_id": "sriraj@phygitron.com",
        "designation": "Backend & Systems Engineer",
        "team": "Engineering",
        "employment_status": "Active",
        "employment_type": "Full-Time"
    },
    {
        "employee_code": "EMP006",
        "name": "Akshit",
        "first_name": "Akshit",
        "email_id": "akshit@phygitron.com",
        "designation": "Security & Quality Specialist",
        "team": "Quality Assurance",
        "employment_status": "Active",
        "employment_type": "Full-Time"
    }
]

def seed_team():
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET search_path TO public")
            print("Seeding team members into employees table...")

            for member in TEAM_MEMBERS:
                cur.execute("""
                    INSERT INTO employees (
                        employee_code, name, first_name, email_id, designation, team, employment_status, employment_type
                    ) VALUES (
                        %(employee_code)s, %(name)s, %(first_name)s, %(email_id)s, %(designation)s, %(team)s, %(employment_status)s, %(employment_type)s
                    )
                    ON CONFLICT (employee_code) DO UPDATE SET
                        name = EXCLUDED.name,
                        first_name = EXCLUDED.first_name,
                        email_id = EXCLUDED.email_id,
                        designation = EXCLUDED.designation,
                        team = EXCLUDED.team,
                        employment_status = EXCLUDED.employment_status,
                        employment_type = EXCLUDED.employment_type
                """, member)
                print(f"  [OK] Processed: {member['employee_code']} - {member['name']} ({member['email_id']})")

            # Link rishit@phygitron.com to EMP001
            print("Linking user account rishit@phygitron.com to EMP001...")
            cur.execute("""
                UPDATE users 
                SET employee_code = 'EMP001' 
                WHERE LOWER(username) = 'rishit@phygitron.com'
            """)

            # Link admin@phygitron.com to EMP002 (Bhupesh) or leave if preferred
            cur.execute("""
                UPDATE users 
                SET employee_code = 'EMP002' 
                WHERE LOWER(username) = 'bhupesh@phygitron.com'
            """)

            conn.commit()

            # Verify
            cur.execute("""
                SELECT u.id, u.username, u.role, u.employee_code, e.name as employee_name, e.designation 
                FROM users u 
                LEFT JOIN employees e ON u.employee_code = e.employee_code 
                WHERE LOWER(u.username) IN ('rishit@phygitron.com', 'admin@phygitron.com')
            """)
            print("\nUpdated User Accounts:")
            for r in cur.fetchall():
                print(f"  - User: {r['username']} | Name: {r['employee_name']} | Role: {r['role']} | Code: {r['employee_code']}")

            cur.execute("SELECT count(*) FROM employees")
            total = cur.fetchone()['count']
            print(f"\nTotal active records in public.employees: {total}")
            print("Seeding completed successfully!")

    finally:
        conn.close()

if __name__ == '__main__':
    seed_team()
