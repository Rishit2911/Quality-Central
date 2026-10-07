import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  X, Clock, ArrowRight, User, CheckCircle2, AlertTriangle, 
  Plus, Edit3, MessageSquare, Send, RefreshCw, Shield, 
  Layers, Tag, GitCommit, UserCheck, Sparkles, AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function BugAuditTimelineDrawer({
  isOpen,
  bug,
  onClose,
  currentUser = 'Rishit'
}) {
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'status' | 'assignment' | 'fix' | 'notes'
  const [newNote, setNewNote] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Fetch timeline events from backend API
  const fetchTimeline = useCallback(async (showToast = false) => {
    if (!bug?.id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/quality/bugs/${encodeURIComponent(bug.id)}/timeline`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setTimelineEvents(data.events || []);
        if (showToast) {
          toast.success('Timeline refreshed');
        }
      } else {
        toast.error('Failed to load audit timeline');
      }
    } catch (err) {
      console.error('Error fetching bug timeline:', err);
      toast.error('Network error loading timeline');
    } finally {
      setIsLoading(false);
    }
  }, [bug?.id]);

  useEffect(() => {
    if (isOpen && bug?.id) {
      fetchTimeline();
    } else {
      setTimelineEvents([]);
      setNewNote('');
      setActiveFilter('all');
    }
  }, [isOpen, bug?.id, fetchTimeline]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Post manual audit remark
  const handlePostNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !bug?.id) return;

    setIsSubmittingNote(true);
    try {
      const res = await fetch(`/api/quality/bugs/${encodeURIComponent(bug.id)}/timeline/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          notes: newNote.trim(),
          event_type: 'AUDIT_NOTE'
        })
      });

      if (res.ok) {
        const data = await res.json();
        setTimelineEvents(data.events || []);
        setNewNote('');
        toast.success('Audit note logged');
      } else {
        toast.error('Failed to post audit note');
      }
    } catch (err) {
      console.error('Error adding audit note:', err);
      toast.error('Error posting note');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Filter events
  const filteredEvents = useMemo(() => {
    if (activeFilter === 'status') {
      return timelineEvents.filter(e => e.event_type === 'STATUS_CHANGE');
    }
    if (activeFilter === 'assignment') {
      return timelineEvents.filter(e => e.event_type === 'ASSIGNMENT');
    }
    if (activeFilter === 'fix') {
      return timelineEvents.filter(e => e.event_type === 'FIX_SUBMITTED');
    }
    if (activeFilter === 'notes') {
      return timelineEvents.filter(e => e.event_type === 'AUDIT_NOTE');
    }
    return timelineEvents;
  }, [timelineEvents, activeFilter]);

  // Count tallies
  const counts = useMemo(() => {
    return {
      all: timelineEvents.length,
      status: timelineEvents.filter(e => e.event_type === 'STATUS_CHANGE').length,
      assignment: timelineEvents.filter(e => e.event_type === 'ASSIGNMENT').length,
      fix: timelineEvents.filter(e => e.event_type === 'FIX_SUBMITTED').length,
      notes: timelineEvents.filter(e => e.event_type === 'AUDIT_NOTE').length,
    };
  }, [timelineEvents]);

  if (!isOpen || !bug) return null;

  // Icon & color styling helper per event type
  const getEventStyle = (event) => {
    switch (event.event_type) {
      case 'CREATED':
        return {
          icon: Sparkles,
          nodeBg: 'bg-violet-600',
          textColor: 'text-violet-700',
          border: 'border-violet-200',
          bg: 'bg-violet-50/60',
          label: 'Defect Logged'
        };
      case 'STATUS_CHANGE':
        const isResolved = ['resolved', 'closed'].includes((event.new_value || '').toLowerCase());
        return {
          icon: isResolved ? CheckCircle2 : GitCommit,
          nodeBg: isResolved ? 'bg-emerald-600' : 'bg-blue-600',
          textColor: isResolved ? 'text-emerald-700' : 'text-blue-700',
          border: isResolved ? 'border-emerald-200' : 'border-blue-200',
          bg: isResolved ? 'bg-emerald-50/50' : 'bg-blue-50/50',
          label: 'Status Transition'
        };
      case 'ASSIGNMENT':
        return {
          icon: UserCheck,
          nodeBg: 'bg-amber-500',
          textColor: 'text-amber-800',
          border: 'border-amber-200',
          bg: 'bg-amber-50/50',
          label: 'Assignment Hand-off'
        };
      case 'FIX_SUBMITTED':
        return {
          icon: CheckCircle2,
          nodeBg: 'bg-teal-600',
          textColor: 'text-teal-800',
          border: 'border-teal-200',
          bg: 'bg-teal-50/60',
          label: 'Fix & Debugging Submitted'
        };
      case 'PRIORITY_CHANGE':
      case 'SEVERITY_CHANGE':
        return {
          icon: AlertTriangle,
          nodeBg: 'bg-rose-500',
          textColor: 'text-rose-800',
          border: 'border-rose-200',
          bg: 'bg-rose-50/50',
          label: event.event_type === 'PRIORITY_CHANGE' ? 'Priority Escalation' : 'Severity Change'
        };
      case 'AUDIT_NOTE':
        return {
          icon: MessageSquare,
          nodeBg: 'bg-indigo-600',
          textColor: 'text-indigo-800',
          border: 'border-indigo-200',
          bg: 'bg-indigo-50/60',
          label: 'Audit Remark'
        };
      case 'DETAILS_EDITED':
      default:
        return {
          icon: Edit3,
          nodeBg: 'bg-slate-500',
          textColor: 'text-slate-700',
          border: 'border-slate-200',
          bg: 'bg-slate-50',
          label: 'Details Updated'
        };
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-slide-left z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-extrabold px-2.5 py-1 rounded-md bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1.5 shadow-2xs">
                  <Clock size={13} className="text-blue-600" />
                  {bug.id}
                </span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Audit Timeline & History
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-2 line-clamp-2 leading-snug">
                {bug.title}
              </h3>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => fetchTimeline(true)}
                disabled={isLoading}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                title="Refresh audit history"
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin text-blue-600' : ''} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                title="Close drawer (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Metadata quick pills */}
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-200/60 text-xs">
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
              Project: <strong>{bug.project}</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
              Module: <strong>{bug.module || 'General'}</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
              Status: <strong>{bug.status}</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
              Assignee: <strong>{bug.assignee || 'Unassigned'}</strong>
            </span>
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 text-[11px] font-bold no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                activeFilter === 'all' 
                  ? 'bg-blue-600 text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Events ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('status')}
              className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                activeFilter === 'status' 
                  ? 'bg-blue-600 text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Status Changes ({counts.status})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('assignment')}
              className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                activeFilter === 'assignment' 
                  ? 'bg-blue-600 text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Assignments ({counts.assignment})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('fix')}
              className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                activeFilter === 'fix' 
                  ? 'bg-blue-600 text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Fixes ({counts.fix})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('notes')}
              className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                activeFilter === 'notes' 
                  ? 'bg-blue-600 text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Remarks ({counts.notes})
            </button>
          </div>
        </div>

        {/* Scrollable Timeline Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {isLoading && timelineEvents.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <RefreshCw size={28} className="mx-auto animate-spin text-blue-500" />
              <p className="text-xs font-semibold">Loading chronological audit events...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Clock size={32} className="mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-600">No events found</p>
              <p className="text-xs text-slate-400">
                {activeFilter !== 'all' 
                  ? 'No events match the selected category filter.' 
                  : 'No timeline events recorded yet for this bug.'}
              </p>
            </div>
          ) : (
            <div className="relative pl-6 sm:pl-8 space-y-6">
              {/* Continuous vertical track line */}
              <div className="absolute left-[11px] sm:left-[15px] top-2 bottom-2 w-[2px] bg-slate-200" />

              {filteredEvents.map((event, idx) => {
                const style = getEventStyle(event);
                const EventIcon = style.icon;
                const actorInitials = (event.actor_name || 'U').substring(0, 2).toUpperCase();

                return (
                  <div key={event.id || idx} className="relative group">
                    {/* Node circle on the line */}
                    <div 
                      className={`absolute -left-[27px] sm:-left-[31px] top-1.5 w-6 h-6 rounded-full ${style.nodeBg} text-white flex items-center justify-center shadow-xs ring-4 ring-white shrink-0`}
                    >
                      <EventIcon size={12} strokeWidth={2.5} />
                    </div>

                    {/* Event Card */}
                    <div className={`p-3.5 sm:p-4 rounded-xl border ${style.border} ${style.bg} transition-all hover:shadow-xs`}>
                      {/* Event Header: Actor and Time */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                            {actorInitials}
                          </div>
                          <span className="text-xs font-bold text-slate-900">
                            {event.actor_name}
                          </span>
                          {event.actor_role && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-white/80 text-slate-600 border border-slate-200 shadow-2xs">
                              {event.actor_role}
                            </span>
                          )}
                        </div>

                        <span 
                          className="text-[11px] text-slate-500 font-medium shrink-0"
                          title={event.formatted_time || ''}
                        >
                          {event.formatted_time || 'Just now'}
                        </span>
                      </div>

                      {/* Event Title Badge */}
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-[11px] font-extrabold uppercase tracking-wider ${style.textColor}`}>
                          {style.label}
                        </span>
                      </div>

                      {/* Value Diff (Old Value -> New Value) */}
                      {(event.old_value !== null || event.new_value !== null) && (
                        <div className="flex flex-wrap items-center gap-2 mt-2 font-mono text-xs">
                          {event.old_value && (
                            <span className="px-2 py-0.5 rounded bg-white text-slate-500 line-through border border-slate-200">
                              {event.old_value}
                            </span>
                          )}
                          {event.old_value && event.new_value && (
                            <ArrowRight size={12} className="text-slate-400 shrink-0" />
                          )}
                          {event.new_value && (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                              {event.new_value}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Optional Event Notes / Description */}
                      {event.notes && (
                        <div className="mt-2.5 p-2.5 bg-white/90 rounded-lg border border-slate-200/80 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans shadow-2xs">
                          {event.notes}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Bar: Post Audit Remark */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 shrink-0">
          <form onSubmit={handlePostNote} className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare size={12} className="text-slate-400" />
              Add Audit Remark / Note
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Log a verification note, re-test status, or comment..."
                className="flex-1 text-xs px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                disabled={isSubmittingNote}
              />
              <button
                type="submit"
                disabled={isSubmittingNote || !newNote.trim()}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              >
                <Send size={12} />
                <span>Log</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
