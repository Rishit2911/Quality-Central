/**
 * PHYGITRON 360 — Frontend Permission Key Registry
 * ==================================================
 * Mirror of backend/core/permissions.py class P.
 * Use P.XXX everywhere — never raw strings — to prevent typos and enable
 * easy refactoring when keys change.
 *
 * Usage:
 *   import { P } from '@/core/permissions';
 *   const canEdit = usePermission(P.DEPLOY_EMP_EDIT);
 *   <HasPermission perm={P.SOURCE_JOBS_MANAGE}> ... </HasPermission>
 */

export const P = {
  // ── Module access gates ──────────────────────────────────────────────────
  MODULE_SOURCE_ACCESS:  'module.source.access',
  MODULE_FORGE_ACCESS:   'module.forge.access',
  MODULE_VERIFY_ACCESS:  'module.verify.access',
  MODULE_DEPLOY_ACCESS:  'module.deploy.access',
  MODULE_QUALITY_ACCESS: 'module.quality.access',
  MODULE_LEXAI_ACCESS:   'module.lexai.access',

  // ── Platform / Admin ────────────────────────────────────────────────────
  MANAGE_SYSTEM:         'manage_system',
  VIEW_REPORTS:          'view_reports',
  MANAGE_OPS:            'manage_ops',
  ADMIN_USERS_MANAGE:    'admin.users.manage',
  ADMIN_ROLES_MANAGE:    'admin.roles.manage',
  ADMIN_TENANTS_PROVISION: 'admin.tenants.provision',  // Provision / delete tenants (super_admin only in practice)

  // ── Deploy: Employees ────────────────────────────────────────────────────
  DEPLOY_EMP_VIEW_LIST:            'deploy.employees.view_list',
  DEPLOY_EMP_VIEW_TEAM:            'deploy.employees.view_team',
  DEPLOY_EMP_VIEW_PROFILE:         'deploy.employees.view_profile',
  DEPLOY_EMP_VIEW_PERSONAL:        'deploy.employees.view_personal',
  DEPLOY_EMP_VIEW_PROFILE_SENSITIVE: 'deploy.employees.view_profile_sensitive',
  DEPLOY_EMP_VIEW_PROFILE_FINANCIAL: 'deploy.employees.view_profile_financial',
  DEPLOY_EMP_CREATE:               'deploy.employees.create',
  DEPLOY_EMP_OFFBOARD:             'deploy.employees.offboard',
  DEPLOY_EMP_DELETE:               'deploy.employees.delete',
  DEPLOY_EMP_EDIT_BASIC:           'deploy.employees.edit_basic',
  DEPLOY_EMP_EDIT_JOB:             'deploy.employees.edit_job',
  DEPLOY_EMP_EDIT_FINANCIAL:       'deploy.employees.edit_financial',
  DEPLOY_EMP_APPROVE_BASIC:        'deploy.employees.approve_basic',
  DEPLOY_EMP_APPROVE_SENSITIVE:    'deploy.employees.approve_sensitive',
  DEPLOY_EMP_APPROVE_FINANCIAL:    'deploy.employees.approve_financial',
  DEPLOY_EMP_EXPORT:               'deploy.employees.export',
  DEPLOY_EMP_MANAGE_DOCS:          'deploy.employees.manage_documents',

  // ── Deploy: Assets ───────────────────────────────────────────────────────
  DEPLOY_ASSETS_VIEW_PERSONAL:     'deploy.assets.view_personal',
  DEPLOY_ASSETS_VIEW_ALL:          'deploy.assets.view_all',
  DEPLOY_ASSETS_MANAGE_ONBOARDING: 'deploy.assets.manage_onboarding',
  DEPLOY_ASSETS_MANAGE_CLEARANCE:  'deploy.assets.manage_clearance',
  DEPLOY_ASSETS_EXPORT_REPORTS:    'deploy.assets.export_reports',

  // ── Deploy: Attendance & Leaves ──────────────────────────────────────────
  DEPLOY_ATT_VIEW_PERSONAL:        'deploy.attendance.view_personal',
  DEPLOY_ATT_VIEW_TEAM:            'deploy.attendance.view_team',
  DEPLOY_ATT_VIEW_ALL:             'deploy.attendance.view_all',
  DEPLOY_ATT_LOG_ATTENDANCE:       'deploy.attendance.log_attendance',
  DEPLOY_ATT_REQ_CORRECTION:       'deploy.attendance.request_correction',
  DEPLOY_ATT_APP_CORRECTION:       'deploy.attendance.approve_correction',
  DEPLOY_LEAVES_VIEW_PERSONAL:     'deploy.leaves.view_personal',
  DEPLOY_LEAVES_VIEW_TEAM:         'deploy.leaves.view_team',
  DEPLOY_LEAVES_VIEW_ALL:          'deploy.leaves.view_all',
  DEPLOY_LEAVES_REQUEST:           'deploy.leaves.request',
  DEPLOY_LEAVES_APPROVE:           'deploy.leaves.approve',
  DEPLOY_LEAVES_MANAGE_BALANCES:   'deploy.leaves.manage_balances',
  DEPLOY_ATT_MANAGE_POLICIES:      'deploy.attendance.manage_policies',

  // ── Deploy: Onboarding ───────────────────────────────────────────────────
  DEPLOY_ONBOARD_VIEW:             'deploy.onboarding.view',
  DEPLOY_ONBOARD_SEND_INVITE:      'deploy.onboarding.send_invite',
  DEPLOY_ONBOARD_CANCEL_INVITE:    'deploy.onboarding.cancel_invite',
  DEPLOY_ONBOARD_REVIEW_SUBMISSIONS: 'deploy.onboarding.review_submissions',
  DEPLOY_ONBOARD_MANAGE:           'deploy.onboarding.manage',  // Approve / reject onboarding submissions

  // ── Deploy: Payroll ──────────────────────────────────────────────────────
  DEPLOY_PAYROLL_VIEW_PERSONAL:    'deploy.payroll.view_personal',
  DEPLOY_PAYROLL_VIEW_ALL:         'deploy.payroll.view_all',
  DEPLOY_PAYROLL_RUN_PAYROLL:      'deploy.payroll.run_payroll',
  DEPLOY_PAYROLL_EDIT_RECORDS:     'deploy.payroll.edit_records',
  DEPLOY_PAYROLL_UPLOAD_BULK:      'deploy.payroll.upload_bulk',
  DEPLOY_PAYROLL_APPROVE:          'deploy.payroll.approve',
  DEPLOY_PAYROLL_EXPORT_REPORTS:   'deploy.payroll.export_reports',

  // ── Deploy: Performance ──────────────────────────────────────────────────
  DEPLOY_PERF_VIEW_PERSONAL:       'deploy.performance.view_personal',
  DEPLOY_PERF_VIEW_TEAM:           'deploy.performance.view_team',
  DEPLOY_PERF_VIEW_ALL:            'deploy.performance.view_all',
  DEPLOY_PERF_ASSIGN_KRAS:         'deploy.performance.assign_kras',
  DEPLOY_PERF_SUBMIT_SELF:         'deploy.performance.submit_self_rating',
  DEPLOY_PERF_SUBMIT_MANAGER:      'deploy.performance.submit_manager_rating',
  DEPLOY_PERF_MANAGE_ASSESSMENTS:  'deploy.performance.manage_assessments',
  DEPLOY_PERF_EXPORT_REPORTS:      'deploy.performance.export_reports',

  // ── Deploy: Learning & Development ───────────────────────────────────────
  DEPLOY_ASSESS_VIEW:    'deploy.assessments.view',
  DEPLOY_ASSESS_MANAGE:  'deploy.assessments.manage',
  DEPLOY_TRAIN_VIEW:     'deploy.training.view',
  DEPLOY_TRAIN_MANAGE:   'deploy.training.manage',

  // ── Deploy: Dashboard / Notifications / Analytics ────────────────────────
  DEPLOY_ANALYTICS_VIEW_KPIS:    'deploy.analytics.view_kpis',
  DEPLOY_ANALYTICS_VIEW_STATUS:  'deploy.analytics.view_status',
  DEPLOY_ANALYTICS_VIEW_HIRING:  'deploy.analytics.view_hiring',
  DEPLOY_ANALYTICS_VIEW_DEMO:    'deploy.analytics.view_demographics',
  DEPLOY_ANALYTICS_VIEW_TALENT:  'deploy.analytics.view_talent',
  DEPLOY_DASH_ADMIN:             'deploy.dashboard.view_admin',
  DEPLOY_NOTIF_ADMIN:    'deploy.notifications.view_admin',
  DEPLOY_NOTIF_MANAGE:   'deploy.notifications.manage',

  // ── Source: Jobs ─────────────────────────────────────────────────────────
  SOURCE_JOBS_VIEW:      'source.jobs.view',
  SOURCE_JOBS_MANAGE:    'source.jobs.manage',

  // ── Source: Candidates ───────────────────────────────────────────────────
  SOURCE_CANDIDATES_VIEW:   'source.candidates.view',
  SOURCE_CANDIDATES_MANAGE: 'source.candidates.manage',

  // ── Source: Offers ───────────────────────────────────────────────────────
  SOURCE_OFFERS_VIEW:       'source.offers.view',
  SOURCE_OFFERS_MANAGE:     'source.offers.manage',
  SOURCE_OFFERS_APPROVE:    'source.offers.approve',

  // ── Source: Evaluations & Interviews ─────────────────────────────────────
  SOURCE_EVALUATIONS_MANAGE: 'source.evaluations.manage',
  SOURCE_INTERVIEWS_MANAGE:  'source.interviews.manage',

  // ── Verify: Assessment Central ───────────────────────────────────────────
  VERIFY_ASSESS_VIEW:      'verify.assessments.view',
  VERIFY_ASSESS_MANAGE:    'verify.assessments.manage',
  VERIFY_ASSESS_ASSIGN:    'verify.assessments.assign',
  VERIFY_QUESTIONS_VIEW:   'verify.questions.view',
  VERIFY_QUESTIONS_MANAGE: 'verify.questions.manage',
  VERIFY_MONITORING_VIEW:  'verify.monitoring.view',
  VERIFY_RESULTS_VIEW:     'verify.results.view',
  VERIFY_RESULTS_MANAGE:   'verify.results.manage',
  VERIFY_QUERIES_MANAGE:   'verify.queries.manage',

  // ── Forge ─────────────────────────────────────────────────────────────────
  FORGE_COURSES_VIEW:   'forge.courses.view',
  FORGE_COURSES_MANAGE: 'forge.courses.manage',
  FORGE_ENROLL:         'forge.courses.enroll',

  // ── LexAI: Learning Design AI ──────────────────────────────────────────────
  LEXAI_PROJECTS_VIEW:    'lexai.projects.view',
  LEXAI_PROJECTS_MANAGE:  'lexai.projects.manage',
  LEXAI_DESIGN_RUN:       'lexai.design.run',
  LEXAI_STORYBOARD_RUN:   'lexai.storyboard.run',
  LEXAI_EXPORT:           'lexai.export',
  LEXAI_FILES_MANAGE:     'lexai.files.manage',
  LEXAI_VOICE_USE:        'lexai.voice.use',
};

export default P;
