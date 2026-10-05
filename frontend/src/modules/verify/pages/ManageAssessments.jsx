import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Loader2, RefreshCw, Filter, Trash2, Edit3, Users,
  BarChart2, Send, ChevronDown, Clock, FileText, CheckCircle,
  XCircle, AlertTriangle, Lock, Unlock, Shuffle, Search, Activity,
  CheckSquare, Square, ListFilter, Layers, Check, Sparkles, Calendar,
  Shield, CheckCircle2, UserCheck, Info
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import HorizontalLoader from '../../../core/components/HorizontalLoader';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';
import useEscapeClose from '../../../core/hooks/useEscapeClose';
import useOverlayClose from '../../../core/hooks/useOverlayClose';
import { P } from '../../../core/permissions';
import { extractErrorMessage } from '../../../core/utils/validators';
import { buildProctoringConfig, STRICTNESS_LEVELS } from '../proctoringConfig';

const TYPE_STYLE = {
  MCQ:     'bg-purple-50 text-purple-700 border-purple-200',
  Coding:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  Written: 'bg-blue-50 text-blue-700 border-blue-200',
  Mixed:   'bg-amber-50 text-amber-700 border-amber-200',
};

const STATUS_STYLE = {
  draft:   'bg-gray-50 text-gray-600 border-gray-200',
  active:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed:  'bg-rose-50 text-rose-700 border-rose-200',
};

const STATUSES = ['draft', 'active', 'closed'];

function Modal({ onClose, title, children, maxWidth = 'max-w-xl' }) {
  useEscapeClose(onClose);
  const overlayHandlers = useOverlayClose(onClose);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto" {...overlayHandlers}>
      <div className={`bg-white text-gray-900 rounded-3xl w-full ${maxWidth} p-6 sm:p-8 relative shadow-2xl border border-gray-200 my-8 light-theme-override max-h-[92vh] overflow-y-auto custom-scrollbar`} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-5 right-5 p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <XCircle size={20} />
        </button>
        {title && <h2 className="text-xl font-bold text-gray-800 mb-6">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body
  );
}

function AssignModal({ assessment, onClose }) {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Questions subset state
  const [questions, setQuestions] = useState([]);
  const [sections, setSections] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [useQuestionSubset, setUseQuestionSubset] = useState(false);
  const [questionSearch, setQuestionSearch] = useState('');

  // Proctoring strictness state
  const [proctoringEnabled, setProctoringEnabled] = useState(true);
  const [proctoringStrictness, setProctoringStrictness] = useState('balanced');
  const [customTemplates, setCustomTemplates] = useState(null);

  const [deadline, setDeadline] = useState('');
  const [generateVariants, setGenerateVariants] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const r = await fetch(`/api/verify/assignments/assignable-users?assessment_id=${assessment.id}`, { credentials: 'include' });
        const d = await r.json();
        if (r.ok) {
          const list = Array.isArray(d.data) ? d.data : [];
          const processed = list.map(u => {
            const isExempt = (u.username || '').toLowerCase() === 'cluxssy25@gmail.com' || (u.email || '').toLowerCase() === 'cluxssy25@gmail.com';
            return {
              ...u,
              is_assigned: isExempt ? false : !!u.is_assigned
            };
          });
          setUsers(processed);
        } else {
          toast.error(extractErrorMessage(d?.detail, 'Failed to fetch users'));
        }
      } catch (err) {
        toast.error(extractErrorMessage(err, 'Network error fetching users'));
      } finally {
        setLoadingUsers(false);
      }
    };

    const fetchAssessmentDetails = async () => {
      try {
        const r = await fetch(`/api/verify/builder/assessments/${assessment.id}`, { credentials: 'include' });
        const d = await r.json();
        if (r.ok && d.data) {
          const qs = d.data.questions || [];
          setQuestions(qs);
          setSections(d.data.sections || []);
          setSelectedQuestionIds(qs.map(q => q.id));
          if (d.data.proctoring_config) {
            const pc = d.data.proctoring_config;
            if (pc.disabled === true || pc.strictness === 'none') {
              setProctoringEnabled(false);
              setProctoringStrictness('none');
            } else if (pc.strictness) {
              setProctoringEnabled(true);
              setProctoringStrictness(pc.strictness);
            }
          }
        }
      } catch (err) {
        // silent fallback
      } finally {
        setLoadingQuestions(false);
      }
    };

    const fetchProctoringSettings = async () => {
      try {
        const r = await fetch('/api/verify/builder/proctoring-settings', { credentials: 'include' });
        const d = await r.json();
        if (r.ok && d.data?.proctoring_defaults) {
          const pd = d.data.proctoring_defaults;
          if (pd.templates) {
            setCustomTemplates(pd.templates);
          }
        }
      } catch (err) {
        // silent fallback
      }
    };

    fetchUsers();
    fetchAssessmentDetails();
    fetchProctoringSettings();
  }, [assessment.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedIds.length === 0) return toast.error('Please select at least one candidate');

    if (useQuestionSubset && selectedQuestionIds.length === 0) {
      return toast.error('Please select at least one question or switch back to all questions.');
    }

    // Filter out any accidentally selected already-assigned users (exempt cluxssy25@gmail.com)
    const validCandidateIds = selectedIds.filter(id => {
      const u = users.find(user => user.id === id);
      const isExempt = (u?.username || '').toLowerCase() === 'cluxssy25@gmail.com' || (u?.email || '').toLowerCase() === 'cluxssy25@gmail.com';
      return u && (!u.is_assigned || isExempt);
    });

    if (validCandidateIds.length === 0) {
      return toast.error('Selected candidate(s) are already assigned to this assessment.');
    }

    // Only send question_ids if question subset mode is explicitly enabled and not all questions are selected
    const qIds = useQuestionSubset && selectedQuestionIds.length > 0 && selectedQuestionIds.length < questions.length
      ? selectedQuestionIds
      : (useQuestionSubset && selectedQuestionIds.length === questions.length ? null : (useQuestionSubset ? selectedQuestionIds : null));
    
    const activeTpl = customTemplates?.[proctoringStrictness];
    const effectiveStrictness = proctoringEnabled ? proctoringStrictness : 'none';
    const config = buildProctoringConfig(
      effectiveStrictness,
      proctoringEnabled ? (activeTpl?.toggles || {}) : { disabled: true },
      null,
      proctoringEnabled ? (activeTpl?.thresholds || null) : null
    );

    setSubmitting(true);
    try {
      const r = await fetch(`/api/verify/assignments/${assessment.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          user_ids: validCandidateIds, 
          deadline: deadline || null, 
          generate_variants: generateVariants,
          question_ids: qIds,
          shuffle_questions: shuffleQuestions,
          proctoring_strictness: effectiveStrictness,
          proctoring_config: config
        }),
      });
      const d = await r.json();
      if (r.ok) {
        toast.success(`Assigned to ${validCandidateIds.length} candidate(s)`);
        onClose();
      } else {
        toast.error(extractErrorMessage(d?.detail, 'Assignment failed'));
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Network error'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUser = (u) => {
    const isExempt = (u.username || '').toLowerCase() === 'cluxssy25@gmail.com' || (u.email || '').toLowerCase() === 'cluxssy25@gmail.com';
    if (u.is_assigned && !isExempt) return; // Block re-assignment
    setSelectedIds(prev => prev.includes(u.id) ? prev.filter(uid => uid !== u.id) : [...prev, u.id]);
  };

  const selectAllUsers = () => {
    // Only select unassigned candidates
    const assignable = filteredUsers.filter(u => !u.is_assigned);
    setSelectedIds(assignable.map(u => u.id));
  };

  const clearAllUsers = () => {
    setSelectedIds([]);
  };

  const toggleQuestion = (qId) => {
    setSelectedQuestionIds(prev =>
      prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]
    );
  };

  const selectAllQuestions = () => {
    setSelectedQuestionIds(questions.map(q => q.id));
  };

  const clearAllQuestions = () => {
    setSelectedQuestionIds([]);
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.role && u.role.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const assignableUsersCount = users.filter(u => !u.is_assigned).length;
  const alreadyAssignedUsersCount = users.filter(u => u.is_assigned).length;

  const filteredQuestions = questions.filter(q => {
    if (!questionSearch.trim()) return true;
    const term = questionSearch.toLowerCase();
    return (
      (q.question_text || '').toLowerCase().includes(term) ||
      (q.question_type || '').toLowerCase().includes(term) ||
      (q.tags && Array.isArray(q.tags) && q.tags.some(t => String(t).toLowerCase().includes(term)))
    );
  });

  const getSectionTitle = (sectionId) => {
    if (!sectionId) return null;
    const sec = sections.find(s => s.id === sectionId);
    return sec ? sec.title : null;
  };

  const activeQuestionsCount = useQuestionSubset ? selectedQuestionIds.length : questions.length;
  const totalAvailableMarks = questions
    .filter(q => !useQuestionSubset || selectedQuestionIds.includes(q.id))
    .reduce((sum, q) => sum + (Number(q.marks) || 1), 0);

  return (
    <Modal onClose={onClose} title={null} maxWidth="max-w-5xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Top Header Strip with Assessment Metadata */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-purple-50 text-purple-700 border border-purple-100 shadow-xs">
              <Send size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-700">
                  Assign Assessment
                </span>
                <span className="text-xs text-gray-400 font-medium">#{assessment.id}</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 mt-0.5">
                {assessment.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Clock size={13} className="text-gray-500" />
              {assessment.time_limit_minutes || 60} mins
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <FileText size={13} className="text-gray-500" />
              {questions.length} Questions
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle size={13} className="text-emerald-600" />
              {assessment.pass_score || 70}% Pass
            </span>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Candidates & Delivery Settings (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* Candidate Selection Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Users size={14} className="text-purple-600" />
                  Candidates ({selectedIds.length} of {assignableUsersCount} available)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllUsers}
                    className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 transition"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={clearAllUsers}
                    className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 transition"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {alreadyAssignedUsersCount > 0 && (
                <div className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-50/90 border border-amber-200/80 text-[10px] font-semibold text-amber-800">
                  <AlertTriangle size={12} className="shrink-0 text-amber-600" />
                  <span>{alreadyAssignedUsersCount} candidate{alreadyAssignedUsersCount === 1 ? ' is' : 's are'} already assigned and locked from re-assignment.</span>
                </div>
              )}

              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                  <Search size={13} />
                </span>
                <input
                  type="text"
                  placeholder="Search candidate by name or role..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="max-h-48 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-6 text-gray-400">
                    <Loader2 size={18} className="animate-spin text-purple-600" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-6 text-center text-xs text-gray-400">No candidates found</div>
                ) : (
                  filteredUsers.map((u, idx) => {
                    const isSelected = selectedIds.includes(u.id);
                    const isAssigned = !!u.is_assigned;
                    const initial = (u.username || 'U')[0].toUpperCase();
                    return (
                      <div 
                        key={`assign-user-${u.id}-${idx}`} 
                        onClick={() => !isAssigned && toggleUser(u)}
                        className={`flex items-center gap-2.5 p-2 rounded-xl transition-all border ${
                          isAssigned
                            ? 'bg-gray-100/70 border-gray-200 cursor-not-allowed opacity-60 text-gray-500'
                            : isSelected 
                              ? 'bg-purple-50/90 border-purple-200 text-purple-900 shadow-xs cursor-pointer' 
                              : 'bg-white border-transparent hover:bg-gray-50 text-gray-700 cursor-pointer'
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          disabled={isAssigned}
                          className={`w-4 h-4 rounded border-gray-300 ${
                            isAssigned ? 'cursor-not-allowed text-gray-300' : 'text-purple-600 focus:ring-purple-500 cursor-pointer'
                          }`}
                          checked={isSelected && !isAssigned}
                          onChange={() => {}} // handled by parent onClick
                        />
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          isAssigned ? 'bg-gray-200 text-gray-500' :
                          isSelected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {initial}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold truncate">{u.username}</span>
                            {isAssigned && (
                              <span className="px-1.5 py-0.2 rounded bg-gray-200 text-gray-700 text-[9px] font-bold flex items-center gap-0.5">
                                <Lock size={9} /> Assigned ({u.assignment_status || 'Active'})
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 capitalize">{u.role || 'Candidate'}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Target Deadline */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={14} className="text-indigo-600" />
                Target Deadline (Optional)
              </label>
              <input
                type="datetime-local"
                className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
              />
              <p className="text-[10px] text-gray-400">If set, candidates will see a countdown to this deadline.</p>
            </div>

            {/* Global Proctoring & Security Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${proctoringEnabled ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                    <Shield size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Proctoring & Security
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {proctoringEnabled ? 'Webcam & AI monitoring active' : 'No camera or microphone required'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold ${proctoringEnabled ? 'text-purple-700' : 'text-gray-400'}`}>
                    {proctoringEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <button
                    type="button"
                    aria-label="Toggle Proctoring"
                    onClick={() => {
                      const next = !proctoringEnabled;
                      setProctoringEnabled(next);
                      if (!next) setProctoringStrictness('none');
                      else if (proctoringStrictness === 'none') setProctoringStrictness('balanced');
                    }}
                    className={`relative w-11 h-6 rounded-full border transition-colors duration-200 ${proctoringEnabled ? 'bg-purple-600 border-purple-600' : 'bg-gray-200 border-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${proctoringEnabled ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
              </div>

              {!proctoringEnabled ? (
                <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed flex items-start gap-2.5">
                  <CheckCircle size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-950">Zero Proctoring (No Camera/Mic):</span> Candidates will be able to start and take this assessment immediately without turning on their webcam or microphone. No tab switch locks or violation limits will be enforced.
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-gray-50/80 border border-gray-200 flex flex-col gap-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-700">Strictness Level</span>
                    <span 
                      className="text-xs font-bold capitalize"
                      style={{
                        color: proctoringStrictness === 'strict' ? '#ef4444' : proctoringStrictness === 'lenient' ? '#22c55e' : '#eab308'
                      }}
                    >
                      {proctoringStrictness}
                    </span>
                  </div>

                  {/* 3-Segment Slider Bar */}
                  <div role="slider" aria-valuemin={0} aria-valuemax={2} aria-valuenow={proctoringStrictness === 'lenient' ? 0 : proctoringStrictness === 'strict' ? 2 : 1} aria-label="Proctoring strictness" className="flex gap-2 items-center">
                    {[
                      { key: 'lenient', label: 'Lenient', color: '#22c55e' },
                      { key: 'balanced', label: 'Balanced', color: '#eab308' },
                      { key: 'strict', label: 'Strict', color: '#ef4444' },
                    ].map((lvl) => {
                      const selected = proctoringStrictness === lvl.key;
                      return (
                        <button
                          key={lvl.key}
                          type="button"
                          onClick={() => setProctoringStrictness(lvl.key)}
                          title={lvl.label}
                          className="flex-1 h-2.5 rounded-full border-0 cursor-pointer transition-all"
                          style={{
                            background: selected ? lvl.color : 'rgba(0,0,0,0.10)',
                            boxShadow: selected ? `0 0 0 2px ${lvl.color}55` : 'none'
                          }}
                        />
                      );
                    })}
                  </div>

                  <div className="flex justify-between">
                    {[
                      { key: 'lenient', label: 'Lenient', color: '#22c55e' },
                      { key: 'balanced', label: 'Balanced', color: '#eab308' },
                      { key: 'strict', label: 'Strict', color: '#ef4444' },
                    ].map(l => (
                      <span 
                        key={l.key} 
                        className="text-[10px] font-semibold cursor-pointer transition-colors"
                        style={{ color: l.key === proctoringStrictness ? l.color : '#9ca3af' }}
                        onClick={() => setProctoringStrictness(l.key)}
                      >
                        {l.label}
                      </span>
                    ))}
                  </div>

                  <p className="text-[11px] text-gray-600 leading-relaxed pt-1">
                    {proctoringStrictness === 'lenient'
                      ? 'Relaxed monitoring. Only clear, sustained violations are flagged. Good for low-stakes practice.'
                      : proctoringStrictness === 'strict'
                        ? 'High-security exam. Any deviation is flagged quickly and strikes accumulate fast.'
                        : 'Recommended default. Reasonable sensitivity with anti-false-positive guards.'}
                  </p>
                </div>
              )}

              {proctoringEnabled && (
                <div className="flex items-start gap-1.5 text-[10px] text-gray-400">
                  <Info size={12} className="shrink-0 mt-0.5 text-gray-400" />
                  <span>Controls how quickly strikes are issued and the maximum allowed before termination for this assignment.</span>
                </div>
              )}
            </div>

            {/* Anti-Cheating & Randomization Controls */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col gap-3">
              <p className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                Anti-Cheating & Delivery
              </p>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/80 border border-gray-100">
                <div className="flex-1 pr-3">
                  <p className="text-xs font-bold text-gray-800">Generate AI Variants</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">AI rewords questions & shuffles options per candidate</p>
                </div>
                <button 
                  type="button" 
                  aria-label="Toggle AI variants" 
                  onClick={() => setGenerateVariants(v => !v)} 
                  className={`relative w-11 h-6 rounded-full border transition-colors duration-200 ${generateVariants ? 'bg-purple-600 border-purple-600' : 'bg-gray-200 border-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${generateVariants ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/80 border border-gray-100">
                <div className="flex-1 pr-3">
                  <p className="text-xs font-bold text-gray-800">Shuffle Questions Locally</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Randomize question order and options per candidate</p>
                </div>
                <button 
                  type="button" 
                  aria-label="Toggle Shuffle questions" 
                  onClick={() => setShuffleQuestions(v => !v)} 
                  className={`relative w-11 h-6 rounded-full border transition-colors duration-200 ${shuffleQuestions ? 'bg-purple-600 border-purple-600' : 'bg-gray-200 border-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${shuffleQuestions ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </div>

          </div>

          {/* Right Column: Question Subset Selection (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col gap-4">
              
              {/* Question Set Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                    <Layers size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Question Configuration
                    </p>
                    <p className="text-xs text-gray-500">
                      {activeQuestionsCount} of {questions.length} questions included • {totalAvailableMarks} total marks
                    </p>
                  </div>
                </div>

                {/* Segmented Mode Selector */}
                <div className="flex items-center p-1 rounded-xl bg-gray-100 border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setUseQuestionSubset(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      !useQuestionSubset 
                        ? 'bg-white text-gray-900 shadow-xs' 
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    All ({questions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUseQuestionSubset(true);
                      if (selectedQuestionIds.length === 0) {
                        setSelectedQuestionIds(questions.map(q => q.id));
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      useQuestionSubset 
                        ? 'bg-purple-600 text-white shadow-xs' 
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Custom Subset {useQuestionSubset ? `(${selectedQuestionIds.length})` : ''}
                  </button>
                </div>
              </div>

              {/* Subset Selection Active View */}
              {useQuestionSubset ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                        <Search size={13} />
                      </span>
                      <input
                        type="text"
                        placeholder="Search question text, type, or tags..."
                        value={questionSearch}
                        onChange={e => setQuestionSearch(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-800 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={selectAllQuestions}
                        className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-purple-700 hover:bg-purple-50 transition"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={clearAllQuestions}
                        className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-100 transition"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {loadingQuestions ? (
                      <div className="flex items-center justify-center py-12 text-gray-400">
                        <Loader2 size={20} className="animate-spin text-purple-600" />
                      </div>
                    ) : filteredQuestions.length === 0 ? (
                      <div className="py-12 text-center text-xs text-gray-400">No questions match your filter</div>
                    ) : (
                      filteredQuestions.map((q, idx) => {
                        const isSelected = selectedQuestionIds.includes(q.id);
                        const secTitle = getSectionTitle(q.section_id);

                        return (
                          <div
                            key={`assign-q-${q.id || 'new'}-${idx}`}
                            onClick={() => toggleQuestion(q.id)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                              isSelected 
                                ? 'bg-purple-50/50 border-purple-300 shadow-xs'
                                : 'bg-gray-50/50 border-gray-200 hover:border-gray-300 opacity-70'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="px-2 py-0.5 rounded-lg bg-gray-200/80 text-[10px] font-extrabold text-gray-700">
                                  Q{idx + 1}
                                </span>
                                <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-[10px] font-bold text-purple-700 uppercase">
                                  {q.question_type || 'MCQ'}
                                </span>
                                {secTitle && (
                                  <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-[10px] font-semibold text-indigo-700 truncate max-w-[160px]">
                                    {secTitle}
                                  </span>
                                )}
                                <span className="text-[11px] text-gray-400 font-semibold ml-auto">
                                  {q.marks || 1} mark{Number(q.marks) === 1 ? '' : 's'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-800 line-clamp-2 leading-relaxed font-medium">
                                {q.question_text || 'Untitled Question'}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                /* All Questions Preview View */
                <div className="p-6 rounded-2xl bg-gray-50/70 border border-gray-200 flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">All {questions.length} Questions Included</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-md">
                      Every candidate assigned will receive the complete assessment set.
                      {sections.length > 0 && ` Organized into ${sections.length} sections.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUseQuestionSubset(true);
                      if (selectedQuestionIds.length === 0) {
                        setSelectedQuestionIds(questions.map(q => q.id));
                      }
                    }}
                    className="mt-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-purple-700 hover:bg-purple-50 transition shadow-xs"
                  >
                    Customize Question Subset
                  </button>
                </div>
              )}

            </div>

          </div>

        </div>

        {/* Bottom Footer & Dispatch Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 border-t border-gray-100">
          <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
            <span className="font-bold text-gray-800">{selectedIds.length} candidate(s) selected</span>
            <span>•</span>
            <span className="font-semibold text-gray-700">{activeQuestionsCount} questions included</span>
            <span>•</span>
            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] capitalize ${
              proctoringStrictness === 'strict' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
              proctoringStrictness === 'lenient' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
              'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {proctoringStrictness} Proctoring
            </span>
            <span>•</span>
            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold text-[10px]">
              {generateVariants ? 'AI Variants Active' : shuffleQuestions ? 'Local Shuffle Active' : 'Standard Delivery'}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Assign Assessment {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
            </button>
          </div>
        </div>

      </form>
    </Modal>
  );
}

export default function ManageAssessments() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();

  const canManage = hasPermission(P.VERIFY_ASSESS_MANAGE);
  const canAssign = hasPermission(P.VERIFY_ASSESS_ASSIGN);
  const canViewResults = hasPermission(P.VERIFY_RESULTS_VIEW);
  const canViewLive = hasPermission(P.VERIFY_MONITORING_VIEW);

  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [assignTarget, setAssignTarget] = useState(null);
  const [publishing, setPublishing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/verify/builder/assessments', { credentials: 'include' });
      const d = await r.json();
      setAssessments(d.data || d || []);
    } catch { toast.error('Failed to load assessments'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAssessments(); }, [fetchAssessments]);

  const handlePublish = async (asm) => {
    setPublishing(asm.id);
    try {
      const r = await fetch(`/api/verify/builder/assessments/${asm.id}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      if (r.ok) {
        toast.success(`"${asm.title}" is now live`);
        fetchAssessments();
      } else {
        const d = await r.json();
        toast.error(extractErrorMessage(d?.detail, 'Publish failed'));
      }
    } catch (err) { toast.error(extractErrorMessage(err, 'Network error')); }
    finally { setPublishing(null); }
  };

  const handleStatusChange = async (asm, newStatus) => {
    try {
      const r = await fetch(`/api/verify/builder/assessments/${asm.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (r.ok) {
        toast.success('Status updated');
        fetchAssessments();
      } else {
        const d = await r.json();
        toast.error(extractErrorMessage(d?.detail, 'Update failed'));
      }
    } catch (err) { toast.error(extractErrorMessage(err, 'Network error')); }
  };

  const handleDelete = async (asm) => {
    if (!window.confirm(`Delete "${asm.title}"? This cannot be undone.`)) return;
    setDeleting(asm.id);
    try {
      const r = await fetch(`/api/verify/builder/assessments/${asm.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (r.ok) {
        toast.success('Assessment deleted');
        fetchAssessments();
      } else {
        const d = await r.json();
        toast.error(extractErrorMessage(d?.detail, 'Delete failed'));
      }
    } catch (err) { toast.error(extractErrorMessage(err, 'Network error')); }
    finally { setDeleting(null); }
  };

  const filtered = assessments.filter(a => {
    const matchesStatus = filterStatus === 'all' || a.status?.toLowerCase() === filterStatus;
    const matchesSearch = a.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          a.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder="Search assessments..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          {['all', 'draft', 'active', 'closed'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-1.5 rounded-lg border text-xs font-medium uppercase tracking-wider transition-colors ${
                filterStatus === s
                  ? 'bg-purple-50 border-purple-300 text-purple-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        
        <button
          onClick={fetchAssessments}
          aria-label="Refresh"
          className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <RefreshCw size={16} />
        </button>
        
        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} of {assessments.length} shown
        </span>
      </div>

      {/* Content */}
      <div className="flex-1">
        {loading ? (
          <HorizontalLoader label="Loading assessments..." />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 py-24 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <FileText size={48} className="text-gray-300" />
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800 mb-1">No assessments found</p>
              <p className="text-sm text-gray-500">
                {filterStatus !== 'all' ? `No ${filterStatus} assessments` : 'Create your first assessment to get started'}
              </p>
            </div>
            {filterStatus === 'all' && canManage && (
              <button
                onClick={() => navigate('/verify?tab=builder')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors duration-150 shadow-sm"
              >
                <Plus size={15} /> New Assessment
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {filtered.map((asm, idx) => (
              <div key={`manage-asm-${asm.id}-${idx}`} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 flex flex-col gap-4">
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-800 truncate">{asm.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{asm.description || 'No description'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span data-tooltip="Assessment type" className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${TYPE_STYLE[asm.type] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {asm.type || 'MCQ'}
                    </span>
                    <span data-tooltip="Assessment status" className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${STATUS_STYLE[asm.status?.toLowerCase()] || STATUS_STYLE.draft}`}>
                      {asm.status || 'Draft'}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-5 py-3 border-t border-b border-gray-100">
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-gray-800">{asm.question_count ?? 0}</span>
                    <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400 mt-0.5">Questions</span>
                  </div>
                  <div className="w-px h-8 bg-gray-200" />
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-gray-800">{asm.time_limit_minutes ?? '—'}</span>
                    <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400 mt-0.5">Minutes</span>
                  </div>
                  <div className="w-px h-8 bg-gray-200" />
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-purple-600">{asm.pass_score ?? 70}%</span>
                    <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400 mt-0.5">Pass Score</span>
                  </div>
                  {asm.shuffle_questions && (
                    <>
                      <div className="w-px h-8 bg-gray-200" />
                      <div className="flex items-center gap-1 text-xs font-medium text-amber-600">
                        <Shuffle size={12} /> Shuffled
                      </div>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  {canManage && (
                    <button
                      onClick={() => navigate(`/verify?tab=builder&id=${asm.id}`)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 text-xs font-medium hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors"
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                  )}

                  {canManage && asm.status?.toLowerCase() === 'draft' && (
                    <button
                      onClick={() => handlePublish(asm)}
                      disabled={publishing === asm.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50"
                    >
                      {publishing === asm.id ? <Loader2 size={13} className="animate-spin" /> : <Unlock size={13} />}
                      Publish
                    </button>
                  )}

                  {/* Status changer */}
                  {canManage && (
                    <div className="relative group/status">
                      <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-100 transition-colors">
                        <Lock size={13} /> Status <ChevronDown size={11} />
                      </button>
                      <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-xl border border-gray-200 shadow-lg p-2 min-w-[140px] opacity-0 invisible group-hover/status:opacity-100 group-hover/status:visible transition-all duration-150">
                        {STATUSES.map(s => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(asm, s)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-gray-50 ${
                              asm.status?.toLowerCase() === s ? 'text-purple-600 bg-purple-50' : 'text-gray-600'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {canViewResults && (
                    <button
                      onClick={() => navigate(`/verify?tab=analytics&asm_id=${asm.id}`)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 text-xs font-medium hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
                    >
                      <BarChart2 size={13} /> Results
                    </button>
                  )}

                  {canViewLive && asm.status?.toLowerCase() === 'active' && (
                    <button
                      onClick={() => navigate(`/verify?tab=live&asm_id=${asm.id}`)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"
                    >
                      <Activity size={13} className="animate-pulse" /> Live
                    </button>
                  )}

                  {canAssign && (
                    <button
                      onClick={() => setAssignTarget(asm)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 text-xs font-medium hover:bg-purple-100 transition-colors"
                    >
                      <Users size={13} /> Assign
                    </button>
                  )}

                  {canManage && (
                    <button
                      onClick={() => handleDelete(asm)}
                      disabled={deleting === asm.id}
                      aria-label="Delete assessment permanently"
                      className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                    >
                      {deleting === asm.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {assignTarget && (
        <AssignModal assessment={assignTarget} onClose={() => setAssignTarget(null)} />
      )}
    </div>
  );
}
