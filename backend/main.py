import os
import sys

# Ensure root folder is on sys.path so 'backend.*' imports resolve
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

# Set up central deploy module router
from backend.modules.deploy.api.auth import router as auth_router
from backend.core.dependencies import require_module
from backend.modules.deploy.api.dashboard import router as dashboard_router
from backend.modules.deploy.api.employees import router as employees_router
from backend.modules.deploy.api.assets import router as assets_router
from backend.modules.deploy.api.attendance import router as attendance_router
from backend.modules.deploy.api.holidays import router as holidays_router
from backend.modules.deploy.api.assessments import router as assessments_router
from backend.modules.deploy.api.training import router as training_router
from backend.modules.deploy.api.onboarding import router as onboarding_router, onboard_alias_router
from backend.modules.deploy.api.notifications import router as notifications_router
from backend.modules.deploy.api.password import router as password_router
from backend.modules.deploy.api.payroll import router as payroll_router
from backend.modules.admin.api.admin import router as admin_router
from backend.modules.admin.api.org import router as org_router
from backend.api.billing import router as billing_router
from fastapi import Depends

# Set up Source & Verify modules
from backend.modules.source.api.candidates import router as candidates_router
from backend.modules.source.api.jobs import router as jobs_router
from backend.modules.source.api.offers import router as offers_router

from backend.modules.verify.api.builder import router as verify_builder_router
from backend.modules.verify.api.assignments import router as verify_assignments_router
from backend.modules.verify.api.submissions import router as verify_submissions_router
from backend.modules.verify.api.sandbox import router as verify_sandbox_router
from backend.modules.verify.api.queries import router as verify_queries_router
from backend.modules.verify.api.question_bank import router as verify_question_bank_router
from backend.modules.verify.api.live_monitoring import router as verify_live_monitor_router

# Set up LexAI module
from backend.modules.lexai.api.projects import router as lexai_projects_router, alias_history_router
from backend.modules.lexai.api.intake import router as lexai_intake_router, alias_intake_router
from backend.modules.lexai.api.design import router as lexai_design_router, alias_design_router
from backend.modules.lexai.api.storyboard import router as lexai_storyboard_router, alias_storyboard_router
from backend.modules.lexai.api.edit import router as lexai_edit_router, alias_edit_router
from backend.modules.lexai.api.extraction import router as lexai_extraction_router, alias_extraction_router
from backend.modules.lexai.api.export import router as lexai_export_router, alias_export_router
from backend.modules.lexai.api.folders import router as lexai_folders_router, alias_folders_router
from backend.modules.lexai.api.files import router as lexai_files_router, alias_files_router
from backend.modules.lexai.api.voice import router as lexai_voice_router, alias_voice_router
from backend.modules.lexai.api.sop import router as lexai_sop_router, alias_sop_router
from backend.modules.quality.api.dashboard import router as quality_router

app = FastAPI(
    title="PHYGITRON 360",
    description="Multi-tenant Modular Talent Intelligence Platform API",
    version="1.0.0"
)

# Automated Schema Sync (Moved to startup event for non-blocking cold starts)

# CORS configuration
origins = ["*"] # Allow all for network dev

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global API Response
@app.get("/api/health")
def health_check():
    return JSONResponse(content={"status": "online", "message": "PHYGITRON 360 Platform is operational"})

# Static Files — uploads (user documents)
from backend.core.database import DATA_DIR
uploads_dir = os.path.join(DATA_DIR, 'uploads')
if not os.path.exists(uploads_dir):
    os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Static Files — branding assets (logos, platform images served in emails)
import pathlib
static_assets_dir = pathlib.Path(__file__).parent / "assets" / "static"
static_assets_dir.mkdir(parents=True, exist_ok=True)
# Mount at /api/static because DO App Platform routes /api to backend
app.mount("/api/static", StaticFiles(directory=str(static_assets_dir)), name="api_static")
app.mount("/static", StaticFiles(directory=str(static_assets_dir)), name="static")

# Background Workers
import asyncio
from backend.modules.source.services.candidate_service import CandidateService
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from backend.core.scheduler_jobs import run_missed_clockout_check, run_bimonthly_report

scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")

async def run_tenant_background_init():
    """Runs tenant schema migrations and background workers asynchronously without blocking server startup."""
    import backend.core.database as db
    from backend.core.database import get_db_connection, create_tables

    def _get_tenants():
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute('SET search_path TO public')
                cur.execute("SELECT id FROM tenants")
                return [row[0] for row in cur.fetchall()]
        finally:
            conn.close()

    try:
        tenant_ids = await asyncio.to_thread(_get_tenants)
    except Exception as e:
        print(f"[Startup] Failed to fetch tenants for background migration: {e}", flush=True)
        return

    print(f"[Startup] Running schema migration for {len(tenant_ids)} tenants: {tenant_ids}", flush=True)

    # Run create_tables() for every tenant in background thread
    for t_id in tenant_ids:
        if t_id == 'public':
            continue
        try:
            await asyncio.to_thread(create_tables, schema_name=t_id)
            print(f"[Startup] Schema migration OK for {t_id}", flush=True)
        except Exception as e:
            print(f"[Startup] Schema migration FAILED for {t_id}: {e}", flush=True)

    # Post-migrations in background thread
    def _run_post_migrations():
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SET lock_timeout = '5s'")
                for t_id in ['public'] + tenant_ids:
                    try:
                        cur.execute(f'SET search_path TO "{t_id}"')
                        cur.execute('ALTER TABLE users RENAME COLUMN roles TO templates')
                        conn.commit()
                        print(f"[Migration] Renamed roles to templates for {t_id}", flush=True)
                    except Exception:
                        conn.rollback()

                    try:
                        cur.execute(f'SET search_path TO "{t_id}", public')
                        cur.execute('''
                            UPDATE company_holidays 
                            SET holiday_type = 'regular_holiday' 
                            WHERE holiday_type IN ('company_holiday', 'festival')
                        ''')
                        cur.execute('''
                            UPDATE company_holidays 
                            SET holiday_type = 'restricted_holiday' 
                            WHERE holiday_type IN ('optional_holiday')
                        ''')
                        conn.commit()
                    except Exception:
                        conn.rollback()
        except Exception as e:
            print(f"[Startup] Post-migration error: {e}", flush=True)
        finally:
            conn.close()

    await asyncio.to_thread(_run_post_migrations)

    # Start bulk upload workers directly as async tasks
    for t_id in tenant_ids:
        try:
            svc = CandidateService(tenant_id=t_id)
            asyncio.create_task(svc.process_bulk_upload_queue())
            print(f"[Startup] Bulk-upload worker started for {t_id}", flush=True)
        except Exception as e:
            print(f"[Startup] Failed starting bulk-upload worker for {t_id}: {e}", flush=True)

    print("[Startup] Tenant background initialization complete.", flush=True)


@app.on_event("startup")
async def start_background_workers():
    import backend.core.database as db
    db.main_loop = asyncio.get_running_loop()
    from backend.core.database import create_tables

    # First, ensure the public schema and master tables exist
    try:
        create_tables(schema_name='public')
        print("[Startup] Public schema migration OK", flush=True)
    except Exception as e:
        print(f"[Startup] Public schema migration FAILED: {e}", flush=True)

    # Start APScheduler tasks
    scheduler.add_job(run_missed_clockout_check, CronTrigger(hour="17,21", minute=0))
    scheduler.add_job(run_bimonthly_report, CronTrigger(hour=9, minute=0))
    scheduler.start()

    # Launch tenant migrations and workers asynchronously so port 8000 opens immediately
    asyncio.create_task(run_tenant_background_init())

@app.on_event("shutdown")
async def shutdown_event():
    if scheduler.running:
        scheduler.shutdown()

# Include Modules
app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(employees_router, dependencies=[Depends(require_module("deploy"))])
app.include_router(assets_router, dependencies=[Depends(require_module("deploy"))])
app.include_router(attendance_router, dependencies=[Depends(require_module("deploy"))])
app.include_router(holidays_router, dependencies=[Depends(require_module("deploy"))])
app.include_router(assessments_router, dependencies=[Depends(require_module("deploy"))])
app.include_router(training_router, dependencies=[Depends(require_module("deploy"))])
app.include_router(onboarding_router)
app.include_router(onboard_alias_router)
app.include_router(notifications_router, dependencies=[Depends(require_module("deploy"))])
app.include_router(password_router)
app.include_router(payroll_router, dependencies=[Depends(require_module("deploy"))])
app.include_router(admin_router)
app.include_router(org_router)
app.include_router(billing_router)
app.include_router(candidates_router, dependencies=[Depends(require_module("source"))])
app.include_router(jobs_router, dependencies=[Depends(require_module("source"))])
app.include_router(offers_router, dependencies=[Depends(require_module("source"))])

app.include_router(verify_builder_router, dependencies=[Depends(require_module("verify"))])
app.include_router(verify_assignments_router, dependencies=[Depends(require_module("verify"))])
app.include_router(verify_submissions_router, dependencies=[Depends(require_module("verify"))])
app.include_router(verify_sandbox_router, dependencies=[Depends(require_module("verify"))])
app.include_router(verify_queries_router, dependencies=[Depends(require_module("verify"))])
app.include_router(verify_question_bank_router, dependencies=[Depends(require_module("verify"))])
app.include_router(verify_live_monitor_router)

# LexAI Routers
app.include_router(lexai_projects_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(alias_history_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(lexai_intake_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(alias_intake_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(lexai_design_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(alias_design_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(lexai_storyboard_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(alias_storyboard_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(lexai_edit_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(alias_edit_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(lexai_extraction_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(alias_extraction_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(lexai_export_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(alias_export_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(lexai_folders_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(alias_folders_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(lexai_files_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(alias_files_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(lexai_voice_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(alias_voice_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(lexai_sop_router, dependencies=[Depends(require_module("lexai"))])
app.include_router(alias_sop_router, dependencies=[Depends(require_module("lexai"))])

# Quality Central Router
app.include_router(quality_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
