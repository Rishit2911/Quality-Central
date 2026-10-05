import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Users, CheckCircle, Clock, TrendingUp, Award,
  BarChart3, Activity, Zap, Star, AlertCircle, ArrowUpRight,
  Calendar, Shield, Loader2, RefreshCw, BookOpen, UserCheck,
  PieChart as PieChartIcon, Target
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import HorizontalLoader from '../../../core/components/HorizontalLoader';
import { useAuth } from '../../../core/auth/AuthContext';
import { P } from '../../../core/permissions';

export default function AssessmentDashboard() {
  const navigate = useNavigate();
  const { user, hasPermission, hasRole } = useAuth();
  const canViewAssessments = hasPermission(P.VERIFY_ASSESS_VIEW);
  const canManageAssessments = hasPermission(P.VERIFY_ASSESS_MANAGE);
  // isAdmin: true when user has any view/manage permission (org_admin/manager have these seeded)
  const isAdmin = canViewAssessments || canManageAssessments;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_assessments: 0,
    active_assessments: 0,
    total_submissions: 0,
    pending_review: 0,
    avg_score: 0,
    pass_rate: 0,
    recent_activity: []
  });

  // ── Candidate-specific stats ──
  const [candidateStats, setCandidateStats] = useState({
    assigned: 0,
    pending: 0,
    completed: 0,
    avg_score: 0,
    passed: 0
  });

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        // Fetch assessments - this endpoint works
        const assessmentsRes = await fetch('/api/verify/builder/assessments', { credentials: 'include' });
        const assessmentsData = await assessmentsRes.json();
        const assessments = assessmentsData.data || [];

        // For submissions, we need to fetch stats for each assessment or use a different endpoint
        // Since /api/verify/submissions/recent doesn't exist, we'll use what we have
        // Try to get submissions from individual assessments or use fallback data
        
        let totalSubmissions = 0;
        let totalPassed = 0;
        let pendingReview = 0;
        let recentActivity = [];

        // Try to fetch stats for each assessment to get submission counts
        const statsPromises = assessments.map(async (a) => {
          try {
            const res = await fetch(`/api/verify/builder/assessments/${a.id}/stats`, { credentials: 'include' });
            if (res.ok) {
              const data = await res.json();
              if (data.success && data.data) {
                return { id: a.id, stats: data.data };
              }
            }
            return null;
          } catch {
            return null;
          }
        });

        const statsResults = await Promise.all(statsPromises);
        const validStats = statsResults.filter(s => s !== null);

        // Aggregate stats
        validStats.forEach(({ stats: s }) => {
          if (s.metrics) {
            totalSubmissions += s.metrics.total_submitted || 0;
            totalPassed += s.metrics.total_passed || 0;
            pendingReview += (s.metrics.total_submitted || 0) - (s.metrics.total_passed || 0);
          }
        });

        // Try to get recent activity from assignments
        if (canManageAssessments) {
          try {
            const assignmentsRes = await fetch('/api/verify/assignments/recent', { credentials: 'include' });
            if (assignmentsRes.ok) {
              const assignmentsData = await assignmentsRes.json();
              recentActivity = (assignmentsData.data || []).slice(0, 5);
            }
          } catch {
            // Fallback - use empty array
          }
        }

        const active = assessments.filter(a => a.status?.toLowerCase() === 'active');
        const passRate = totalSubmissions > 0 ? (totalPassed / totalSubmissions) * 100 : 0;

        setStats({
          total_assessments: assessments.length,
          active_assessments: active.length,
          total_submissions: totalSubmissions,
          pending_review: pendingReview,
          avg_score: 0, // Will be calculated from individual stats if needed
          pass_rate: passRate,
          recent_activity: recentActivity
        });
      } else {
        // Candidate view - fetch assignments and results
        const [assignmentsRes, resultsRes] = await Promise.all([
          fetch('/api/verify/assignments/my-tests', { credentials: 'include' }),
          fetch('/api/verify/submissions/my-results', { credentials: 'include' })
        ]);

        const assignmentsData = await assignmentsRes.json();
        const resultsData = await resultsRes.json();

        const assignments = assignmentsData.data || [];
        const results = resultsData.data || [];

        const completed = results.length;
        const assigned = assignments.length;
        const pending = Math.max(0, assigned - completed);

        let totalScore = 0;
        let passed = 0;

        results.forEach(r => {
          totalScore += r.score || 0;
          if (r.status === 'passed' || (r.score >= (r.passing_score || 70))) {
            passed++;
          }
        });

        setCandidateStats({
          assigned,
          pending,
          completed,
          avg_score: completed > 0 ? totalScore / completed : 0,
          passed
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast.error('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, canManageAssessments]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <HorizontalLoader />
        <p className="text-gray-500 mt-4 text-sm font-medium animate-pulse">Loading dashboard...</p>
      </div>
    );
  }

  // ── Admin / Manager View ──
  if (isAdmin) {
    const adminCards = [
      {
        label: 'Total Assessments',
        value: stats.total_assessments,
        icon: BookOpen,
        color: 'purple',
        borderColor: 'border-t-purple-600',
        bgColor: 'bg-purple-50',
        iconColor: 'text-purple-600',
        onClick: () => navigate('/verify?tab=manage'),
        subtitle: 'All created assessments'
      },
      {
        label: 'Submissions',
        value: stats.total_submissions,
        icon: Users,
        color: 'amber',
        borderColor: 'border-t-amber-500',
        bgColor: 'bg-amber-50',
        iconColor: 'text-amber-500',
        onClick: () => navigate('/verify?tab=manage'),
        subtitle: 'Total responses received'
      },
      {
        label: 'Pending Review',
        value: stats.pending_review,
        icon: Clock,
        color: 'emerald',
        borderColor: 'border-t-emerald-500',
        bgColor: 'bg-emerald-50',
        iconColor: 'text-emerald-500',
        onClick: () => navigate('/verify?tab=manage'),
        subtitle: 'Awaiting evaluation'
      },
      {
        label: 'Pass Rate',
        value: `${Math.round(stats.pass_rate)}%`,
        icon: Target,
        color: 'pink',
        borderColor: 'border-t-pink-500',
        bgColor: 'bg-pink-50',
        iconColor: 'text-pink-500',
        onClick: () => navigate('/verify?tab=analytics'),
        subtitle: 'Candidates who passed'
      }
    ];

    const chartData = [
      { name: 'Passed', value: Math.round((stats.pass_rate / 100) * stats.total_submissions), color: '#10b981' }, // Emerald
      { name: 'Pending/Failed', value: stats.total_submissions - Math.round((stats.pass_rate / 100) * stats.total_submissions), color: '#f59e0b' } // Amber
    ];

    return (
      <div className="flex flex-col gap-6">
        {/* KPI Cards - 4 columns with icons - Purple, Amber, Green, Pink */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {adminCards.map((card, index) => (
            <div
              key={index}
              onClick={card.onClick}
              className={`bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer border-t-4 ${card.borderColor}`}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-3xl font-bold text-gray-800">{card.value}</p>
                <div className={`w-10 h-10 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                  <card.icon size={20} className={card.iconColor} />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-700">{card.label}</p>
              <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1 font-medium">
                {card.subtitle} <ArrowUpRight size={12} />
              </p>
            </div>
          ))}
        </div>

        {/* Recent Activity + Quick Actions - Horizontal Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity - Takes 2/3 */}
          <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Activity size={16} className="text-purple-600" />
                Recent Activity
              </h3>
              <button
                onClick={fetchStats}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {stats.recent_activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Clock size={32} className="mb-3 opacity-50" />
                <p className="text-sm font-medium">No recent activity</p>
                <p className="text-xs text-gray-400 mt-1">Submissions will appear here</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {stats.recent_activity.map((activity, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 bg-gray-50   border border-gray-100">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      activity.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 
                      activity.status === 'started' ? 'bg-amber-100 text-amber-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {activity.status === 'completed' ? <CheckCircle size={14} /> : 
                       activity.status === 'started' ? <Clock size={14} /> :
                       <Users size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {activity.user_name || activity.candidate_name || 'Candidate'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {activity.assessment_title || activity.title || 'Assessment'} • 
                        {activity.status === 'completed' ? ' Completed' : activity.status === 'started' ? ' In Progress' : ' Assigned'}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {activity.created_at ? new Date(activity.created_at).toLocaleDateString() : 'Today'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assessment Performance - Takes 1/3 */}
          <div className="col-span-1 bg-white rounded-xl p-6 border border-gray-100 shadow-sm flex flex-col">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
              <PieChartIcon size={16} className="text-blue-600" />
              Assessment Performance
            </h3>
            
            <div className="flex-1 flex flex-col justify-center items-center min-h-[200px]">
              {stats.total_submissions > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ color: '#374151', fontSize: '12px', fontWeight: 500 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-6 mt-4 w-full">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                      <span className="text-xs text-gray-600 font-medium">Passed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                      <span className="text-xs text-gray-600 font-medium">Pending/Failed</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400">
                  <PieChartIcon size={32} className="mb-3 opacity-30" />
                  <p className="text-sm font-medium">No Data Yet</p>
                  <p className="text-xs text-gray-400 mt-1">Waiting for submissions</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Candidate / Employee View ──
  const candidateCards = [
    {
      label: 'Assigned',
      value: candidateStats.assigned,
      icon: BookOpen,
      color: 'purple',
      borderColor: 'border-t-purple-600',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      onClick: () => navigate('/verify?tab=candidate'),
      subtitle: 'Total tests assigned'
    },
    {
      label: 'Pending',
      value: candidateStats.pending,
      icon: Clock,
      color: 'amber',
      borderColor: 'border-t-amber-500',
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-500',
      onClick: () => navigate('/verify?tab=candidate'),
      subtitle: 'Ready to take'
    },
    {
      label: 'Completed',
      value: candidateStats.completed,
      icon: CheckCircle,
      color: 'green',
      borderColor: 'border-t-emerald-500',
      bgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-500',
      onClick: () => navigate('/verify?tab=candidate'),
      subtitle: 'Submitted tests'
    },
    {
      label: 'Avg Score',
      value: `${Math.round(candidateStats.avg_score)}%`,
      icon: TrendingUp,
      color: 'pink',
      borderColor: 'border-t-pink-500',
      bgColor: 'bg-pink-50',
      iconColor: 'text-pink-500',
      onClick: () => navigate('/verify?tab=candidate'),
      subtitle: 'Your average score'
    }
  ];

  const candidateQuickActions = [
    {
      label: 'My Assessments',
      icon: FileText,
      color: 'purple',
      bg: 'bg-purple-50',
      hoverBg: 'hover:bg-purple-100',
      textColor: 'text-purple-600',
      onClick: () => navigate('/verify?tab=candidate'),
      subtitle: 'View all tests'
    },
    {
      label: 'View Results',
      icon: BarChart3,
      color: 'blue',
      bg: 'bg-blue-50',
      hoverBg: 'hover:bg-blue-100',
      textColor: 'text-blue-600',
      onClick: () => navigate('/verify?tab=candidate'),
      subtitle: 'Check scores'
    }
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Cards - 4 columns with icons - Purple, Amber, Green, Pink */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {candidateCards.map((card, index) => (
          <div
            key={index}
            onClick={card.onClick}
            className={`bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer border-t-4 ${card.borderColor}`}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-3xl font-bold text-gray-800">{card.value}</p>
              <div className={`w-10 h-10 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                <card.icon size={20} className={card.iconColor} />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-700">{card.label}</p>
            <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1 font-medium">
              {card.subtitle} <ArrowUpRight size={12} />
            </p>
          </div>
        ))}
      </div>

      {/* In Progress + Quick Actions - Horizontal Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* In Progress - Takes 2/3 */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
            <Clock size={16} className="text-amber-500" />
            In Progress
          </h3>
          {candidateStats.pending === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <CheckCircle size={32} className="text-emerald-400 mb-3" />
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs text-gray-400 mt-1">No pending assessments</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {Array.from({ length: Math.min(candidateStats.pending, 5) }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-amber-50   border border-amber-200">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Assessment #{i + 1}</p>
                    <p className="text-xs text-gray-500">Click to continue</p>
                  </div>
                  <button
                    onClick={() => navigate('/verify?tab=candidate')}
                    className="px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions - Takes 1/3 */}
        <div className="col-span-1 bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {candidateQuickActions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border border-gray-100 ${action.bg} ${action.hoverBg} transition-all hover:scale-[1.02] group`}
              >
                <div className={`w-10 h-10 rounded-lg ${action.bg} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                  <action.icon size={18} className={action.textColor} />
                </div>
                <p className="text-[10px] font-semibold text-gray-800 text-center leading-tight">{action.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}