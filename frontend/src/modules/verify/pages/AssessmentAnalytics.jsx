import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Award, ShieldAlert, CheckCircle, Clock, Loader2, ChevronDown, ChevronUp, AlertTriangle, Play, Image as ImageIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import HorizontalLoader from '../../../core/components/HorizontalLoader';
import useEscapeClose from '../../../core/hooks/useEscapeClose';
import useOverlayClose from '../../../core/hooks/useOverlayClose';
import { useAuth } from '../../../core/auth/AuthContext';


// ── Single Question Answer Block ──────────────────────────────────────────────
function AnswerBlock({ question, answer, scoreObj }) {
  const qt = question.question_type;
  const actualScore = scoreObj != null && typeof scoreObj === 'object' ? scoreObj.score : scoreObj;
  const maxMarks = (scoreObj != null && typeof scoreObj === 'object' && scoreObj.max != null)
    ? scoreObj.max
    : (parseFloat(question.marks) || 0);
  const hasScore = actualScore !== undefined && actualScore !== null;
  const scoreColor = !hasScore ? 'text-gray-500' : actualScore > 0 ? 'text-emerald-600' : 'text-rose-600';

  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-3">
      {/* Header row */}
      <div className="flex justify-between items-start gap-3 flex-wrap mb-2">
        <span className="text-[0.78rem] font-bold text-gray-500 uppercase tracking-wider">
          {qt?.replace(/_/g, ' ')}
        </span>
        {hasScore ? (
          <span className={`font-bold text-[0.82rem] ${scoreColor}`}>
            {actualScore > 0 ? '✅' : '❌'} {actualScore}/{maxMarks} marks
          </span>
        ) : (
          <span className="text-[0.78rem] text-gray-500">{maxMarks} marks</span>
        )}
      </div>

      {/* Question text */}
      <div className="text-[0.92rem] font-medium mb-3 leading-relaxed text-gray-800">
        {question.question_text}
      </div>

      {/* MCQ */}
      {qt === 'mcq' && (
        <div className="flex flex-col gap-2">
          {(question.options || []).map((opt, i) => {
            const isSelected = answer === opt;
            const isCorrect = question.correct_answer === opt;
            let bg = 'bg-transparent', border = 'border-gray-200', icon = null;
            if (isSelected && isCorrect) { bg = 'bg-emerald-50'; border = 'border-emerald-500'; icon = '✅'; }
            else if (isSelected && !isCorrect) { bg = 'bg-rose-50'; border = 'border-rose-500'; icon = '❌'; }
            else if (!isSelected && isCorrect) { bg = 'bg-emerald-50/50'; border = 'border-emerald-500 border-dashed'; icon = '✓'; }
            return (
              <div key={i} className={`flex justify-between py-2 px-3 rounded-lg border text-[0.85rem] ${bg} ${border}`}>
                <span>{opt}</span>
                {icon && <span className="font-bold">{icon}</span>}
              </div>
            );
          })}
          {!answer && <div className="text-gray-500 text-[0.82rem] italic mt-1">Not answered</div>}
        </div>
      )}

      {/* MCQ Multi */}
      {qt === 'mcq_multi' && (() => {
        const ansArr = Array.isArray(answer) ? answer : [];
        let corrArr = [];
        try {
          corrArr = typeof question.correct_answer === 'string' && question.correct_answer.startsWith('[')
            ? JSON.parse(question.correct_answer)
            : [question.correct_answer];
        } catch { corrArr = [question.correct_answer]; }
        return (
          <div className="flex flex-col gap-2">
            {(question.options || []).map((opt, i) => {
              const isSelected = ansArr.includes(opt);
              const isCorrect = corrArr.includes(opt);
              let bg = 'bg-transparent', border = 'border-gray-200', icon = null;
              if (isSelected && isCorrect) { bg = 'bg-emerald-50'; border = 'border-emerald-500'; icon = '✅'; }
              else if (isSelected && !isCorrect) { bg = 'bg-rose-50'; border = 'border-rose-500'; icon = '❌'; }
              else if (!isSelected && isCorrect) { bg = 'bg-emerald-50/50'; border = 'border-emerald-500 border-dashed'; icon = '✓'; }
              return (
                <div key={i} className={`flex justify-between items-center py-2 px-3 rounded-lg border text-[0.85rem] ${bg} ${border}`}>
                  <label className="flex items-center gap-2 m-0 cursor-default">
                    <input type="checkbox" checked={isSelected} readOnly className="pointer-events-none rounded text-purple-600" />
                    <span>{opt}</span>
                  </label>
                  {icon && <span className="font-bold">{icon}</span>}
                </div>
              );
            })}
            {ansArr.length === 0 && <div className="text-gray-500 text-[0.82rem] italic mt-1">Not answered</div>}
          </div>
        );
      })()}

      {/* Written / Fill in */}
      {(qt === 'written' || qt === 'fill_in') && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-[0.87rem] whitespace-pre-wrap text-gray-700 min-h-[3rem]">
          {answer || <span className="text-gray-400 italic">No answer provided</span>}
        </div>
      )}

      {/* Coding */}
      {qt === 'coding' && (() => {
        let code = '';
        try { const p = typeof answer === 'string' ? JSON.parse(answer) : answer; code = p?.code || answer || ''; } catch { code = answer || ''; }
        return (
          <pre className="bg-[#1E1B4B] text-[#A5B4FC] p-3 rounded-lg text-[0.78rem] overflow-x-auto m-0 font-mono max-h-[280px] overflow-y-auto">
            {code || 'No code submitted'}
          </pre>
        );
      })()}
    </div>
  );
}

export default function AssessmentAnalytics({ assessmentId: initialAssessmentId }) {
  const { hasPermission } = useAuth();
  const canViewResults = hasPermission('verify.results.view');
  const [assessmentsList, setAssessmentsList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  
  const [selectedView, setSelectedView] = useState(initialAssessmentId ? 'assessment' : null);
  const [selectedId, setSelectedId] = useState(initialAssessmentId || null);

  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userHistory, setUserHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [resultDetailsCache, setResultDetailsCache] = useState({});
  const [loadingDetailsId, setLoadingDetailsId] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  useEscapeClose(() => setLightboxImage(null), !!lightboxImage);
  const lightboxOverlayHandlers = useOverlayClose(() => setLightboxImage(null));

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  // Fetch dropdown lists on mount
  useEffect(() => {
    fetch('/api/verify/builder/assessments', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setAssessmentsList(d.data); });
      
    fetch('/api/verify/assignments/assignable-users', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setUsersList(d.data); });
  }, []);

  // Fetch data when selection changes
  useEffect(() => {
    if (!selectedView || !selectedId) {
      setStats(null);
      setUserHistory(null);
      return;
    }
    
    setLoading(true);
    setExpandedRowId(null);
    setSearchTerm('');
    setDateFilter('all');

    if (selectedView === 'assessment') {
      Promise.all([
        fetch(`/api/verify/builder/assessments/${selectedId}/stats`, { credentials: 'include' }).then(r => r.json()),
        fetch(`/api/verify/submissions/assessments/${selectedId}/results`, { credentials: 'include' }).then(r => r.json()),
        fetch(`/api/verify/assignments/${selectedId}/candidates`, { credentials: 'include' }).then(r => r.json())
      ]).then(([statsRes, leadRes, candRes]) => {
          if (statsRes.success) {
            const data = statsRes.data || {};
            // Keep stats around if we want base reference, but we will calculate dynamically now
            setStats({
              metrics: {
                total_assigned: candRes.success ? (candRes.data || []).length : 0,
                total_submitted: data.total_submissions || 0,
                total_passed: data.passed_count || 0,
                total_malpractice: data.malpractice_count || 0
              },
              performance: {
                pass_rate_pct: data.total_submissions > 0 ? ((data.passed_count || 0) / data.total_submissions) * 100 : 0,
                average_score: data.average_score || 0,
                average_time_taken: 0 // Not available in current backend query
              }
            });
            setLeaderboard(leadRes.success ? leadRes.data : []);
          } else toast.error('Failed to load assessment analytics');
        })
        .catch(() => toast.error('Error loading analytics'))
        .finally(() => setLoading(false));
    } else if (selectedView === 'user') {
      fetch(`/api/verify/submissions/user/${selectedId}/results`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => {
          if (d.success) setUserHistory(d.data);
          else toast.error('Failed to load user history');
        })
        .catch(() => toast.error('Error loading history'))
        .finally(() => setLoading(false));
    }
  }, [selectedView, selectedId]);

  const handleAssessmentChange = (e) => {
    const val = e.target.value;
    if (val) {
      setSelectedView('assessment');
      setSelectedId(val);
    } else {
      setSelectedView(null);
      setSelectedId(null);
    }
  };

  const handleUserChange = (e) => {
    const val = e.target.value;
    if (val) {
      setSelectedView('user');
      setSelectedId(val);
    } else {
      setSelectedView(null);
      setSelectedId(null);
    }
  };

  const toggleRow = async (resultId) => {
    if (expandedRowId === resultId) {
      setExpandedRowId(null);
      return;
    }
    setExpandedRowId(resultId);
    
    if (!resultDetailsCache[resultId]) {
      setLoadingDetailsId(resultId);
      try {
        const res = await fetch(`/api/verify/submissions/results/${resultId}`, { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
          setResultDetailsCache(prev => ({ ...prev, [resultId]: data.data }));
        }
      } catch (err) {
        toast.error('Failed to load proctoring evidence');
      } finally {
        setLoadingDetailsId(null);
      }
    }
  };

  // --- Render Functions ---

  const renderAssessmentStats = () => {
    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-purple-600" /></div>;
    if (!stats) return <div className="p-10 text-center text-gray-400">No data available</div>;

    // Apply filters
    const now = new Date();
    const filteredSubmissions = leaderboard.filter(item => {
      const name = item.display_name || item.user_name || `User ${item.user_id}`;
      if (searchTerm && !name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

      if (dateFilter !== 'all' && item.submitted_at) {
        const subDate = new Date(item.submitted_at);
        if (dateFilter === 'today') {
          if (subDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === '7days') {
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (subDate < sevenDaysAgo) return false;
        } else if (dateFilter === '30days') {
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          if (subDate < thirtyDaysAgo) return false;
        }
      }
      return true;
    });

    // Dynamically calculate metrics
    const totalAssigned = stats.metrics.total_assigned; // Keeps global context
    const filteredSubmitted = filteredSubmissions.length;
    const filteredPassed = filteredSubmissions.filter(s => s.pass_status === 'passed').length;
    const filteredMalpractice = filteredSubmissions.filter(s => s.is_malpractice).length;
    const filteredAvgScore = filteredSubmitted > 0 ? filteredSubmissions.reduce((acc, s) => acc + (s.score || 0), 0) / filteredSubmitted : 0;
    const filteredPassRate = filteredSubmitted > 0 ? (filteredPassed / filteredSubmitted) * 100 : 0;
    
    const validTimes = filteredSubmissions.filter(s => s.time_taken_seconds && s.time_taken_seconds > 0);
    const filteredAvgTime = validTimes.length > 0 ? validTimes.reduce((acc, s) => acc + s.time_taken_seconds, 0) / validTimes.length : 0;

    return (
      <div className="space-y-6 animate-fade-in-up">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Users size={16} className="text-purple-400" />
              <p className="text-xs font-medium text-gray-500">Total Assigned</p>
            </div>
            <p className="text-3xl font-bold text-gray-800">{totalAssigned}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-purple-400" />
              <p className="text-xs font-medium text-gray-500">Submitted (Filtered)</p>
            </div>
            <p className="text-3xl font-bold text-gray-800">{filteredSubmitted}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Award size={16} className="text-emerald-500" />
              <p className="text-xs font-medium text-gray-500">Passed (Filtered)</p>
            </div>
            <p className="text-3xl font-bold text-emerald-600">{filteredPassed}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert size={16} className="text-rose-500" />
              <p className="text-xs font-medium text-gray-500">Flagged (Filtered)</p>
            </div>
            <p className="text-3xl font-bold text-rose-600">{filteredMalpractice}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Averages (Filtered)</h4>
            <div className="space-y-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Pass Rate</p>
                <span className="text-3xl font-bold text-gray-800">{filteredPassRate.toFixed(1)}%</span>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Average Score</p>
                <span className="text-3xl font-bold text-purple-600">{filteredAvgScore.toFixed(1)}%</span>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Average Time</p>
                <div className="flex items-center gap-2">
                  <Clock size={20} className="text-gray-400" />
                  <span className="text-2xl font-bold text-gray-800">{Math.floor(filteredAvgTime / 60)}m {Math.floor(filteredAvgTime % 60)}s</span>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                <BarChart3 size={14} className="text-purple-600" /> Assessment Submissions
              </h4>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input 
                  type="text" 
                  placeholder="Search candidate..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 w-full sm:w-48 outline-none"
                />
                <select 
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 outline-none"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                </select>
              </div>
            </div>

            {filteredSubmissions.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-gray-400 italic">No submissions match your filters</div>
            ) : (
              <div className="overflow-auto max-h-[500px]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3">Candidate</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Passed?</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-center">Flagged</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredSubmissions.map(item => (
                      <React.Fragment key={item.id}>
                        <tr 
                          onClick={() => toggleRow(item.id)}
                          className={`cursor-pointer hover:bg-gray-50 transition-colors ${expandedRowId === item.id ? 'bg-gray-50' : ''}`}
                        >
                          <td className="px-4 py-3 font-medium text-gray-800">{item.display_name || item.user_name || `User ${item.user_id}`}</td>
                          <td className="px-4 py-3 font-bold text-purple-600">{item.score != null ? `${Math.round(item.score)}%` : '—'}</td>
                          <td className="px-4 py-3">
                            {item.pass_status === 'passed' ? <span className="text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">Yes</span> : 
                             item.pass_status === 'failed' ? <span className="text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded">No</span> : 
                             <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-500">{item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : '—'}</td>
                          <td className="px-4 py-3 text-center">
                            {item.is_malpractice ? <ShieldAlert size={16} className="text-rose-500 inline" /> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button className="text-gray-400 hover:text-purple-600">
                              {expandedRowId === item.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                          </td>
                        </tr>
                        
                        {/* Expanded Evidence Panel */}
                        {expandedRowId === item.id && (
                          <tr>
                            <td colSpan="6" className="p-0 border-b-2 border-purple-100">
                              <div className="bg-purple-50/50 p-6 shadow-inner">
                                {loadingDetailsId === item.id ? (
                                  <div className="flex justify-center p-4"><Loader2 className="animate-spin text-purple-600" /></div>
                                ) : (
                                  renderEvidencePanel(resultDetailsCache[item.id])
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderUserHistory = () => {
    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-purple-600" /></div>;
    if (!userHistory || userHistory.length === 0) return <div className="p-10 text-center text-gray-400 border border-dashed border-gray-300 rounded-xl">No test history available for this user.</div>;

    // Calculate user aggregates
    const totalTaken = userHistory.length;
    const passed = userHistory.filter(h => h.pass_status === 'passed').length;
    const avgScore = userHistory.reduce((acc, h) => acc + (h.score || 0), 0) / totalTaken;
    const totalFlags = userHistory.filter(h => h.is_malpractice).length;

    return (
      <div className="space-y-6 animate-fade-in-up">
        {/* User Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-1">Assessments Taken</p>
            <p className="text-2xl font-bold text-gray-800">{totalTaken}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-1">Average Score</p>
            <p className="text-2xl font-bold text-purple-600">{avgScore.toFixed(1)}%</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-1">Pass Rate</p>
            <p className="text-2xl font-bold text-emerald-600">{((passed/totalTaken)*100).toFixed(1)}%</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-1">Malpractice Flags</p>
            <p className="text-2xl font-bold text-rose-600">{totalFlags}</p>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[680px]">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Assessment</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Passed?</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-center">Flagged</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {userHistory.map(item => (
                <React.Fragment key={item.result_id}>
                  <tr 
                    onClick={() => toggleRow(item.result_id)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${expandedRowId === item.result_id ? 'bg-gray-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-800">{item.title}</td>
                    <td className="px-4 py-3 font-bold text-purple-600">{item.score != null ? `${Math.round(item.score)}%` : '—'}</td>
                    <td className="px-4 py-3">
                      {item.pass_status === 'passed' ? <span className="text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">Yes</span> : 
                       item.pass_status === 'failed' ? <span className="text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded">No</span> : 
                       <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(item.submitted_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-center">
                      {item.is_malpractice ? <ShieldAlert size={16} className="text-rose-500 inline" /> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-gray-400 hover:text-purple-600">
                        {expandedRowId === item.result_id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expanded Evidence Panel */}
                  {expandedRowId === item.result_id && (
                    <tr>
                      <td colSpan="6" className="p-0 border-b-2 border-purple-100">
                        <div className="bg-purple-50/50 p-6 shadow-inner">
                          {loadingDetailsId === item.result_id ? (
                            <div className="flex justify-center p-4"><Loader2 className="animate-spin text-purple-600" /></div>
                          ) : (
                            renderEvidencePanel(resultDetailsCache[item.result_id])
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

    const renderEvidencePanel = (details) => {
    if (!details) return <div className="text-rose-500 text-sm">Failed to load details</div>;
    
    // Parse candidate answers
    let answersObj = {};
    let scoresObj = {};
    try { answersObj = typeof details.answers === 'string' ? JSON.parse(details.answers) : (details.answers || {}); } catch(e) {}
    try { scoresObj = typeof details.scores_per_question === 'string' ? JSON.parse(details.scores_per_question) : (details.scores_per_question || {}); } catch(e) {}
    
    const questions = details.assessment?.questions || [];
    
    // Proctoring Data
    const flags = details.flags || [];
    const hasProctoring = flags.length > 0 || details.is_malpractice;
    
    const screenshots = flags.filter(f => f.flag_type === 'screenshot');
    const audioClips = flags.filter(f => f.flag_type === 'audio_snippet');
    const violations = flags.filter(f => f.flag_type !== 'screenshot' && f.flag_type !== 'audio_snippet');

    return (
      <div className="space-y-10">
        
        {/* Submissions Review (Candidate Answers) */}
        <div className="space-y-4">
          <h4 className="font-bold text-gray-800 flex items-center gap-2">
            <CheckCircle className="text-emerald-600" size={18} /> Candidate Responses
          </h4>
          
          {questions.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No question details available.</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              {questions.map(q => (
                <AnswerBlock 
                  key={q.id} 
                  question={q} 
                  answer={answersObj[q.id]} 
                  scoreObj={scoresObj[q.id]} 
                />
              ))}
            </div>
          )}
        </div>

        {/* Proctoring Evidence */}
        <div className="space-y-4 border-t border-purple-100 pt-6">
          <h4 className="font-bold text-gray-800 flex items-center gap-2">
            <ShieldAlert className="text-purple-600" size={18} /> Proctoring Evidence Report
          </h4>
          
          {!hasProctoring ? (
            <div className="text-center py-6 bg-white rounded-xl border border-emerald-100">
              <Award size={32} className="text-emerald-400 mx-auto mb-2" />
              <p className="text-gray-600 text-sm font-medium">Clean session. No proctoring events recorded.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Violation Log */}
              <div className="lg:col-span-1 bg-white rounded-xl border border-rose-100 shadow-sm p-4">
                <h5 className="text-xs font-semibold text-rose-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} /> Violation Log
                </h5>
                {violations.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No direct violations flagged.</p>
                ) : (
                  <ul className="space-y-3">
                    {violations.map(v => {
                      let data = {};
                      try { data = typeof v.details === 'string' ? JSON.parse(v.details) : (v.details || {}); } catch(e) {}
                      const eventName = data.violation || data.details || v.flag_type;
                      const timeStr = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date(v.created_at).toLocaleTimeString();
                      return (
                        <li key={v.id} className="text-sm p-2 bg-rose-50 rounded-lg border border-rose-100">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-rose-800 uppercase text-xs">{eventName.replace(/_/g, ' ')}</span>
                          </div>
                          <p className="text-xs text-rose-600">{timeStr}</p>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {/* Media Evidence */}
              <div className="lg:col-span-2 space-y-4">
                {/* Screenshots */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                  <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ImageIcon size={14} /> Screen Captures
                  </h5>
                  {screenshots.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No screenshots available.</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {screenshots.map(s => {
                        let src = '';
                        try {
                          const data = typeof s.details === 'string' ? JSON.parse(s.details) : s.details;
                          src = data.image || data;
                        } catch(e) {}
                        return (
                          <div 
                            key={s.id} 
                            className="aspect-video bg-gray-900 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all group relative"
                            onClick={() => setLightboxImage({ src, type: 'Screenshot', time: s.created_at })}
                          >
                            <img src={src} alt="Snapshot" className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Audio Snippets */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                  <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Play size={14} /> Audio Recordings
                  </h5>
                  {audioClips.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No audio recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {audioClips.map(a => {
                        let src = '';
                        try {
                          const data = typeof a.details === 'string' ? JSON.parse(a.details) : a.details;
                          src = data.audio || data;
                        } catch(e) {}
                        return (
                          <div key={a.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-100">
                            <audio controls src={src} className="h-8 w-full max-w-sm" />
                            <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(a.created_at).toLocaleTimeString()}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 w-full">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Search by Assessment</label>
          <select 
            value={selectedView === 'assessment' ? selectedId || '' : ''}
            onChange={handleAssessmentChange}
            className="w-full border-gray-300 rounded-xl shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm"
          >
            <option value="">-- Select Assessment --</option>
            {assessmentsList.map(a => (
              <option key={a.id} value={a.id}>{a.title} ({a.status})</option>
            ))}
          </select>
        </div>
        
        <div className="hidden md:block text-gray-300 font-bold">OR</div>
        
        <div className="flex-1 w-full">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Search by Test Giver</label>
          <select 
            value={selectedView === 'user' ? selectedId || '' : ''}
            onChange={handleUserChange}
            className="w-full border-gray-300 rounded-xl shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm"
          >
            <option value="">-- Select Candidate/Employee --</option>
            {usersList.map(u => (
              <option key={u.id} value={u.id}>{u.name || u.email || u.username} ({u.role})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {!selectedView && (
        <div className="flex flex-col items-center justify-center p-20 text-center border border-dashed border-gray-300 rounded-2xl bg-gray-50">
          <BarChart3 size={48} className="text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-700">Reports Overview</h3>
          <p className="text-gray-500 max-w-sm mt-2 text-sm">Select an assessment to view overall performance metrics, or select a specific user to review their testing history and proctoring evidence.</p>
        </div>
      )}

      {selectedView === 'assessment' && renderAssessmentStats()}
      {selectedView === 'user' && renderUserHistory()}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" {...lightboxOverlayHandlers}>
          <div className="max-w-5xl w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <img src={lightboxImage.src} alt="Evidence" className="max-h-[85vh] object-contain rounded-lg shadow-2xl border border-gray-800" />
            <div className="mt-4 flex justify-between w-full max-w-lg text-white font-medium">
              <span>{lightboxImage.type}</span>
              <span>{new Date(lightboxImage.time).toLocaleString()}</span>
            </div>
            <button 
              className="mt-6 px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"
              onClick={() => setLightboxImage(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
