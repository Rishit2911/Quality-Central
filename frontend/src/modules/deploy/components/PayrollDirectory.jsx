import React, { useState, useEffect } from 'react';
import { Users, Search, ArrowRight, MapPin, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { usePermissions } from '../../../core/auth/usePermissions';
import { P } from '../../../core/permissions';
import FinanceReviewPanel from './FinanceReviewPanel';
import { getInitials } from '../../../core/utils/nameHelpers';

// Same status normalization as EmployeeDirectory.jsx, kept local since it
// isn't exported from there.
const normalizeStatus = (status) => {
  if (!status) return 'Active';
  const s = status.toLowerCase().trim();
  if (s === 'notice period' || s === 'on notice' || s === 'notice' || s === 'onnotice') return 'Notice Period';
  if (s === 'active') return 'Active';
  if (s === 'exited' || s === 'terminated') return 'Exited';
  if (s === 'inactive') return 'Inactive';
  return status;
};

export default function PayrollDirectory() {
  const { hasPermission } = usePermissions();
  const canViewProfile = hasPermission(P.DEPLOY_EMP_VIEW_PROFILE);

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTeam, setFilterTeam] = useState('All');
  const [selectedCode, setSelectedCode] = useState(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/employees', { credentials: 'include' });
      const data = await res.json();
      let list = [];
      if (Array.isArray(data)) list = data;
      else if (Array.isArray(data.employees)) list = data.employees;
      else if (Array.isArray(data.data)) list = data.data;
      else if (Array.isArray(data.results)) list = data.results;
      setEmployees(list);
    } catch {
      toast.error('Failed to load payroll directory');
    } finally {
      setLoading(false);
    }
  };

  const activeEmployees = employees.filter(e => normalizeStatus(e.employment_status) === 'Active');

  const filtered = activeEmployees.filter((e) => {
    const employeeName = e.name || e.full_name || e.username || 'Unknown';
    const employeeCode = e.employee_code || '';
    const employeeEmail = e.email_id || e.email || '';
    const s = search.toLowerCase();
    const matchSearch =
      employeeName.toLowerCase().includes(s) ||
      employeeCode.toLowerCase().includes(s) ||
      employeeEmail.toLowerCase().includes(s);
    const matchTeam = filterTeam === 'All' || (e.team || 'Unassigned') === filterTeam;
    return matchSearch && matchTeam;
  }).sort((a, b) => {
    const nameA = a.name || a.full_name || a.username || '';
    const nameB = b.name || b.full_name || b.username || '';
    return nameA.localeCompare(nameB);
  });

  const teams = ['All', ...new Set(activeEmployees.map(e => e.team).filter(Boolean))];

  const panelBase = "bg-white border border-[#ebe4ff] rounded-[2rem] shadow-[0_8px_32px_rgba(180,140,255,0.08)]";

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-black/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search active employees..."
            className="w-full pl-12 pr-5 py-3.5 rounded-2xl border border-[#ece6ff] bg-white text-black text-sm font-semibold outline-none focus:border-[#8b5cf6]"
          />
        </div>
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="px-5 py-3.5 rounded-2xl border border-[#ece6ff] bg-white text-black text-sm font-bold outline-none"
        >
          {teams.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
        {[
          { label: 'Active Employees', count: activeEmployees.length, color: '#10B981' },
          { label: 'Teams', count: new Set(activeEmployees.map(e => e.team).filter(Boolean)).size, color: '#3B82F6' },
          { label: 'Results', count: filtered.length, color: '#8B5CF6' },
        ].map((s, i) => (
          <div key={i} className={`${panelBase} p-6`}>
            <p className="text-4xl font-black" style={{ color: s.color }}>{s.count}</p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.3em] font-black text-black/50">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className={`${panelBase} overflow-x-auto`}>
        {loading ? (
          <div className="flex items-center justify-center h-52">
            <div className="w-10 h-10 border-4 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 gap-5">
            <Users size={48} className="text-black/10" />
            <p className="text-sm font-bold text-black/40">No active personnel found</p>
          </div>
        ) : (
          <table className="w-full min-w-[900px]">
            <thead className="bg-[#f7f3ff] border-b border-[#ebe7ff]">
              <tr>
                {['Employee', 'Designation', 'Department', 'Location', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-8 py-6 text-left text-[11px] uppercase tracking-[0.25em] font-black text-black/50">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp, i) => {
                const employeeName = emp.name || emp.full_name || emp.username || 'Unknown';
                return (
                  <tr
                    key={emp.employee_code || i}
                    className={`border-b border-[#f1ecff] transition-all ${canViewProfile ? 'hover:bg-[#faf7ff] cursor-pointer' : ''}`}
                    onClick={() => canViewProfile && setSelectedCode(emp.employee_code)}
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                          <div className="w-14 h-14 rounded-2xl overflow-hidden border border-[#e9ddff] bg-[#f5edff] flex items-center justify-center font-black text-[#7c3aed] text-lg">
                            {emp.photo_path ? (
                              <img
                                src={`/api/employee/${emp.employee_code}/document/pfp`}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              getInitials(employeeName)
                            )}
                          </div>
                          {!['1', 1, true].includes(emp.finance_approved) && (
                            <span
                              title="Finance approval pending"
                              className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-amber-200"
                            >
                              <AlertTriangle size={12} className="text-amber-500" fill="#fef3c7" />
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-base font-black text-black">{employeeName}</p>
                          <p className="text-xs text-black/40 font-bold mt-1">{emp.employee_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm text-black/70 font-semibold">{emp.designation || '—'}</td>
                    <td className="px-8 py-6 text-sm text-black/70 font-semibold">{emp.team || '—'}</td>
                    <td className="px-8 py-6 text-sm text-black/50">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} />
                        {emp.location || '—'}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span
                        className="px-4 py-2 rounded-full text-[11px] uppercase font-black tracking-[0.15em]"
                        style={{ background: '#10B98115', color: '#10B981', border: '1px solid #10B98130' }}
                      >
                        Active
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      {canViewProfile && (
                        <button className="flex items-center gap-2 text-[#7c3aed] font-black text-sm">
                          Open <ArrowRight size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selectedCode && (
        <FinanceReviewPanel employeeCode={selectedCode} onClose={() => setSelectedCode(null)} onSaved={fetchEmployees} />
      )}
    </div>
  );
}
