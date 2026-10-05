import React, { useEffect, useState, useMemo } from 'react';
import { 
  X, Bug, CheckCircle2, Clock, AlertTriangle, 
  ShieldCheck, ArrowRight, UserCheck, Code2, 
  Layers, ExternalLink, ShieldAlert, Edit3, Download, FileText
} from 'lucide-react';
import { getMemberByName, TEAM_LEAD } from '../constants/teamPool';
import { computeProjectStats, isBugAssignedToUser, doesBugMatchProject } from '../utils/qualityMetrics';
import { exportProjectDefectReportCSV, exportProjectDefectReportXLSX } from '../utils/qualityExport';

export default function ProjectDetailModal({
  isOpen,
  project,
  bugs = [],
  currentUser,
  scope: initialScope = 'team',
  onClose,
  onNavigateToBugs,
  onEditProject
}) {
  const [modalScope, setModalScope] = useState(initialScope || 'team');

  useEffect(() => {
    if (initialScope) setModalScope(initialScope);
  }, [initialScope]);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Real-time project metrics computation based on active bugs array
  const liveStats = useMemo(() => {
    return computeProjectStats(project, bugs, currentUser, modalScope);
  }, [project, bugs, currentUser, modalScope]);

  const myProjBugsCount = useMemo(() => {
    return bugs.filter(b => doesBugMatchProject(b, project) && isBugAssignedToUser(b, currentUser)).length;
  }, [bugs, project, currentUser]);

  const teamProjBugsCount = useMemo(() => {
    return bugs.filter(b => doesBugMatchProject(b, project)).length;
  }, [bugs, project]);

  if (!isOpen || !project) return null;

  // Health rate styling
  const healthRate = Number(liveStats.health_rate || 0);
  const getHealthBadgeStyle = (rate) => {
    if (rate < 85) return 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]';
    if (rate <= 94) return 'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]';
    return 'bg-[#DCFCE7] text-[#16A34A] border-[#86EFAC]';
  };

  const getSeverityBadge = (severity) => {
    const s = (severity || 'Normal').toLowerCase();
    if (s === 'critical') return { pill: 'bg-[#FEE2E2] text-[#DC2626]', dot: 'bg-[#DC2626]', label: 'Critical' };
    if (s === 'high') return { pill: 'bg-[#FEF3C7] text-[#D97706]', dot: 'bg-[#D97706]', label: 'High' };
    return { pill: 'bg-[#DCFCE7] text-[#16A34A]', dot: 'bg-[#16A34A]', label: 'Normal' };
  };

  const sevBadge = getSeverityBadge(project.severity);

  // Team lookup
  const leadMember = getMemberByName(project.lead || 'Bhupesh') || TEAM_LEAD;
  const developerMembers = (project.developers || ['Rishit', 'Vidhi']).map(getMemberByName);
  const qaMembers = (project.qa || ['Vidhi']).map(getMemberByName);

  // Live real-time bug counters directly from the active bug list
  const openCount = liveStats.open_bugs ?? 0;
  const inProgCount = liveStats.in_progress_bugs ?? 0;
  const resolvedCount = liveStats.resolved_bugs ?? 0;
  const totalActive = liveStats.active_bugs ?? (openCount + inProgCount);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-detail-title"
      >
        {/* ================================================================
            MODAL HEADER: IDENTIFIER & STATUS
        ================================================================ */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#F1F5F9] bg-[#FAF5FF]/60">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Project Icon Box (38px x 38px, bg #F8FAFC, border #E2E8F0, rounded 8px) */}
            <div 
              className="w-[42px] h-[42px] min-w-[42px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] flex items-center justify-center text-lg shadow-2xs shrink-0"
              aria-hidden="true"
            >
              <span role="img" aria-label="Project">📁</span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 id="project-detail-title" className="text-base font-bold text-[#0F172A] leading-tight truncate">
                  {project.name}
                </h3>
                <span className="text-xs font-mono font-bold text-[#64748B] bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  {project.prefix}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${sevBadge.pill}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sevBadge.dot}`} />
                  {sevBadge.label}
                </span>
                {/* Lifecycle Status: Active vs Archived */}
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
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
              </div>
              <p className="text-xs text-[#64748B] font-medium mt-0.5 truncate max-w-md">
                {project.description || 'Project managed under Quality Central.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            {onEditProject && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditProject(project);
                }}
                className="px-2.5 py-1 text-xs font-bold text-violet-700 bg-white hover:bg-violet-50 border border-violet-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Edit project team and parameters"
              >
                <Edit3 size={13} />
                <span>Edit Project</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ================================================================
            MODAL BODY
        ================================================================ */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* TOP METRICS STRIP: Health Rate + Bug Counts */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Project Health &amp; Defect Snapshot
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getHealthBadgeStyle(healthRate)}`}>
                  {healthRate}% Health Rate
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border ${
                    (project.status || 'Active').toLowerCase() === 'archived'
                      ? 'bg-slate-100 text-slate-700 border-slate-300'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      (project.status || 'Active').toLowerCase() === 'archived'
                        ? 'bg-slate-400'
                        : 'bg-emerald-500 animate-pulse'
                    }`}
                  />
                  Status: {project.status || 'Active'}
                </span>
              </div>

              {/* Scope Switcher Pill */}
              <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setModalScope('personal')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    modalScope === 'personal'
                      ? 'bg-violet-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Show metrics for bugs assigned to you in this project"
                >
                  <span>👤 Assigned to You</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                    modalScope === 'personal' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {myProjBugsCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalScope('team')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    modalScope === 'team'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Show all bugs in this project"
                >
                  <span>👥 To the Team</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                    modalScope === 'team' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {teamProjBugsCount}
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Metric 1: Health Rate Card */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-slate-500">Quality Health</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className={`text-xl font-extrabold ${healthRate < 85 ? 'text-[#DC2626]' : healthRate <= 94 ? 'text-[#D97706]' : 'text-[#16A34A]'}`}>
                    {healthRate}%
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium mt-1">Defect-free rate</span>
              </div>

              {/* Metric 2: Open Bugs */}
              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-blue-700">Open Bugs</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-extrabold text-blue-900">{openCount}</span>
                  <span className="text-[11px] font-semibold text-blue-600">Pending</span>
                </div>
                <span className="text-[10px] text-blue-500 font-medium mt-1">Awaiting triage</span>
              </div>

              {/* Metric 3: In Progress Bugs */}
              <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3.5 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-amber-700">In Progress</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-extrabold text-amber-900">{inProgCount}</span>
                  <span className="text-[11px] font-semibold text-amber-600">Active</span>
                </div>
                <span className="text-[10px] text-amber-600 font-medium mt-1">Being fixed</span>
              </div>

              {/* Metric 4: Resolved Bugs */}
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3.5 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-emerald-700">Resolved</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-extrabold text-emerald-900">{resolvedCount}</span>
                  <span className="text-[11px] font-semibold text-emerald-600">Done</span>
                </div>
                <span className="text-[10px] text-emerald-600 font-medium mt-1">Verified &amp; closed</span>
              </div>
            </div>
          </div>

          {/* ================================================================
              ASSIGNED TEAM HIERARCHY (Exact Order: Lead -> Devs -> QA)
          ================================================================ */}
          <div className="space-y-4 pt-1 border-t border-[#F1F5F9]">
            {/* 1. TEAM LEAD (Shown First for All Projects: Bhupesh) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                  <span role="img" aria-label="crown">👑</span> Team Lead
                </span>
                <span className="text-[11px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100">
                  Engineering Lead
                </span>
              </div>

              <div className="bg-[#FAF5FF] border border-violet-200/80 rounded-xl p-3.5 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl text-white font-black text-sm flex items-center justify-center shadow-xs"
                    style={{ backgroundColor: leadMember.avatarBg || '#8B5CF6' }}
                  >
                    {leadMember.initials || 'BP'}
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-[#0F172A] leading-tight">
                      {leadMember.name || 'Bhupesh'}
                    </h4>
                    <p className="text-[11px] text-[#64748B] font-medium mt-0.5">
                      {leadMember.role || 'Engineering Lead & Principal Architect'}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 text-[10px] font-extrabold text-violet-700 bg-white border border-violet-200 rounded-lg shadow-2xs">
                  Project Lead
                </span>
              </div>
            </div>

            {/* 2. ASSIGNED DEVELOPERS (Shown Second) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                  <Code2 size={14} className="text-blue-600" /> Assigned Developers
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  {developerMembers.length} {developerMembers.length === 1 ? 'Developer' : 'Developers'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {developerMembers.map((dev) => (
                  <div 
                    key={dev.id || dev.name}
                    className="bg-[#FFFFFF] border border-[#E2E8F0] hover:border-blue-300 rounded-xl p-3 flex items-center justify-between transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div 
                        className="w-8 h-8 rounded-lg text-white font-bold text-xs flex items-center justify-center shadow-2xs shrink-0"
                        style={{ backgroundColor: dev.avatarBg || '#3B82F6' }}
                      >
                        {dev.initials || dev.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-[#0F172A] truncate">
                          {dev.name}
                        </span>
                        <span className="block text-[10px] text-[#64748B] truncate">
                          {dev.role || 'Software Engineer'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md shrink-0">
                      Dev
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. ASSIGNED QA TEAM (Shown Third) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-purple-600" /> QA &amp; Test Automation Team
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  {qaMembers.length} {qaMembers.length === 1 ? 'Specialist' : 'Specialists'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {qaMembers.map((qa) => (
                  <div 
                    key={qa.id || qa.name}
                    className="bg-[#FFFFFF] border border-[#E2E8F0] hover:border-purple-300 rounded-xl p-3 flex items-center justify-between transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div 
                        className="w-8 h-8 rounded-lg text-white font-bold text-xs flex items-center justify-center shadow-2xs shrink-0"
                        style={{ backgroundColor: qa.avatarBg || '#EC4899' }}
                      >
                        {qa.initials || qa.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-[#0F172A] truncate">
                          {qa.name}
                        </span>
                        <span className="block text-[10px] text-[#64748B] truncate">
                          {qa.role || 'QA Engineer'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md shrink-0">
                      QA
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================
            MODAL FOOTER: ACTION CTA ("View Bugs" Button)
        ================================================================ */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#F1F5F9] bg-[#FAF5FF]/40">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => exportProjectDefectReportXLSX({ project, bugs, scope: modalScope, currentUser })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl transition-all cursor-pointer shadow-2xs"
              title="Download executive defect audit report"
            >
              <FileText size={14} />
              <span>Download Audit Report</span>
            </button>
          </div>

          {/* Primary View Bugs CTA */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigateToBugs(project);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow transition-all active:scale-98 cursor-pointer"
          >
            <Bug size={15} />
            <span>View Project Bugs ({totalActive} Active)</span>
            <ArrowRight size={14} className="ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
