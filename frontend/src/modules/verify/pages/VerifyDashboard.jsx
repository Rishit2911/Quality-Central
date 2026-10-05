import React, { useState } from 'react';
import { Shield, Activity, CheckCircle, LayoutDashboard, User, FileText, TrendingUp, Award, MessageSquare } from 'lucide-react';
import { useAuth } from '../../../core/auth/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

import ManageAssessments from './ManageAssessments';
import AssessmentBuilder from './AssessmentBuilder';
import AssessmentTaker from './AssessmentTaker';
import ResultScreen from './ResultScreen';
import AssessmentAnalytics from './AssessmentAnalytics';
import CandidateDashboard from './CandidateDashboard';
import QuestionBank from './QuestionBank';
import LiveMonitor from './LiveMonitor';
import AssessmentDashboard from './AssessmentDashboard';
import ProctoringSettings from './ProctoringSettings';
import AssessmentQueries from './AssessmentQueries';

import "../../../styles/light-theme-override.css";
import logo from "../../../assets/phy360.png";
import ewandzLogo from "../../../assets/EWANDZ.png";
import bellIcon from "../../../assets/bell.png";
import logoutIcon from "../../../assets/exit.png";
import { getHubTabs } from "../../../core/navigation/hubTabs";
import { useNotifications } from '../../../core/context/NotificationContext';
import { P } from '../../../core/permissions';
import { getInitials } from '../../../core/utils/nameHelpers';

export default function VerifyDashboard() {
  const { user, hasPermission, hasRole, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { setShowNotifications } = useNotifications();
  const params = new URLSearchParams(location.search);
  
  // PBAC capability checks
  const canViewAssessments   = hasPermission(P.VERIFY_ASSESS_VIEW);
  const canManageAssessments = hasPermission(P.VERIFY_ASSESS_MANAGE);
  const canViewQuestions     = hasPermission(P.VERIFY_QUESTIONS_VIEW);
  const canViewResults       = hasPermission(P.VERIFY_RESULTS_VIEW);
  const canViewMonitoring    = hasPermission(P.VERIFY_MONITORING_VIEW);
  const canManageQueries     = hasPermission(P.VERIFY_QUERIES_MANAGE) || canManageAssessments || canViewAssessments || canViewResults;

  // Management view is available to any user with at least one verify permission
  const isManagementAvailable = canViewAssessments || canManageAssessments || canViewQuestions || canViewResults || canViewMonitoring || canManageQueries;

  // Default to candidate if management view is not available
  const tab = params.get('tab') || (isManagementAvailable ? 'dashboard' : 'candidate');

  const [verifyView, setVerifyView] = useState(isManagementAvailable ? 'management' : 'personal');

  const setTab = (t) => navigate(`/verify?tab=${t}`);
  const displayName = user?.name || user?.email?.split('@')[0] || "User";

  const appModules = getHubTabs({ hasPermission, hasRole });

  // Role label for display only — uses user.role string, not PBAC (intentional)
  const getRoleDisplay = () => {
    if (verifyView === 'personal') return 'Candidate';
    const r = user?.role?.toLowerCase();
    if (r === 'super_admin' || r === 'superadmin') return 'Super Admin';
    if (r === 'org_admin') return 'Organization Admin';
    if (r === 'manager') return 'Manager';
    return 'Employee';
  };

  const renderContent = () => {
    if (verifyView === 'personal') {
      if (tab === 'take') return <AssessmentTaker />;
      if (tab === 'result') return <ResultScreen />;
      if (tab === 'my-assessments') return <CandidateDashboard activeTab="assessments" />;
      if (tab === 'history') return <CandidateDashboard activeTab="history" />;
      if (tab === 'queries') return <CandidateDashboard activeTab="queries" />;
      if (tab === 'performance' || tab === 'analytics') return <CandidateDashboard activeTab="analytics" />;
      return <CandidateDashboard activeTab="overview" />;
    }

    switch (tab) {
      case 'dashboard': return <AssessmentDashboard />;
      case 'manage': return <ManageAssessments />;
      case 'builder': return <AssessmentBuilder />;
      case 'take': return <AssessmentTaker />;
      case 'result': return <ResultScreen />;
      case 'analytics': return <AssessmentAnalytics assessmentId={params.get('id')} />;
      case 'bank': return <QuestionBank />;
      case 'live': return <LiveMonitor />;
      case 'candidate': return <CandidateDashboard activeTab="overview" />;
      case 'my-assessments': return <CandidateDashboard activeTab="assessments" />;
      case 'history': return <CandidateDashboard activeTab="history" />;
      case 'proctoring': return <ProctoringSettings />;
      case 'queries': return <AssessmentQueries />;
      default: return isManagementAvailable ? <ManageAssessments /> : <CandidateDashboard activeTab="overview" />;
    }
  };

  // Show header only for management dashboard/manage tabs — personal view has its own built-in header
  const showHeader = verifyView === 'management' && (tab === 'dashboard' || tab === 'manage');

  // ── KPI Cards for Header (Admin) ──
  const [headerStats, setHeaderStats] = React.useState({ total: 0, active: 0, submissions: 0 });
  const [loadingStats, setLoadingStats] = React.useState(true);

  React.useEffect(() => {
    if (isManagementAvailable && verifyView === 'management' && showHeader) {
      const fetchHeaderStats = async () => {
        try {
          const promises = [];
          if (canViewAssessments || canManageAssessments) {
            promises.push(fetch('/api/verify/builder/assessments', { credentials: 'include' }).then(r => r.json()));
          } else {
            promises.push(Promise.resolve({ data: [] }));
          }
          if (canManageAssessments) {
            promises.push(fetch('/api/verify/submissions/recent', { credentials: 'include' }).then(r => r.json()));
          } else {
            promises.push(Promise.resolve({ data: [] }));
          }
          const [assessments, submissions] = await Promise.all(promises);
          setHeaderStats({
            total: (assessments.data || []).length,
            active: (assessments.data || []).filter(a => a.status?.toLowerCase() === 'active').length,
            submissions: (submissions.data || []).length
          });
        } catch { /* silent */ }
        finally { setLoadingStats(false); }
      };
      fetchHeaderStats();
    }
  }, [isManagementAvailable, verifyView, showHeader]);


  if (tab === 'take') {
    return (
      <div className="w-full min-h-screen bg-gray-50 p-4 md:p-8 light-theme-override">
        {renderContent()}
      </div>
    );
  }

  return (
    <div className="dashboard-page light-theme-override" style={{ backgroundColor: '#FFFFFF' }}>
      {/* TOPBAR - UNCHANGED */}
      <div className="topbar">
        <div className="top-left">
          <img src={logo} className="logo" alt="logo" />
        </div>
        <div className="top-center">
          <div className="hub-tabs">
            {appModules.map((m) => (
              <button
                key={m.id}
                className={`hub-tab ${location.pathname.startsWith(m.path) ? "active" : ""}`}
                onClick={() => navigate(m.path)}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
        <div className="top-right">
          <img 
            src={bellIcon} 
            className="icon cursor-pointer" 
            alt="bell" 
            onClick={() => setShowNotifications(true)}
          />
          <img
            src={logoutIcon}
            className="icon logout-icon"
            alt="logout"
            onClick={() => { logout(); navigate('/'); }}
          />
          <div className="profile-wrap">
            <div className="avatar">
              {user?.photo_path ? (
                <img src={`/api/employee/${user.employee_code}/document/pfp`} alt="" />
              ) : (
                getInitials(displayName)
              )}
            </div>
            <div className="profile-text">
              <h4>{displayName}</h4>
              <p>{getRoleDisplay()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="dashboard-body">
        {/* SIDEBAR */}
        <div className="sidebar">
          {isManagementAvailable && (
            <div className="w-full flex bg-[#f3f0ff] p-1 rounded-xl border border-[#ebe4ff] mb-6">
              <button
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  verifyView === 'management'
                    ? '!bg-black !text-white shadow-md'
                    : 'text-black/60 hover:bg-white'
                }`}
                onClick={() => { setVerifyView('management'); setTab('dashboard'); }}
              >
                <Shield size={14} className="inline mr-1" /> Admin
              </button>
              <button
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  verifyView === 'personal'
                    ? '!bg-black !text-white shadow-md'
                    : 'text-black/60 hover:bg-white'
                }`}
                onClick={() => { setVerifyView('personal'); setTab('candidate'); }}
              >
                <User size={14} className="inline mr-1" /> Personal
              </button>
            </div>
          )}

          {verifyView === 'management' && isManagementAvailable && (
            <>
              {canViewAssessments && (
                <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>
                  Dashboard
                </button>
              )}
              {canViewAssessments && (
                <button className={tab === 'manage' ? 'active' : ''} onClick={() => setTab('manage')}>Manage</button>
              )}
              {canManageAssessments && (
                <button className={tab === 'builder' ? 'active' : ''} onClick={() => setTab('builder')}>Create Assessment</button>
              )}
              {canViewQuestions && (
                <button className={tab === 'bank' ? 'active' : ''} onClick={() => setTab('bank')}>Question Bank</button>
              )}
              {canViewResults && (
                <button className={tab === 'analytics' ? 'active' : ''} onClick={() => setTab('analytics')}>Analytics</button>
              )}
              {canViewMonitoring && (
                <button className={tab === 'live' ? 'active' : ''} onClick={() => setTab('live')}>Live Monitor</button>
              )}
              {canManageAssessments && (
                <button className={tab === 'proctoring' ? 'active' : ''} onClick={() => setTab('proctoring')}>
                  <Shield size={13} className="inline mr-1.5" />Proctoring
                </button>
              )}
              {canManageQueries && (
                <button className={tab === 'queries' ? 'active' : ''} onClick={() => setTab('queries')}>
                  <MessageSquare size={13} className="inline mr-1.5" />Queries
                </button>
              )}
            </>
          )}

          {verifyView === 'personal' && (
            <>
              <button
                className={tab === 'candidate' || tab === 'dashboard' ? 'active' : ''}
                onClick={() => setTab('candidate')}
              >
                <LayoutDashboard size={14} className="inline mr-2" /> Overview
              </button>
              <button
                className={tab === 'my-assessments' ? 'active' : ''}
                onClick={() => setTab('my-assessments')}
              >
                <FileText size={14} className="inline mr-2" /> My Assessments
              </button>
              <button
                className={tab === 'history' ? 'active' : ''}
                onClick={() => setTab('history')}
              >
                <TrendingUp size={14} className="inline mr-2" /> History & Results
              </button>
              <button
                className={tab === 'queries' ? 'active' : ''}
                onClick={() => setTab('queries')}
              >
                <MessageSquare size={14} className="inline mr-2" /> My Queries
              </button>
            </>
          )}
          <div className="sidebar-brand">
            <img src={ewandzLogo} alt="Ewandz" />
          </div>
        </div>
        
        {/* CONTENT */}
        <div className="content" style={{ backgroundColor: '#FFFFFF', padding: '24px' }}>
          <div className="flex flex-col gap-6">
            {/* Header - Only shows for Manage and Candidate tabs */}
            {showHeader && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#7c3aed] mb-3">
                  {verifyView === 'management' ? 'ASSESSMENT CENTRAL' : 'CANDIDATE PORTAL'}
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                      {verifyView === 'management' 
                        ? (tab === 'dashboard' ? 'Dashboard' : 'Skills Assessment') 
                        : (tab === 'history' ? 'Assessment History & Results' : tab === 'my-assessments' ? 'My Assessments' : 'Candidate Portal')}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                      {verifyView === 'management'
                        ? (tab === 'dashboard' 
                            ? 'Overview of all assessment activities and performance metrics'
                            : 'Create, manage, and evaluate skills assessments for candidates and employees.')
                        : (tab === 'history'
                            ? 'Review past scores, completion dates, and detailed analysis.'
                            : tab === 'my-assessments'
                              ? 'Start, resume, or view your assigned skill assessments.'
                              : 'Welcome to your assessment hub. Track assignments, deadlines, and results.')
                      }
                    </p>
                  </div>
                  {verifyView === 'management' && canManageAssessments && tab !== 'dashboard' && (
                    <button 
                      onClick={() => setTab('builder')}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors duration-150 shadow-sm"
                    >
                      <Shield size={16} /> New Assessment
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Main Content */}
            <div className="animate-fade-in-up transition-all delay-200">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
