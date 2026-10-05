import json
from backend.core.database import get_db_connection

CORE_PROJECTS = [
    {
        "id": "proj-tc-01",
        "name": "Talent Central",
        "prefix": "#TC",
        "severity": "Normal",
        "health_rate": 96,
        "status": "Active",
        "lead": "Bhupesh",
        "developers": ["Sriraj", "Priyanshu", "Akshit"],
        "qa": ["Vidhi"],
        "description": "Talent acquisition pipeline, ATS resume parser, candidate interview orchestration, and hiring workflows."
    },
    {
        "id": "proj-lc-02",
        "name": "Learning Central",
        "prefix": "#LC",
        "severity": "Normal",
        "health_rate": 97,
        "status": "Active",
        "lead": "Bhupesh",
        "developers": ["Sriraj", "Priyanshu", "Akshit"],
        "qa": ["Vidhi"],
        "description": "Enterprise LMS learning tracks, skill matrices, compliance assessments, and interactive training modules."
    },
    {
        "id": "proj-ac-03",
        "name": "Assessment Central",
        "prefix": "#AC",
        "severity": "High",
        "health_rate": 92,
        "status": "Active",
        "lead": "Bhupesh",
        "developers": ["Sriraj", "Priyanshu", "Akshit"],
        "qa": ["Vidhi"],
        "description": "Online testing framework, proctoring controls, candidate score evaluation, and automated skill grading."
    },
    {
        "id": "proj-ec-04",
        "name": "Employee Central",
        "prefix": "#EC",
        "severity": "Normal",
        "health_rate": 95,
        "status": "Active",
        "lead": "Bhupesh",
        "developers": ["Sriraj", "Priyanshu", "Akshit"],
        "qa": ["Vidhi"],
        "description": "Core employee directory, attendance tracking, organizational hierarchy, payroll, and profile self-service."
    },
    {
        "id": "proj-qc-05",
        "name": "Quality Central",
        "prefix": "#QC",
        "severity": "Normal",
        "health_rate": 99,
        "status": "Active",
        "lead": "Bhupesh",
        "developers": ["Rishit", "Vidhi"],
        "qa": ["Sriraj", "Akshit"],
        "description": "Automated test suite orchestration, defect lifecycle tracking, SLA monitor, and engineering quality assurance."
    },
    {
        "id": "proj-lex-06",
        "name": "LexAI",
        "prefix": "#LEX",
        "severity": "Critical",
        "health_rate": 86,
        "status": "Active",
        "lead": "Bhupesh",
        "developers": ["Rishit", "Vidhi", "Akshit"],
        "qa": ["Sriraj", "Vidhi"],
        "description": "Generative legal AI assistant, neural document summarization, contract review, and compliance intelligence."
    }
]

def sync_database():
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # 1. Upsert projects with clean prefixes
            for p in CORE_PROJECTS:
                cur.execute("""
                    INSERT INTO quality_projects (
                        id, name, prefix, severity, health_rate, status, lead, developers, qa, description
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (name) DO UPDATE SET
                        id = EXCLUDED.id,
                        prefix = EXCLUDED.prefix,
                        severity = EXCLUDED.severity,
                        health_rate = EXCLUDED.health_rate,
                        status = EXCLUDED.status,
                        lead = EXCLUDED.lead,
                        developers = EXCLUDED.developers,
                        qa = EXCLUDED.qa,
                        description = EXCLUDED.description,
                        updated_at = CURRENT_TIMESTAMP
                """, (
                    p["id"],
                    p["name"],
                    p["prefix"],
                    p["severity"],
                    p["health_rate"],
                    p["status"],
                    p["lead"],
                    json.dumps(p["developers"]),
                    json.dumps(p["qa"]),
                    p["description"]
                ))
            print("Upserted 6 core projects with prefixes.")

            # 2. Update existing bug IDs to start with project's prefix:
            # LexAI -> LEX-
            # Talent Central -> TC-
            # Learning Central -> LC-
            # Assessment Central -> AC-
            # Employee Central -> EC-
            # Quality Central -> QC-
            mappings = [
                ('QC-00129', 'LEX-00129'),
                ('QC-00125', 'LEX-00125'),
                ('QC-00123', 'TC-00123'),
                ('QC-00122', 'LC-00122'),
                ('QC-00121', 'AC-00121'),
                ('QC-00120', 'EC-00120'),
            ]

            for old_id, new_id in mappings:
                # Check if old_id exists
                cur.execute("SELECT id FROM quality_bugs WHERE id = %s", (old_id,))
                if cur.fetchone():
                    # Check if new_id already exists
                    cur.execute("SELECT id FROM quality_bugs WHERE id = %s", (new_id,))
                    if cur.fetchone():
                        cur.execute("DELETE FROM quality_bugs WHERE id = %s", (old_id,))
                    else:
                        cur.execute("UPDATE quality_bugs SET id = %s WHERE id = %s", (new_id, old_id))
                    print(f"Updated {old_id} -> {new_id}")

            # 3. Clean up any bugs where project does not match prefix
            cur.execute("""
                UPDATE quality_bugs
                SET id = REPLACE(id, 'QC-', 'LEX-')
                WHERE LOWER(project) LIKE '%lex%' AND id LIKE 'QC-%'
            """)
            cur.execute("""
                UPDATE quality_bugs
                SET id = REPLACE(id, 'QC-', 'TC-')
                WHERE LOWER(project) LIKE '%talent%' AND id LIKE 'QC-%'
            """)
            cur.execute("""
                UPDATE quality_bugs
                SET id = REPLACE(id, 'QC-', 'LC-')
                WHERE LOWER(project) LIKE '%learning%' AND id LIKE 'QC-%'
            """)
            cur.execute("""
                UPDATE quality_bugs
                SET id = REPLACE(id, 'QC-', 'AC-')
                WHERE LOWER(project) LIKE '%assessment%' AND id LIKE 'QC-%'
            """)
            cur.execute("""
                UPDATE quality_bugs
                SET id = REPLACE(id, 'QC-', 'EC-')
                WHERE LOWER(project) LIKE '%employee%' AND id LIKE 'QC-%'
            """)

            # 4. Remove any remaining non-core project bugs
            cur.execute("""
                DELETE FROM quality_bugs
                WHERE LOWER(project) NOT IN ('talent central', 'learning central', 'assessment central', 'employee central', 'quality central', 'lexai')
            """)

            # 5. Update activities
            for old_id, new_id in mappings:
                cur.execute(f"UPDATE quality_activities SET text = REPLACE(text, '{old_id}', '{new_id}')")

            conn.commit()

            # Verify
            cur.execute("SELECT id, name, prefix FROM quality_projects ORDER BY id ASC")
            print("quality_projects in DB:", cur.fetchall())

            cur.execute("SELECT id, project, title FROM quality_bugs ORDER BY id ASC")
            print("quality_bugs in DB:", cur.fetchall())

    finally:
        conn.close()

if __name__ == "__main__":
    sync_database()
