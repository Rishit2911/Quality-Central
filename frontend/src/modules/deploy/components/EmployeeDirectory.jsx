import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  ArrowRight,
  MapPin,
  AlertTriangle,
  ClipboardList
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

import AddEmployeeModal from './AddEmployeeModal';
import EditRequestReviewPanel from './EditRequestReviewPanel';
import HasPermission from '../../../components/common/HasPermission';
import { usePermissions } from '../../../core/auth/usePermissions';
import { P } from '../../../core/permissions';
import { getInitials } from '../../../core/utils/nameHelpers';

// ── UPDATED STATUS COLORS ──
const STATUS_COLORS = {
  Active: '#10B981',
  'Notice Period': '#F59E0B',
  'On Notice': '#F59E0B',
  'Notice': '#F59E0B',
  'Inactive': '#000000',  // ← ADD THIS LINE
  'Exited': '#fe002a',
  'On Leave' : '#147bdb',
};

// ── HELPER: Normalize status for display ──
const normalizeStatus = (status) => {
  if (!status) return 'Active';
  
  const s = status.toLowerCase().trim();
  
  // All variations of "Notice" map to "Notice Period"
  if (s === 'notice period' || s === 'on notice' || s === 'notice' || s === 'onnotice') {
    return 'Notice Period';
  }
  
  if (s === 'active') return 'Active';
  if (s === 'exited' || s === 'terminated') return 'Exited';
  if (s === 'inactive') return 'Inactive';
  
  return status; // Return as-is for unknown statuses
};

export default function EmployeeDirectory() {
  const { hasPermission } = usePermissions();
  const canViewProfile = hasPermission(P.DEPLOY_EMP_VIEW_PROFILE);
  const canReviewEditRequests = hasPermission(P.DEPLOY_EMP_APPROVE_BASIC);
  const canViewList = hasPermission(P.DEPLOY_EMP_VIEW_LIST);
  const isTeamView = !canViewList && hasPermission(P.DEPLOY_EMP_VIEW_TEAM);

  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterTeam, setFilterTeam] = useState('All');

  const [showAddModal, setShowAddModal] = useState(false);

  const [activeTab, setActiveTab] = useState('employees');
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  useEffect(() => {
    fetchEmployees();
    if (canReviewEditRequests) {
      fetchPendingRequests();
    }
  }, [canReviewEditRequests]);

  useEffect(() => {
    if (activeTab === 'requests' && canReviewEditRequests) fetchPendingRequests();
  }, [activeTab, canReviewEditRequests]);

  const fetchPendingRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await fetch('/api/employee-edit-requests/pending', { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPendingRequests(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load pending edit requests');
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchEmployees = async () => {

    try {

      setLoading(true);

      const res = await fetch('/api/employees', {
  credentials: 'include'
});

const data = await res.json();

console.log("RAW EMPLOYEE RESPONSE:", data);

let employeeList = [];

if (Array.isArray(data)) {
  employeeList = data;
}
else if (Array.isArray(data.employees)) {
  employeeList = data.employees;
}
else if (Array.isArray(data.data)) {
  employeeList = data.data;
}
else if (Array.isArray(data.results)) {
  employeeList = data.results;
}
else {
  console.error("UNKNOWN EMPLOYEE SHAPE:", data);
}

console.log("FINAL EMPLOYEE LIST:", employeeList);

setEmployees(employeeList);

    } catch (e) {

      console.error(e);
      toast.error('Failed to load personnel');

    } finally {

      setLoading(false);

    }
  };

  // ── HELPER: Check if status matches filter ──
  const statusMatchesFilter = (empStatus, filter) => {
    if (filter === 'All') return true;
    
    const normalized = normalizeStatus(empStatus);
    
    if (filter === 'Active') return normalized === 'Active';
    if (filter === 'Notice Period') return normalized === 'Notice Period';
    if (filter === 'Exited') return normalized === 'Exited';
    
    return empStatus === filter;
  };

  const filtered = employees.filter((e) => {

    const employeeName =
      e.name ||
      e.full_name ||
      e.username ||
      'Unknown';

    const employeeCode =
      e.employee_code || '';
      
    const employeeEmail = 
      e.email_id || e.email || '';

    const s = search.toLowerCase();

    const matchSearch =
      employeeName.toLowerCase().includes(s) ||
      employeeCode.toLowerCase().includes(s) ||
      employeeEmail.toLowerCase().includes(s);

    const matchStatus = statusMatchesFilter(e.employment_status, filterStatus);

    const matchTeam =
      filterTeam === 'All' ||
      (e.team || 'Unassigned') === filterTeam;

    return (
      matchSearch &&
      matchStatus &&
      matchTeam
    );
  }).sort((a, b) => {
    const nameA = a.name || a.full_name || a.username || '';
    const nameB = b.name || b.full_name || b.username || '';
    return nameA.localeCompare(nameB);
  });

  const teams = [
    'All',
    ...new Set(
      employees
        .map(e => e.team)
        .filter(Boolean)
    )
  ];

  return (

    <div className="space-y-8">

      {/* HERO */}

      <div className="rounded-[2.5rem] border border-[#ebe7ff] bg-[#f7f3ff] px-10 py-10">

        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#7c3aed] mb-3">
          Employee Management
        </p>

        <h1 className="text-5xl font-black text-black tracking-tight leading-none">
          {isTeamView ? 'Team Directory' : 'Employee Directory'}
        </h1>

      </div>

      {/* SUB-TABS */}

      <div className="flex gap-2 p-1.5 rounded-2xl border bg-[#f5efff] border-[#ece2ff] w-fit">
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'employees'
              ? 'bg-[#7c3aed] text-white shadow-md'
              : 'text-[#6b7280] hover:text-black'
          }`}
        >
          {isTeamView ? 'My Team' : 'All Employees'}
        </button>
        {canReviewEditRequests && (
          <button
            onClick={() => setActiveTab('requests')}
            className={`relative px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'requests'
                ? 'bg-[#7c3aed] text-white shadow-md'
                : 'text-[#6b7280] hover:text-black'
            }`}
          >
            Pending Edit Requests
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-md shadow-red-500/30">
                {pendingRequests.length}
              </span>
            )}
          </button>
        )}
      </div>

      {activeTab === 'requests' && canReviewEditRequests ? (
        <div className="overflow-x-auto rounded-[2rem] border border-[#ebe7ff] bg-white">
          {loadingRequests ? (
            <div className="flex items-center justify-center h-52">
              <div className="w-10 h-10 border-4 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 gap-5">
              <ClipboardList size={48} className="text-black/10" />
              <p className="text-sm font-bold text-black/40">No pending edit requests</p>
            </div>
          ) : (
            <table className="w-full min-w-[700px]">
              <thead className="bg-[#f7f3ff] border-b border-[#ebe7ff]">
                <tr>
                  {['Employee', 'Requested Fields', 'Submitted'].map((h) => (
                    <th key={h} className="px-8 py-6 text-left text-[11px] uppercase tracking-[0.25em] font-black text-black/50">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...pendingRequests].sort((a, b) => (a.employee_name || '').localeCompare(b.employee_name || '')).map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className="border-b border-[#f1ecff] cursor-pointer hover:bg-[#faf7ff] transition-colors"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl overflow-hidden border border-[#e9ddff] bg-[#f5edff] flex items-center justify-center font-black text-[#7c3aed] text-base shrink-0">
                          {req.photo_path ? (
                            <img
                              src={`/api/employee/${req.employee_code}/document/pfp`}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            getInitials(req.employee_name)
                          )}
                        </div>
                        <div>
                          <p className="text-base font-black text-black">{req.employee_name || 'Unknown'}</p>
                          <p className="text-xs text-black/40 font-bold mt-1">{req.employee_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm text-black/70 font-semibold">
                      {(req.requested_fields || []).map(f => f.label).join(', ')}
                    </td>
                    <td className="px-8 py-6 text-sm text-black/50">
                      {req.created_at ? new Date(req.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
      <>

      {/* TOOLBAR */}

      <div className="flex flex-wrap items-center justify-between gap-4">

        <div className="flex flex-wrap items-center gap-4 flex-1 min-w-0">

          {/* SEARCH */}

          <div className="relative flex-1 min-w-[200px] max-w-md">

            <Search
              size={16}
              className="absolute left-5 top-1/2 -translate-y-1/2 text-black/30"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search personnel..."
              className="
                w-full
                pl-12
                pr-5
                py-4
                rounded-2xl
                border
                border-[#ece6ff]
                bg-white
                text-black
                text-sm
                font-semibold
                outline-none
                focus:border-[#8b5cf6]
              "
            />

          </div>

          {/* STATUS */}

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="
              w-auto
              shrink-0
              px-5
              py-4
              rounded-2xl
              border
              border-[#ece6ff]
              bg-white
              text-black
              text-sm
              font-bold
              outline-none
              cursor-pointer
            "
          >

            {[
              'All',
              'Active',
              'Notice Period',
              'Exited'
            ].map((s) => (

              <option key={s} value={s}>
                {s}
              </option>

            ))}

          </select>

          {/* TEAM */}

          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="
              w-auto
              shrink-0
              px-5
              py-4
              rounded-2xl
              border
              border-[#ece6ff]
              bg-white
              text-black
              text-sm
              font-bold
              outline-none
              cursor-pointer
            "
          >

            {teams.map((t) => (

              <option key={t} value={t}>
                {t}
              </option>

            ))}

          </select>

        </div>

        {/* BUTTON */}

        <HasPermission permission="deploy.employees.create">

          <button
            onClick={() => setShowAddModal(true)}
            className="
              px-7
              py-4
              rounded-2xl
              bg-[#7c3aed]
              hover:bg-[#6d28d9]
              !text-white 
              text-sm
              font-black 
              tracking-wide
              flex items-center 
              gap-3 shadow-lg 
              shadow-[#7c3aed]/20
              shrink-0
              transition-all
              cursor-pointer
            "
          >

            <Plus size={16} />

            Add Employee

          </button>

        </HasPermission>

      </div>

      {/* ── UPDATED STATS ── */}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-5">

        {[
        {
          label: 'Total',
          count: employees.length,
          color: '#8B5CF6'
        },
        {
          label: 'Active',
          count: employees.filter(e =>
            normalizeStatus(e.employment_status) === 'Active'
          ).length,
          color: '#10B981'
        },
        {
          label: 'Notice',
          count: employees.filter(e =>
            normalizeStatus(e.employment_status) === 'Notice Period'
          ).length,
          color: '#F59E0B'
        },
        {
          label: 'Exited',
          count: employees.filter(e =>
            normalizeStatus(e.employment_status) === 'Exited'
          ).length,
          color: '#EF4444'
        },
        {
          label: 'Teams',
          count: new Set(
            employees.map(e => e.team).filter(Boolean)
          ).size,
          color: '#3B82F6'
        },
        {
          label: 'Results',
          count: filtered.length,
          color: '#06B6D4'
        },
      ].map((s, i) => (


          <div
            key={i}
            className="
              bg-white
              border
              border-[#ebe7ff]
              rounded-[2rem]
              p-6
            "
          >

            <p
              className="text-4xl font-black"
              style={{ color: s.color }}
            >
              {s.count}
            </p>

            <p className="mt-2 text-[11px] uppercase tracking-[0.3em] font-black text-black/50">
              {s.label}
            </p>

          </div>

        ))}

      </div>

      {/* TABLE */}

      <div className="overflow-x-auto rounded-[2rem] border border-[#ebe7ff] bg-white">

        {loading ? (

          <div className="flex items-center justify-center h-52">

            <div className="w-10 h-10 border-4 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />

          </div>

        ) : filtered.length === 0 ? (

          <div className="flex flex-col items-center justify-center h-52 gap-5">

            <Users size={48} className="text-black/10" />

            <p className="text-sm font-bold text-black/40">
              No personnel found
            </p>

          </div>

        ) : (

          <table className="w-full min-w-[900px]">

            <thead className="bg-[#f7f3ff] border-b border-[#ebe7ff]">

              <tr>

                {[
                  'Employee',
                  'Designation',
                  'Department',
                  'Location',
                  'Status',
                  'Actions'
                ].map((h) => (

                  <th
                    key={h}
                    className="
                      px-8
                      py-6
                      text-left
                      text-[11px]
                      uppercase
                      tracking-[0.25em]
                      font-black
                      text-black/50
                    "
                  >
                    {h}
                  </th>

                ))}

              </tr>

            </thead>

            <tbody>

              {filtered.map((emp, i) => {

                const employeeName =
                  emp.name ||
                  emp.full_name ||
                  emp.username ||
                  'Unknown';

                // ── Normalize status for display ──
                const displayStatus = normalizeStatus(emp.employment_status);
                const statusColor = STATUS_COLORS[displayStatus] || '#8B5CF6';

                return (

                  <tr
                    key={emp.employee_code || i}
                    className={`
                      border-b
                      border-[#f1ecff]
                      transition-all
                      ${canViewProfile ? 'hover:bg-[#faf7ff] cursor-pointer' : ''}
                    `}
                    onClick={() => {
                      if (canViewProfile) {
                        navigate(`/deploy?tab=profile&code=${emp.employee_code}`);
                      }
                    }}
                  >

                    {/* EMPLOYEE */}

                    <td className="px-8 py-6">

                      <div className="flex items-center gap-4">

                        <div className="relative shrink-0">

                          <div className="
                            w-14
                            h-14
                            rounded-2xl
                            overflow-hidden
                            border
                            border-[#e9ddff]
                            bg-[#f5edff]
                            flex
                            items-center
                            justify-center
                            font-black
                            text-[#7c3aed]
                            text-lg
                          ">

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

                          {!emp.profile_complete && (
                            <span
                              title="Incomplete profile"
                              className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-amber-200"
                            >
                              <AlertTriangle size={12} className="text-amber-500" fill="#fef3c7" />
                            </span>
                          )}

                        </div>

                        <div>

                          <p className="text-base font-black text-black">
                            {employeeName}
                          </p>

                          <p className="text-xs text-black/40 font-bold mt-1">
                            {emp.employee_code}
                          </p>

                        </div>

                      </div>

                    </td>

                    {/* DESIGNATION */}

                    <td className="px-8 py-6 text-sm text-black/70 font-semibold">
                      {emp.designation || '—'}
                    </td>

                    {/* TEAM */}

                    <td className="px-8 py-6 text-sm text-black/70 font-semibold">
                      {emp.team || '—'}
                    </td>

                    {/* LOCATION */}

                    <td className="px-8 py-6 text-sm text-black/50">

                      <div className="flex items-center gap-2">

                        <MapPin size={14} />

                        {emp.location || '—'}

                      </div>

                    </td>

                    {/* ── STATUS ── */}

                    <td className="px-8 py-6">

                      <span
                        className="
                          px-4
                          py-2
                          rounded-full
                          text-[11px]
                          uppercase
                          font-black
                          tracking-[0.15em]
                        "
                        style={{
                          background: `${statusColor}15`,
                          color: statusColor,
                          border: `1px solid ${statusColor}30`
                        }}
                      >

                        {displayStatus}

                      </span>

                    </td>

                    {/* ACTION */}

                    <td className="px-8 py-6">

                      {canViewProfile && (
                        <button className="
                          flex
                          items-center
                          gap-2
                          text-[#7c3aed]
                          font-black
                          text-sm
                        ">

                          Open

                          <ArrowRight size={15} />

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

      {/* MODAL */}

      {showAddModal && (

        <AddEmployeeModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchEmployees();
          }}
        />

      )}

      </>
      )}

      {selectedRequest && (
        <EditRequestReviewPanel
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onReviewed={() => {
            setSelectedRequest(null);
            fetchPendingRequests();
            fetchEmployees();
          }}
        />
      )}

    </div>
  );
}