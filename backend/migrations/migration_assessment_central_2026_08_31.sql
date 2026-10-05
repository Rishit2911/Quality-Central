-- ============================================================
-- PHYGITRON360 — Assessment Central Production Migration
-- Generated: 2026-08-31
-- Safe to run on production: all statements use IF NOT EXISTS
-- Run this against EVERY tenant schema + public schema
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. tenants table
--    New: settings (JSONB) — org-level config storage
-- ─────────────────────────────────────────────────────────────
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;


-- ─────────────────────────────────────────────────────────────
-- 2. assessment_assignments table
--    New: proctoring_config — strictness + feature toggles
--         resume_count      — how many times candidate reopened test
-- ─────────────────────────────────────────────────────────────
ALTER TABLE assessment_assignments
    ADD COLUMN IF NOT EXISTS proctoring_config JSONB;

ALTER TABLE assessment_assignments
    ADD COLUMN IF NOT EXISTS resume_count INTEGER DEFAULT 0;


-- ─────────────────────────────────────────────────────────────
-- 3. proctoring_strikes (NEW TABLE)
--    Individual strike log per assignment. Survives page reloads.
--    Frontend loads this on resume to restore strike count.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proctoring_strikes (
    id              SERIAL PRIMARY KEY,
    assignment_id   INTEGER NOT NULL
                        REFERENCES assessment_assignments(id)
                        ON DELETE CASCADE,
    violation_name  TEXT NOT NULL,
    flag_type       TEXT DEFAULT 'proctoring_violation',
    strike_index    INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proctoring_strikes_assignment
    ON proctoring_strikes(assignment_id);


-- ─────────────────────────────────────────────────────────────
-- 4. assessments table
--    New: sections (JSONB) — array of section definitions
-- ─────────────────────────────────────────────────────────────
ALTER TABLE assessments
    ADD COLUMN IF NOT EXISTS sections JSONB DEFAULT '[]'::jsonb;


-- ─────────────────────────────────────────────────────────────
-- 5. assessment_questions table
--    New: section_id TEXT  — which section this question belongs to
--         difficulty TEXT  — 'easy' | 'medium' | 'hard'
--    Safe repeats (already exist in prod, IF NOT EXISTS guards):
--         tags JSONB, images JSONB
-- ─────────────────────────────────────────────────────────────
ALTER TABLE assessment_questions
    ADD COLUMN IF NOT EXISTS section_id  TEXT;

ALTER TABLE assessment_questions
    ADD COLUMN IF NOT EXISTS difficulty  TEXT DEFAULT 'medium';

ALTER TABLE assessment_questions
    ADD COLUMN IF NOT EXISTS tags   JSONB DEFAULT '[]'::jsonb;

ALTER TABLE assessment_questions
    ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;


-- ─────────────────────────────────────────────────────────────
-- HOW TO RUN
-- ─────────────────────────────────────────────────────────────
-- Single schema:
--   psql -U <user> -d <dbname> -f this_file.sql
--
-- Per-tenant (multi-schema):
--   SET search_path TO "tenant_schema_name";
--   \i this_file.sql
--
-- NOTE: database.py create_tables() runs these same statements
-- on backend startup. If you deploy the new code and restart
-- the backend BEFORE running this manually, it will auto-apply.
-- Still recommended to run this manually first on production.
-- ─────────────────────────────────────────────────────────────
