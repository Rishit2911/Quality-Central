import React from 'react';
import { createPortal } from 'react-dom';
import { Shield, Check, X, Zap, Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';

// ─── Management Permission Categories ────────────────────────────────────────
// These are org/team-facing permissions — things managers and admins do.
export const MANAGEMENT_CATEGORIES = [
  {
    group: 'Feature Access',
    perms: [
      { key: 'module.source.access',  label: 'Talent Central Access' },
      { key: 'module.forge.access',   label: 'Learning Central Access' },
      { key: 'module.verify.access',  label: 'Assessment Central Access' },
      { key: 'module.deploy.access',  label: 'Employee Central Access' },
      { key: 'module.lexai.access',   label: 'LexAI Access' },
    ]
  },
  {
    group: 'Administration',
    perms: [
      { key: 'admin.users.manage',    label: 'User Management' },
      { key: 'view_reports',          label: 'Global Analytics' },
    ]
  },
  {
    group: 'Employee Management',
    perms: [
      { key: 'deploy.employees.view_list',               label: 'View Full Employee List' },
      { key: 'deploy.employees.view_team',               label: 'View Team Members' },
      { key: 'deploy.employees.view_profile',            label: 'View Employee Basic Profile' },
      { key: 'deploy.employees.view_profile_sensitive',  label: 'View Sensitive Details' },
      { key: 'deploy.employees.view_profile_financial',  label: 'View Financial Details' },
      { key: 'deploy.employees.create',                  label: 'Add New Employee' },
      { key: 'deploy.employees.edit_basic',              label: 'Edit Basic Details' },
      { key: 'deploy.employees.edit_job',                label: 'Edit Job Details' },
      { key: 'deploy.employees.edit_financial',          label: 'Edit Financial Details' },
      { key: 'deploy.employees.approve_basic',           label: 'Approve Basic Details (HR)' },
      { key: 'deploy.employees.approve_sensitive',       label: 'Approve Sensitive Details (HR)' },
      { key: 'deploy.employees.approve_financial',       label: 'Approve Financial Details (Finance)' },
      { key: 'deploy.employees.manage_documents',        label: 'Manage Employee Documents' },
      { key: 'deploy.employees.offboard',                label: 'Offboard Employee' },
      { key: 'deploy.employees.delete',                  label: 'Delete Employee Record' },
      { key: 'deploy.employees.export',                  label: 'Export Employee Data' },
    ]
  },
  {
    group: 'Asset Management',
    perms: [
      { key: 'deploy.assets.view_all',           label: 'View All Assets' },
      { key: 'deploy.assets.manage_onboarding',  label: 'Manage Onboarding Assets' },
      { key: 'deploy.assets.manage_clearance',   label: 'Manage Clearance Assets' },
      { key: 'deploy.assets.export_reports',     label: 'Export Asset Reports' },
    ]
  },
  {
    group: 'Attendance & Leave Management',
    perms: [
      { key: 'deploy.attendance.view_team',       label: 'View Team Attendance' },
      { key: 'deploy.attendance.view_all',        label: 'View All Attendance' },
      { key: 'deploy.attendance.approve_correction', label: 'Approve Attendance Correction' },
      { key: 'deploy.attendance.manage_policies', label: 'Manage Attendance Policies' },
      { key: 'deploy.leaves.view_team',           label: 'View Team Leaves' },
      { key: 'deploy.leaves.view_all',            label: 'View All Leaves' },
      { key: 'deploy.leaves.approve',             label: 'Approve Leave Requests' },
      { key: 'deploy.leaves.manage_balances',     label: 'Manage Leave Balances' },
    ]
  },
  {
    group: 'Onboarding Management',
    perms: [
      { key: 'deploy.onboarding.view',                label: 'View Onboarding Pipeline' },
      { key: 'deploy.onboarding.send_invite',         label: 'Send Onboarding Invite' },
      { key: 'deploy.onboarding.cancel_invite',       label: 'Cancel Onboarding Invite' },
      { key: 'deploy.onboarding.review_submissions',  label: 'Review Onboarding Submissions' },
      { key: 'deploy.onboarding.manage',              label: 'Approve / Reject Onboarding' },
    ]
  },
  {
    group: 'Payroll Management',
    perms: [
      { key: 'deploy.payroll.view_all',         label: 'View All Payroll Records' },
      { key: 'deploy.payroll.run_payroll',      label: 'Run Payroll' },
      { key: 'deploy.payroll.edit_records',     label: 'Edit Payroll Records' },
      { key: 'deploy.payroll.upload_bulk',      label: 'Bulk Upload Payroll' },
      { key: 'deploy.payroll.approve',          label: 'Approve Payroll' },
      { key: 'deploy.payroll.export_reports',   label: 'Export Payroll Reports' },
    ]
  },
  {
    group: 'Performance Management',
    perms: [
      { key: 'deploy.performance.view_team',            label: 'View Team KRAs' },
      { key: 'deploy.performance.view_all',             label: 'View All KRAs' },
      { key: 'deploy.performance.assign_kras',          label: 'Assign KRAs to Employees' },
      { key: 'deploy.performance.submit_manager_rating', label: 'Rate Team Members' },
      { key: 'deploy.performance.manage_assessments',   label: 'Manage Performance Assessments' },
      { key: 'deploy.performance.export_reports',       label: 'Export Performance Reports' },
    ]
  },
  {
    group: 'Learning & Development Management',
    perms: [
      { key: 'deploy.assessments.manage',  label: 'Manage L&D Assessments' },
      { key: 'deploy.training.manage',     label: 'Manage Training Programs' },
    ]
  },
  {
    group: 'Analytics & Dashboards',
    perms: [
      { key: 'deploy.notifications.view_admin',   label: 'View Admin Notifications' },
      { key: 'deploy.notifications.manage',       label: 'Manage Notifications' },
      { key: 'deploy.analytics.view_kpis',        label: 'Analytics: KPIs & Metrics' },
      { key: 'deploy.analytics.view_status',      label: 'Analytics: Employee Status' },
      { key: 'deploy.analytics.view_hiring',      label: 'Analytics: Hiring & Onboarding' },
      { key: 'deploy.analytics.view_demographics','label': 'Analytics: Demographics' },
      { key: 'deploy.analytics.view_talent',      label: 'Analytics: Talent & Skills' },
      { key: 'deploy.dashboard.view_admin',       label: 'View Admin Dashboard' },
    ]
  },
  {
    group: 'Talent Central (Source)',
    perms: [
      { key: 'source.jobs.view',              label: 'View Job Listings' },
      { key: 'source.jobs.manage',            label: 'Manage Job Listings' },
      { key: 'source.candidates.view',        label: 'View Candidates' },
      { key: 'source.candidates.manage',      label: 'Manage Candidates' },
      { key: 'source.offers.view',            label: 'View Offers' },
      { key: 'source.offers.manage',          label: 'Manage Offers' },
      { key: 'source.offers.approve',         label: 'Approve Offers' },
      { key: 'source.evaluations.manage',     label: 'Manage Evaluations' },
      { key: 'source.interviews.manage',      label: 'Manage Interviews' },
    ]
  },
  {
    group: 'Assessment Central (Verify) — Management',
    perms: [
      { key: 'verify.assessments.manage',    label: 'Build & Manage Assessments' },
      { key: 'verify.assessments.assign',    label: 'Assign Tests to Candidates' },
      { key: 'verify.questions.view',        label: 'View Question Bank' },
      { key: 'verify.questions.manage',      label: 'Manage Question Bank & AI Import' },
      { key: 'verify.monitoring.view',       label: 'Live Proctoring & Monitoring' },
      { key: 'verify.results.view',          label: 'View Analytics & Results' },
      { key: 'verify.results.manage',        label: 'Release Results & Regrade' },
      { key: 'verify.queries.manage',        label: 'Manage Candidate Disputes' },
    ]
  },
  {
    group: 'Learning Central (Forge) — Management',
    perms: [
      { key: 'forge.courses.manage',  label: 'Build & Manage Courses' },
    ]
  },
  {
    group: 'LexAI (Learning Design AI) — Management',
    perms: [
      { key: 'lexai.projects.view',    label: 'View Projects' },
      { key: 'lexai.projects.manage',  label: 'Create & Manage Projects' },
      { key: 'lexai.design.run',       label: 'Run AI Design Document Generation' },
      { key: 'lexai.storyboard.run',   label: 'Run AI Storyboard Generation' },
      { key: 'lexai.export',           label: 'Export Documents (Word / Excel)' },
      { key: 'lexai.files.manage',     label: 'Manage Files & Folders' },
      { key: 'lexai.voice.use',        label: 'Use Voice Speech-to-Text' },
    ]
  },
];

// ─── Personal Permission Categories ──────────────────────────────────────────
// These are self-service permissions — things an employee does for themselves.
export const PERSONAL_CATEGORIES = [
  {
    group: 'My Profile',
    perms: [
      { key: 'deploy.employees.view_personal',  label: 'View My Own Profile' },
    ]
  },
  {
    group: 'My Assets',
    perms: [
      { key: 'deploy.assets.view_personal',  label: 'View My Assigned Assets' },
    ]
  },
  {
    group: 'My Attendance & Leaves',
    perms: [
      { key: 'deploy.attendance.view_personal',       label: 'View My Attendance' },
      { key: 'deploy.attendance.log_attendance',      label: 'Clock In / Log Attendance' },
      { key: 'deploy.attendance.request_correction',  label: 'Request Attendance Correction' },
      { key: 'deploy.leaves.view_personal',           label: 'View My Leaves' },
      { key: 'deploy.leaves.request',                 label: 'Apply for Leave' },
    ]
  },
  {
    group: 'My Payroll',
    perms: [
      { key: 'deploy.payroll.view_personal',  label: 'View My Payslips' },
    ]
  },
  {
    group: 'My Performance',
    perms: [
      { key: 'deploy.performance.view_personal',      label: 'View My KRAs & Ratings' },
      { key: 'deploy.performance.submit_self_rating', label: 'Submit My Self-Rating' },
    ]
  },
  {
    group: 'My Learning & Development',
    perms: [
      { key: 'deploy.assessments.view',  label: 'View My L&D Assessments' },
      { key: 'deploy.training.view',     label: 'View My Training Content' },
    ]
  },
  {
    group: 'Learning Central (Forge) — Personal',
    perms: [
      { key: 'forge.courses.view',    label: 'Browse Available Courses' },
      { key: 'forge.courses.enroll',  label: 'Enrol in Courses' },
    ]
  },
  {
    group: 'Assessment Central (Verify) — Personal',
    perms: [
      { key: 'verify.assessments.view',  label: 'Take Assigned Assessments' },
    ]
  },
  {
    group: 'LexAI (Learning Design AI) — Personal',
    perms: [
      { key: 'lexai.projects.view',    label: 'View My Projects' },
      { key: 'lexai.projects.manage',  label: 'Create & Manage Projects' },
      { key: 'lexai.design.run',       label: 'Run AI Design Document Generation' },
      { key: 'lexai.storyboard.run',   label: 'Run AI Storyboard Generation' },
      { key: 'lexai.export',           label: 'Export Documents (Word / Excel)' },
      { key: 'lexai.files.manage',     label: 'Manage Files & Folders' },
      { key: 'lexai.voice.use',        label: 'Use Voice Speech-to-Text' },
    ]
  },
];

// ─── Legacy flat export so other imports don't break ─────────────────────────
export const PERMISSIONS_CATEGORIES = [
  ...MANAGEMENT_CATEGORIES,
  ...PERSONAL_CATEGORIES,
];

// ─── Core perms that org_admin cannot lose ───────────────────────────────────
const CORE_ADMIN_PERMS = new Set([
  'admin.users.manage',
]);

export default function ClearanceMatrix({ rolesPerms, customRolesList, onRefreshRoles, onUpdate }) {
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [newRoleName, setNewRoleName] = React.useState('');
  const [newRoleDesc, setNewRoleDesc] = React.useState('');
  const [editingRole, setEditingRole] = React.useState(null);
  const [editRoleValue, setEditRoleValue] = React.useState('');

  const roles = Object.keys(rolesPerms).filter(r => r !== 'trainee');

  const KEY_COL_WIDTH = 280;
  const ROLE_COL_WIDTH = 150;
  const tableMinWidth = KEY_COL_WIDTH + roles.length * ROLE_COL_WIDTH;

  // ── Determine which super-sections have at least one checked perm across any role ──
  const allMgmtKeys = MANAGEMENT_CATEGORIES.flatMap(c => c.perms.map(p => p.key));
  const allPersonalKeys = PERSONAL_CATEGORIES.flatMap(c => c.perms.map(p => p.key));

  const hasMgmtPerms = roles.some(r =>
    (rolesPerms[r] || []).some(k => allMgmtKeys.includes(k))
  );
  const hasPersonalPerms = roles.some(r =>
    (rolesPerms[r] || []).some(k => allPersonalKeys.includes(k))
  );

  const togglePermission = async (role, permKey) => {
    const currentList = rolesPerms[role] || [];
    const newList = currentList.includes(permKey)
      ? currentList.filter(p => p !== permKey)
      : [...currentList, permKey];

    try {
      const res = await fetch('/api/admin/permissions/roles', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, permissions: newList })
      });
      if (!res.ok) throw new Error();
      onUpdate(role, newList);
      toast.success('Permissions Updated');
    } catch {
      toast.error('Sync Error');
    }
  };

  const createCustomRole = async () => {
    if (!newRoleName.trim()) return;
    try {
      const res = await fetch('/api/admin/permissions/templates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoleName.trim(),
          description: newRoleDesc.trim() || undefined
        })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Creation failed');
      }
      toast.success('Template Created');
      setShowCreateModal(false);
      setNewRoleName('');
      setNewRoleDesc('');
      if (onRefreshRoles) onRefreshRoles();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const deleteCustomRole = async (name) => {
    if (!confirm(`Delete template ${name}?`)) return;
    try {
      const res = await fetch(`/api/admin/permissions/templates/${name}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Deletion failed');
      toast.success('Template Deleted');
      if (onRefreshRoles) onRefreshRoles();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const startEditingRole = (name) => {
    setEditingRole(name);
    setEditRoleValue(name);
  };

  const cancelEditingRole = () => {
    setEditingRole(null);
    setEditRoleValue('');
  };

  const renameCustomRole = async (oldName) => {
    const newName = editRoleValue.trim();
    if (!newName || newName === oldName) {
      cancelEditingRole();
      return;
    }
    try {
      const res = await fetch(`/api/admin/permissions/templates/${oldName}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_name: newName })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Rename failed');
      }
      toast.success('Template Renamed');
      cancelEditingRole();
      if (onRefreshRoles) onRefreshRoles();
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ─── Reusable row renderers ────────────────────────────────────────────────

  /** Renders the "super-section" banner row (Management / Personal) */
  const renderSuperHeader = (label, accent) => (
    <tr key={`super-${label}`}>
      <td
        colSpan={roles.length + 1}
        className="px-6 py-3"
        style={{ background: accent === 'management'
          ? 'linear-gradient(90deg, rgba(139,92,246,0.10) 0%, transparent 100%)'
          : 'linear-gradient(90deg, rgba(236,72,153,0.08) 0%, transparent 100%)'
        }}
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-6 rounded-full ${accent === 'management' ? 'bg-violet-500' : 'bg-pink-500'}`} />
          <span className={`text-[11px] font-black uppercase tracking-[0.4em] ${accent === 'management' ? 'text-violet-600' : 'text-pink-600'}`}>
            {label}
          </span>
          <div className="flex-1 h-px ml-2" style={{ background: accent === 'management' ? 'rgba(139,92,246,0.15)' : 'rgba(236,72,153,0.15)' }} />
        </div>
      </td>
    </tr>
  );

  /** Renders a group header row (e.g. "Employee Management") */
  const renderGroupHeader = (groupName) => (
    <tr key={`group-${groupName}`} className="bg-primary/[0.04]">
      <td
        colSpan={roles.length + 1}
        className="px-8 py-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-black border-y border-primary/10"
      >
        {groupName}
      </td>
    </tr>
  );

  /** Renders all permission toggle rows for a category array */
  const renderCategoryRows = (categories) =>
    categories.map(cat => (
      <React.Fragment key={cat.group}>
        {renderGroupHeader(cat.group)}
        {cat.perms.map(p => {
          const isLocked = CORE_ADMIN_PERMS.has(p.key);
          return (
            <tr
              key={p.key}
              className="hover:bg-primary/[0.03] group transition-all duration-300"
            >
              {/* PERMISSION LABEL */}
              <td className="p-6 border-b border-primary/[0.04]" style={{ width: KEY_COL_WIDTH }}>
                <p className="text-sm font-semibold text-black transition-colors group-hover:text-violet-700">
                  {p.label}
                </p>
                <p className="text-[10px] text-slate-500 font-normal font-mono mt-1 uppercase tracking-tight">
                  {p.key}
                </p>
              </td>

              {/* ROLE TOGGLES */}
              {roles.map(r => {
                const isAllowed = rolesPerms[r]?.includes(p.key);
                const locked = isLocked && r === 'org_admin';
                return (
                  <td
                    key={`${r}-${p.key}`}
                    className="p-6 border-b border-primary/[0.04] text-center"
                    style={{ width: ROLE_COL_WIDTH }}
                  >
                    <button
                      onClick={() => !locked && togglePermission(r, p.key)}
                      disabled={locked}
                      title={locked ? 'Core permission — cannot be removed from org_admin' : ''}
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center mx-auto transition-all duration-300 border ${
                        isAllowed
                          ? locked
                            ? 'bg-black/5 text-black/40 border-black/10 cursor-not-allowed'
                            : 'bg-gradient-to-br from-primary/20 to-primary/5 text-violet-700 border-primary/20 shadow-[0_0_25px_rgba(180,140,255,0.18)] hover:scale-105'
                          : 'bg-white text-black/20 border-primary/10 hover:border-primary/30 hover:text-primary hover:bg-primary/[0.04]'
                      }`}
                    >
                      {isAllowed
                        ? <Check size={18} strokeWidth={3} />
                        : <X size={16} strokeWidth={2.5} />
                      }
                    </button>
                  </td>
                );
              })}
            </tr>
          );
        })}
      </React.Fragment>
    ));

  return (
    <div className="bg-white/70 backdrop-blur-2xl border border-primary/10 shadow-[0_10px_60px_rgba(180,140,255,0.08)] overflow-hidden animate-fade-in-up rounded-[2.5rem]">

      {/* HEADER */}
      <div className="p-8 border-b border-primary/10 flex justify-between items-center bg-white">
        <div>
          <h3 className="text-2xl font-bold text-black uppercase tracking-tight flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 text-primary shadow-[0_0_30px_rgba(180,140,255,0.15)]">
              <Shield size={22} />
            </div>
            Permission Management
          </h3>
          <p className="text-[10px] text-gray-500 mt-2 uppercase tracking-[0.25em] font-medium">
            Role-wise Permissions
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-black text-white rounded-2xl text-[10px] font-semibold uppercase tracking-[0.12em] shadow-[0_0_20px_rgba(0,0,0,0.08)] hover:bg-violet-700 transition-all flex items-center gap-1 active:scale-95"
        >
          <Plus size={12} />
          New Template
        </button>
      </div>

      {/* LEGEND */}
      <div className="flex items-center gap-6 px-8 py-3 bg-white border-b border-primary/10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-4 rounded-full bg-violet-500" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-600">Management</span>
          <span className="text-[10px] text-gray-400 ml-1">— org &amp; team-wide operations</span>
        </div>
        <div className="w-px h-4 bg-gray-200" />
        <div className="flex items-center gap-2">
          <div className="w-2 h-4 rounded-full bg-pink-500" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-pink-600">Personal</span>
          <span className="text-[10px] text-gray-400 ml-1">— self-service &amp; own data</span>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table
          className="w-full text-left border-collapse"
          style={{ tableLayout: 'fixed', minWidth: tableMinWidth }}
        >
          <thead>
            <tr className="bg-gradient-to-r from-primary/[0.08] to-transparent border-b border-primary/10">
              <th
                style={{ width: KEY_COL_WIDTH }}
                className="p-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 whitespace-nowrap"
              >
                Permission
              </th>
              {roles.map(r => {
                const isCustom = customRolesList && customRolesList.find(cr => cr.name === r);
                const isEditing = editingRole === r;
                return (
                  <th
                    key={r}
                    style={{ width: ROLE_COL_WIDTH }}
                    className="px-3 py-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 text-center group"
                  >
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-1">
                        <input
                          autoFocus
                          value={editRoleValue}
                          onChange={e => setEditRoleValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') renameCustomRole(r);
                            if (e.key === 'Escape') cancelEditingRole();
                          }}
                          className="w-full min-w-0 bg-white border border-primary/30 rounded-lg px-2 py-1 text-[10px] normal-case text-black focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                        <button onClick={() => renameCustomRole(r)} className="text-emerald-600 hover:text-emerald-700 shrink-0" title="Save">
                          <Check size={14} strokeWidth={3} />
                        </button>
                        <button onClick={cancelEditingRole} className="text-gray-400 hover:text-gray-600 shrink-0" title="Cancel">
                          <X size={14} strokeWidth={3} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="whitespace-nowrap truncate">{r}</span>
                        {isCustom && (
                          <span className="hidden group-hover:inline-flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => startEditingRole(r)}
                              className="text-gray-400 hover:text-primary transition-colors"
                              title="Rename Template"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => deleteCustomRole(r)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                              title="Delete Template"
                            >
                              <Trash2 size={12} />
                            </button>
                          </span>
                        )}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-primary/[0.05]">

            {/* ── MANAGEMENT SUPER-SECTION ─────────────────────────────── */}
            {hasMgmtPerms && (
              <>
                {renderSuperHeader('Management Permissions', 'management')}
                {renderCategoryRows(MANAGEMENT_CATEGORIES)}
              </>
            )}

            {/* ── PERSONAL SUPER-SECTION ───────────────────────────────── */}
            {hasPersonalPerms && (
              <>
                {renderSuperHeader('Personal Permissions', 'personal')}
                {renderCategoryRows(PERSONAL_CATEGORIES)}
              </>
            )}

          </tbody>
        </table>
      </div>

      {/* CREATE TEMPLATE MODAL */}
      {showCreateModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2rem] p-8 w-[400px] shadow-[0_20px_80px_rgba(0,0,0,0.2)] border border-primary/10">
            <h3 className="text-xl font-bold text-black uppercase tracking-tight mb-6 flex items-center gap-3">
              <Shield size={20} className="text-primary" />
              New Template
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Role Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                  placeholder="e.g. hr_reviewer"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Description (Optional)</label>
                <textarea
                  value={newRoleDesc}
                  onChange={e => setNewRoleDesc(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                  placeholder="What does this role do?"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => { setShowCreateModal(false); setNewRoleName(''); setNewRoleDesc(''); }}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={createCustomRole}
                className="flex-1 py-3 bg-black text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-violet-700 transition-all"
              >
                Create
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* FOOTER */}
      <div className="p-8 bg-gradient-to-r from-primary/[0.04] to-transparent border-t border-primary/10">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 text-primary">
            <Zap size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-tight text-primary italic">
              Permission Management
            </p>
            <p className="text-sm text-gray-500 font-normal mt-3 leading-relaxed max-w-4xl">
              Changes to feature permissions take effect immediately. Removing access to a feature will instantly
              disable that feature for users without special permissions within this organisation.
              User data is preserved across access changes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}