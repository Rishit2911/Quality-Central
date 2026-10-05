import React, { useState, useMemo } from 'react';
import { 
  FolderKanban, Bug, ShieldCheck, AlertTriangle, 
  Search, Plus, ChevronRight, X, ArrowUpDown, 
  Filter, TrendingUp, AlertCircle, RefreshCw, Download, FileText
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import CreateNewProjectModal from './CreateNewProjectModal';
import ProjectDetailModal from './ProjectDetailModal';
import { computeProjectStats, doesBugMatchProject, isBugAssignedToUser } from '../utils/qualityMetrics';
import { 
  exportProjectDefectReportCSV, 
  exportAllProjectsPortfolioCSV,
  exportProjectDefectReportXLSX,
  exportAllProjectsPortfolioXLSX
} from '../utils/qualityExport';

export default function ProjectsListingView({
  projects = [],
  bugs = [],
  currentUser,
  scope = 'personal',
  onScopeChange,
  myBugsCount = 0,
  teamBugsCount = 0,
  onNavigateToBugs,
  onCreateProject,
  onUpdateProject,
  onRefresh,
  hiddenBugIds = []
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState('all'); // 'all' | 'critical' | 'high' | 'normal'
  const [sortOption, setSortOption] = useState('highest_bugs'); // 'highest_bugs' | 'lowest_health' | 'name' | 'highest_health'
  const [statusTab, setStatusTab] = useState('all'); // 'all' | 'active' | 'archived'
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProjectForDetail, setSelectedProjectForDetail] = useState(null);
  const [editingProject, setEditingProject] = useState(null);

  // ==========================================================================
  // REAL-TIME COMPUTATION: Enrich projects with live bugs data & active scope
  // ==========================================================================
  const liveProjects = useMemo(() => {
    return projects.map(p => computeProjectStats(p, bugs, currentUser, scope, hiddenBugIds));
  }, [projects, bugs, currentUser, scope, hiddenBugIds]);

  // ==========================================================================
  // 1. TOP EXECUTIVE KPI SUMMARY COMPUTATIONS (Section 2)
  // ==========================================================================
  const kpiMetrics = useMemo(() => {
    const totalProjects = liveProjects.length;
    const activeProjects = liveProjects.filter(p => (p.status || 'Active').toLowerCase() === 'active').length;
    const archivedProjects = liveProjects.filter(p => (p.status || '').toLowerCase() === 'archived').length;

    // Total active bugs (open + in-progress) computed directly from live bugs list
    const openBugs = liveProjects.reduce((acc, p) => acc + (p.open_bugs || 0), 0);
    const inProgressBugs = liveProjects.reduce((acc, p) => acc + (p.in_progress_bugs || 0), 0);
    const totalActiveBugs = openBugs + inProgressBugs;

    // Defect-free quality health rate: dynamically calculated average
    const calculatedAvgHealth = totalProjects > 0
      ? (liveProjects.reduce((acc, p) => acc + Number(p.health_rate || 0), 0) / totalProjects).toFixed(1)
      : '94.2';

    // Critical urgent blockers in scope
    const criticalBugs = liveProjects.reduce((acc, p) => acc + (p.critical_bugs || 0), 0);

    return {
      totalProjects,
      activeProjects,
      archivedProjects,
      totalActiveBugs,
      openBugs,
      inProgressBugs,
      avgHealthRate: calculatedAvgHealth,
      criticalBugs
    };
  }, [liveProjects]);

  // ==========================================================================
  // 2. SEARCH, FILTER & SORTING PIPELINE (Section 3)
  // ==========================================================================
  const filteredAndSortedProjects = useMemo(() => {
    let result = [...liveProjects];

    // Status tab filter
    if (statusTab === 'active') {
      result = result.filter(p => (p.status || 'Active').toLowerCase() === 'active');
    } else if (statusTab === 'archived') {
      result = result.filter(p => (p.status || '').toLowerCase() === 'archived');
    }

    // Search query (project name or prefix code)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.prefix && p.prefix.toLowerCase().includes(q)) ||
        (p.lead && p.lead.toLowerCase().includes(q))
      );
    }

    // Health rate filter
    if (healthFilter === 'critical') {
      result = result.filter(p => (p.health_rate || 0) < 85);
    } else if (healthFilter === 'high') {
      result = result.filter(p => (p.health_rate || 0) >= 85 && (p.health_rate || 0) <= 94);
    } else if (healthFilter === 'normal') {
      result = result.filter(p => (p.health_rate || 0) >= 95);
    }

    // Sort order
    if (sortOption === 'highest_bugs') {
      result.sort((a, b) => (b.active_bugs ?? 0) - (a.active_bugs ?? 0));
    } else if (sortOption === 'lowest_health') {
      result.sort((a, b) => (a.health_rate ?? 0) - (b.health_rate ?? 0));
    } else if (sortOption === 'highest_health') {
      result.sort((a, b) => (b.health_rate ?? 0) - (a.health_rate ?? 0));
    } else if (sortOption === 'name') {
      result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return result;
  }, [liveProjects, statusTab, searchQuery, healthFilter, sortOption]);

  // ==========================================================================
  // 3. BADGE STYLING HELPERS (Section 4)
  // ==========================================================================
  const getSeverityBadge = (severity) => {
    const s = (severity || 'Normal').toLowerCase();
    if (s === 'critical') {
      return {
        pillClasses: 'bg-[#FEE2E2] text-[#DC2626]',
        dotColor: 'bg-[#DC2626]',
        label: 'Critical'
      };
    }
    if (s === 'high') {
      return {
        pillClasses: 'bg-[#FEF3C7] text-[#D97706]',
        dotColor: 'bg-[#D97706]',
        label: 'High'
      };
    }
    return {
      pillClasses: 'bg-[#DCFCE7] text-[#16A34A]',
      dotColor: 'bg-[#16A34A]',
      label: 'Normal'
    };
  };

  const getHealthRateTextColor = (rate) => {
    const r = Number(rate || 0);
    if (r < 85) return 'text-[#DC2626]';
    if (r <= 94) return 'text-[#D97706]';
    return 'text-[#16A34A]';
  };

  // ==========================================================================
  // 4. REPORT EXPORT HANDLERS (CSV & Native Microsoft Excel .xlsx)
  // ==========================================================================
  const handleExportProjectCSV = (project) => {
    exportProjectDefectReportCSV({
      project,
      bugs,
      scope,
      currentUser
    });
  };

  const handleExportProjectXLSX = (project) => {
    exportProjectDefectReportXLSX({
      project,
      bugs,
      scope,
      currentUser
    });
  };

  const handleExportAllProjectsCSV = () => {
    exportAllProjectsPortfolioCSV({
      projects: liveProjects,
      bugs,
      currentUser
    });
  };

  const handleExportAllProjectsXLSX = () => {
    exportAllProjectsPortfolioXLSX({
      projects: liveProjects,
      bugs,
      currentUser
    });
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-6 pb-12 animate-fade-in">
      {/* ===================================================================
          1. SCOPE SELECTOR HEADER: ASSIGNED TO YOU VS TO THE TEAM
      =================================================================== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
            Executive Project & Quality Metrics
          </span>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
            {scope === 'personal' ? '👤 Assigned to You' : '👥 To the Team'}
          </span>
        </div>

        {onScopeChange && (
          <div className="inline-flex items-center bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => onScopeChange('personal')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                scope === 'personal'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="Show metrics strictly for bugs assigned to you"
            >
              <span>👤 Assigned to You</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                scope === 'personal' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {myBugsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onScopeChange('team')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                scope === 'team'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="Show all organization bugs across all projects"
            >
              <span>👥 To the Team</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                scope === 'team' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {teamBugsCount}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ===================================================================
          2. TOP EXECUTIVE KPI SUMMARY BAR (Section 2)
      =================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Projects */}
        <div className="bg-[#FFFFFF] rounded-2xl border border-[#E2E8F0] p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Projects
            </span>
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center shadow-2xs">
              <FolderKanban size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-2xl font-black text-[#0F172A] tracking-tight">
              {kpiMetrics.totalProjects}
            </span>
            <span className="text-sm font-semibold text-slate-500">
              Total
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{kpiMetrics.activeProjects} Active</span>
            <span className="text-slate-300">•</span>
            <span>{kpiMetrics.archivedProjects} Archived</span>
          </div>
        </div>

        {/* Card 2: Total Active Bugs */}
        <div className="bg-[#FFFFFF] rounded-2xl border border-[#E2E8F0] p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Active Bugs
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shadow-2xs">
              <Bug size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-2xl font-black text-[#0F172A] tracking-tight">
              {kpiMetrics.totalActiveBugs}
            </span>
            <span className="text-sm font-semibold text-slate-500">
              Active
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>{kpiMetrics.openBugs} Open</span>
            <span className="text-slate-300">•</span>
            <span>{kpiMetrics.inProgressBugs} In-Progress</span>
          </div>
        </div>

        {/* Card 3: Avg. Quality Health Rate */}
        <div className="bg-[#FFFFFF] rounded-2xl border border-[#E2E8F0] p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Avg. Quality Health Rate
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-2xs">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-2xl font-black text-[#0F172A] tracking-tight">
              {kpiMetrics.avgHealthRate}%
            </span>
            <span className="text-sm font-semibold text-slate-500">
              Health Rate
            </span>
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
            <TrendingUp size={12} />
            <span>Overall Defect-Free Benchmark</span>
          </div>
        </div>

        {/* Card 4: Critical Attention Banner */}
        <div className="bg-[#FFFFFF] rounded-2xl border border-[#E2E8F0] p-5 shadow-xs hover:shadow-md hover:border-rose-300 transition-all duration-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-red-600" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Critical Attention
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shadow-2xs">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-2xl font-black text-[#DC2626] tracking-tight">
              {kpiMetrics.criticalBugs}
            </span>
            <span className="text-sm font-semibold text-rose-600">
              Critical
            </span>
          </div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
            <AlertCircle size={12} className="shrink-0" />
            <span className="truncate">{kpiMetrics.criticalBugs} Critical Bugs Needing Immediate Fix</span>
          </div>
        </div>
      </div>

      {/* ===================================================================
          3. SEARCH, FILTER & ACTION BAR (Section 3)
      =================================================================== */}
      <div className="bg-[#FFFFFF] rounded-2xl border border-[#E2E8F0] p-3.5 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Left Controls: Search, Health Rate Filter, Sort Dropdown */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
            {/* Search Bar */}
            <div className="relative flex-1 min-w-[240px] sm:min-w-[280px] lg:max-w-[360px]">
              <Search 
                size={16} 
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" 
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by project name or prefix code..."
                className="w-full text-xs font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Health Rate Filter Dropdown */}
            <div className="relative">
              <select
                value={healthFilter}
                onChange={(e) => setHealthFilter(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all cursor-pointer pr-8 appearance-none"
                aria-label="Filter by Health Rate"
              >
                <option value="all">Health Rate: All</option>
                <option value="critical">Critical (&lt;85%)</option>
                <option value="high">High (85-94%)</option>
                <option value="normal">Normal (95-100%)</option>
              </select>
              <Filter size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all cursor-pointer pr-8 appearance-none"
                aria-label="Sort Projects"
              >
                <option value="highest_bugs">Sort: Highest Bug Count</option>
                <option value="lowest_health">Sort: Lowest Health Rate</option>
                <option value="highest_health">Sort: Highest Health Rate</option>
                <option value="name">Sort: Project Name</option>
              </select>
              <ArrowUpDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Status View Pills (Active / Archived) */}
            <div className="hidden xl:flex items-center gap-1 bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setStatusTab('all')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  statusTab === 'all' 
                    ? 'bg-white text-slate-800 shadow-2xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All ({projects.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusTab('active')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  statusTab === 'active' 
                    ? 'bg-white text-emerald-700 shadow-2xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Active ({kpiMetrics.activeProjects})
              </button>
              <button
                type="button"
                onClick={() => setStatusTab('archived')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  statusTab === 'archived' 
                    ? 'bg-white text-slate-700 shadow-2xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Archived ({kpiMetrics.archivedProjects})
              </button>
            </div>
          </div>

          {/* Right Control: Primary CTA Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                title="Refresh project metrics"
                className="w-9 h-9 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer"
              >
                <RefreshCw size={15} />
              </button>
            )}


            {/* Executive Portfolio Audit Report Button */}
            <button
              type="button"
              onClick={handleExportAllProjectsXLSX}
              title="Download comprehensive portfolio defect audit report"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-[#E2E8F0] hover:border-slate-300 font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer active:scale-98"
            >
              <FileText size={14} className="text-violet-600" />
              <span>Export Portfolio Audit</span>
            </button>

            {/* Primary Action: Add Project Button */}
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow transition-all duration-150 active:scale-98 cursor-pointer"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>+ Add Project</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================
          4. PROJECT ROW-ITEM ARCHITECTURE (LIST VIEW) (Section 4)
      =================================================================== */}
      {filteredAndSortedProjects.length === 0 ? (
        /* Empty State */
        <div className="bg-[#FFFFFF] rounded-[16px] border border-[#E2E8F0] p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <FolderKanban size={24} />
          </div>
          <h4 className="text-sm font-bold text-[#0F172A] mb-1">
            No projects matched your criteria
          </h4>
          <p className="text-xs text-[#64748B] max-w-md mx-auto mb-4">
            Try adjusting your search query, clearing health rate filters, or check the archived projects view.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setHealthFilter('all');
              setStatusTab('all');
            }}
            className="px-4 py-2 text-xs font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-xl transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        /* Single Outer Card Container (#FFFFFF, 16px border-radius, border: 1px solid #E2E8F0) */
        <div className="bg-[#FFFFFF] rounded-[16px] border border-[#E2E8F0] shadow-xs overflow-hidden">
          {filteredAndSortedProjects.map((project) => {
            const severityStyle = getSeverityBadge(project.severity);
            const healthColor = getHealthRateTextColor(project.health_rate);

            return (
              <div
                key={project.id || project.prefix}
                onClick={() => setSelectedProjectForDetail(project)}
                className="group flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#F1F5F9] last:border-b-0 hover:bg-[#F8FAFC] transition-colors duration-150 cursor-pointer select-none"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedProjectForDetail(project);
                  }
                }}
                title={`Click to view team & defect overview for ${project.name} (${project.prefix})`}
              >
                {/* [LEFT SECTION - IDENTIFIER BLOCK] */}
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* 1. Project Icon Box: Square container (38px x 38px, bg: #F8FAFC, border: #E2E8F0, 8px rounded corners) */}
                  <div 
                    className="w-[38px] h-[38px] min-w-[38px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] flex items-center justify-center text-base shadow-2xs shrink-0 group-hover:border-violet-300 transition-colors"
                    aria-hidden="true"
                  >
                    <span role="img" aria-label="Project">📁</span>
                  </div>

                  {/* 2. Project Name & Prefix Code */}
                  <div className="flex flex-col min-w-0 text-left">
                    {/* Project Title: Bold dark text (#0F172A, 14px/600) */}
                    <span className="text-[#0F172A] text-[14px] font-semibold leading-tight truncate group-hover:text-violet-700 transition-colors">
                      {project.name}
                    </span>
                    {/* Prefix ID: Displayed directly underneath in muted gray (#64748B, 12px/500) */}
                    <span className="text-[#64748B] text-[12px] font-medium leading-tight mt-0.5 font-mono">
                      {project.prefix}
                    </span>
                  </div>
                </div>

                {/* [RIGHT SECTION - METRICS, BADGES & ACTIONS] */}
                <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
                  {/* 1. Project Lifecycle Status: Active vs Archived */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide inline-flex items-center gap-1.5 ${
                      (project.status || 'Active').toLowerCase() === 'archived'
                        ? 'bg-slate-100 text-slate-700 border border-slate-300'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        (project.status || 'Active').toLowerCase() === 'archived'
                          ? 'bg-slate-400'
                          : 'bg-emerald-500 animate-pulse'
                      }`}
                    />
                    {project.status || 'Active'}
                  </span>

                  {/* 2. Severity Status Badge (Color-Coded Logic) */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide inline-flex items-center gap-1.5 ${severityStyle.pillClasses}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${severityStyle.dotColor}`} />
                    {severityStyle.label}
                  </span>

                  {/* 2. Quality Health Rate Badge: Soft slate pill badge */}
                  <span className="px-3 py-1 rounded-full text-[12px] font-medium bg-[#F8FAFC] border border-[#E2E8F0] inline-flex items-center gap-1.5 shadow-2xs">
                    <span className={`font-semibold ${healthColor}`}>
                      {project.health_rate}% Health Rate
                    </span>
                  </span>

                  {/* Executive Defect Audit Report Button for this Project */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportProjectXLSX(project);
                    }}
                    title={`Download ${project.name} executive defect audit report (.xlsx)`}
                    className="px-2.5 sm:px-3 py-1 rounded-full text-[12px] font-semibold text-slate-700 hover:text-violet-700 bg-[#F8FAFC] hover:bg-violet-50 border border-[#E2E8F0] hover:border-violet-300 inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer group/report active:scale-95"
                  >
                    <FileText size={13} className="text-slate-400 group-hover/report:text-violet-600 transition-colors" />
                    <span>Audit Report</span>
                  </button>

                  {/* 4. Chevron Trigger (>): Opens project information modal */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProjectForDetail(project);
                    }}
                    title={`View project details for ${project.name}`}
                    className="p-1 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                  >
                    <ChevronRight 
                      size={18} 
                      className="text-[#94A3B8] group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all duration-150 shrink-0" 
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Subtle Footer Note */}
      <div className="flex items-center justify-between text-[11px] text-[#64748B] px-2 pt-1 font-medium">
        <span>Showing {filteredAndSortedProjects.length} of {projects.length} registered projects in Quality Central</span>
        <span className="text-violet-600 font-semibold">Click any project to view assigned team &gt;</span>
      </div>

      {/* PROJECT DETAIL MODAL (Team Hierarchy & Defect Overview) */}
      {selectedProjectForDetail && (
        <ProjectDetailModal
          isOpen={!!selectedProjectForDetail}
          project={selectedProjectForDetail}
          bugs={bugs}
          currentUser={currentUser}
          scope={scope}
          onClose={() => setSelectedProjectForDetail(null)}
          onNavigateToBugs={(proj) => {
            setSelectedProjectForDetail(null);
            onNavigateToBugs(proj);
          }}
          onEditProject={(proj) => {
            setSelectedProjectForDetail(null);
            setEditingProject(proj);
          }}
        />
      )}

      {/* CREATE / EDIT PROJECT MODAL */}
      {(isCreateModalOpen || editingProject) && (
        <CreateNewProjectModal
          key={editingProject ? `edit-${editingProject.id || editingProject.prefix}` : 'create-new'}
          isOpen={isCreateModalOpen || !!editingProject}
          initialProject={editingProject}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingProject(null);
          }}
          onSubmitProject={(projData) => {
            if (editingProject && onUpdateProject) {
              onUpdateProject(projData);
            } else if (onCreateProject) {
              onCreateProject(projData);
            }
            setIsCreateModalOpen(false);
            setEditingProject(null);
          }}
          existingProjects={projects}
        />
      )}
    </div>
  );
}
