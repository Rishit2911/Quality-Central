import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, ArrowRightLeft, User, Shield, AlertTriangle, 
  Layers, CheckCircle2, Info, ChevronDown, Check,
  Clock, Sparkles, HelpCircle, UserCheck
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getDevelopersForProject, INITIAL_SAMPLE_PROJECTS } from '../constants/defaultProjects';

// Preset reason chips for rapid selection
const REASSIGN_REASONS = [
  { id: 'blocked', label: 'Technical Blocker', icon: '🚧', desc: 'Blocked by dependencies or technical hurdle' },
  { id: 'workload', label: 'Workload & Bandwidth', icon: '⏳', desc: 'Current sprint capacity exceeded' },
  { id: 'domain', label: 'Domain Expertise Needed', icon: '🎯', desc: 'Requires specialized module knowledge' },
  { id: 'leave', label: 'Out of Office / Leave', icon: '🌴', desc: 'Developer unavailable or on scheduled leave' },
  { id: 'rebalancing', label: 'Task Rebalancing', icon: '🔄', desc: 'Sprint reallocation across project team' }
];

export default function ReassignBugModal({
  isOpen,
  bug,
  bugs = [],
  onClose,
  onReassign,
  projectsList = INITIAL_SAMPLE_PROJECTS,
  currentUserName = 'Rishit'
}) {
  const targetBugs = useMemo(() => {
    if (bugs && bugs.length > 0) return bugs;
    if (bug) return [bug];
    return [];
  }, [bug, bugs]);

  const primaryBug = targetBugs[0];
  const projectName = primaryBug?.project || 'Quality Central';
  const currentAssignee = primaryBug?.assignee || 'Unassigned';

  // Get project developers strictly as per the project
  const projectDevelopers = useMemo(() => {
    const devs = getDevelopersForProject(projectName, projectsList);
    // Find project definition to get lead
    const matchedProj = projectsList?.find(p => 
      p.name?.toLowerCase() === projectName.toLowerCase() ||
      p.prefix?.toLowerCase() === projectName.toLowerCase()
    );
    const lead = matchedProj?.lead || 'Bhupesh';

    // Build unique list with lead included
    const allMembers = [];
    if (lead && !devs.includes(lead)) {
      allMembers.push({ name: lead, role: 'Lead', isLead: true });
    }
    devs.forEach(d => {
      if (!allMembers.some(m => m.name.toLowerCase() === d.toLowerCase())) {
        allMembers.push({ name: d, role: 'Developer', isLead: d.toLowerCase() === lead.toLowerCase() });
      }
    });

    return allMembers;
  }, [projectName, projectsList]);

  // Form states
  const [selectedDeveloper, setSelectedDeveloper] = useState('');
  const [selectedReasonId, setSelectedReasonId] = useState('blocked');
  const [customReason, setCustomReason] = useState('Technical Blocker');
  const [handoffNotes, setHandoffNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-select the first eligible developer that is NOT the current assignee
  useEffect(() => {
    if (isOpen) {
      const eligible = projectDevelopers.find(d => 
        d.name.toLowerCase().trim() !== currentAssignee.toLowerCase().trim()
      );
      if (eligible) {
        setSelectedDeveloper(eligible.name);
      } else if (projectDevelopers.length > 0) {
        setSelectedDeveloper(projectDevelopers[0].name);
      }
      setSelectedReasonId('blocked');
      setCustomReason('Technical Blocker');
      setHandoffNotes('');
      setIsSubmitting(false);
    }
  }, [isOpen, projectDevelopers, currentAssignee]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || targetBugs.length === 0) return null;

  const handleSelectReason = (reason) => {
    setSelectedReasonId(reason.id);
    setCustomReason(reason.label);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDeveloper) {
      toast.error('Please select a developer to reassign to.');
      return;
    }
    if (selectedDeveloper.toLowerCase().trim() === currentAssignee.toLowerCase().trim() && targetBugs.length === 1) {
      toast.error(`Ticket is already assigned to ${selectedDeveloper}. Please select a different team member.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onReassign?.({
        bugIds: targetBugs.map(b => b.id),
        newAssignee: selectedDeveloper,
        reason: customReason || 'Developer requested reassignment',
        notes: handoffNotes.trim()
      });
      onClose();
    } catch (err) {
      console.error('Error during reassignment:', err);
      toast.error('Reassignment failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const isBatch = targetBugs.length > 1;

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in"
      onClick={() => {
        if (!isSubmitting) onClose?.();
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-xl overflow-hidden my-8 transform transition-all animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 sm:p-6 text-white relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
                <ArrowRightLeft size={22} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-extrabold text-white tracking-tight">
                    {isBatch ? `Reassign ${targetBugs.length} Bugs` : 'Reassign Bug Ticket'}
                  </h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    Project Team
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Hand over ownership to another developer allocated to <strong className="text-indigo-300">{projectName}</strong>.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer shrink-0"
              title="Close modal (Esc)"
            >
              <X size={20} />
            </button>
          </div>

          {/* QUICK BUG CONTEXT CHIP */}
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center gap-2 text-xs">
            {isBatch ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-300 font-medium">Selected Bugs:</span>
                {targetBugs.slice(0, 5).map(b => (
                  <span key={b.id} className="font-mono font-bold bg-white/15 px-2 py-0.5 rounded text-white text-[11px]">
                    {b.id}
                  </span>
                ))}
                {targetBugs.length > 5 && (
                  <span className="text-[11px] text-slate-300">+{targetBugs.length - 5} more</span>
                )}
              </div>
            ) : (
              <>
                <span className="font-mono font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded text-[11px]">
                  {primaryBug.id}
                </span>
                <span className="font-medium text-slate-200 truncate max-w-[280px]">
                  {primaryBug.title}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-300">
                  Current Assignee: <strong className="text-white">{currentAssignee}</strong>
                </span>
              </>
            )}
          </div>
        </div>

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {/* STEP 1: SELECT NEW DEVELOPER AS PER PROJECT */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <UserCheck size={14} className="text-indigo-600" />
                <span>Select New Developer for {projectName}</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                {projectDevelopers.length} Team Members
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {projectDevelopers.map((dev) => {
                const isCurrent = dev.name.toLowerCase().trim() === currentAssignee.toLowerCase().trim();
                const isSelected = selectedDeveloper.toLowerCase().trim() === dev.name.toLowerCase().trim();

                return (
                  <div
                    key={dev.name}
                    onClick={() => {
                      if (!isCurrent) {
                        setSelectedDeveloper(dev.name);
                      }
                    }}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer select-none ${
                      isCurrent
                        ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                        isSelected 
                          ? 'bg-indigo-600 text-white shadow-xs' 
                          : isCurrent
                          ? 'bg-slate-300 text-slate-700'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {getInitials(dev.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>
                            {dev.name}
                          </span>
                          {dev.isLead && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                              Lead
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {isCurrent ? '(Current Assignee)' : `${projectName} Developer`}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isCurrent ? (
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-200 px-2 py-0.5 rounded">
                          Current
                        </span>
                      ) : isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-300" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 2: REASON FOR REASSIGNMENT */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2">
              <AlertTriangle size={14} className="text-amber-600" />
              <span>Reason for Reassignment</span>
              <span className="text-rose-500">*</span>
            </label>

            {/* Quick Reason Chips */}
            <div className="flex flex-wrap gap-2 mb-2.5">
              {REASSIGN_REASONS.map((r) => {
                const active = selectedReasonId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectReason(r)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      active
                        ? 'bg-indigo-600 text-white shadow-xs scale-102'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                    }`}
                  >
                    <span>{r.icon}</span>
                    <span>{r.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Editable reason summary */}
            <input
              type="text"
              value={customReason}
              onChange={(e) => {
                setCustomReason(e.target.value);
                setSelectedReasonId('custom');
              }}
              placeholder="e.g. Blocked by database lock / Workload peak"
              className="w-full px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
              required
            />
          </div>

          {/* STEP 3: HANDOFF NOTES / CONTEXT (OPTIONAL BUT RECOMMENDED) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Clock size={14} className="text-slate-500" />
                <span>Debugging Context & Handoff Notes</span>
                <span className="text-[10px] font-normal text-slate-400 lowercase">(recommended)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                Logged to audit timeline
              </span>
            </div>

            <textarea
              value={handoffNotes}
              onChange={(e) => setHandoffNotes(e.target.value)}
              rows={3}
              placeholder="Explain what steps you already tried, what issues or blockers were encountered, and any pointers for the incoming developer..."
              className="w-full px-3.5 py-2.5 text-xs text-slate-800 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* NOTICE / INFO BANNER */}
          <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-indigo-900">
            <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">
                What happens when you confirm:
              </p>
              <p className="text-[11px] text-indigo-700 leading-relaxed">
                The bug's owner will be updated to <strong className="font-bold">{selectedDeveloper || 'the chosen developer'}</strong>. A <span className="font-bold text-indigo-900">REASSIGNMENT</span> record will be added to the bug's audit trail, and the ticket will be transferred out of your active personal queue.
              </p>
            </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !selectedDeveloper}
              className="px-5 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-98 rounded-xl shadow-md shadow-indigo-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Reassigning...</span>
                </>
              ) : (
                <>
                  <ArrowRightLeft size={14} strokeWidth={2.5} />
                  <span>Confirm Reassignment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
