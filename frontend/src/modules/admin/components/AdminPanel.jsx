import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Shield, Users, Activity, Plus, Trash2, Link, Lock, Unlock, Key, Search } from 'lucide-react';
import ClearanceMatrix from './ClearanceMatrix';
import UserClearanceOverrides from './UserClearanceOverrides';
import ModuleControl from './ModuleControl';
import "../styles/adminPanel.css";
import useTabListKeyNav from '../../../core/hooks/useTabListKeyNav';
import { getInitials } from '../../../core/utils/nameHelpers';
import useUnsavedChangesWarning from '../../../core/hooks/useUnsavedChangesWarning';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('users');
  const handleTabKeyNav = useTabListKeyNav();
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [rolesPerms, setRolesPerms] = useState({});
  const [tenantOps, setTenantOps] = useState({ modules_enabled: [] });
  const [userOverrides, setUserOverrides] = useState({});
  const [selectedUserForOverride, setSelectedUserForOverride] = useState(null);
  
  const [customRolesList, setCustomRolesList] = useState([]);

  const [loading, setLoading] = useState(true);

  const [showAddForm, setShowAddForm] = useState(false);
  useUnsavedChangesWarning(showAddForm);

  const [userSearch, setUserSearch] = useState('');

  const [form, setForm] = useState({
    username: '',
    password: '',
    role: 'employee',
    templates: [],
    employee_code: ''
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);

    try {
      if (activeTab === 'users') {
        const [resUsers, resCustomRoles] = await Promise.all([
          fetch(`/api/admin/users?t=${Date.now()}`, {
            credentials: 'include',
            headers: { 'Cache-Control': 'no-cache' }
          }),
          fetch('/api/admin/permissions/templates', { credentials: 'include' })
        ]);

        const dataUsers = await resUsers.json();
        setUsers(Array.isArray(dataUsers) ? dataUsers : []);

        if (resCustomRoles.ok) {
          const customData = await resCustomRoles.json();
          setCustomRolesList(customData || []);
        }

      } else if (activeTab === 'permissions') {
        const [resBase, resCustom] = await Promise.all([
          fetch('/api/admin/permissions/roles', { credentials: 'include' }),
          fetch('/api/admin/permissions/templates', { credentials: 'include' })
        ]);

        const baseData = await resBase.json();
        const customData = await resCustom.json();
        setCustomRolesList(customData || []);

        // Merge custom roles into rolesPerms so they display in the matrix
        const merged = { ...(baseData || {}) };
        if (Array.isArray(customData)) {
          customData.forEach(cr => {
            merged[cr.name] = merged[cr.name] || [];
          });
        }
        setRolesPerms(merged);

      } else if (activeTab === 'modules') {
        const res = await fetch('/api/admin/tenants/current/ops', {
          credentials: 'include'
        });

        const data = await res.json();

        setTenantOps({
          modules_enabled: data.config?.modules_enabled || []
        });

      } else if (activeTab === 'logs') {
        const res = await fetch('/api/admin/logs', {
          credentials: 'include'
        });

        const data = await res.json();
        setLogs(Array.isArray(data) ? data : []);
      }

    } catch {
      toast.error('Connection Error');
    } finally {
      setLoading(false);
    }
  };

  const createUser = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Identity Creation failed');
      }

      toast.success('User Created');

      setShowAddForm(false);

      setForm({
        username: '',
        password: '',
        role: 'employee',
        employee_code: ''
      });

      loadData();

    } catch (e) {
      toast.error(e.message);
    }
  };

  const deleteUser = async (id) => {
    if (!confirm('Delete this user permanently?')) return;

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!res.ok) throw new Error('User deletion failed');

      toast.success('User Deleted');
      loadData();

    } catch (e) {
      toast.error(e.message);
    }
  };

  const toggleActive = async (id, currentStatus) => {
    // currentStatus = true means user is currently active; we want to lock them
    // currentStatus = false means user is currently locked; we want to restore them
    const newActiveValue = currentStatus ? 0 : 1;
    try {
      // Optimistic update first so UI is instant
      setUsers(prev =>
        prev.map(user =>
          user.id === id ? { ...user, is_active: newActiveValue } : user
        )
      );

      const res = await fetch(`/api/admin/users/${id}/toggle`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      });

      if (!res.ok) {
        // Revert on failure
        setUsers(prev =>
          prev.map(user =>
            user.id === id ? { ...user, is_active: currentStatus ? 1 : 0 } : user
          )
        );
        throw new Error('Lock sequence failed');
      }

      toast.success(currentStatus ? 'User Locked' : 'User Restored');

    } catch (e) {
      toast.error(e.message);
    }
  };

  const updateRole = async (id, newRole, customRoles = []) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: newRole,
          templates: customRoles
        })
      });

      if (!res.ok) throw new Error('User role update failed');

      toast.success('Role Updated');

      loadData();

    } catch (e) {
      toast.error(e.message);
    }
  };

  const updateEmployeeCode = async (id, code) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/employee-code`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employee_code: code || null
        })
      });

      if (!res.ok) throw new Error('Update failed');

      toast.success('Employee Code Updated');

      loadData();

    } catch (e) {
      toast.error(e.message);
    }
  };

  const loadUserOverrides = async (id) => {
    try {
      const res = await fetch(`/api/admin/permissions/users/${id}`, {
        credentials: 'include'
      });

      const data = await res.json();

      setUserOverrides(data || {});

    } catch {
      toast.error('Failed to load user permissions');
    }
  };

  const updateOverride = async (userId, perm, value) => {
    try {
      const res = await fetch(`/api/admin/permissions/users/${userId}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          overrides: {
            [perm]: value
          }
        })
      });

      if (!res.ok) throw new Error();

      toast.success('User Permissions Updated');

      loadUserOverrides(userId);

    } catch {
      toast.error('Override Error');
    }
  };

  const TABS = [
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'permissions', label: 'Permissions', icon: Shield },
    { id: 'modules', label: 'Features', icon: Activity },
    { id: 'logs', label: 'Activity Log', icon: Activity },
  ];

  return (
    <div className="admin-panel">

      <div className="admin-header">

        <div>
          <p className="admin-kicker">
            Administration
          </p>

          <h1 className="admin-title text-black">
            Organisation Settings
          </h1>

          <p className="admin-subtitle">
            Platform management & security
          </p>
        </div>

        <div className="admin-tabs" onKeyDown={handleTabKeyNav}>

          {TABS.map(t => (

            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={
                activeTab === t.id
                  ? "admin-tab active"
                  : "admin-tab"
              }
            >
              <t.icon size={14} />
              {t.label}
            </button>

          ))}

        </div>

      </div>

      {loading ? (

        <div className="flex flex-col justify-center h-64 items-center gap-4">

          <div className="relative">
            <div className="w-12 h-12 border-2 border-primary/20 rounded-full" />

            <div className="absolute inset-0 w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>

          <p className="text-[10px] text-primary font-black uppercase tracking-[0.3em] animate-pulse">
            Loading Users...
          </p>

        </div>

      ) : (

        <div className="animate-fade-in-up">

          {activeTab === 'users' && (

            <div className="space-y-6">

              {/* TOP PANEL */}

              <div className="flex justify-between items-center bg-white/75 backdrop-blur-2xl border border-primary/10 shadow-[0_10px_50px_rgba(180,140,255,0.12)] p-8 rounded-[2.5rem]">

                <div className="flex items-center gap-5">

                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 text-primary shadow-[0_0_30px_rgba(180,140,255,0.15)]">
                    <Users size={24} />
                  </div>

                  <div>

                    <h3 className="text-2xl font-black text-black uppercase tracking-tight">
                      Active Identity Index
                    </h3>

                    <p className="text-[10px] text-black/80 uppercase font-black tracking-[0.25em] mt-2">
                      Total provisioning for this workspace environment
                    </p>

                  </div>

                </div>

                <div className="relative w-full max-w-xs">
                  <Search
                    size={16}
                    className="absolute left-5 top-1/2 -translate-y-1/2 text-black/30"
                  />
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-12 pr-5 py-3.5 rounded-2xl border border-primary/10 bg-white text-black text-sm font-semibold outline-none focus:border-primary/40"
                  />
                </div>

              </div>

              {/* TABLE */}

              <div className="light-table bg-white/70 backdrop-blur-2xl border border-primary/10 shadow-[0_10px_60px_rgba(180,140,255,0.08)] overflow-x-auto rounded-[2.5rem]">

                <table className="w-full text-left border-collapse min-w-[720px]">

                  <thead>

                    <tr className="bg-gradient-to-r from-primary/[0.08] to-transparent border-b border-primary/10">

                      <th className="px-10 py-6 text-[10px] font-normal uppercase tracking-[0.2em] text-black">

                        Identity Context
                      </th>

                      <th className="px-10 py-6 text-[10px] font-normal uppercase tracking-[0.2em] text-black">
                        Permission Level
                      </th>

                      <th className="px-10 py-6 text-[10px] font-normal uppercase tracking-[0.2em] text-black">
                        Employee Link
                      </th>

                      <th className="px-10 py-6 text-[10px] font-normal uppercase tracking-[0.2em] text-black text-right">
                        User Controls
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-primary/[0.06]">

                    {users
                      .filter(u => {
                        const term = userSearch.trim().toLowerCase();
                        if (!term) return true;
                        return (
                          (u.username || '').toLowerCase().includes(term) ||
                          (u.role || '').toLowerCase().includes(term) ||
                          (u.employee_code || '').toLowerCase().includes(term)
                        );
                      })
                      .sort((a, b) => (a.username || '').localeCompare(b.username || ''))
                      .map(u => {
                        const isUserActive = !(u.is_active === 0 || u.is_active === false);
                        return (

                      <tr
                        key={u.id}
                        className="hover:bg-primary/[0.045] group transition-all duration-300"
                      >

                        {/* USER */}

                        <td className="px-10 py-8">

                          <div className="flex items-center gap-5">

                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-normal uppercase tracking-tighter shadow-inner ${
                              isUserActive
                                ? 'bg-gradient-to-br from-primary/20 to-primary/5 text-primary border border-primary/20 shadow-[0_0_20px_rgba(180,140,255,0.12)]'
                                : 'bg-red-500/10 text-red-500 border border-red-500/10'
                            }`}>
                              {getInitials(u.username)}
                            </div>

                            <div>

                              <div className="flex items-center gap-2">
                                <p className="text-base font-medium text-black group-hover:text-violet-700 transition-colors">
                                  {u.username}
                                </p>
                                {!isUserActive && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
                                    Locked
                                  </span>
                                )}
                              </div>

                              <p className="text-[9px] text-black font-mono mt-1 tracking-widest uppercase">
                                ID: USER_{u.id.toString().padStart(4, '0')}
                              </p>

                            </div>

                          </div>

                        </td>

                        <td className="px-10 py-8">
                          <div className="flex flex-col gap-2">
                            <select
                              value={u.role}
                              onChange={e => updateRole(u.id, e.target.value, [])}
                              className="bg-[#ece8f8] border border-primary/15 text-black text-[10px] font-normal uppercase tracking-[0.15em] px-5 py-3 rounded-2xl focus:outline-none hover:border-primary/40 hover:shadow-[0_0_20px_rgba(180,140,255,0.12)] transition-all cursor-pointer"
                            >
                              {['org_admin', 'manager', 'employee', 'trainee', ...customRolesList.map(r => r.name)].map(r => (
                                <option
                                  key={r}
                                  value={r}
                                  className="bg-white text-black font-normal"
                                >
                                  {r.replace('_', ' ')}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>

                        {/* EMPLOYEE LINK */}

                        <td className="px-10 py-8">

                          <div className="flex items-center gap-3 bg-[#ece8f8] backdrop-blur-xl border border-primary/15 px-4 py-3 rounded-2xl hover:border-primary/30 hover:shadow-[0_0_20px_rgba(180,140,255,0.1)] transition-all">

                            <Link size={12} className="text-primary/70" />

                            <input
                              type="text"
                              defaultValue={u.employee_code || ''}
                              onBlur={e => updateEmployeeCode(u.id, e.target.value)}
                              placeholder="Employee ID"
                              className="w-28 bg-transparent text-[10px] text-black/90 font-mono focus:outline-none placeholder:text-black/20"
                            />

                          </div>

                        </td>

                        {/* ACTIONS */}

                        <td className="px-10 py-8 text-right">

                          <div className="flex items-center justify-end gap-3">

                            <button
                              onClick={() => {
                                setSelectedUserForOverride(u);
                                loadUserOverrides(u.id);
                              }}
                              className="w-11 h-11 flex items-center justify-center bg-white/90 backdrop-blur-xl text-black hover:text-violet-700 hover:bg-primary/10 rounded-2xl transition-all border border-primary/10 hover:border-primary/30 hover:shadow-[0_0_20px_rgba(180,140,255,0.12)] active:scale-95"
                              title="Adjust Permission Level"
                            >
                              <Key size={16} strokeWidth={2.5} />
                            </button>

                            <button
                              onClick={() => toggleActive(u.id, isUserActive)}
                              className={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all border active:scale-95 ${
                                isUserActive
                                  ? 'bg-white border-primary/10 text-black hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/5'
                                  : 'bg-red-500/10 text-red-500 border-red-500/20 hover:text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/30'
                              }`}
                              title={isUserActive ? "Lock User Access" : "Unlock User Access"}
                            >
                              {isUserActive ? <Lock size={16} strokeWidth={2.5} /> : <Unlock size={16} strokeWidth={2.5} />}
                            </button>

                            <button
                              onClick={() => deleteUser(u.id)}
                              className="w-11 h-11 flex items-center justify-center bg-white border border-primary/10 text-black hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/5 rounded-2xl transition-all active:scale-95"
                              title="Purge Identity"
                            >
                              <Trash2 size={16} strokeWidth={2.5} />
                            </button>

                          </div>

                        </td>

                      </tr>
                        );
                      })}

                  </tbody>

                </table>

              </div>

            </div>

          )}

          {activeTab === 'permissions' && (

            <ClearanceMatrix
              rolesPerms={rolesPerms}
              customRolesList={customRolesList}
              onRefreshRoles={loadData}
              onUpdate={(role, newList) =>
                setRolesPerms(prev => ({
                  ...prev,
                  [role]: newList
                }))
              }
            />

          )}

          {activeTab === 'modules' && (

            <ModuleControl
              tenantOps={tenantOps}
              onUpdate={setTenantOps}
            />

          )}

          {activeTab === 'logs' && (

  <div
    className="
      overflow-x-auto
      rounded-[2.8rem]
      border
      border-[#ebe5fa]
      bg-white
      shadow-[0_20px_60px_rgba(180,140,255,0.08)]
    "
  >

    <table className="w-full text-left border-collapse min-w-[720px]">

      <thead>

        <tr className="bg-gradient-to-r from-[#faf7ff] to-[#f3ecff]">

          {[
            'Timeline',
            'User',
            'Module',
            'Action',
            'Details'
          ].map(h => (

            <th
              key={h}
              className="
                px-10
                py-7
                text-[11px]
                font-normal
                uppercase
                tracking-[0.2em]
                text-black
                border-b
                border-[#ece7fa]
              "
            >
              {h}
            </th>

          ))}

        </tr>

      </thead>

      <tbody>

        {logs.map((l, index) => (

          <tr
            key={l.id}
            className="
              border-b
              border-[#f1edf8]
              hover:bg-[#faf7ff]
              transition-all
              duration-300
            "
          >

            {/* DATE */}

            <td className="px-10 py-8">

              <p className="text-[12px] font-normal text-black">
                {new Date(l.timestamp).toLocaleDateString()}
              </p>

              <p className="text-[10px] text-[#8b5cf6] font-normal mt-1">
                {new Date(l.timestamp).toLocaleTimeString()}
              </p>

            </td>

            {/* SUBJECT */}

            <td className="px-10 py-8">

              <div
                className="
                  inline-flex
                  items-center
                  px-4
                  py-2
                  rounded-xl
                  bg-[#f5efff]
                  border
                  border-[#ddd0ff]
                  text-[#8b5cf6]
                  text-[10px]
                  font-medium
                  uppercase
                  tracking-[0.1em]
                "
              >
                {l.username || 'SYSTEM'}
              </div>

            </td>

            {/* MODULE */}

            <td className="px-10 py-8">

              <div
                className="
                  inline-flex
                  items-center
                  px-3
                  py-1
                  rounded-lg
                  bg-slate-100
                  text-slate-600
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-wider
                "
              >
                {l.module || 'admin'}
              </div>

            </td>

            {/* ACTION */}

            <td className="px-10 py-8">

              <span
                className="
                  text-[11px]
                  font-normal
                  uppercase
                  tracking-[0.18em]
                  text-[#8b5cf6]
                  italic
                "
              >
                {l.action.replaceAll('_', ' ')}
              </span>

            </td>

            {/* DETAILS */}

            <td className="px-10 py-8">

              <p
                className="
                  text-[14px]
                  text-[#4b5563]
                  leading-relaxed
                "
              >
                {l.details}
              </p>

            </td>

          </tr>

        ))}

      </tbody>

    </table>

  </div>

)}


        </div>

      )}
      {selectedUserForOverride && (
        <UserClearanceOverrides
          user={selectedUserForOverride}
          overrides={userOverrides}
          onUpdate={(userId, perm, value) => updateOverride(userId, perm, value)}
          onClose={() => setSelectedUserForOverride(null)}
        />
      )}

      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2rem] p-8 w-[400px] shadow-[0_20px_80px_rgba(0,0,0,0.2)] border border-primary/10">
            <h3 className="text-xl font-bold text-black uppercase tracking-tight mb-6 flex items-center gap-3">
              <Plus size={20} className="text-primary" />
              Provision Identity
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Username <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm({...form, username: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                  placeholder="Enter username"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Password <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                  placeholder="Enter password"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Role <span className="text-red-500">*</span></label>
                <select
                  value={form.role}
                  onChange={e => setForm({...form, role: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                >
                  {['org_admin', 'manager', 'employee', 'trainee', ...customRolesList.map(r => r.name)].map(r => (
                    <option key={r} value={r}>{r.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Employee Code (Optional)</label>
                <input
                  type="text"
                  value={form.employee_code}
                  onChange={e => setForm({...form, employee_code: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                  placeholder="e.g. EMP123"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={createUser}
                className="flex-1 py-3 bg-black text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-violet-700 transition-all"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}