import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, Clock, CheckCircle, AlertTriangle, Play,
  BarChart2, RefreshCw, Calendar, FileText, TrendingUp, Award,
  Search, Shield, ChevronRight, Sparkles, ArrowUpRight, Target, Flame,
  MessageSquare, ExternalLink
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';
import { extractErrorMessage } from '../../../core/utils/validators';

const STATUS_STYLE = {
  pending:     'bg-amber-50 text-amber-700 border-amber-200',
  started:     'bg-purple-50 text-purple-700 border-purple-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  submitted:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  graded:      'bg-indigo-50 text-indigo-700 border-indigo-200',
  expired:     'bg-rose-50 text-rose-700 border-rose-200',
};

function DeadlineCountdown({ deadline }) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (!deadline) { setDisplay('No deadline'); return; }
    const calc = () => {
      const diff = new Date(deadline) - new Date();
      if (diff <= 0) { setDisplay('Expired'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      if (h > 48) setDisplay(`${Math.floor(h / 24)}d ${h % 24}h left`);
      else setDisplay(`${h}h ${m}m left`);
    };
    calc();
    const iv = setInterval(calc, 60000);
    return () => clearInterval(iv);
  }, [deadline]);

  const isUrgent = deadline && (new Date(deadline) - new Date()) < 24 * 3600000;

  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${isUrgent ? 'text-rose-600 font-semibold' : 'text-gray-500'}`}>
      <Clock size={12} className={isUrgent ? 'animate-pulse text-rose-600' : 'text-gray-400'} /> {display}
    </span>
  );
}

export default function CandidateDashboard({ activeTab: propTab }) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const { user } = useAuth();

  // Determine active view tab: overview, assessments, history, queries, analytics
  const urlTab = params.get('tab');
  const [currentTab, setCurrentTab] = useState(
    propTab ||
    (urlTab === 'history' ? 'history' : urlTab === 'my-assessments' ? 'assessments' : urlTab === 'queries' ? 'queries' : 'overview')
  );

  useEffect(() => {
    if (propTab) {
      setCurrentTab(propTab);
    } else if (urlTab === 'history') {
      setCurrentTab('history');
    } else if (urlTab === 'my-assessments') {
      setCurrentTab('assessments');
    } else if (urlTab === 'queries') {
      setCurrentTab('queries');
    } else if (urlTab === 'candidate') {
      setCurrentTab('overview');
    }
  }, [propTab, urlTab]);

  const handleTabSwitch = (t) => {
    setCurrentTab(t);
    const targetUrlTab = t === 'history' ? 'history' : t === 'assessments' ? 'my-assessments' : t === 'queries' ? 'queries' : 'candidate';
    navigate(`/verify?tab=${targetUrlTab}`);
  };

  const [assignments, setAssignments] = useState([]);
  const [results, setResults] = useState([]);
  const [myQueries, setMyQueries] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingResults, setLoadingResults] = useState(true);
  const [loadingQueries, setLoadingQueries] = useState(true);

  // Filters for My Assessments tab
  const [assessmentFilter, setAssessmentFilter] = useState('all'); // all, pending, in_progress, completed, expired
  const [assessmentSearch, setAssessmentSearch] = useState('');

  // Filters for History tab
  const [historyFilter, setHistoryFilter] = useState('all'); // all, passed, failed
  const [historySearch, setHistorySearch] = useState('');

  const fetchAssignments = useCallback(async () => {
    setLoadingAssignments(true);
    try {
      const r = await fetch('/api/verify/assignments/my-tests', { credentials: 'include' });
      const d = await r.json();
      setAssignments(d.data || d || []);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to load assignments'));
    } finally {
      setLoadingAssignments(false);
    }
  }, []);

  const fetchResults = useCallback(async () => {
    setLoadingResults(true);
    try {
      const r = await fetch('/api/verify/submissions/my-results', { credentials: 'include' });
      const d = await r.json();
      setResults(d.data || d || []);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to load results'));
    } finally {
      setLoadingResults(false);
    }
  }, []);

  const fetchMyQueries = useCallback(async () => {
    setLoadingQueries(true);
    try {
      const r = await fetch('/api/verify/queries/my', { credentials: 'include' });
      const d = await r.json();
      setMyQueries(d.data || []);
    } catch {
      // silent
    } finally {
      setLoadingQueries(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
    fetchResults();
    fetchMyQueries();
  }, [fetchAssignments, fetchResults, fetchMyQueries]);

  // Derived statistics
  const pendingAssignments = useMemo(() => {
    return assignments.filter(a => ['pending', 'started', 'in_progress'].includes(a.status?.toLowerCase()));
  }, [assignments]);

  const completedAssignments = useMemo(() => {
    return assignments.filter(a => ['submitted', 'graded'].includes(a.status?.toLowerCase()));
  }, [assignments]);

  const passedResults = useMemo(() => {
    return results.filter(r => r.pass_status === 'pass' || r.passed === true);
  }, [results]);

  const failedResults = useMemo(() => {
    return results.filter(r => r.pass_status === 'fail' || (r.passed === false && r.score !== null && r.score !== undefined));
  }, [results]);

  const averageScore = useMemo(() => {
    const scoredResults = results.filter(r => r.score !== null && r.score !== undefined && !isNaN(Number(r.score)));
    if (scoredResults.length === 0) return 0;
    const total = scoredResults.reduce((acc, r) => acc + Number(r.score), 0);
    return Math.round(total / scoredResults.length);
  }, [results]);

  const highestScore = useMemo(() => {
    const scoredResults = results.filter(r => r.score !== null && r.score !== undefined && !isNaN(Number(r.score)));
    if (scoredResults.length === 0) return 0;
    return Math.round(Math.max(...scoredResults.map(r => Number(r.score))));
  }, [results]);

  const passRate = useMemo(() => {
    if (results.length === 0) return 0;
    return Math.round((passedResults.length / results.length) * 100);
  }, [results, passedResults]);

  // Filtered lists
  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => {
      const s = a.status?.toLowerCase() || '';
      const matchesSearch = !assessmentSearch.trim() ||
        (a.title || a.assessment_title || '').toLowerCase().includes(assessmentSearch.toLowerCase()) ||
        (a.description || '').toLowerCase().includes(assessmentSearch.toLowerCase());

      if (!matchesSearch) return false;

      if (assessmentFilter === 'pending') return s === 'pending';
      if (assessmentFilter === 'in_progress') return s === 'started' || s === 'in_progress';
      if (assessmentFilter === 'completed') return s === 'submitted' || s === 'graded';
      if (assessmentFilter === 'expired') return s === 'expired';
      return true;
    });
  }, [assignments, assessmentFilter, assessmentSearch]);

  const filteredResults = useMemo(() => {
    return results.filter(r => {
      const matchesSearch = !historySearch.trim() ||
        (r.title || r.assessment_title || '').toLowerCase().includes(historySearch.toLowerCase());

      if (!matchesSearch) return false;

      const isPass = r.pass_status === 'pass' || r.passed === true;
      const isFail = r.pass_status === 'fail' || (r.passed === false && r.score !== null && r.score !== undefined);

      if (historyFilter === 'passed') return isPass;
      if (historyFilter === 'failed') return isFail;
      return true;
    });
  }, [results, historyFilter, historySearch]);

  const refreshAll = () => {
    fetchAssignments();
    fetchResults();
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'Candidate';

  return (
    <div className="flex flex-col gap-6 light-theme-override text-gray-900">
      {/* Contextual Section Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-6 rounded-full bg-purple-600" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-600">
              Candidate Portal
            </p>
            <p className="text-xs text-gray-500 font-medium">
              {currentTab === 'overview'
                ? 'Overview — assignments, deadlines, and recent scores'
                : currentTab === 'assessments'
                  ? 'My Assessments — all assigned evaluations'
                  : currentTab === 'history'
                    ? 'History & Results — past attempts and scorecards'
                    : 'Performance Analytics — scores, pass rate, and trends'}
            </p>
          </div>
        </div>
        <button
          onClick={refreshAll}
          title="Refresh Data"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition border border-gray-200"
        >
          <RefreshCw size={13} className={loadingAssignments || loadingResults ? 'animate-spin text-purple-600' : ''} />
          Refresh
        </button>
      </div>


      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: OVERVIEW                                                     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {currentTab === 'overview' && (
        <div className="space-y-6">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-800 rounded-3xl p-8 text-white shadow-md relative overflow-hidden">
            <div className="absolute right-0 bottom-0 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-purple-200 text-xs font-semibold backdrop-blur-sm mb-3">
                  <Sparkles size={13} className="text-amber-300" /> Assessment Central Portal
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Welcome back, <span className="text-purple-200">{displayName}</span>
                </h1>
                <p className="text-sm text-purple-100/80 mt-1 max-w-xl">
                  {pendingAssignments.length > 0
                    ? `You have ${pendingAssignments.length} assessment${pendingAssignments.length > 1 ? 's' : ''} ready to take. Check your deadlines below.`
                    : 'You are all caught up! No pending assessments require your attention.'}
                </p>
              </div>

              {pendingAssignments.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleTabSwitch('assessments')}
                  className="px-6 py-3 rounded-xl bg-white text-purple-900 hover:bg-purple-50 text-xs font-bold transition shadow-lg shrink-0 flex items-center gap-2"
                >
                  <Play size={14} fill="currentColor" /> Take Assessment
                </button>
              )}
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <FileText size={22} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Total Assigned</p>
                <p className="text-2xl font-bold text-gray-900">{assignments.length}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock size={22} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Action Required</p>
                <p className="text-2xl font-bold text-amber-600">{pendingAssignments.length}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle size={22} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-emerald-600">{results.length}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <TrendingUp size={22} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Average Score</p>
                <p className="text-2xl font-bold text-indigo-600">{averageScore}%</p>
              </div>
            </div>
          </div>

          {/* Action Required: Pending Tests */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <Flame className="text-amber-500" size={18} /> Action Required
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Assessments pending your submission</p>
              </div>
              <button
                type="button"
                onClick={() => handleTabSwitch('assessments')}
                className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1"
              >
                View All ({assignments.length}) <ChevronRight size={14} />
              </button>
            </div>

            {loadingAssignments ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-purple-600" size={24} />
              </div>
            ) : pendingAssignments.length === 0 ? (
              <div className="py-10 text-center text-gray-400 space-y-2">
                <CheckCircle className="mx-auto text-emerald-500" size={36} />
                <p className="text-sm font-semibold text-gray-700">All caught up!</p>
                <p className="text-xs text-gray-400">No assessments currently require your attention.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingAssignments.map((a, idx) => {
                  const s = a.status?.toLowerCase();
                  const isStarted = s === 'started' || s === 'in_progress';
                  const keyId = a.assignment_id || a.assessment_id || a.id || idx;

                  return (
                    <div key={`pending-asm-${keyId}-${idx}`} className="p-5 rounded-2xl border border-gray-200 bg-gray-50/50 hover:bg-white hover:border-purple-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{a.title || a.assessment_title || 'Assessment'}</h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[s] || 'bg-gray-100 text-gray-600'}`}>
                            {isStarted ? 'In Progress' : 'Pending'}
                          </span>
                        </div>
                        {a.description && (
                          <p className="text-xs text-gray-500 line-clamp-2 mb-3">{a.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                          <DeadlineCountdown deadline={a.deadline} />
                          {a.time_limit_minutes && (
                            <span className="flex items-center gap-1 font-medium text-gray-600">
                              <Clock size={12} /> {a.time_limit_minutes} Mins
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate(`/verify?tab=take&asm_id=${a.assessment_id || a.id}`)}
                        className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition shadow-sm flex items-center justify-center gap-2"
                      >
                        <Play size={13} fill="currentColor" /> {isStarted ? 'Resume Assessment' : 'Start Assessment'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Completed Assessments & Performance Spotlight */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Results */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <TrendingUp className="text-purple-600" size={18} /> Recent Scorecards
                </h2>
                <button
                  type="button"
                  onClick={() => handleTabSwitch('history')}
                  className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                >
                  Full History <ChevronRight size={14} />
                </button>
              </div>

              {loadingResults ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="animate-spin text-purple-600" size={20} />
                </div>
              ) : results.length === 0 ? (
                <div className="py-8 text-center text-gray-400">
                  <Award size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-xs">No completed assessment history yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {results.slice(0, 3).map((r, idx) => {
                    const pct = Math.round(r.percentage_score ?? r.score ?? 0);
                    const passed = r.pass_status === 'pass' || r.passed === true;
                    const resKey = r.result_id || r.id || idx;

                    return (
                      <div key={`recent-res-${resKey}-${idx}`} className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 text-xs truncate">{r.title || 'Assessment'}</h4>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Completed'}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            {pct}% {passed ? 'Pass' : 'Fail'}
                          </span>
                          <button
                            type="button"
                            onClick={() => navigate(`/verify?tab=result&result_id=${r.result_id || r.id}`)}
                            className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-100 transition"
                            title="View Scorecard"
                          >
                            <ArrowUpRight size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Test Readiness Checklist */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-1">
                  <Shield className="text-purple-600" size={18} /> Candidate Readiness
                </h2>
                <p className="text-xs text-gray-500 mb-4">Quick checklist before beginning an assessment</p>

                <ul className="space-y-3 text-xs text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span>Use <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> for proctoring.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span>Ensure web camera and microphone permissions are granted.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span>Take tests in a well-lit room without external assistance.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span>Section time limits count down strictly once started.</span>
                  </li>
                </ul>
              </div>

              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-[11px] text-purple-800 font-medium">
                💡 Need help? Contact your assessment administrator.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: MY ASSESSMENTS                                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {currentTab === 'assessments' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
          
          {/* Header & Search/Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileText className="text-purple-600" size={20} /> My Assigned Assessments
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                All skill evaluations assigned to your profile
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap bg-gray-50 p-1 rounded-xl border border-gray-200">
              {[
                { id: 'all', label: `All (${assignments.length})` },
                { id: 'pending', label: `Pending (${assignments.filter(a => a.status?.toLowerCase() === 'pending').length})` },
                { id: 'in_progress', label: `In Progress (${assignments.filter(a => a.status?.toLowerCase() === 'started' || a.status?.toLowerCase() === 'in_progress').length})` },
                { id: 'completed', label: `Completed (${completedAssignments.length})` },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAssessmentFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    assessmentFilter === f.id
                      ? 'bg-white text-purple-700 shadow-sm font-bold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              <Search size={15} />
            </span>
            <input
              type="text"
              placeholder="Search assessments by title or keyword..."
              value={assessmentSearch}
              onChange={e => setAssessmentSearch(e.target.value)}
              className="w-full bg-gray-50 text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
            />
          </div>

          {/* List of Assessments */}
          {loadingAssignments ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Loader2 className="animate-spin text-purple-600 mb-2" size={24} />
              <span className="text-xs">Loading assessments...</span>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="py-16 text-center text-gray-400 space-y-2">
              <Calendar className="mx-auto text-gray-300" size={40} />
              <p className="text-sm font-semibold text-gray-700">No assessments found</p>
              <p className="text-xs text-gray-400">Try adjusting your search query or filter criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAssignments.map((a, idx) => {
                const s = a.status?.toLowerCase();
                const isActionable = s === 'pending' || s === 'started' || s === 'in_progress';
                const isCompleted = s === 'submitted' || s === 'graded';
                const isStarted = s === 'started' || s === 'in_progress';
                const keyId = a.assignment_id || a.assessment_id || a.id || idx;

                return (
                  <div
                    key={`all-asm-${keyId}-${idx}`}
                    className={`rounded-2xl p-6 border transition-all flex flex-col justify-between space-y-4 ${
                      isActionable
                        ? 'bg-white border-gray-200 hover:border-purple-300 hover:shadow-md'
                        : 'bg-gray-50/70 border-gray-200 opacity-90'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-bold text-gray-900 text-sm line-clamp-1">
                          {a.title || a.assessment_title || 'Assessment'}
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${STATUS_STYLE[s] || 'bg-gray-100 text-gray-600'}`}>
                          {a.status || 'Pending'}
                        </span>
                      </div>

                      {a.description && (
                        <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">
                          {a.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap pt-1">
                        <DeadlineCountdown deadline={a.deadline} />
                        {a.time_limit_minutes && (
                          <span className="flex items-center gap-1 font-medium text-gray-600">
                            <Clock size={12} /> {a.time_limit_minutes} Mins
                          </span>
                        )}
                        {a.type && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-semibold uppercase">
                            {a.type}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-3">
                      {isActionable && (
                        <button
                          type="button"
                          onClick={() => navigate(`/verify?tab=take&asm_id=${a.assessment_id || a.id}`)}
                          className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition shadow-sm flex items-center justify-center gap-2"
                        >
                          <Play size={13} fill="currentColor" />
                          {isStarted ? 'Resume Assessment' : 'Start Assessment'}
                        </button>
                      )}

                      {isCompleted && (
                        <button
                          type="button"
                          onClick={() => {
                            if (a.result_id) navigate(`/verify?tab=result&result_id=${a.result_id}`);
                            else handleTabSwitch('history');
                          }}
                          className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition flex items-center justify-center gap-2"
                        >
                          <BarChart2 size={14} /> View Result
                        </button>
                      )}

                      {s === 'expired' && (
                        <span className="text-xs text-rose-500 font-semibold italic">
                          Assessment Expired
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: HISTORY & RESULTS                                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {currentTab === 'history' && (
        <div className="space-y-6">
          {/* History Analytics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Total Attempts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{results.length}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Tests Passed</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{passedResults.length}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Average Score</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{averageScore}%</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Highest Score</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1">{highestScore}%</p>
            </div>
          </div>

          {/* Results Table & Search Box */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="text-purple-600" size={20} /> Attempt History & Scorecards
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Detailed score breakdown and status for all past attempts
                </p>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-200">
                {[
                  { id: 'all', label: `All (${results.length})` },
                  { id: 'passed', label: `Passed (${passedResults.length})` },
                  { id: 'failed', label: `Failed (${failedResults.length})` },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setHistoryFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      historyFilter === f.id
                        ? 'bg-white text-purple-700 shadow-sm font-bold'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search size={15} />
              </span>
              <input
                type="text"
                placeholder="Search scorecards by assessment title..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                className="w-full bg-gray-50 text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              />
            </div>

            {loadingResults ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Loader2 className="animate-spin text-purple-600 mb-2" size={24} />
                <span className="text-xs">Loading scorecard history...</span>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="py-16 text-center text-gray-400 space-y-2">
                <Award className="mx-auto text-gray-300" size={40} />
                <p className="text-sm font-semibold text-gray-700">No scorecards found</p>
                <p className="text-xs text-gray-400">You haven't completed any assessments matching this filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredResults.map((r, idx) => {
                  const pct = Math.round(r.percentage_score ?? r.score ?? 0);
                  const isScoreAvailable = r.score !== null && r.score !== undefined;
                  const passed = r.pass_status === 'pass' || r.passed === true;

                  return (
                    <div
                      key={`hist-res-${r.result_id || r.id || idx}-${idx}`}
                      className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-200 transition-all flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-bold text-gray-900 text-sm truncate">{r.title || 'Assessment'}</h3>
                          <span className={`px-2.5 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            !isScoreAvailable
                              ? 'bg-gray-100 text-gray-600 border-gray-200'
                              : passed
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {!isScoreAvailable ? 'Submitted' : passed ? 'Pass' : 'Fail'}
                          </span>
                        </div>

                        {/* Visual Score Bar */}
                        {isScoreAvailable ? (
                          <div className="space-y-1.5 my-3">
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="text-gray-500">Score</span>
                              <span className={passed ? 'text-emerald-600' : 'text-rose-600'}>{pct}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${passed ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic my-3">Results will be published by administrator.</p>
                        )}

                        <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                          <span>
                            {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''}
                          </span>
                          {r.is_malpractice && (
                            <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                              <AlertTriangle size={10} /> Flagged
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate(`/verify?tab=result&result_id=${r.result_id || r.id}`)}
                        className="w-full py-2 rounded-xl bg-purple-50 text-purple-700 text-xs font-bold hover:bg-purple-100 transition flex items-center justify-center gap-1.5"
                      >
                        View Full Scorecard <ChevronRight size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: PERFORMANCE & INSIGHTS                                      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {currentTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Award className="text-purple-600" size={20} /> Overall Performance Analytics
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Summary of your skills performance, success rate, and consistency
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
              <div className="p-6 rounded-2xl bg-purple-50/60 border border-purple-100 text-center space-y-2">
                <Target size={32} className="mx-auto text-purple-600" />
                <p className="text-3xl font-extrabold text-purple-900">{passRate}%</p>
                <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Pass Rate</p>
                <p className="text-[11px] text-gray-500">{passedResults.length} of {results.length} tests passed</p>
              </div>

              <div className="p-6 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-center space-y-2">
                <TrendingUp size={32} className="mx-auto text-indigo-600" />
                <p className="text-3xl font-extrabold text-indigo-900">{averageScore}%</p>
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Average Score</p>
                <p className="text-[11px] text-gray-500">Across all completed assessments</p>
              </div>

              <div className="p-6 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-center space-y-2">
                <Award size={32} className="mx-auto text-emerald-600" />
                <p className="text-3xl font-extrabold text-emerald-900">{highestScore}%</p>
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Personal Best</p>
                <p className="text-[11px] text-gray-500">Highest recorded score</p>
              </div>
            </div>

            {results.length > 0 && (
              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-bold text-gray-800 mb-4">Score Distribution</h3>
                <div className="space-y-3">
                  {results.map((r, idx) => {
                    const score = Math.round(r.percentage_score ?? r.score ?? 0);
                    const passed = r.pass_status === 'pass' || r.passed === true;

                    return (
                      <div key={idx} className="flex items-center gap-4 text-xs">
                        <span className="w-48 font-medium text-gray-800 truncate">{r.title || 'Assessment'}</span>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${passed ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <span className={`w-12 text-right font-bold ${passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {score}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: MY QUERIES & APPEALS                                        */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {currentTab === 'queries' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="text-purple-600" size={20} /> My Submitted Queries & Appeals
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Track the status and review HR responses for your submitted assessment queries.
                </p>
              </div>

              <button
                onClick={fetchMyQueries}
                disabled={loadingQueries}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition border border-gray-200"
              >
                <RefreshCw size={13} className={loadingQueries ? 'animate-spin text-purple-600' : ''} />
                Refresh Queries
              </button>
            </div>

            {loadingQueries ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Loader2 className="animate-spin text-purple-600 mb-2" size={24} />
                <span className="text-xs">Loading your queries...</span>
              </div>
            ) : myQueries.length === 0 ? (
              <div className="py-16 text-center text-gray-400 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle size={24} />
                </div>
                <p className="text-sm font-semibold text-gray-700">No Queries Raised</p>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  You haven't submitted any disputes or appeals. You can raise a query directly from any assessment scorecard in your History tab.
                </p>
                <button
                  onClick={() => handleTabSwitch('history')}
                  className="px-4 py-2 bg-purple-50 text-purple-700 rounded-xl text-xs font-semibold hover:bg-purple-100 transition"
                >
                  View Scorecards in History
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {myQueries.map((q) => {
                  const isResolved = q.status === 'resolved';
                  const isClosed = q.status === 'closed';

                  return (
                    <div
                      key={q.id}
                      className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:border-purple-200 transition-all space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
                            {q.assessment_title || 'Skill Assessment'}
                          </span>
                          <h3 className="text-sm font-bold text-gray-900 mt-0.5">
                            {q.subject || 'Evaluation Dispute'}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isResolved
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isClosed
                                ? 'bg-gray-100 text-gray-600 border-gray-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {isResolved ? 'Resolved' : isClosed ? 'Closed' : 'Pending HR Review'}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {q.created_at ? new Date(q.created_at).toLocaleDateString() : ''}
                          </span>
                        </div>
                      </div>

                      {/* Candidate Message */}
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Your Message</p>
                        <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 leading-relaxed font-sans">
                          {q.message}
                        </p>
                      </div>

                      {/* HR Response if present */}
                      {q.response ? (
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle size={13} /> HR Resolution Response
                          </p>
                          <p className="text-xs text-emerald-950 bg-emerald-50/90 p-3.5 rounded-xl border border-emerald-200 leading-relaxed font-sans">
                            {q.response}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-gray-400 italic">
                          Awaiting response from the HR evaluation team.
                        </p>
                      )}

                      {/* Scorecard link */}
                      {q.assessment_result_id && (
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/verify?tab=result&result_id=${q.assessment_result_id}`)}
                            className="inline-flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-semibold"
                          >
                            <span>View Linked Result Scorecard</span>
                            <ExternalLink size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}