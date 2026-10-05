"""
PHYGITRON 360 — Core Permission System
========================================
Single source of truth for:
  - Permission key constants (class P)
  - Default role → permission seed matrix
  - FastAPI dependency guards:
      require_permission(key)  → PBAC gate
      require_module(module)   → module access gate
      require_role(roles)      → legacy RBAC shim (prefer require_permission)
"""

from __future__ import annotations
import logging
from typing import List, Dict, Callable, Union
from fastapi import Depends, HTTPException
from backend.core.auth import get_current_user

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Permission Key Registry
# All permission keys used anywhere in the platform are declared here.
# Modules are responsible for nothing but importing these; no magic strings.
# ---------------------------------------------------------------------------

class P:
    """Canonical permission key constants. Use P.XXX everywhere — never raw strings."""

    # ── Module-level access gates ───────────────────────────────────────────
    MODULE_SOURCE_ACCESS  = "module.source.access"
    MODULE_FORGE_ACCESS   = "module.forge.access"
    MODULE_VERIFY_ACCESS  = "module.verify.access"
    MODULE_DEPLOY_ACCESS  = "module.deploy.access"
    MODULE_QUALITY_ACCESS = "module.quality.access"
    MODULE_LEXAI_ACCESS   = "module.lexai.access"

    # ── Platform / Admin ────────────────────────────────────────────────────
    MANAGE_SYSTEM         = "manage_system"
    VIEW_REPORTS          = "view_reports"
    MANAGE_OPS            = "manage_ops"
    ADMIN_USERS_MANAGE    = "admin.users.manage"
    ADMIN_ROLES_MANAGE    = "admin.roles.manage"  # Manage role-level permission overrides
    ADMIN_TENANTS_PROVISION = "admin.tenants.provision"  # Provision / delete tenants (super_admin only in practice)

    # ── Deploy: Employees ────────────────────────────────────────────────────
    DEPLOY_EMP_VIEW_LIST            = "deploy.employees.view_list"
    DEPLOY_EMP_VIEW_TEAM            = "deploy.employees.view_team"
    DEPLOY_EMP_VIEW_PROFILE         = "deploy.employees.view_profile"  # View other basic profiles
    DEPLOY_EMP_VIEW_PERSONAL        = "deploy.employees.view_personal" # View own profile
    DEPLOY_EMP_VIEW_PROFILE_SENSITIVE = "deploy.employees.view_profile_sensitive"
    DEPLOY_EMP_VIEW_PROFILE_FINANCIAL = "deploy.employees.view_profile_financial"
    DEPLOY_EMP_CREATE               = "deploy.employees.create"
    DEPLOY_EMP_OFFBOARD             = "deploy.employees.offboard"
    DEPLOY_EMP_DELETE               = "deploy.employees.delete"
    DEPLOY_EMP_EDIT_BASIC           = "deploy.employees.edit_basic"
    DEPLOY_EMP_EDIT_JOB             = "deploy.employees.edit_job"
    DEPLOY_EMP_EDIT_FINANCIAL       = "deploy.employees.edit_financial"
    DEPLOY_EMP_APPROVE_BASIC        = "deploy.employees.approve_basic"
    DEPLOY_EMP_APPROVE_SENSITIVE    = "deploy.employees.approve_sensitive"
    DEPLOY_EMP_APPROVE_FINANCIAL    = "deploy.employees.approve_financial"
    DEPLOY_EMP_EXPORT               = "deploy.employees.export"
    DEPLOY_EMP_MANAGE_DOCS          = "deploy.employees.manage_documents"

    # ── Deploy: Assets ───────────────────────────────────────────────────────
    DEPLOY_ASSETS_VIEW_PERSONAL     = "deploy.assets.view_personal"
    DEPLOY_ASSETS_VIEW_ALL          = "deploy.assets.view_all"
    DEPLOY_ASSETS_MANAGE_ONBOARDING = "deploy.assets.manage_onboarding"
    DEPLOY_ASSETS_MANAGE_CLEARANCE  = "deploy.assets.manage_clearance"
    DEPLOY_ASSETS_EXPORT_REPORTS    = "deploy.assets.export_reports"

    # ── Deploy: Attendance & Leaves ──────────────────────────────────────────
    DEPLOY_ATT_VIEW_PERSONAL        = "deploy.attendance.view_personal"
    DEPLOY_ATT_VIEW_TEAM            = "deploy.attendance.view_team"
    DEPLOY_ATT_VIEW_ALL             = "deploy.attendance.view_all"
    DEPLOY_ATT_LOG_ATTENDANCE       = "deploy.attendance.log_attendance"
    DEPLOY_ATT_REQ_CORRECTION       = "deploy.attendance.request_correction"
    DEPLOY_ATT_APP_CORRECTION       = "deploy.attendance.approve_correction"
    DEPLOY_LEAVES_VIEW_PERSONAL     = "deploy.leaves.view_personal"
    DEPLOY_LEAVES_VIEW_TEAM         = "deploy.leaves.view_team"
    DEPLOY_LEAVES_VIEW_ALL          = "deploy.leaves.view_all"
    DEPLOY_LEAVES_REQUEST           = "deploy.leaves.request"
    DEPLOY_LEAVES_APPROVE           = "deploy.leaves.approve"
    DEPLOY_LEAVES_MANAGE_BALANCES   = "deploy.leaves.manage_balances"
    DEPLOY_ATT_MANAGE_POLICIES      = "deploy.attendance.manage_policies"

    # ── Deploy: Onboarding ───────────────────────────────────────────────────
    DEPLOY_ONBOARD_VIEW             = "deploy.onboarding.view"
    DEPLOY_ONBOARD_SEND_INVITE      = "deploy.onboarding.send_invite"
    DEPLOY_ONBOARD_CANCEL_INVITE    = "deploy.onboarding.cancel_invite"
    DEPLOY_ONBOARD_REVIEW_SUBMISSIONS = "deploy.onboarding.review_submissions"
    DEPLOY_ONBOARD_MANAGE           = "deploy.onboarding.manage"  # Approve / reject onboarding submissions

    # ── Deploy: Payroll ──────────────────────────────────────────────────────
    DEPLOY_PAYROLL_VIEW_PERSONAL    = "deploy.payroll.view_personal"
    DEPLOY_PAYROLL_VIEW_ALL         = "deploy.payroll.view_all"
    DEPLOY_PAYROLL_RUN_PAYROLL      = "deploy.payroll.run_payroll"
    DEPLOY_PAYROLL_EDIT_RECORDS     = "deploy.payroll.edit_records"
    DEPLOY_PAYROLL_UPLOAD_BULK      = "deploy.payroll.upload_bulk"
    DEPLOY_PAYROLL_APPROVE          = "deploy.payroll.approve"
    DEPLOY_PAYROLL_EXPORT_REPORTS   = "deploy.payroll.export_reports"

    # ── Deploy: Performance ──────────────────────────────────────────────────
    DEPLOY_PERF_VIEW_PERSONAL       = "deploy.performance.view_personal"
    DEPLOY_PERF_VIEW_TEAM           = "deploy.performance.view_team"
    DEPLOY_PERF_VIEW_ALL            = "deploy.performance.view_all"
    DEPLOY_PERF_ASSIGN_KRAS         = "deploy.performance.assign_kras"
    DEPLOY_PERF_SUBMIT_SELF         = "deploy.performance.submit_self_rating"
    DEPLOY_PERF_SUBMIT_MANAGER      = "deploy.performance.submit_manager_rating"
    DEPLOY_PERF_MANAGE_ASSESSMENTS  = "deploy.performance.manage_assessments"
    DEPLOY_PERF_EXPORT_REPORTS      = "deploy.performance.export_reports"

    # ── Deploy: Learning & Development (unmapped) ────────────────────────────
    DEPLOY_ASSESS_VIEW              = "deploy.assessments.view"
    DEPLOY_ASSESS_MANAGE            = "deploy.assessments.manage"
    DEPLOY_TRAIN_VIEW               = "deploy.training.view"
    DEPLOY_TRAIN_MANAGE             = "deploy.training.manage"

    # ── Deploy: Dashboard / Notifications / Analytics ────────────────────────
    DEPLOY_ANALYTICS_VIEW_KPIS      = "deploy.analytics.view_kpis"
    DEPLOY_ANALYTICS_VIEW_STATUS    = "deploy.analytics.view_status"
    DEPLOY_ANALYTICS_VIEW_HIRING    = "deploy.analytics.view_hiring"
    DEPLOY_ANALYTICS_VIEW_DEMO      = "deploy.analytics.view_demographics"
    DEPLOY_ANALYTICS_VIEW_TALENT    = "deploy.analytics.view_talent"
    DEPLOY_DASH_ADMIN               = "deploy.dashboard.view_admin"
    DEPLOY_NOTIF_ADMIN              = "deploy.notifications.view_admin"
    DEPLOY_NOTIF_MANAGE             = "deploy.notifications.manage"

    # ── Source: Jobs ─────────────────────────────────────────────────────────
    SOURCE_JOBS_VIEW      = "source.jobs.view"
    SOURCE_JOBS_MANAGE    = "source.jobs.manage"

    # ── Source: Candidates ───────────────────────────────────────────────────
    SOURCE_CANDIDATES_VIEW   = "source.candidates.view"
    SOURCE_CANDIDATES_MANAGE = "source.candidates.manage"

    # ── Source: Offers ───────────────────────────────────────────────────────
    SOURCE_OFFERS_VIEW       = "source.offers.view"
    SOURCE_OFFERS_MANAGE     = "source.offers.manage"
    SOURCE_OFFERS_APPROVE    = "source.offers.approve"

    # ── Source: Evaluations & Interviews ─────────────────────────────────────
    SOURCE_EVALUATIONS_MANAGE = "source.evaluations.manage"
    SOURCE_INTERVIEWS_MANAGE  = "source.interviews.manage"

    # ── Verify: Assessment Central ───────────────────────────────────────────
    VERIFY_ASSESS_VIEW         = "verify.assessments.view"
    VERIFY_ASSESS_MANAGE       = "verify.assessments.manage"
    VERIFY_ASSESS_ASSIGN       = "verify.assessments.assign"
    VERIFY_QUESTIONS_VIEW      = "verify.questions.view"
    VERIFY_QUESTIONS_MANAGE    = "verify.questions.manage"
    VERIFY_MONITORING_VIEW     = "verify.monitoring.view"
    VERIFY_RESULTS_VIEW        = "verify.results.view"
    VERIFY_RESULTS_MANAGE      = "verify.results.manage"
    VERIFY_QUERIES_MANAGE      = "verify.queries.manage"

    # ── Forge (future) ───────────────────────────────────────────────────────
    FORGE_COURSES_VIEW    = "forge.courses.view"
    FORGE_COURSES_MANAGE  = "forge.courses.manage"
    FORGE_ENROLL          = "forge.courses.enroll"

    # ── LexAI ─────────────────────────────────────────────────────────────────
    LEXAI_PROJECTS_VIEW    = "lexai.projects.view"
    LEXAI_PROJECTS_MANAGE  = "lexai.projects.manage"
    LEXAI_DESIGN_RUN       = "lexai.design.run"
    LEXAI_STORYBOARD_RUN   = "lexai.storyboard.run"
    LEXAI_EXPORT           = "lexai.export"
    LEXAI_FILES_MANAGE     = "lexai.files.manage"
    LEXAI_VOICE_USE        = "lexai.voice.use"


# ---------------------------------------------------------------------------
# Default Role → Permission Seed Matrix
# Seeded when a new tenant workspace is provisioned.
# super_admin is a platform-level role and is NOT seeded — it gets a
# hardcoded bypass in the guards for platform integrity.
# ---------------------------------------------------------------------------

DEFAULT_PERMISSIONS: Dict[str, List[str]] = {
    "org_admin": [
        # Full platform access
        P.MODULE_SOURCE_ACCESS, P.MODULE_FORGE_ACCESS,
        P.MODULE_VERIFY_ACCESS, P.MODULE_DEPLOY_ACCESS,
        P.MODULE_QUALITY_ACCESS, P.MODULE_LEXAI_ACCESS,
        # Admin
        P.VIEW_REPORTS, P.MANAGE_OPS, P.ADMIN_USERS_MANAGE, P.ADMIN_ROLES_MANAGE,
        # Deploy: Employees
        P.DEPLOY_EMP_VIEW_LIST, P.DEPLOY_EMP_VIEW_TEAM, P.DEPLOY_EMP_VIEW_PROFILE, P.DEPLOY_EMP_VIEW_PROFILE_SENSITIVE, P.DEPLOY_EMP_VIEW_PROFILE_FINANCIAL,
        P.DEPLOY_EMP_CREATE, P.DEPLOY_EMP_EDIT_BASIC, P.DEPLOY_EMP_EDIT_JOB, P.DEPLOY_EMP_EDIT_FINANCIAL,
        P.DEPLOY_EMP_APPROVE_BASIC, P.DEPLOY_EMP_APPROVE_SENSITIVE, P.DEPLOY_EMP_APPROVE_FINANCIAL,
        P.DEPLOY_EMP_DELETE, P.DEPLOY_EMP_OFFBOARD, P.DEPLOY_EMP_EXPORT, P.DEPLOY_EMP_MANAGE_DOCS,
        # Deploy: Assets
        P.DEPLOY_ASSETS_VIEW_PERSONAL, P.DEPLOY_ASSETS_VIEW_ALL, P.DEPLOY_ASSETS_MANAGE_ONBOARDING, P.DEPLOY_ASSETS_MANAGE_CLEARANCE, P.DEPLOY_ASSETS_EXPORT_REPORTS,
        # Deploy: Attendance & Leaves
        P.DEPLOY_ATT_VIEW_PERSONAL, P.DEPLOY_ATT_VIEW_TEAM, P.DEPLOY_ATT_VIEW_ALL, P.DEPLOY_ATT_LOG_ATTENDANCE, P.DEPLOY_ATT_REQ_CORRECTION, P.DEPLOY_ATT_APP_CORRECTION,
        P.DEPLOY_LEAVES_VIEW_PERSONAL, P.DEPLOY_LEAVES_VIEW_TEAM, P.DEPLOY_LEAVES_VIEW_ALL, P.DEPLOY_LEAVES_REQUEST, P.DEPLOY_LEAVES_APPROVE, P.DEPLOY_LEAVES_MANAGE_BALANCES,
        P.DEPLOY_ATT_MANAGE_POLICIES,
        # Deploy: Onboarding
        P.DEPLOY_ONBOARD_VIEW, P.DEPLOY_ONBOARD_SEND_INVITE, P.DEPLOY_ONBOARD_CANCEL_INVITE, P.DEPLOY_ONBOARD_REVIEW_SUBMISSIONS, P.DEPLOY_ONBOARD_MANAGE,
        # Deploy: Payroll
        P.DEPLOY_PAYROLL_VIEW_PERSONAL, P.DEPLOY_PAYROLL_VIEW_ALL, P.DEPLOY_PAYROLL_RUN_PAYROLL, P.DEPLOY_PAYROLL_EDIT_RECORDS, P.DEPLOY_PAYROLL_UPLOAD_BULK, P.DEPLOY_PAYROLL_APPROVE, P.DEPLOY_PAYROLL_EXPORT_REPORTS,
        # Deploy: Performance
        P.DEPLOY_PERF_VIEW_PERSONAL, P.DEPLOY_PERF_VIEW_TEAM, P.DEPLOY_PERF_VIEW_ALL, P.DEPLOY_PERF_ASSIGN_KRAS, P.DEPLOY_PERF_SUBMIT_SELF, P.DEPLOY_PERF_SUBMIT_MANAGER, P.DEPLOY_PERF_MANAGE_ASSESSMENTS, P.DEPLOY_PERF_EXPORT_REPORTS,
        # Deploy: Learning (unmapped)
        P.DEPLOY_ASSESS_VIEW, P.DEPLOY_ASSESS_MANAGE,
        P.DEPLOY_TRAIN_VIEW, P.DEPLOY_TRAIN_MANAGE,
        # Deploy: Dashboard / Notifications / Analytics
        P.DEPLOY_ANALYTICS_VIEW_KPIS, P.DEPLOY_ANALYTICS_VIEW_STATUS, P.DEPLOY_ANALYTICS_VIEW_HIRING, P.DEPLOY_ANALYTICS_VIEW_DEMO, P.DEPLOY_ANALYTICS_VIEW_TALENT,
        P.DEPLOY_DASH_ADMIN, P.DEPLOY_NOTIF_ADMIN, P.DEPLOY_NOTIF_MANAGE,
        # Source
        P.SOURCE_JOBS_VIEW, P.SOURCE_JOBS_MANAGE,
        P.SOURCE_CANDIDATES_VIEW, P.SOURCE_CANDIDATES_MANAGE,
        P.SOURCE_OFFERS_VIEW, P.SOURCE_OFFERS_MANAGE, P.SOURCE_OFFERS_APPROVE,
        P.SOURCE_EVALUATIONS_MANAGE, P.SOURCE_INTERVIEWS_MANAGE,
        # Verify
        P.VERIFY_ASSESS_VIEW, P.VERIFY_ASSESS_MANAGE, P.VERIFY_ASSESS_ASSIGN,
        P.VERIFY_QUESTIONS_VIEW, P.VERIFY_QUESTIONS_MANAGE,
        P.VERIFY_MONITORING_VIEW, P.VERIFY_RESULTS_VIEW, P.VERIFY_RESULTS_MANAGE,
        P.VERIFY_QUERIES_MANAGE,
        # Forge
        P.FORGE_COURSES_VIEW, P.FORGE_COURSES_MANAGE, P.FORGE_ENROLL,
        # LexAI
        P.LEXAI_PROJECTS_VIEW, P.LEXAI_PROJECTS_MANAGE,
        P.LEXAI_DESIGN_RUN, P.LEXAI_STORYBOARD_RUN,
        P.LEXAI_EXPORT, P.LEXAI_FILES_MANAGE, P.LEXAI_VOICE_USE,
    ],
    "manager": [
        P.MODULE_SOURCE_ACCESS, P.MODULE_FORGE_ACCESS,
        P.MODULE_VERIFY_ACCESS, P.MODULE_DEPLOY_ACCESS,
        P.MODULE_QUALITY_ACCESS, P.MODULE_LEXAI_ACCESS,
        P.VIEW_REPORTS,
        # Deploy: Employees
        P.DEPLOY_EMP_VIEW_TEAM, P.DEPLOY_EMP_VIEW_PROFILE, P.DEPLOY_EMP_APPROVE_BASIC, P.DEPLOY_EMP_APPROVE_SENSITIVE,
        # Deploy: Assets
        P.DEPLOY_ASSETS_VIEW_PERSONAL,
        # Deploy: Attendance
        P.DEPLOY_ATT_VIEW_PERSONAL, P.DEPLOY_ATT_VIEW_TEAM, P.DEPLOY_ATT_LOG_ATTENDANCE, P.DEPLOY_ATT_REQ_CORRECTION, P.DEPLOY_ATT_APP_CORRECTION,
        P.DEPLOY_LEAVES_VIEW_PERSONAL, P.DEPLOY_LEAVES_VIEW_TEAM, P.DEPLOY_LEAVES_REQUEST, P.DEPLOY_LEAVES_APPROVE,
        # Deploy: Onboarding
        P.DEPLOY_ONBOARD_VIEW, P.DEPLOY_ONBOARD_MANAGE,
        # Deploy: Payroll
        P.DEPLOY_PAYROLL_VIEW_PERSONAL,
        # Deploy: Performance
        P.DEPLOY_PERF_VIEW_PERSONAL, P.DEPLOY_PERF_VIEW_TEAM, P.DEPLOY_PERF_SUBMIT_SELF, P.DEPLOY_PERF_SUBMIT_MANAGER,
        # Deploy: Learning (unmapped)
        P.DEPLOY_ASSESS_VIEW, P.DEPLOY_ASSESS_MANAGE,
        P.DEPLOY_TRAIN_VIEW,
        # Deploy: Dashboard / Notifications / Analytics
        P.DEPLOY_ANALYTICS_VIEW_KPIS, P.DEPLOY_ANALYTICS_VIEW_STATUS, P.DEPLOY_ANALYTICS_VIEW_DEMO, P.DEPLOY_ANALYTICS_VIEW_TALENT,
        P.DEPLOY_DASH_ADMIN, P.DEPLOY_NOTIF_ADMIN,
        # Source
        P.SOURCE_JOBS_VIEW, P.SOURCE_JOBS_MANAGE,
        P.SOURCE_CANDIDATES_VIEW, P.SOURCE_CANDIDATES_MANAGE,
        P.SOURCE_OFFERS_VIEW, P.SOURCE_OFFERS_MANAGE,
        P.SOURCE_EVALUATIONS_MANAGE, P.SOURCE_INTERVIEWS_MANAGE,
        # Verify
        P.VERIFY_ASSESS_VIEW, P.VERIFY_ASSESS_ASSIGN,
        P.VERIFY_QUESTIONS_VIEW, P.VERIFY_MONITORING_VIEW,
        P.VERIFY_RESULTS_VIEW, P.VERIFY_QUERIES_MANAGE,
        # Forge
        P.FORGE_COURSES_VIEW, P.FORGE_ENROLL,
        # LexAI
        P.LEXAI_PROJECTS_VIEW, P.LEXAI_PROJECTS_MANAGE,
        P.LEXAI_DESIGN_RUN, P.LEXAI_STORYBOARD_RUN,
        P.LEXAI_EXPORT, P.LEXAI_FILES_MANAGE, P.LEXAI_VOICE_USE,
    ],
    "employee": [
        P.MODULE_FORGE_ACCESS, P.MODULE_DEPLOY_ACCESS,
        P.MODULE_QUALITY_ACCESS, P.MODULE_LEXAI_ACCESS,
        # Deploy: Employees
        P.DEPLOY_EMP_VIEW_TEAM, P.DEPLOY_EMP_VIEW_PERSONAL,
        # Deploy: Assets
        P.DEPLOY_ASSETS_VIEW_PERSONAL,
        # Deploy: Attendance
        P.DEPLOY_ATT_VIEW_PERSONAL, P.DEPLOY_ATT_LOG_ATTENDANCE, P.DEPLOY_ATT_REQ_CORRECTION,
        P.DEPLOY_LEAVES_VIEW_PERSONAL, P.DEPLOY_LEAVES_REQUEST,
        # Deploy: Payroll
        P.DEPLOY_PAYROLL_VIEW_PERSONAL,
        # Deploy: Performance
        P.DEPLOY_PERF_VIEW_PERSONAL, P.DEPLOY_PERF_SUBMIT_SELF,
        # Deploy: Learning (unmapped)
        P.DEPLOY_ASSESS_VIEW,
        P.DEPLOY_TRAIN_VIEW,
        # Verify: take tests assigned to them
        P.VERIFY_ASSESS_VIEW,
        # Forge: learn
        P.FORGE_COURSES_VIEW, P.FORGE_ENROLL,
        # LexAI
        P.LEXAI_PROJECTS_VIEW, P.LEXAI_PROJECTS_MANAGE,
        P.LEXAI_DESIGN_RUN, P.LEXAI_STORYBOARD_RUN,
        P.LEXAI_EXPORT, P.LEXAI_FILES_MANAGE, P.LEXAI_VOICE_USE,
    ],
    "trainee": [
        P.MODULE_VERIFY_ACCESS,
        P.MODULE_FORGE_ACCESS,
        # Access to view personal profile and take assessments/courses
        P.DEPLOY_EMP_VIEW_PERSONAL,
        P.VERIFY_ASSESS_VIEW,
        P.FORGE_COURSES_VIEW, P.FORGE_ENROLL,
    ],
}


# ---------------------------------------------------------------------------
# FastAPI Dependency Factories
# ---------------------------------------------------------------------------

def _get_user_roles(user: dict) -> List[str]:
    """Normalizes the user's roles from the session dict."""
    raw = user.get("roles") or [user.get("role")]
    return [r.lower() for r in raw if r]


def _is_platform_admin(user_roles: List[str]) -> bool:
    """Returns True only for super_admin — full cross-tenant bypass."""
    return "super_admin" in user_roles or "superadmin" in user_roles


def require_permission(permission_key: Union[str, List[str]]) -> Callable:
    """
    FastAPI dependency factory — PBAC gate.

    Grants access if:
      1. User is super_admin (hardcoded platform bypass), OR
      2. The permission_key (or at least one key if a list is provided) exists and is True in user['permissions']

    NOTE: org_admin access is NOT hardcoded here — it is seeded in
    DEFAULT_PERMISSIONS above, so it flows through normal permission lookup.
    This keeps the system fully auditable.
    """
    def permission_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_roles = _get_user_roles(current_user)

        # Platform-level bypass — super_admin only
        if _is_platform_admin(user_roles):
            return current_user

        # Check granular permission
        perms = current_user.get("permissions", {})
        keys_to_check = [permission_key] if isinstance(permission_key, str) else permission_key
        has_access = False

        if isinstance(perms, list):
            # Legacy list format — treat as set of allowed keys
            has_access = any(key in perms for key in keys_to_check)
        elif isinstance(perms, dict):
            has_access = any(bool(perms.get(key, False)) for key in keys_to_check)

        if not has_access:
            keys_str = "', '".join(keys_to_check) if isinstance(keys_to_check, list) else permission_key
            logger.warning(
                "Permission denied for user %s: missing %s",
                current_user.get("employee_code") or current_user.get("email") or "unknown",
                keys_str,
            )
            raise HTTPException(
                status_code=403,
                detail=f"You don't have permission to do this (Missing: {keys_str}). Contact your admin if you think this is a mistake."
            )
        return current_user
    return permission_checker


def require_module(module_name: str) -> Callable:
    """
    FastAPI dependency factory — module access gate.

    Checks that the resolved module.{name}.access permission is present.
    Falls back to checking modules_enabled list in session if permission
    key is not present (backward compat during migration window).
    """
    perm_key = f"module.{module_name}.access"

    def module_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_roles = _get_user_roles(current_user)

        # Platform-level bypass
        if _is_platform_admin(user_roles):
            return current_user

        # Primary: permission-based check
        perms = current_user.get("permissions", {})
        if isinstance(perms, list):
            has_access = perm_key in perms
        elif isinstance(perms, dict):
            has_access = bool(perms.get(perm_key, False))
        else:
            has_access = False

        if not has_access:
            raise HTTPException(
                status_code=403,
                detail=f"Module '{module_name}' is not available in your workspace."
            )
        return current_user
    return module_checker


def require_role(allowed_roles: List[str]) -> Callable:
    """
    Legacy RBAC shim — retained for backward compatibility during full migration.
    Prefer require_permission() for all new code.

    Will emit a deprecation warning when called.
    """
    import warnings

    def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        warnings.warn(
            f"require_role({allowed_roles!r}) is deprecated. "
            "Migrate to require_permission() with a specific key.",
            DeprecationWarning,
            stacklevel=2
        )
        user_roles = _get_user_roles(current_user)

        if _is_platform_admin(user_roles):
            return current_user

        allowed_lower = [r.lower() for r in allowed_roles]
        # org_admin gets access to everything a manager/employee/candidate can do
        if "org_admin" in user_roles and any(
            r in allowed_lower for r in ["org_admin", "manager", "employee", "candidate"]
        ):
            return current_user

        if not any(r in allowed_lower for r in user_roles):
            logger.warning(
                "Role check denied for user %s: required one of %s, has %s",
                current_user.get("employee_code") or current_user.get("email") or "unknown",
                allowed_roles,
                user_roles,
            )
            raise HTTPException(
                status_code=403,
                detail=f"You don't have permission to do this (Required Role: {allowed_roles}). Contact your admin if you think this is a mistake."
            )
        return current_user
    return role_checker
