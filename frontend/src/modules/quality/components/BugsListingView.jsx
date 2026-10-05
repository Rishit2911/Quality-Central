import React, { useState, useMemo } from 'react';
import { 
  Plus, Search, Filter, Edit3, Trash2, ExternalLink, 
  CheckSquare, Square, ChevronRight, ChevronLeft, 
  Layers, User, Calendar, Check, MoreVertical, X,
  LayoutGrid, List as ListIcon, ShieldAlert, CheckCircle2,
  Send, CheckCheck, Lock, Eye, Download, FileText
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { exportBugsQueueXLSX } from '../utils/qualityExport';

export default function BugsListingView({
  bugs = [],
  onOpenCreateBug,
  onViewBugDetails,
  onEditBug,
  onDeleteBug,
  onUpdateBugStatus,
  onTriggerSubmitDebug,
  currentUser = 'Rishit',
  hiddenBugIds = [],
  initialProjectFilter = 'all',
  initialQueueTab = 'all',
  onClearProjectFilter,
  projectsList = [],
  scope: initialScope,
  onScopeChange
}) {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'kanban'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState(initialProjectFilter || 'all');
  const [assigneeTab, setAssigneeTab] = useState(() => {
    if (initialQueueTab) return initialQueueTab;
    return initialScope === 'personal' ? 'me' : 'all';
  }); // 'all' | 'me' | 'resolved'
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const [selectedBugIds, setSelectedBugIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  React.useEffect(() => {
    if (initialQueueTab) {
      setAssigneeTab(initialQueueTab);
      setCurrentPage(1);
    } else if (initialScope) {
      setAssigneeTab(initialScope === 'personal' ? 'me' : 'all');
      setCurrentPage(1);
    }
  }, [initialQueueTab, initialScope]);

  React.useEffect(() => {
    setProjectFilter(initialProjectFilter || 'all');
  }, [initialProjectFilter]);

  // Strict ownership check: only the person responsible can edit progress, select, or submit ticket
  const canUserEdit = (bug) => {
    if (!bug) return false;
    const myName = (typeof currentUser === 'string' ? currentUser : currentUser?.name || currentUser?.username || 'Rishit').toLowerCase().trim();
    const myShort = myName.includes('@') ? myName.split('@')[0] : myName;

    // Superadmin / admin has universal permissions
    if (myShort === 'admin' || myName.includes('admin')) return true;

    if (!bug.assignee) return true; // Unassigned bugs can be claimed/edited
    const bugAssignee = String(bug.assignee).toLowerCase().trim();
    if (myShort.includes('rishit') && bugAssignee.includes('rishit')) return true;
    return bugAssignee.includes(myShort) || myShort.includes(bugAssignee);
  };

  // Filtered bugs
  const filteredBugs = useMemo(() => {
    return bugs.filter((bug) => {
      const isResolved = ['resolved', 'closed'].includes((bug.status || '').toLowerCase()) || 
                         Boolean(bug.handed_off_to_tester) || 
                         Boolean(bug.removed_from_dev_list) || 
                         (hiddenBugIds && hiddenBugIds.includes(bug.id));

      // 1. Queue Tab Filtering:
      if (assigneeTab === 'resolved') {
        // Show strictly resolved & closed tickets
        if (!isResolved) return false;
      } else {
        // In "Assigned to You" or "To the Team" active queues:
        // Hide resolved/closed/handed-off tickets unless explicitly chosen via status filter dropdown
        const isExplicitResolvedFilter = ['resolved', 'closed'].includes((statusFilter || '').toLowerCase());
        if (isResolved && !isExplicitResolvedFilter) {
          return false;
        }

        // In "Assigned to You" tab, only show bugs assigned to currentUser
        if (assigneeTab === 'me') {
          const myName = (typeof currentUser === 'string' ? currentUser : currentUser?.name || currentUser?.username || 'Rishit').toLowerCase().trim();
          const bugAssignee = (bug.assignee || '').toLowerCase().trim();
          const matches = bugAssignee.includes(myName) || 
                          myName.includes(bugAssignee) ||
                          (myName.includes('rishit') && bugAssignee.includes('rishit'));
          if (!matches) return false;
        }
      }

      // 2. Search query matching
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        bug.title?.toLowerCase().includes(q) ||
        bug.id?.toLowerCase().includes(q) ||
        bug.assignee?.toLowerCase().includes(q) ||
        bug.resolved_by?.toLowerCase().includes(q) ||
        bug.project?.toLowerCase().includes(q) ||
        bug.module?.toLowerCase().includes(q);

      // 3. Dropdown status filter matching
      const matchesStatus = statusFilter === 'all' || bug.status?.toLowerCase() === statusFilter.toLowerCase();
      const matchesSeverity = severityFilter === 'all' || bug.severity?.toLowerCase() === severityFilter.toLowerCase();
      const matchesPriority = priorityFilter === 'all' || bug.priority?.toLowerCase() === priorityFilter.toLowerCase();
      
      // 4. Project filter matching
      const pClean = projectFilter.toLowerCase().trim();
      const pCodeNoHash = pClean.startsWith('#') ? pClean.slice(1) : pClean;
      const matchesProject = projectFilter === 'all' || 
        bug.project?.toLowerCase() === pClean ||
        bug.prefix?.toLowerCase() === pClean ||
        bug.project_code?.toLowerCase() === pClean ||
        (bug.id && bug.id.toLowerCase().includes(pCodeNoHash)) ||
        (bug.project && bug.project.toLowerCase().includes(pClean)) ||
        (projectsList.some(p => 
          (p.prefix.toLowerCase() === pClean || p.name.toLowerCase() === pClean) &&
          (bug.project?.toLowerCase() === p.name.toLowerCase() || (bug.id && bug.id.toLowerCase().includes(p.prefix.replace('#','').toLowerCase())))
        ));

      return matchesSearch && matchesStatus && matchesSeverity && matchesPriority && matchesProject;
    });
  }, [bugs, searchQuery, statusFilter, severityFilter, priorityFilter, projectFilter, assigneeTab, hiddenBugIds, currentUser, projectsList]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredBugs.length / pageSize));
  const paginatedBugs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBugs.slice(start, start + pageSize);
  }, [filteredBugs, currentPage]);

  // Checkbox handling - only bugs assigned to current user are selectable
  const selectableBugs = useMemo(() => {
    return paginatedBugs.filter(b => canUserEdit(b));
  }, [paginatedBugs, currentUser]);

  // Clean up selectedBugIds if any ticket is not assigned to currentUser
  React.useEffect(() => {
    setSelectedBugIds(prev => {
      const allowed = prev.filter(id => {
        const bug = bugs.find(b => b.id === id);
        return bug && canUserEdit(bug);
      });
      return allowed.length === prev.length ? prev : allowed;
    });
  }, [bugs, currentUser]);

  const isAllSelected = selectableBugs.length > 0 && selectableBugs.every(b => selectedBugIds.includes(b.id));

  const toggleSelectAll = () => {
    if (selectableBugs.length === 0) {
      toast.error('No bugs assigned to you on this page to select.');
      return;
    }
    if (isAllSelected) {
      setSelectedBugIds([]);
    } else {
      setSelectedBugIds(selectableBugs.map(b => b.id));
    }
  };

  const toggleSelectRow = (bug) => {
    if (!canUserEdit(bug)) {
      toast.error(`Permission denied: Only ${bug.assignee || 'the assigned owner'} can select or submit this bug.`);
      return;
    }
    setSelectedBugIds(prev => 
      prev.includes(bug.id) ? prev.filter(item => item !== bug.id) : [...prev, bug.id]
    );
  };

  // Badge Styling based strictly on prompt specifications:
  // Critical: #EF4444, High: #F97316, Medium: #F59E0B, Low: #64748B
  const getSeverityBadge = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return {
          bg: '#FEE2E2',
          text: '#EF4444',
          border: '#FECACA',
          label: 'Critical'
        };
      case 'high':
        return {
          bg: '#FFEDD5',
          text: '#F97316',
          border: '#FED7AA',
          label: 'High'
        };
      case 'medium':
        return {
          bg: '#FEF3C7',
          text: '#F59E0B',
          border: '#FDE68A',
          label: 'Medium'
        };
      case 'low':
      default:
        return {
          bg: '#F1F5F9',
          text: '#64748B',
          border: '#E2E8F0',
          label: 'Low'
        };
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical':
      case 'p1 - urgent':
      case 'urgent':
        return {
          bg: '#FEE2E2',
          text: '#EF4444',
          border: '#FECACA',
          label: 'Urgent'
        };
      case 'high':
      case 'p2 - high':
        return {
          bg: '#FFEDD5',
          text: '#F97316',
          border: '#FED7AA',
          label: 'High'
        };
      case 'medium':
      case 'p3 - normal':
      case 'normal':
        return {
          bg: '#FEF3C7',
          text: '#F59E0B',
          border: '#FDE68A',
          label: 'Medium'
        };
      case 'low':
      case 'p4 - low':
      default:
        return {
          bg: '#F1F5F9',
          text: '#64748B',
          border: '#E2E8F0',
          label: 'Low'
        };
    }
  };

  // Status badges: Open: #3B82F6, In Progress: #EAB308, Resolved: #22C55E
  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'open':
        return {
          bg: '#DBEAFE',
          text: '#3B82F6',
          border: '#BFDBFE',
          label: 'Open'
        };
      case 'in progress':
        return {
          bg: '#FEF9C3',
          text: '#EAB308',
          border: '#FEF08A',
          label: 'In Progress'
        };
      case 'resolved':
        return {
          bg: '#DCFCE7',
          text: '#22C55E',
          border: '#BBF7D0',
          label: 'Resolved'
        };
      case 'closed':
      default:
        return {
          bg: '#F1F5F9',
          text: '#64748B',
          border: '#E2E8F0',
          label: 'Closed'
        };
    }
  };

  // Kanban Columns
  const kanbanColumns = [
    { id: 'Open', title: 'Open', color: '#3B82F6', bg: 'bg-blue-50/60' },
    { id: 'In Progress', title: 'In Progress', color: '#EAB308', bg: 'bg-yellow-50/60' },
    { id: 'Resolved', title: 'Resolved', color: '#22C55E', bg: 'bg-emerald-50/60' },
    { id: 'Closed', title: 'Closed', color: '#64748B', bg: 'bg-slate-50/60' },
  ];

  // Live real-time bug counts for the Assigned to You vs To the Team switcher
  const myBugsCount = useMemo(() => {
    return bugs.filter(b => {
      const isResolved = ['resolved', 'closed'].includes((b.status || '').toLowerCase());
      const isHandedOff = b.handed_off_to_tester || b.removed_from_dev_list || (hiddenBugIds && hiddenBugIds.includes(b.id));
      if (isResolved || isHandedOff) return false;
      const myName = (typeof currentUser === 'string' ? currentUser : currentUser?.name || currentUser?.username || 'Rishit').toLowerCase().trim();
      const bugAssignee = (b.assignee || '').toLowerCase().trim();
      return bugAssignee.includes(myName) || myName.includes(bugAssignee) || (myName.includes('rishit') && bugAssignee.includes('rishit'));
    }).length;
  }, [bugs, currentUser, hiddenBugIds]);

  const teamBugsCount = useMemo(() => {
    return bugs.filter(b => {
      const isResolved = ['resolved', 'closed'].includes((b.status || '').toLowerCase());
      const isHandedOff = b.handed_off_to_tester || b.removed_from_dev_list || (hiddenBugIds && hiddenBugIds.includes(b.id));
      if (isResolved || isHandedOff) return false;
      return true;
    }).length;
  }, [bugs, hiddenBugIds]);

  const resolvedBugsCount = useMemo(() => {
    return bugs.filter(b => {
      const isResolved = ['resolved', 'closed'].includes((b.status || '').toLowerCase());
      const isHandedOff = Boolean(b.handed_off_to_tester || b.removed_from_dev_list || (hiddenBugIds && hiddenBugIds.includes(b.id)));
      return isResolved || isHandedOff;
    }).length;
  }, [bugs, hiddenBugIds]);

  return (
    <div className="w-full max-w-[1440px] mx-auto animate-fade-in-up pb-12">
      {/* ========================================================
          A. HEADER CONTROLS & ACTIONS matching Screenshot 1
      ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 gap-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight m-0">
            Bugs
          </h1>
          <span className="px-2.5 py-0.5 text-xs font-bold bg-violet-100 text-violet-700 rounded-full border border-violet-200">
            {filteredBugs.length} Total
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Queue Tab: Assigned to You vs To the Team vs Resolved & Closed */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setAssigneeTab('me');
                setCurrentPage(1);
                if (onScopeChange) onScopeChange('personal');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                assigneeTab === 'me'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="Filter to active bugs assigned to you"
            >
              <span>👤 Assigned to You</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                assigneeTab === 'me' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {myBugsCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAssigneeTab('all');
                setProjectFilter('all');
                setCurrentPage(1);
                if (onClearProjectFilter) onClearProjectFilter();
                if (onScopeChange) onScopeChange('team');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                assigneeTab === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="Show all active team bugs across all projects"
            >
              <span>👥 To the Team</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                assigneeTab === 'all' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {teamBugsCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAssigneeTab('resolved');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                assigneeTab === 'resolved'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="Show all resolved and closed bugs from database archive"
            >
              <CheckCircle2 size={13} className={assigneeTab === 'resolved' ? 'text-white' : 'text-emerald-600'} />
              <span>Resolved & Closed</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                assigneeTab === 'resolved' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {resolvedBugsCount}
              </span>
            </button>
          </div>

          {/* View Toggle: List View | Kanban View with Switch matching Screenshot 1 */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ListIcon size={14} />
              <span>List View</span>
            </button>

            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid size={14} />
              <span>Kanban View</span>
            </button>

            {/* Toggle switch visual */}
            <div 
              onClick={() => setViewMode(viewMode === 'list' ? 'kanban' : 'list')}
              className="ml-2 w-9 h-5 bg-blue-600 rounded-full flex items-center p-0.5 cursor-pointer transition-colors"
            >
              <div 
                className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${
                  viewMode === 'kanban' ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
          </div>

          {/* Search Input matching Screenshot 1 */}
          <div className="relative">
            <Search 
              size={15} 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" 
            />
            <input
              type="text"
              placeholder="Search Bugs..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs font-medium pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400 w-44 sm:w-56 shadow-sm transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter Popover Button */}
          <div className="relative">
            <button
              onClick={() => setShowFilterPopover(!showFilterPopover)}
              className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                statusFilter !== 'all' || severityFilter !== 'all' || priorityFilter !== 'all'
                  ? 'bg-blue-50 border-blue-200 text-blue-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title="Filter Bugs"
            >
              <Filter size={15} />
            </button>

            {showFilterPopover && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-40 animate-scale-in">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider m-0">
                    Filter Bugs
                  </h4>
                  <button
                    onClick={() => {
                      setStatusFilter('all');
                      setSeverityFilter('all');
                      setPriorityFilter('all');
                      setProjectFilter('all');
                    }}
                    className="text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    Reset All
                  </button>
                </div>

                <div className="py-3 space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Project</label>
                    <select
                      value={projectFilter}
                      onChange={(e) => setProjectFilter(e.target.value)}
                      className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
                    >
                      <option value="all">All Projects</option>
                      {projectsList && projectsList.map(p => (
                        <option key={p.id || p.prefix} value={p.name}>
                          {p.name} ({p.prefix})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                    >
                      <option value="all">All Statuses</option>
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Severity</label>
                    <select
                      value={severityFilter}
                      onChange={(e) => setSeverityFilter(e.target.value)}
                      className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                    >
                      <option value="all">All Severities</option>
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Priority</label>
                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                    >
                      <option value="all">All Priorities</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => setShowFilterPopover(false)}
                  className="w-full py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            )}
          </div>

          {/* Export Defect Register Report Button */}
          <button
            type="button"
            onClick={() => {
              const queueLabel = assigneeTab === 'me' 
                ? 'Assigned to You' 
                : assigneeTab === 'resolved' 
                  ? 'Resolved and Closed Archive' 
                  : 'Team Defect Queue';
              exportBugsQueueXLSX(filteredBugs, queueLabel, currentUser);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            title="Download defect register report"
          >
            <FileText size={14} className="text-violet-600" />
            <span className="hidden sm:inline">Export Defect Register</span>
          </button>

          {/* Primary CTA Button: + New Bug matching Screenshot 1 */}
          <button
            onClick={onOpenCreateBug}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>+ New Bug</span>
          </button>
        </div>
      </div>

      {/* Active Project Filter Notification Banner */}
      {projectFilter && projectFilter !== 'all' && (
        <div className="mt-4 p-3 bg-violet-50/90 border border-violet-200/90 rounded-2xl flex items-center justify-between gap-3 shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse shrink-0" />
            <span className="text-xs text-violet-950 font-medium truncate">
              Filtered by Project: <strong className="font-mono font-bold text-violet-800">{projectFilter}</strong>
              <span className="ml-2 text-violet-600 font-normal">({filteredBugs.length} matching tickets)</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setProjectFilter('all');
              if (onClearProjectFilter) onClearProjectFilter();
            }}
            className="shrink-0 px-2.5 py-1 text-[11px] font-bold text-violet-700 bg-white hover:bg-violet-100/80 rounded-xl border border-violet-200 transition-all flex items-center gap-1 cursor-pointer"
          >
            <span>Reset Project Filter</span>
            <X size={12} />
          </button>
        </div>
      )}

      {/* ========================================================
      {/* ========================================================
          SELECTED BUGS ACTIONS BAR (Done / Hand Off to Tester)
      ======================================================== */}
      {selectedBugIds.length > 0 && (
        <>
          <style>{`
            @keyframes floatDonePopUp {
              0% {
                opacity: 0;
                transform: translate(-50%, 32px) scale(0.95);
              }
              60% {
                transform: translate(-50%, -4px) scale(1.02);
              }
              100% {
                opacity: 1;
                transform: translate(-50%, 0) scale(1);
              }
            }
          `}</style>

          {/* Contextual Top Banner */}
          <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in shadow-xs">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-emerald-950">
                {selectedBugIds.length} {selectedBugIds.length === 1 ? 'Bug' : 'Bugs'} Selected ({selectedBugIds.join(', ')})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedBugIds([])}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Clear Selection
              </button>
              <button
                type="button"
                onClick={() => {
                  const targets = bugs.filter(b => selectedBugIds.includes(b.id));
                  if (targets.length === 0) {
                    toast.error('Please select at least one bug to mark Done.');
                    return;
                  }
                  onTriggerSubmitDebug?.(targets);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                <CheckCircle2 size={16} strokeWidth={2.5} />
                <span>Done (Submit to Tester)</span>
              </button>
            </div>
          </div>

          {/* FLOATING ACTION BAR: Fixed at bottom of viewport so it ALWAYS POPS UP in view */}
          <div 
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[90] bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-slate-700/80 flex items-center gap-4 transition-all duration-300"
            style={{ animation: 'floatDonePopUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#34D399]" />
              <span className="text-xs font-bold text-slate-100 whitespace-nowrap">
                {selectedBugIds.length} {selectedBugIds.length === 1 ? 'Bug' : 'Bugs'} Selected: <span className="font-mono text-emerald-400 font-extrabold">{selectedBugIds.join(', ')}</span>
              </span>
            </div>

            <div className="h-4 w-px bg-slate-700 hidden sm:block" />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedBugIds([])}
                className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  const targets = bugs.filter(b => selectedBugIds.includes(b.id));
                  if (targets.length === 0) {
                    toast.error('Please select at least one bug to mark Done.');
                    return;
                  }
                  onTriggerSubmitDebug?.(targets);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white text-xs font-extrabold rounded-xl shadow-[0_4px_16px_rgba(16,185,129,0.35)] transition-all cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 size={16} strokeWidth={2.5} />
                <span>Done (Submit to Tester)</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ========================================================
          B. BUG LISTING TABLE DATA matching Screenshot 1
      ======================================================== */}
      {viewMode === 'list' ? (
        <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {/* Checkbox column */}
                  <th className="py-3.5 px-4 w-10 text-center">
                    {selectableBugs.length > 0 ? (
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-slate-400 hover:text-slate-600 flex items-center justify-center mx-auto cursor-pointer transition-transform active:scale-90"
                        title={isAllSelected ? "Deselect all your assigned bugs" : "Select all your assigned bugs"}
                        aria-label="Select all your assigned bugs"
                      >
                        {isAllSelected ? (
                          <CheckSquare size={16} className="text-blue-600" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    ) : (
                      <div 
                        className="flex items-center justify-center mx-auto text-slate-300 cursor-not-allowed select-none"
                        title="No bugs assigned to you on this page to select"
                      >
                        <Lock size={13} className="text-slate-300 opacity-60" />
                      </div>
                    )}
                  </th>

                  <th className="py-3.5 px-4">Bug ID</th>
                  <th className="py-3.5 px-4 min-w-[200px]">Title</th>
                  <th className="py-3.5 px-4">Project</th>
                  <th className="py-3.5 px-4">Module</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Severity</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">{assigneeTab === 'resolved' ? 'Resolved By' : 'Assignee'}</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedBugs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <ShieldAlert size={36} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-600 m-0">No bug tickets found</p>
                      <p className="text-[11px] mt-1 text-slate-400 m-0">
                        Try modifying your search or filter parameters, or click "+ New Bug" to report one.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedBugs.map((bug) => {
                    const isSelected = selectedBugIds.includes(bug.id);
                    const sev = getSeverityBadge(bug.severity);
                    const pri = getPriorityBadge(bug.priority);
                    const st = getStatusBadge(bug.status);

                    return (
                      <tr 
                        key={bug.id} 
                        className={`hover:bg-violet-50/30 transition-colors group ${
                          isSelected ? 'bg-blue-50/40' : ''
                        }`}
                      >
                        {/* Checkbox - selectable strictly by the assigned owner */}
                        <td className="py-3.5 px-4 text-center">
                          {canUserEdit(bug) ? (
                            <button
                              type="button"
                              onClick={() => toggleSelectRow(bug)}
                              className="text-slate-400 hover:text-slate-600 flex items-center justify-center mx-auto cursor-pointer transition-transform active:scale-90"
                              title="Select bug to mark Done or submit to tester"
                            >
                              {isSelected ? (
                                <CheckSquare size={16} className="text-blue-600" />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          ) : (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                toast.error(`Permission denied: Only ${bug.assignee || 'the assigned owner'} can select or mark Done this ticket.`);
                              }}
                              className="flex items-center justify-center mx-auto text-slate-300 hover:text-slate-400 cursor-not-allowed select-none group/lock py-0.5"
                              title={`Selection locked: Only ${bug.assignee || 'the assigned owner'} can select or mark Done this ticket`}
                            >
                              <Lock size={13} className="text-slate-300 group-hover/lock:text-slate-500 transition-colors" />
                            </div>
                          )}
                        </td>

                        {/* Bug ID with SMART LINK styling matching Screenshot 1 */}
                        <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">
                          <button
                            onClick={() => onViewBugDetails(bug)}
                            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 transition-colors font-bold group-hover:underline text-left cursor-pointer"
                            title="Click to view details (Smart Link)"
                          >
                            <span>{bug.id}</span>
                            <span className="text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 opacity-90 group-hover:opacity-100 font-sans font-bold flex items-center gap-0.5">
                              ↗
                            </span>
                          </button>
                        </td>

                        {/* Title */}
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          <span
                            onClick={() => onViewBugDetails(bug)}
                            className="hover:text-blue-600 cursor-pointer transition-colors"
                          >
                            {bug.title}
                          </span>
                        </td>

                        {/* Project */}
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap font-medium">
                          {bug.project || 'Quality Central'}
                        </td>

                        {/* Module */}
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap font-medium">
                          {bug.module || 'General'}
                        </td>

                        {/* Priority Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span 
                            className="px-2.5 py-1 text-[11px] font-bold rounded-md border"
                            style={{ 
                              backgroundColor: pri.bg, 
                              color: pri.text, 
                              borderColor: pri.border 
                            }}
                          >
                            {pri.label}
                          </span>
                        </td>

                        {/* Severity Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span 
                            className="px-2.5 py-1 text-[11px] font-bold rounded-md border"
                            style={{ 
                              backgroundColor: sev.bg, 
                              color: sev.text, 
                              borderColor: sev.border 
                            }}
                          >
                            {sev.label}
                          </span>
                        </td>

                        {/* Interactive Status Selector - Editable only by assignee */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {canUserEdit(bug) ? (
                            <select
                              value={bug.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => onUpdateBugStatus(bug.id, e.target.value)}
                              className="text-[11px] font-bold py-1 px-2.5 rounded-lg border cursor-pointer transition-all hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-violet-400 font-sans"
                              style={{
                                backgroundColor: st.bg,
                                color: st.text,
                                borderColor: st.border
                              }}
                              title="Click to update bug status (You are the assignee)"
                            >
                              <option value="Open" style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}>Open</option>
                              <option value="In Progress" style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>In Progress</option>
                              <option value="Resolved" style={{ backgroundColor: '#DCFCE7', color: '#166534' }}>Resolved</option>
                              <option value="Closed" style={{ backgroundColor: '#F1F5F9', color: '#334155' }}>Closed</option>
                            </select>
                          ) : (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                toast.error(`Only ${bug.assignee || 'the assigned owner'} can change the status of this ticket.`);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-md border cursor-not-allowed opacity-80"
                              style={{
                                backgroundColor: st.bg,
                                color: st.text,
                                borderColor: st.border
                              }}
                              title={`Read-only: Assigned to ${bug.assignee}`}
                            >
                              <Lock size={11} className="text-slate-500" />
                              <span>{st.label}</span>
                            </div>
                          )}
                        </td>

                        {/* Assignee / Resolved By */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {['resolved', 'closed'].includes((bug.status || '').toLowerCase()) || bug.resolved_by ? (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-xs">
                                {(bug.resolved_by || bug.assignee || 'RI').substring(0, 2).toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                                  <span>{bug.resolved_by || bug.assignee || 'Rishit'}</span>
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                                    Resolved
                                  </span>
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium">
                                  {bug.resolved_at || '14 Mar 2026, 02:45 PM'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">
                                {bug.assignee ? bug.assignee.substring(0, 2).toUpperCase() : 'NA'}
                              </div>
                              <span className="font-semibold text-slate-700">
                                {bug.assignee || 'Unassigned'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Actions (Done / Edit / Delete / View Details) */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {['resolved', 'closed'].includes((bug.status || '').toLowerCase()) ? (
                              <button
                                type="button"
                                onClick={() => onViewBugDetails(bug)}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-800 border border-emerald-300 rounded-xl transition-all flex items-center gap-1.5 font-bold text-xs shadow-2xs cursor-pointer hover:shadow-xs"
                                title="View full bug & resolution details"
                              >
                                <Eye size={13} className="text-emerald-700" />
                                <span>View Details</span>
                              </button>
                            ) : canUserEdit(bug) ? (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onTriggerSubmitDebug?.([bug]);
                                  }}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-700 border border-emerald-300 rounded-lg transition-all flex items-center gap-1.5 font-bold text-[11px] shadow-xs cursor-pointer hover:shadow-sm"
                                  title="Done: Submit debugging info to QA tester"
                                >
                                  <CheckCircle2 size={13} strokeWidth={2.5} />
                                  <span>Done</span>
                                </button>
                                <button
                                  onClick={() => onEditBug(bug)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit bug"
                                >
                                  <Edit3 size={15} />
                                </button>
                                <button
                                  onClick={() => onDeleteBug(bug.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete bug"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onViewBugDetails(bug)}
                                className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 py-1 px-2.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 rounded-lg border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer"
                                title="Click to view bug information"
                              >
                                <Eye size={12} className="text-slate-500" />
                                <span>View Details</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination matching Screenshot 1 ("Showing 1 to 3 of 3" and 1 2 3 4 5 >) */}
          <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing {filteredBugs.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, filteredBugs.length)} of {filteredBugs.length}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                    currentPage === page
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================
            KANBAN VIEW
        ======================================================== */
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
          {kanbanColumns.map((col) => {
            const colBugs = filteredBugs.filter(b => b.status?.toLowerCase() === col.id.toLowerCase());

            return (
              <div 
                key={col.id} 
                className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 min-h-[500px] flex flex-col"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-3">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-2.5 h-2.5 rounded-full" 
                      style={{ backgroundColor: col.color }} 
                    />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider m-0">
                      {col.title}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-white text-slate-600 border border-slate-200 shadow-sm">
                    {colBugs.length}
                  </span>
                </div>

                {/* Bug Cards */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {colBugs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs italic">
                      No bugs in {col.title}
                    </div>
                  ) : (
                    colBugs.map((bug) => {
                      const sev = getSeverityBadge(bug.severity);
                      const pri = getPriorityBadge(bug.priority);

                      return (
                        <div
                          key={bug.id}
                          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                          onClick={() => onViewBugDetails(bug)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-xs font-bold text-blue-600 group-hover:underline">
                              {bug.id}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {!canUserEdit(bug) && (
                                <span 
                                  className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1"
                                  title={`Read-only: Assigned to ${bug.assignee}`}
                                >
                                  <Lock size={9} /> Read-Only
                                </span>
                              )}
                              <span 
                                className="px-1.5 py-0.5 text-[9px] font-bold rounded border"
                                style={{ 
                                  backgroundColor: pri.bg, 
                                  color: pri.text, 
                                  borderColor: pri.border 
                                }}
                              >
                                {pri.label}
                              </span>
                              <span 
                                className="px-2 py-0.5 text-[10px] font-bold rounded border"
                                style={{ 
                                  backgroundColor: sev.bg, 
                                  color: sev.text, 
                                  borderColor: sev.border 
                                }}
                              >
                                {sev.label}
                              </span>
                            </div>
                          </div>

                          <h4 className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2 leading-tight">
                            {bug.title}
                          </h4>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-3">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                              {bug.project || 'Quality Central'}
                            </span>
                            <span>•</span>
                            <span className="truncate max-w-[100px]">{bug.module}</span>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="w-5 h-5 rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                                {bug.assignee ? bug.assignee.substring(0, 2).toUpperCase() : 'NA'}
                              </div>
                              <span className="text-[11px] font-semibold text-slate-700 truncate">
                                {bug.assignee || 'Unassigned'}
                              </span>
                            </div>

                            {/* Quick status controller - Editable ONLY by the assigned owner */}
                            {canUserEdit(bug) ? (
                              <select
                                value={bug.status}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => onUpdateBugStatus(bug.id, e.target.value)}
                                className="text-[10px] font-bold py-0.5 px-2 bg-white border border-violet-300 text-violet-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-400 cursor-pointer shadow-2xs hover:bg-violet-50 transition-colors"
                                title="Change status (You are the assignee)"
                              >
                                <option value="Open">Open</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Resolved">Resolved</option>
                                <option value="Closed">Closed</option>
                              </select>
                            ) : (
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toast.error(`Only ${bug.assignee || 'the assigned owner'} can change the status of this ticket.`);
                                }}
                                className="flex items-center gap-1 text-[10px] font-bold py-0.5 px-2 bg-slate-100 text-slate-500 rounded-lg border border-slate-200 cursor-not-allowed opacity-85 hover:bg-slate-200 transition-colors"
                                title={`Read-only: Only ${bug.assignee} can edit or change status`}
                              >
                                <Lock size={10} className="text-slate-400" />
                                <span>{bug.status}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
