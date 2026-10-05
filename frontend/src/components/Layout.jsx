import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Zap, Shield, Database, Send,
  Terminal, Layout as LayoutIcon,
  LogOut, Bell, Settings,
  ChevronRight, Command, Briefcase,
  Rocket, Layers, Activity, User, Globe,
  Cpu, Star, Home, Upload, Users,
  LayoutDashboard, BarChart3, Clock, Package, BookOpen,
  Bug, FolderKanban
} from 'lucide-react';

import { useAuth } from '../core/auth/AuthContext';
import OrgAdminSetupModal from '../modules/deploy/components/OrgAdminSetupModal';
import { MODULE_CONFIG } from '../core/config/modules';
import { NotificationProvider, useNotifications } from '../core/context/NotificationContext';
import ewandzLogo from '../assets/EWANDZ.png';
import useEscapeClose from '../core/hooks/useEscapeClose';

import { DEPLOY_MANAGEMENT_PERMS } from '../core/permissions/classification';
import { P } from '../core/permissions';

// ── Notification Dropdown Component ──
function NotificationDropdown() {
  const { notifications, showNotifications, setShowNotifications, markRead, markAllRead } = useNotifications();
  useEscapeClose(() => setShowNotifications(false), showNotifications);

  if (!showNotifications) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[9998]" 
        onClick={() => setShowNotifications(false)}
      />
      
      {/* Dropdown positioned under bell icon */}
      <div
        className="fixed z-[9999] bg-white rounded-2xl shadow-2xl w-[calc(100vw-2rem)] sm:w-96 max-h-[500px] overflow-hidden border border-[#ece4ff]"
        style={{
          top: '72px',
          right: '1rem',
          transformOrigin: 'top right',
        }}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#ece4ff] flex justify-between items-center bg-[#faf7ff]">
          <h3 className="text-sm font-black text-black uppercase tracking-tighter flex items-center gap-2">
            <Bell size={16} className="text-[#8b5cf6]" />
            Notifications
          </h3>
          <div className="flex gap-2">
            {notifications.length > 0 && (
              <button
                onClick={markAllRead}
                className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] hover:text-[#7c3aed] transition-colors"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={() => setShowNotifications(false)}
              className="p-1 rounded-lg hover:bg-[#f5efff] transition-colors text-[#6b7280]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#f5efff] flex items-center justify-center">
                <Bell size={20} className="text-[#b0a8c5]" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#b6b6c7]">No new notifications</p>
              <p className="text-[10px] text-[#b6b6c7] mt-1">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-[#f5efff]">
              {notifications.map((n, i) => (
                <div
                  key={n.id || i}
                  className="p-4 hover:bg-[#faf7ff] transition-colors cursor-pointer group"
                  onClick={() => markRead(n.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#8b5cf6] mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-black truncate">{n.title || 'Notification'}</p>
                      <p className="text-[11px] text-[#6b7280] mt-0.5 line-clamp-2">{n.message || n.body || 'No details'}</p>
                      <span className="text-[9px] text-[#b0a8c5] font-bold uppercase tracking-widest mt-1 block">
                        {n.created_at ? new Date(n.created_at).toLocaleDateString() : 'Just now'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main Layout Content ──
function LayoutContent({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasRole, hasPermission, refreshUser } = useAuth();
  const { setShowNotifications, notifications } = useNotifications();

  const [deployView, setDeployView] = useState('employee');

  // ✅ Detect admin dashboard (LIGHT MODE)
  const isAdminDashboard =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/deploy') ||
    location.pathname.startsWith('/source') ||
    location.pathname.startsWith('/verify') ||
    location.pathname.startsWith('/quality') ||
    location.pathname.startsWith('/lexai') ||
    location.pathname.startsWith('/superadmin');

  // ✅ Check if we're on the Forge page - hide sidebar for Learning Central
  const isForgePage = location.pathname.startsWith('/forge');

  // Dynamically determine if user should see the admin/management view for Deploy
  // based on whether they have ANY management-level permissions from the classification registry.
  const hasAdminClearance = user?.permissions && DEPLOY_MANAGEMENT_PERMS.some(p => user.permissions[p]);
  useEffect(() => {
    if (user) {
      setDeployView(hasAdminClearance ? 'admin' : 'employee');
    }
  }, [user, hasAdminClearance]);

  // ===== MODULE CONFIG =====
  const allModules = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      path: '/admin',
      icon: LayoutDashboard,
      perm: P.ADMIN_USERS_MANAGE,
      options: [
        { label: 'Overview', icon: Home, search: '', default: true },
        { label: 'Users', icon: Shield, search: '?tab=users' },
        { label: 'Analytics', icon: BarChart3, search: '?tab=stats' },
      ],
    },
    {
      id: 'source',
      name: 'Source',
      path: '/source',
      icon: Database,
      perm: 'module.source.access',
      options: [
        { label: 'Home', icon: Home, search: '?tab=home', default: true },
        { label: 'Jobs', icon: Briefcase, search: '?tab=jobs' },
        { label: 'Directory', icon: Users, search: '?tab=directory' },
        { label: 'Upload Resume', icon: Upload, search: '?tab=upload' },
      ],
    },
    {
      id: 'forge',
      name: 'Forge',
      path: '/forge',
      icon: Zap,
      perm: 'module.forge.access',
      options: [
        { label: 'Learning Home', icon: Home, search: '?tab=academy', default: true },
        { label: 'Courses', icon: Layers, search: '?tab=courses' },
        { label: 'My Learning', icon: Star, search: '?tab=my-learning' },
      ],
    },
    {
      id: 'verify',
      name: 'Verify',
      path: '/verify',
      icon: Shield,
      perm: 'module.verify.access',
      options: [
        { label: 'Assessments', icon: Home, search: '?tab=home', default: true },
        { label: 'Create Assessment', icon: Cpu, search: '?tab=builder' },
        { label: 'Results', icon: Activity, search: '?tab=results' },
      ],
    },
    {
      id: 'deploy',
      name: 'Deploy',
      path: '/deploy',
      icon: Rocket,
      perm: 'module.deploy.access',
      options:
        deployView === 'admin'
          ? [
            { label: 'Analytics', icon: LayoutDashboard, search: '?tab=dashboard', default: true },
            { label: 'Employees', icon: Users, search: '?tab=personnel' },
            { label: 'Assets', icon: Package, search: '?tab=allocations' },
          ]
          : [
            { label: 'Dashboard', icon: LayoutDashboard, search: '?tab=my-dashboard', default: true },
            { label: 'My Profile', icon: User, search: '?tab=my-profile' },
            { label: 'Attendance', icon: Clock, search: '?tab=my-attendance' },
          ],
    },
    {
      id: 'quality',
      name: 'Quality Central',
      path: '/quality',
      icon: Shield,
      perm: 'module.quality.access',
      options: [
        { label: 'Dashboard', icon: LayoutDashboard, search: '?tab=dashboard', default: true },
        { label: 'Projects', icon: FolderKanban, search: '?tab=projects' },
        { label: 'Bugs', icon: Bug, search: '?tab=bugs' },
      ],
    },
    {
      id: 'lexai',
      name: 'LexAI',
      path: '/lexai',
      icon: BookOpen,
      perm: 'module.lexai.access',
      options: [
        { label: 'Home', icon: Home, search: '?tab=home', default: true },
        { label: 'Projects', icon: Layers, search: '?tab=projects' },
        { label: 'Files', icon: Package, search: '?tab=files' },
      ],
    },
  ];

  const modules = [
    ...(hasPermission(P.ADMIN_USERS_MANAGE) ? [{
      id: 'dashboard',
      name: 'Dashboard',
      path: '/admin',
      icon: LayoutDashboard,
      options: allModules.find(m => m.id === 'dashboard').options,
    }] : []),

    ...allModules
      .filter(m => m.id !== 'dashboard' && hasPermission(m.perm))
      .map(m => ({
        id: m.id,

        name:
          m.id === 'source'
            ? 'Talent Central'
            : m.id === 'forge'
              ? 'Learning Central'
              : m.id === 'verify'
                ? 'Assessment Central'
                : m.id === 'deploy'
                  ? 'Employee Central'
                  : m.id === 'quality'
                    ? 'Quality Central'
                    : m.id === 'lexai'
                      ? 'Learning Design AI'
                      : m.name,

        path: m.path,

        icon: m.icon,

        options: m.options,
      })),
  ];

  const activeModule =
    modules.find(m => location.pathname.startsWith(m.path)) || modules[0];

  const filteredOptions = activeModule?.options || [];

  // ===================== RENDER =====================

  return (
    <div
      className={`flex h-screen w-full ${isAdminDashboard ? 'bg-white text-black' : 'bg-[#040812] text-white'
        }`}
    >
      {/* ================= DARK SIDEBARS ================= */}
      {!isAdminDashboard && !isForgePage && (
        <>
          {/* PRIMARY SIDEBAR */}
          <aside className="hidden lg:flex w-[88px] flex-col items-center py-8 bg-[#060E20] border-r border-white/5" data-no-tooltip>
            <div
              onClick={() => navigate('/')}
              className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mb-10 cursor-pointer"
            >
              <Command size={24} />
            </div>

            <nav className="flex-1 flex flex-col gap-6">
              {modules.map((m) => (
                <Link
                  key={m.id}
                  to={m.path}
                  className="w-14 h-14 flex items-center justify-center rounded-xl hover:bg-white/10"
                >
                  <m.icon size={20} />
                </Link>
              ))}
            </nav>

            <button onClick={logout} className="mt-auto mb-4" aria-label="Log out">
              <LogOut size={20} />
            </button>
            <img src={ewandzLogo} alt="Ewandz" className="w-12 h-auto" />
          </aside>

          {/* SECOND SIDEBAR */}
          <aside className="hidden lg:block w-[260px] bg-[#060E20]/60 border-r border-white/5 p-6" data-no-tooltip>
            <h2 className="text-lg font-bold mb-6">{activeModule?.name}</h2>

            {filteredOptions.map((opt, i) => (
              <div
                key={i}
                onClick={() => navigate(`${activeModule.path}${opt.search}`)}
                className="p-3 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                {opt.label}
              </div>
            ))}
          </aside>
        </>
      )}

      {/* ================= MAIN CONTENT ================= */}
      <main className={`flex-1 overflow-auto ${isForgePage ? 'w-full' : ''}`}>
        {children}
      </main>

      {/* ================= GLOBAL NOTIFICATION DROPDOWN ================= */}
      <NotificationDropdown />

      {/* ================= BACKGROUND GLOW ================= */}
      {!isAdminDashboard && (
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-purple-500/10 blur-3xl rounded-full" />
        </div>
      )}

      {/* ================= MODAL ================= */}
      {hasPermission(P.ADMIN_USERS_MANAGE) && !user?.employee_code && user?.role !== 'super_admin' && (
        <OrgAdminSetupModal user={user} onComplete={() => refreshUser()} />
      )}
    </div>
  );
}

// ── Wrapper with Provider ──
export default function Layout({ children }) {
  return (
    <NotificationProvider>
      <LayoutContent>{children}</LayoutContent>
    </NotificationProvider>
  );
}
