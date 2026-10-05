import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';
import { useNotifications } from '../../../core/context/NotificationContext';
import { getHubTabs } from '../../../core/navigation/hubTabs';
import { getInitials } from '../../../core/utils/nameHelpers';
import useTabListKeyNav from '../../../core/hooks/useTabListKeyNav';

import Dashboard from '../components/Dashboard';
import ProjectList from '../components/ProjectList';
import ProjectView from '../components/ProjectView';
import IntakeForm from '../components/IntakeForm';
import ProjectUpload from '../components/ProjectUpload';
import FolderManager from '../components/FolderManager';
import SopFormatter from '../components/SopFormatter';
import LandingPage from '../components/LandingPage';

import logo from '../../../assets/phy360.png';
import bellIcon from '../../../assets/bell.png';
import logoutIcon from '../../../assets/exit.png';

import {
  Home,
  Layers,
  FolderOpen,
  PlusCircle,
  UploadCloud,
  Sparkles,
  BookOpen,
  FileEdit,
  Globe
} from 'lucide-react';

import '../../deploy/styles/deploy.css';
import '../styles/lexai.css';

export default function LexAIDashboard() {
  const { user, hasPermission, hasRole, logout } = useAuth();
  const { setShowNotifications } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const handleTabKeyNav = useTabListKeyNav();

  const params = new URLSearchParams(location.search);
  const tab = params.get('tab') || 'home';
  const projectIdParam = params.get('id');

  const [activeProjectId, setActiveProjectId] = useState(projectIdParam);

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const appModules = getHubTabs({ hasPermission, hasRole });

  const getRoleDisplay = () => {
    if (hasRole?.('super_admin')) return 'Super Admin';
    if (hasRole?.('org_admin')) return 'Organization Admin';
    if (hasRole?.('manager')) return 'Manager';
    return 'Employee';
  };

  useEffect(() => {
    if (projectIdParam) {
      setActiveProjectId(projectIdParam);
    }
  }, [projectIdParam]);

  const setTab = (newTab) => {
    navigate(`/lexai?tab=${newTab}`);
  };

  const handleOpenProject = (id) => {
    setActiveProjectId(id);
    navigate(`/lexai?tab=editor&id=${id}`);
  };

  const handleNewProject = () => {
    navigate('/lexai?tab=intake');
  };

  const handleUploadProject = () => {
    navigate('/lexai?tab=upload');
  };

  const handleBackToProjects = () => {
    setActiveProjectId(null);
    navigate('/lexai?tab=projects');
  };

  const handleBackToDashboard = () => {
    navigate('/lexai?tab=home');
  };

  return (
    <div className="dashboard-page light-theme-override lexai-scope" style={{ backgroundColor: '#FFFFFF', minHeight: '100vh' }}>
      {/* ================= TOPBAR ================= */}
      <div className="topbar">
        <div className="top-left">
          <img src={logo} className="logo" alt="Phygitron 360" />
        </div>

        <div className="top-center">
          <div className="hub-tabs">
            {appModules.map((m) => (
              <button
                key={m.id}
                className={`hub-tab ${location.pathname.startsWith(m.path) ? 'active' : ''}`}
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
            alt="Notifications"
            aria-label="Open notifications"
            onClick={() => setShowNotifications?.(true)}
          />

          <img
            src={logoutIcon}
            className="icon logout-icon cursor-pointer"
            alt="Log out"
            aria-label="Log out"
            onClick={() => {
              logout();
              navigate('/');
            }}
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

      {/* ================= BODY ================= */}
      <div className="dashboard-body">
        {/* ================= SIDEBAR ================= */}
        <div className="sidebar" data-no-tooltip onKeyDown={handleTabKeyNav}>
          <div className="px-4 py-2 mb-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-black/50">
              <Sparkles size={14} className="text-[#9347FF]" />
              <span>Learning Design AI</span>
            </div>
          </div>

          <button
            className={tab === 'home' ? 'active' : ''}
            onClick={() => setTab('home')}
          >
            <Home size={16} /> Home
          </button>

          <button
            className={tab === 'projects' || tab === 'editor' ? 'active' : ''}
            onClick={() => setTab('projects')}
          >
            <Layers size={16} /> Projects
          </button>

          <button
            className={tab === 'files' ? 'active' : ''}
            onClick={() => setTab('files')}
          >
            <FolderOpen size={16} /> Files & Assets
          </button>

          <button
            className={tab === 'sop' ? 'active' : ''}
            onClick={() => setTab('sop')}
          >
            <FileEdit size={16} /> SOP Formatter
          </button>
        </div>

        {/* ================= MAIN CONTENT ================= */}
        <div className="main-content flex-1 overflow-y-auto bg-white p-6">
          {tab === 'home' && (
            <Dashboard
              onNewProject={handleNewProject}
              onUploadProject={handleUploadProject}
            />
          )}

          {tab === 'showcase' && (
            <div className="rounded-2xl overflow-hidden border border-slate-200">
              <LandingPage
                onGetStarted={handleNewProject}
                onSignIn={handleBackToDashboard}
              />
            </div>
          )}

          {tab === 'projects' && (
            <ProjectList
              onUploadProject={handleUploadProject}
              onNewProject={handleNewProject}
              onOpenProject={handleOpenProject}
            />
          )}

          {tab === 'files' && (
            <div className="w-full max-w-6xl mx-auto p-4">
              <FolderManager mode="manage" />
            </div>
          )}

          {tab === 'intake' && (
            <IntakeForm
              onBack={handleBackToDashboard}
              onComplete={handleOpenProject}
            />
          )}

          {tab === 'upload' && (
            <ProjectUpload
              onBack={handleBackToDashboard}
              onComplete={handleOpenProject}
            />
          )}

          {tab === 'sop' && (
            <SopFormatter />
          )}

          {tab === 'editor' && activeProjectId && (
            <ProjectView
              projectId={activeProjectId}
              onBack={handleBackToProjects}
            />
          )}
        </div>
      </div>
    </div>
  );
}
