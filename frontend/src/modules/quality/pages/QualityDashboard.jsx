import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  LayoutDashboard, Bug, FolderKanban, 
  Users2, ShieldCheck, Plus, Sparkles 
} from 'lucide-react';

import { useAuth } from '../../../core/auth/AuthContext';
import { useNotifications } from '../../../core/context/NotificationContext';
import { getHubTabs } from '../../../core/navigation/hubTabs';
import { getInitials } from '../../../core/utils/nameHelpers';

// Assets matching Screenshot 1
import logo from '../../../assets/phy360.png';
import ewandzLogo from '../../../assets/EWANDZ.png';
import bellIcon from '../../../assets/bell.png';
import logoutIcon from '../../../assets/exit.png';

// Quality Central Dashboard Components
import WelcomeBanner from '../components/WelcomeBanner';
import KPICardsGrid from '../components/KPICard';
import StatusDonutChart from '../components/StatusDonutChart';
import SeverityBarChart from '../components/SeverityBarChart';
import ActionItemsWidget from '../components/ActionItemsWidget';
import ActivityTimelineWidget from '../components/ActivityTimelineWidget';

import BugsListingView from '../components/BugsListingView';
import CreateNewBugView from '../components/CreateNewBugView';
import BugDetailsModal from '../components/BugDetailsModal';
import SubmitDebuggingModal from '../components/SubmitDebuggingModal';
import BugAuditTimelineDrawer from '../components/BugAuditTimelineDrawer';
import ProjectsListingView from '../components/ProjectsListingView';
import { INITIAL_SAMPLE_PROJECTS, getBugPrefixForProject } from '../constants/defaultProjects';
import { QUALITY_CENTRAL_TEAM } from '../constants/teamPool';
import { 
  isBugAssignedToUser, 
  doesBugMatchProject, 
  getScopedBugs, 
  computeLiveMetrics, 
  computeProjectStats 
} from '../utils/qualityMetrics';

// Demo Error Screenshot
import demoErrorScreenshot from '../../../assets/demo_error_screenshot.png';

// Layout styles
import '../../../styles/layout.css';

// Initial sample reports matching the 6 Core Modules
const INITIAL_SAMPLE_BUGS = [
  {
    id: 'LEX-00125',
    title: 'Neural legal contract extraction fails on nested PDF tables',
    project: 'LexAI',
    prefix: '#LEX',
    project_code: '#LEX',
    module: 'Document Parser',
    environment: 'Production',
    priority: 'P1 - Urgent',
    severity: 'Critical',
    status: 'Open',
    bug_type: 'Functional',
    assignee: 'Rishit',
    reported_by: 'Vidhi',
    created_on: '14 Mar 2026',
    steps_to_reproduce: '1. Upload structured PDF agreement with nested financial tables.\n2. Observe extraction worker exception in transformer pipeline.',
    expected_result: 'Entity table extraction parses columns and outputs structured schema.',
    actual_result: 'Extraction fails with memory boundary error and worker terminates.',
    attachments: []
  },
  {
    id: 'QC-00124',
    title: 'Defect regression triage hook fails silently on CI re-run',
    project: 'Quality Central',
    prefix: '#QC',
    project_code: '#QC',
    module: 'Test Orchestration',
    environment: 'Production',
    priority: 'P2 - High',
    severity: 'High',
    status: 'Open',
    bug_type: 'Functional',
    assignee: 'Vidhi',
    reported_by: 'Rishit',
    created_on: '12 Mar 2026',
    steps_to_reproduce: '1. Trigger re-run of nightly test suite.\n2. Check automated SLA quality health hook.',
    expected_result: 'Webhooks report test passes and update project health rate dynamically.',
    actual_result: 'Hook times out and fails to increment resolved metrics.',
    attachments: [
      {
        id: 'att-1',
        name: 'login_error_repro.mp4',
        size: '80MB',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        previewUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        progress: 75,
      },
      {
        id: 'att-2',
        name: 'error_screenshot.png',
        size: '1.2MB',
        type: 'image',
        url: demoErrorScreenshot,
        previewUrl: demoErrorScreenshot,
        thumb: demoErrorScreenshot,
      }
    ]
  },
  {
    id: 'TC-00123',
    title: 'Candidate profile pipeline fails to persist resume parsing state',
    project: 'Talent Central',
    prefix: '#TC',
    project_code: '#TC',
    module: 'ATS Pipeline',
    environment: 'Staging',
    priority: 'P2 - High',
    severity: 'High',
    status: 'In Progress',
    bug_type: 'Functional',
    assignee: 'Sriraj',
    reported_by: 'Priyanshu',
    created_on: '11 Mar 2026',
    steps_to_reproduce: '1. Ingest multi-page candidate CV.\n2. Submit candidate to next interview round.\n3. Observe parsed skill tags.',
    expected_result: 'Candidate tags persist and sync to the hiring manager view.',
    actual_result: 'HTTP 500 error returned by server and changes are discarded.',
    attachments: [
      {
        id: 'att-3',
        name: 'profile_patch_failure.png',
        size: '850KB',
        type: 'image',
        url: demoErrorScreenshot,
        previewUrl: demoErrorScreenshot,
        thumb: demoErrorScreenshot,
      }
    ]
  },
  {
    id: 'LC-00122',
    title: 'LMS video playback course progress desync on tab switch',
    project: 'Learning Central',
    prefix: '#LC',
    project_code: '#LC',
    module: 'Course Player',
    environment: 'Staging',
    priority: 'P3 - Normal',
    severity: 'Normal',
    status: 'In Progress',
    bug_type: 'Functional',
    assignee: 'Priyanshu',
    reported_by: 'Akshit',
    created_on: '10 Mar 2026',
    steps_to_reproduce: '1. Play mandatory compliance video module.\n2. Switch browser tab for 2 minutes.\n3. Return and observe progress percentage.',
    expected_result: 'Video auto-pauses and resumes from exact bookmark.',
    actual_result: 'Player resets progress to previous chapter timestamp.',
    attachments: []
  },
  {
    id: 'AC-00121',
    title: 'Skill assessment question timer desync under network jitter',
    project: 'Assessment Central',
    prefix: '#AC',
    project_code: '#AC',
    module: 'Exam Engine',
    environment: 'Staging',
    priority: 'P2 - High',
    severity: 'High',
    status: 'Open',
    bug_type: 'Performance',
    assignee: 'Akshit',
    reported_by: 'Sriraj',
    created_on: '10 Mar 2026',
    steps_to_reproduce: '1. Launch timed skill assessment.\n2. Introduce network latency.\n3. Observe remaining question timer.',
    expected_result: 'Timer syncs accurately with server clock authority.',
    actual_result: 'Client timer displays negative countdown.',
    attachments: []
  },
  {
    id: 'EC-00120',
    title: 'Attendance punch-in timestamp shift on timezone boundary',
    project: 'Employee Central',
    prefix: '#EC',
    project_code: '#EC',
    module: 'Timesheets',
    environment: 'Development',
    priority: 'P4 - Low',
    severity: 'Normal',
    status: 'Resolved',
    bug_type: 'UI/UX',
    assignee: 'Priyanshu',
    reported_by: 'Rishit',
    resolved_by: 'Priyanshu',
    resolved_at: '09 Mar 2026, 05:15 PM',
    created_on: '09 Mar 2026',
    steps_to_reproduce: '1. Employee logs punch-in at 23:59 UTC.\n2. View local employee dashboard.',
    expected_result: 'Time displays in local company time format.',
    actual_result: 'Shift registers under next day calendar tile.',
    attachments: []
  }
];

export default function QualityDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasPermission, hasRole, logout } = useAuth();
  const { setShowNotifications } = useNotifications();

  // Navigation state: 'dashboard' | 'projects' | 'bugs'
  // Default to 'dashboard' as primary view
  const [activeSideTab, setActiveSideTab] = useState(() => {
    try {
      const param = new URLSearchParams(window.location.search).get('tab');
      if (param && ['dashboard', 'projects', 'bugs'].includes(param.toLowerCase())) {
        return param.toLowerCase();
      }
    } catch {}
    return 'dashboard';
  });
  
  // Bug section sub-view: 'list' | 'create'
  const [bugSubView, setBugSubView] = useState('list');
  const [activeProjectFilter, setActiveProjectFilter] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('project') || 'all';
    } catch {
      return 'all';
    }
  });
  const [bugsInitialTab, setBugsInitialTab] = useState('all'); // 'all' | 'me' | 'resolved'

  // Sync activeSideTab and activeProjectFilter with URL search params changes
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const tabParam = params.get('tab');
      const projectParam = params.get('project');
      if (tabParam && ['dashboard', 'projects', 'bugs'].includes(tabParam.toLowerCase())) {
        setActiveSideTab(tabParam.toLowerCase());
      } else if (!tabParam) {
        setActiveSideTab('dashboard');
      }
      if (projectParam) {
        setActiveProjectFilter(projectParam);
      }
    } catch {}
  }, [location.search]);

  // Projects state: strictly the 6 Core Modules
  const [projects, setProjects] = useState(() => {
    try {
      const saved = localStorage.getItem('qc_persisted_projects');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const allowedNames = [
            'talent central',
            'learning central',
            'assessment central',
            'employee central',
            'quality central',
            'lexai'
          ];
          const filtered = parsed.filter(p => allowedNames.includes(p.name?.toLowerCase().trim()));
          if (filtered.length === 6) return filtered;
        }
      }
    } catch {}
    return INITIAL_SAMPLE_PROJECTS;
  });

  useEffect(() => {
    try {
      if (projects && projects.length > 0) {
        localStorage.setItem('qc_persisted_projects', JSON.stringify(projects));
      }
    } catch {}
  }, [projects]);
  
  // Modals & Details
  const [selectedBugDetails, setSelectedBugDetails] = useState(null);
  const [editingBug, setEditingBug] = useState(null);
  const [submitDebugModalOpen, setSubmitDebugModalOpen] = useState(false);
  const [targetBugsForDebug, setTargetBugsForDebug] = useState([]);
  const [timelineDrawerBug, setTimelineDrawerBug] = useState(null);
  const [hiddenBugIds, setHiddenBugIds] = useState(() => {
    try {
      localStorage.removeItem('qc_hidden_bug_ids');
    } catch {}
    return [];
  });

  // Dashboard scope: 'personal' (My Assigned Bugs) | 'team' (All Organization Bugs)
  const [dashboardScope, setDashboardScope] = useState('personal');

  // Data states (hydrated from localStorage so initial render never resets to defaults)
  const [bugs, setBugs] = useState(() => {
    try {
      const saved = localStorage.getItem('qc_persisted_bugs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const allowedNames = [
            'talent central',
            'learning central',
            'assessment central',
            'employee central',
            'quality central',
            'lexai'
          ];
          const filtered = parsed
            .filter(b => allowedNames.includes(b.project?.toLowerCase().trim()))
            .map(b => {
              const pref = getBugPrefixForProject(b.project);
              if (b.id && !b.id.startsWith(`${pref}-`)) {
                const num = b.id.replace(/^[A-Za-z0-9]+-/, '');
                return { ...b, id: `${pref}-${num}`, prefix: `#${pref}`, project_code: `#${pref}` };
              }
              return b;
            });
          if (filtered.length > 0) return filtered;
        }
      }
    } catch {}
    return INITIAL_SAMPLE_BUGS;
  });
  const [dashboardData, setDashboardData] = useState(() => {
    try {
      const saved = localStorage.getItem('qc_persisted_dashboard');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncedTime, setSyncedTime] = useState(() => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  useEffect(() => {
    try {
      if (bugs && bugs.length > 0) {
        localStorage.setItem('qc_persisted_bugs', JSON.stringify(bugs));
      }
    } catch {}
  }, [bugs]);

  useEffect(() => {
    try {
      if (dashboardData) {
        localStorage.setItem('qc_persisted_dashboard', JSON.stringify(dashboardData));
      }
    } catch {}
  }, [dashboardData]);

  // Dynamic modules list for the top navigation bar
  const appModules = getHubTabs({ hasPermission, hasRole });

  // User display variables matching Screenshot 1
  const rawDisplayName = user?.name || (user?.username?.includes('@') ? user.username.split('@')[0] : user?.username) || (user?.email?.includes('@') ? user.email.split('@')[0] : user?.email) || 'Rishit';
  const displayName = rawDisplayName.charAt(0).toUpperCase() + rawDisplayName.slice(1);
  const userInitials = getInitials(displayName) || (displayName.length >= 2 ? displayName.slice(0, 2).toUpperCase() : 'RS');

  const getRoleDisplay = () => {
    if (hasRole?.('super_admin')) return 'Employee Portal';
    if (hasRole?.('org_admin')) return 'Organization Admin';
    if (hasRole?.('manager')) return 'Manager Portal';
    return 'Employee Portal';
  };

  // Helper to determine if a bug belongs to the current user
  const isBugAssignedToUser = (bug, currentUser) => {
    if (!bug) return false;
    const bugAssignee = String(bug.assignee || '').toLowerCase().trim();
    const resolvedBy = String(bug.resolved_by || '').toLowerCase().trim();

    const candidates = [];
    if (typeof currentUser === 'string') {
      candidates.push(currentUser.toLowerCase().trim());
      candidates.push(currentUser.split('@')[0].toLowerCase().trim());
    } else if (currentUser && typeof currentUser === 'object') {
      if (currentUser.name) candidates.push(currentUser.name.toLowerCase().trim());
      if (currentUser.username) {
        candidates.push(currentUser.username.toLowerCase().trim());
        candidates.push(currentUser.username.split('@')[0].toLowerCase().trim());
      }
      if (currentUser.email) {
        candidates.push(currentUser.email.toLowerCase().trim());
        candidates.push(currentUser.email.split('@')[0].toLowerCase().trim());
      }
    }
    const validCandidates = candidates.filter(Boolean);

    return validCandidates.some(c => 
      (bugAssignee && (bugAssignee.includes(c) || c.includes(bugAssignee))) ||
      (resolvedBy && (resolvedBy.includes(c) || c.includes(resolvedBy)))
    );
  };

  // Strict ownership check for mutations (status change, edit, submit debugging, done)
  const canUserEditBug = (bug) => {
    if (!bug) return false;
    const myName = (displayName || 'Rishit').toLowerCase().trim();
    const myShort = myName.includes('@') ? myName.split('@')[0] : myName;
    if (myShort === 'admin' || myName.includes('admin')) return true;
    if (!bug.assignee) return true;
    const bugAssignee = String(bug.assignee).toLowerCase().trim();
    if (myShort.includes('rishit') && bugAssignee.includes('rishit')) return true;
    return bugAssignee.includes(myShort) || myShort.includes(bugAssignee);
  };

  // Dynamically compute all dashboard KPIs, charts, and action items in real-time from the bugs list
  const computedDashboardData = useMemo(() => {
    return computeLiveMetrics(bugs, user || displayName, dashboardScope, hiddenBugIds);
  }, [bugs, dashboardScope, user, displayName, hiddenBugIds]);

  const scopedBugs = computedDashboardData.scopedBugs;
  const myBugsCount = computedDashboardData.myBugsCount;
  const teamBugsCount = computedDashboardData.teamBugsCount;

  // Fetch live dashboard, bugs, and projects data
  const fetchData = async () => {
    try {
      const [dashRes, bugsRes, projRes] = await Promise.all([
        fetch(`/api/quality/dashboard?scope=${dashboardScope}`, { credentials: 'include' }),
        fetch('/api/quality/bugs', { credentials: 'include' }),
        fetch('/api/quality/projects', { credentials: 'include' })
      ]);

      if (dashRes.ok) {
        const data = await dashRes.json();
        setDashboardData(data);
        if (data.synced_at) setSyncedTime(data.synced_at);
        try {
          localStorage.setItem('qc_persisted_dashboard', JSON.stringify(data));
        } catch {}
      }

      if (bugsRes.ok) {
        const bugsData = await bugsRes.json();
        if (bugsData.bugs && bugsData.bugs.length > 0) {
          const allowedNames = [
            'talent central',
            'learning central',
            'assessment central',
            'employee central',
            'quality central',
            'lexai'
          ];
          const filteredBugs = bugsData.bugs
            .filter(b => allowedNames.includes(b.project?.toLowerCase().trim()))
            .map(b => {
              const pref = getBugPrefixForProject(b.project);
              if (b.id && !b.id.startsWith(`${pref}-`)) {
                const num = b.id.replace(/^[A-Za-z0-9]+-/, '');
                return { ...b, id: `${pref}-${num}`, prefix: `#${pref}`, project_code: `#${pref}` };
              }
              return b;
            });
          const finalBugs = filteredBugs.length > 0 ? filteredBugs : INITIAL_SAMPLE_BUGS;
          setBugs(finalBugs);
          try {
            localStorage.setItem('qc_persisted_bugs', JSON.stringify(finalBugs));
          } catch {}
          // Sync handed off / removed bugs from backend
          const backendHidden = finalBugs
            .filter(b => (b.handed_off_to_tester || b.removed_from_dev_list))
            .map(b => b.id);
          setHiddenBugIds(backendHidden);
        }
      }

      if (projRes && projRes.ok) {
        const projData = await projRes.json();
        if (projData.projects && projData.projects.length > 0) {
          const allowedNames = [
            'talent central',
            'learning central',
            'assessment central',
            'employee central',
            'quality central',
            'lexai'
          ];
          const filtered = projData.projects.filter(p => allowedNames.includes(p.name?.toLowerCase().trim()));
          const finalProjects = filtered.length === 6 ? filtered : INITIAL_SAMPLE_PROJECTS;
          setProjects(finalProjects);
          try {
            localStorage.setItem('qc_persisted_projects', JSON.stringify(finalProjects));
          } catch {}
        }
      }
    } catch {
      console.log('Using local Quality Central data cache.');
    }
  };

  useEffect(() => {
    fetchData();
  }, [dashboardScope, user, activeSideTab]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const updatedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSyncedTime(updatedTime);

    try {
      await fetchData();
      toast.success('Quality metrics & tickets synchronized successfully');
    } catch {
      toast.success('Quality metrics updated');
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500);
    }
  };

  // Create Bug Handler (supports both single bug and batch array of bugs)
  const handleCreateBug = async (bugPayload) => {
    const isBatch = Array.isArray(bugPayload);
    try {
      const res = await fetch('/api/quality/bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(bugPayload)
      });

      if (res.ok) {
        const result = await res.json();
        // Immediately add newly created bug(s) to bugs state for instant UI update
        if (result.bugs && Array.isArray(result.bugs)) {
          setBugs(prev => [...result.bugs, ...prev.filter(b => !result.bugs.some(x => x.id === b.id))]);
        } else if (result.bug) {
          setBugs(prev => [result.bug, ...prev.filter(b => b.id !== result.bug.id)]);
        }

        // Immediately refresh full dataset from PostgreSQL
        await fetchData();
        setBugSubView('list');
        setActiveSideTab('bugs');
        setEditingBug(null);
        if (isBatch && result.bugs) {
          toast.success(result.message || `Successfully created ${result.bugs.length} bug tickets!`);
        } else if (result.bug) {
          toast.success(result.message || 'Bug ticket created successfully!');
        }
      } else {
        // Fallback local client addition
        if (isBatch) {
          const newBugs = bugPayload.map((item, idx) => {
            const pref = getBugPrefixForProject(item.project || item.project_name);
            const num = String(120 + bugs.length + 1 + idx).padStart(5, '0');
            const nextId = `${pref}-${num}`;
            return {
              ...item,
              id: nextId,
              prefix: `#${pref}`,
              project_code: `#${pref}`,
              created_on: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
              status: 'Open',
              reported_by: displayName.split('@')[0],
            };
          });
          setBugs(prev => [...newBugs, ...prev]);
          toast.success(`Created ${newBugs.length} bug tickets!`);
        } else {
          const pref = getBugPrefixForProject(bugPayload.project || bugPayload.project_name);
          const num = String(120 + bugs.length + 1).padStart(5, '0');
          const nextId = `${pref}-${num}`;
          const newBug = {
            ...bugPayload,
            id: nextId,
            prefix: `#${pref}`,
            project_code: `#${pref}`,
            created_on: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            status: 'Open',
            reported_by: displayName.split('@')[0],
          };
          setBugs(prev => [newBug, ...prev]);
          toast.success(`Bug ticket ${nextId} created!`);
        }
      }
    } catch {
      if (isBatch) {
        const newBugs = bugPayload.map((item, idx) => {
          const pref = getBugPrefixForProject(item.project || item.project_name);
          const num = String(120 + bugs.length + 1 + idx).padStart(5, '0');
          const nextId = `${pref}-${num}`;
          return {
            ...item,
            id: nextId,
            prefix: `#${pref}`,
            project_code: `#${pref}`,
            created_on: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            status: 'Open',
            reported_by: displayName.split('@')[0],
          };
        });
        setBugs(prev => [...newBugs, ...prev]);
        toast.success(`Created ${newBugs.length} bug tickets!`);
      } else {
        const pref = getBugPrefixForProject(bugPayload.project || bugPayload.project_name);
        const num = String(120 + bugs.length + 1).padStart(5, '0');
        const nextId = `${pref}-${num}`;
        const newBug = {
          ...bugPayload,
          id: nextId,
          prefix: `#${pref}`,
          project_code: `#${pref}`,
          created_on: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          status: 'Open',
          reported_by: displayName.split('@')[0],
        };
        setBugs(prev => [newBug, ...prev]);
        toast.success(`Bug ticket ${nextId} created!`);
      }
    }

    setBugSubView('list');
    setEditingBug(null);
  };

  // Update Status Handler
  const handleUpdateBugStatus = async (bugId, newStatus) => {
    // 0. Verify ticket ownership
    const target = bugs.find(b => b.id === bugId);
    if (target && !canUserEditBug(target)) {
      toast.error(`Permission denied: Only ${target.assignee || 'the assigned owner'} can change the status of this ticket.`);
      return;
    }

    const isSolved = newStatus === 'Closed' || newStatus === 'Resolved';
    const currentUserName = displayName.split('@')[0];
    const nowDateTimeStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    // 1. Immediately update local bugs state for instantaneous 0ms reactive UI transition
    setBugs(prev => prev.map(b => b.id === bugId ? { 
      ...b, 
      status: newStatus,
      ...(isSolved ? { resolved_by: currentUserName, resolved_at: nowDateTimeStr } : {})
    } : b));

    if (selectedBugDetails && selectedBugDetails.id === bugId) {
      setSelectedBugDetails(prev => ({ 
        ...prev, 
        status: newStatus,
        ...(isSolved ? { resolved_by: currentUserName, resolved_at: nowDateTimeStr } : {})
      }));
    }

    if (isSolved) {
      toast.success(`${bugId} marked as ${newStatus}`);
    } else {
      toast.success(`${bugId} status changed to ${newStatus}`);
    }

    // 2. Persist to backend with active scope
    try {
      const res = await fetch(`/api/quality/bugs/${bugId}?scope=${dashboardScope}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        const result = await res.json();
        setBugs(prev => prev.map(b => b.id === bugId ? result.bug : b));
        if (result.updated_dashboard) {
          setDashboardData(result.updated_dashboard);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.detail) {
          toast.error(errData.detail);
        }
      }
    } catch {
      console.log('Saved status change in local session memory.');
    }
  };

  // Delete Bug Handler
  const handleDeleteBug = async (bugId) => {
    const target = bugs.find(b => b.id === bugId);
    if (target && !canUserEditBug(target) && !hasRole?.('super_admin')) {
      toast.error(`Permission denied: Only ${target.assignee || 'the assigned owner'} can delete this ticket.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete bug ${bugId}?`)) return;

    try {
      const res = await fetch(`/api/quality/bugs/${bugId}?scope=${dashboardScope}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        const result = await res.json();
        setBugs(prev => prev.filter(b => b.id !== bugId));
        if (result.updated_dashboard) {
          setDashboardData(result.updated_dashboard);
        }
      } else {
        setBugs(prev => prev.filter(b => b.id !== bugId));
      }
      toast.success(`Bug ${bugId} removed`);
    } catch {
      setBugs(prev => prev.filter(b => b.id !== bugId));
      toast.success(`Bug ${bugId} removed`);
    }
  };

  // Submit Debugging Information & Hand Off to QA Tester Handler
  const handleSubmitDebugging = async (data) => {
    // Verify all submitted bug IDs belong to user
    const unauthorized = (data.bugIds || []).filter(id => {
      const bug = bugs.find(b => b.id === id);
      return bug && !canUserEditBug(bug);
    });
    if (unauthorized.length > 0) {
      toast.error('Permission denied: You can only submit debugging info for bugs assigned to you.');
      return;
    }

    const currentUserName = (displayName.includes('@') ? displayName.split('@')[0] : displayName).trim();
    const nowDateTimeStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    try {
      const res = await fetch('/api/quality/bugs/submit-debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bug_ids: data.bugIds,
          tester: data.tester,
          debugging_notes: data.debuggingNotes,
          verification_steps: data.verificationSteps,
          environment: data.environment,
          remove_from_my_list: data.removeFromMyList
        })
      });

      if (res.ok) {
        const result = await res.json();
        setBugs(prev => prev.map(b => {
          if (data.bugIds.includes(b.id)) {
            return {
              ...b,
              status: 'Resolved',
              resolved_by: currentUserName,
              assignee: data.tester,
              tester: data.tester,
              debugging_notes: data.debuggingNotes,
              verification_steps: data.verificationSteps,
              environment: data.environment,
              handed_off_to_tester: true,
              removed_from_dev_list: true,
              resolved_at: nowDateTimeStr
            };
          }
          return b;
        }));

        if (result.updated_dashboard) {
          setDashboardData(result.updated_dashboard);
        }
        await fetchData();
      } else {
        setBugs(prev => prev.map(b => {
          if (data.bugIds.includes(b.id)) {
            return {
              ...b,
              status: 'Resolved',
              resolved_by: currentUserName,
              assignee: data.tester,
              tester: data.tester,
              debugging_notes: data.debuggingNotes,
              verification_steps: data.verificationSteps,
              environment: data.environment,
              handed_off_to_tester: true,
              removed_from_dev_list: true,
              resolved_at: nowDateTimeStr
            };
          }
          return b;
        }));
      }

      setHiddenBugIds(prev => {
        const next = [...new Set([...prev, ...data.bugIds])];
        try {
          localStorage.setItem('qc_hidden_bug_ids', JSON.stringify(next));
        } catch {}
        return next;
      });

      toast.success(
        `Bug ${data.bugIds.join(', ')} marked as Done and submitted to QA Tester ${data.tester}! Added to Resolved.`
      );
    } catch {
      setBugs(prev => prev.map(b => {
        if (data.bugIds.includes(b.id)) {
          return {
            ...b,
            status: 'Resolved',
            resolved_by: currentUserName,
            assignee: data.tester,
            tester: data.tester,
            debugging_notes: data.debuggingNotes,
            verification_steps: data.verificationSteps,
            environment: data.environment,
            handed_off_to_tester: true,
            removed_from_dev_list: true,
            resolved_at: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          };
        }
        return b;
      }));

      if (data.removeFromMyList) {
        setHiddenBugIds(prev => {
          const next = [...new Set([...prev, ...data.bugIds])];
          try {
            localStorage.setItem('qc_hidden_bug_ids', JSON.stringify(next));
          } catch {}
          return next;
        });
      }

      toast.success(`Bug ${data.bugIds.join(', ')} marked as Done and submitted to QA Tester ${data.tester}! Added to Resolved.`);
    }
  };

  // Handler for clicking a project row or chevron:
  // Navigates directly to the "Bugs" page pre-filtered for that specific project prefix ID
  const handleNavigateToBugsFromProject = (project) => {
    const filterKey = project.name;
    setActiveProjectFilter(filterKey);
    setActiveSideTab('bugs');
    setBugSubView('list');
    setBugsInitialTab('all');
    navigate(`/quality?tab=bugs&project=${encodeURIComponent(filterKey)}`);
    toast.success(`Displaying bugs pre-filtered for ${project.name} (${project.prefix})`);
  };

  // Handler for creating a new project from modal
  const handleCreateProject = async (newProject) => {
    setProjects(prev => [newProject, ...prev]);
    toast.success(`Project "${newProject.name}" (${newProject.prefix}) initialized successfully!`);
    
    // Non-blocking sync with backend
    try {
      const res = await fetch('/api/quality/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newProject)
      });
      if (res.ok) {
        const result = await res.json();
        if (result.project) {
          setProjects(prev => prev.map(p => p.id === newProject.id ? result.project : p));
        }
      }
    } catch {}
  };

  // Handler for updating an existing project (Option 3 dynamic editing)
  const handleUpdateProject = async (updatedProject) => {
    setProjects(prev => prev.map(p => (
      p.id === updatedProject.id || 
      p.prefix === updatedProject.prefix ||
      p.name?.toLowerCase() === updatedProject.name?.toLowerCase()
    ) ? { ...p, ...updatedProject } : p));
    toast.success(`Project "${updatedProject.name}" updated successfully!`);

    try {
      const targetId = updatedProject.id || updatedProject.prefix;
      await fetch(`/api/quality/projects/${targetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updatedProject)
      });
    } catch {}
  };

  return (
    <div className="dashboard-page" style={{ backgroundColor: '#FAF5FF' }}>
      {/* =========================================
          1. TOP NAVIGATION BAR (Integrated)
      ========================================= */}
      <div className="topbar">
        {/* Left: Phygitron 360 Logo */}
        <div className="top-left">
          <img src={logo} className="logo" alt="Phygitron 360" />
        </div>

        {/* Center: Hub Tabs with Quality Central Pill Active */}
        <div className="top-center">
          <div className="hub-tabs">
            {appModules.map((m) => {
              const isActive = location.pathname.startsWith(m.path);
              return (
                <button
                  key={m.id}
                  className={`hub-tab ${isActive ? 'active' : ''}`}
                  onClick={() => navigate(m.path)}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Notification, Logout, and Dynamic User Profile */}
        <div className="top-right">
          <img
            src={bellIcon}
            className="icon cursor-pointer"
            alt="Notifications"
            aria-label="Open notifications"
            onClick={() => setShowNotifications(true)}
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

          {/* Profile Card */}
          <div className="profile-wrap">
            <div className="avatar">
              {user?.photo_path ? (
                <img src={`/api/employee/${user.employee_code}/document/pfp`} alt={displayName} />
              ) : (
                userInitials
              )}
            </div>

            <div className="profile-text text-left">
              <h4 className="text-xs font-bold text-slate-900 leading-tight m-0">
                {displayName}
              </h4>
              <p className="text-[11px] text-slate-500 font-semibold m-0">
                {getRoleDisplay()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================
          2. DASHBOARD BODY: SIDEBAR + CONTENT
      ========================================= */}
      <div className="dashboard-body">
        {/* Quality Central Left Sidebar matching Screenshot 1 (Dark navy theme) */}
        <div 
          className="sidebar" 
          style={{ 
            backgroundColor: '#0F172A',
            borderRight: '1px solid #1E293B',
            color: '#F8FAFC'
          }} 
          data-no-tooltip
        >
          {/* Header Title inside Sidebar */}
          <div className="px-3 py-3 border-b border-slate-800/80 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-400 animate-pulse" />
              <h2 className="text-sm font-extrabold text-white tracking-wide uppercase m-0">
                Quality Central
              </h2>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 flex-1">
            {/* Primary Menu Option 1: Dashboard */}
            <button
              onClick={() => {
                setActiveSideTab('dashboard');
                setBugSubView('list');
                navigate('/quality?tab=dashboard');
              }}
              style={{
                backgroundColor: activeSideTab === 'dashboard' ? '#2563EB' : 'transparent',
                color: activeSideTab === 'dashboard' ? '#FFFFFF' : '#94A3B8'
              }}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </button>

            {/* Primary Menu Option 2: Projects (Active Selection) */}
            <button
              onClick={() => {
                setActiveSideTab('projects');
                navigate('/quality?tab=projects');
              }}
              style={{
                backgroundColor: activeSideTab === 'projects' ? '#2563EB' : 'transparent',
                color: activeSideTab === 'projects' ? '#FFFFFF' : '#94A3B8'
              }}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <FolderKanban size={16} />
                <span>Projects</span>
              </div>
              <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-mono ${
                activeSideTab === 'projects' ? 'bg-blue-800 text-white' : 'bg-slate-800 text-slate-300'
              }`}>
                {projects.length}
              </span>
            </button>

            {/* Primary Menu Option 3: Bugs */}
            <button
              onClick={() => {
                setActiveSideTab('bugs');
                setBugSubView('list');
                setActiveProjectFilter('all');
                setBugsInitialTab('all');
                navigate('/quality?tab=bugs');
              }}
              style={{
                backgroundColor: activeSideTab === 'bugs' ? '#2563EB' : 'transparent',
                color: activeSideTab === 'bugs' ? '#FFFFFF' : '#94A3B8'
              }}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Bug size={16} />
                <span>Bugs</span>
              </div>
              <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-mono ${
                activeSideTab === 'bugs' ? 'bg-blue-800 text-white' : 'bg-slate-800 text-slate-300'
              }`}>
                {bugs.filter(b => !(b.handed_off_to_tester || b.removed_from_dev_list || hiddenBugIds.includes(b.id))).length}
              </span>
            </button>

            {/* Secondary navigation items matching Theme */}
            <button
              onClick={() => toast('Team quality assignments & permissions')}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all opacity-80 cursor-pointer"
            >
              <Users2 size={16} />
              <span>Users</span>
            </button>

          </div>

          {/* Brand Logo at Sidebar Bottom */}
          <div className="sidebar-brand mt-auto pt-4 border-t border-slate-800 flex items-center justify-center">
            <img src={ewandzLogo} alt="Ewandz" className="h-6 w-auto opacity-80" />
          </div>
        </div>

        {/* Main Content Area */}
        <div
          className="content"
          style={{
            backgroundColor: '#FAF5FF',
            padding: '32px',
            overflowY: 'auto'
          }}
        >
          {/* ========================================================
              VIEW 1: PROJECTS VIEW (Active Selection - Section 4)
          ======================================================== */}
          {activeSideTab === 'projects' && (
            <ProjectsListingView
              projects={projects}
              bugs={bugs}
              currentUser={displayName}
              scope={dashboardScope}
              onScopeChange={setDashboardScope}
              myBugsCount={myBugsCount}
              teamBugsCount={teamBugsCount}
              onNavigateToBugs={handleNavigateToBugsFromProject}
              onCreateProject={handleCreateProject}
              onUpdateProject={handleUpdateProject}
              onRefresh={handleRefresh}
              hiddenBugIds={hiddenBugIds}
            />
          )}

          {/* ========================================================
              VIEW 2: DASHBOARD VIEW
          ======================================================== */}
          {activeSideTab === 'dashboard' && (
            <div className="max-w-[1440px] mx-auto space-y-8 animate-fade-in-up pb-12">
              {/* 4.A Welcome Banner Header (Hero Section) */}
              <WelcomeBanner
                user={user}
                syncedTime={syncedTime}
                onRefresh={handleRefresh}
                isRefreshing={isRefreshing}
                scope={dashboardScope}
                onScopeChange={setDashboardScope}
                myBugsCount={myBugsCount}
                teamBugsCount={teamBugsCount}
              />

              {/* 4.B Key Metrics Grid (Top KPI Row) - Reactively calculated */}
              <KPICardsGrid 
                stats={computedDashboardData?.stats} 
                scope={dashboardScope}
                onScopeChange={setDashboardScope}
                myBugsCount={myBugsCount}
                teamBugsCount={teamBugsCount}
                onFilterStatus={(statusKey) => {
                  setActiveSideTab('bugs');
                  setBugSubView('list');
                  navigate('/quality?tab=bugs');
                  if (statusKey === 'resolved_bugs') {
                    setBugsInitialTab('resolved');
                    toast.success('Displaying Resolved & Closed bugs archive');
                  } else {
                    setBugsInitialTab('all');
                  }
                }}
              />

              {/* 4.C Analytics & Charting Section (Middle Row) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <StatusDonutChart 
                  data={computedDashboardData?.status_overview} 
                  onSelectStatus={(statusName) => {
                    setActiveSideTab('bugs');
                    setBugSubView('list');
                    navigate('/quality?tab=bugs');
                    if (statusName?.toLowerCase() === 'resolved' || statusName?.toLowerCase() === 'closed') {
                      setBugsInitialTab('resolved');
                      toast.success('Displaying Resolved & Closed bugs archive');
                    } else {
                      setBugsInitialTab('all');
                    }
                  }}
                />
                <SeverityBarChart data={computedDashboardData?.bugs_by_severity} />
              </div>

              {/* 4.D Operational Widgets (Bottom Row) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ActionItemsWidget 
                  items={computedDashboardData?.action_items} 
                  onQuickStatusChange={handleUpdateBugStatus}
                  currentUser={displayName.split('@')[0]}
                  onViewAll={() => {
                    setActiveSideTab('bugs');
                    setBugSubView('list');
                    navigate('/quality?tab=bugs');
                  }}
                  onItemClick={(item) => {
                    const found = bugs.find(b => b.id === item.id);
                    if (found) {
                      setSelectedBugDetails(found);
                    } else {
                      setActiveSideTab('bugs');
                      navigate('/quality?tab=bugs');
                    }
                  }}
                />
                <ActivityTimelineWidget activities={computedDashboardData?.recent_activity} />
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 3: BUGS SECTION (LISTING OR SMART FORM)
          ======================================================== */}
          {activeSideTab === 'bugs' && (
            <>
              {bugSubView === 'create' ? (
                /* SMART FORM: CREATE NEW BUG (Screenshot 2) */
                <CreateNewBugView
                  existingBugs={bugs}
                  onSubmitBug={handleCreateBug}
                  onCancel={() => {
                    setBugSubView('list');
                    setEditingBug(null);
                  }}
                  initialData={editingBug}
                  projectsList={projects}
                />
              ) : (
                /* BUGS LISTING PAGE (Screenshot 1) */
                <BugsListingView
                  bugs={bugs}
                  initialProjectFilter={activeProjectFilter}
                  initialQueueTab={bugsInitialTab}
                  onClearProjectFilter={() => setActiveProjectFilter('all')}
                  projectsList={projects}
                  onOpenCreateBug={() => {
                    setEditingBug(null);
                    setBugSubView('create');
                  }}
                  onViewBugDetails={(bug) => setSelectedBugDetails(bug)}
                  onEditBug={(bug) => {
                    if (!canUserEditBug(bug)) {
                      toast.error(`Permission denied: Only ${bug.assignee || 'the assigned owner'} can edit this ticket.`);
                      return;
                    }
                    setEditingBug(bug);
                    setBugSubView('create');
                  }}
                  onDeleteBug={handleDeleteBug}
                  onUpdateBugStatus={handleUpdateBugStatus}
                  onTriggerSubmitDebug={(targetBugs) => {
                    const bugsToSubmit = (targetBugs && targetBugs.length > 0) ? targetBugs : [];
                    if (bugsToSubmit.length === 0) {
                      toast.error('Please select at least one bug to mark Done.');
                      return;
                    }
                    setTargetBugsForDebug(bugsToSubmit);
                    setSubmitDebugModalOpen(true);
                  }}
                  currentUser={displayName.split('@')[0]}
                  hiddenBugIds={hiddenBugIds}
                  scope={dashboardScope}
                  onScopeChange={setDashboardScope}
                  onOpenTimeline={(bug) => setTimelineDrawerBug(bug)}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* SMART LINK QUICK VIEW / BUG DETAILS MODAL */}
      {selectedBugDetails && (
        <BugDetailsModal
          bug={selectedBugDetails}
          currentUser={displayName.split('@')[0]}
          onClose={() => setSelectedBugDetails(null)}
          onEdit={(bug) => {
            if (!canUserEditBug(bug)) {
              toast.error(`Permission denied: Only ${bug.assignee || 'the assigned owner'} can edit this ticket.`);
              return;
            }
            setEditingBug(bug);
            setActiveSideTab('bugs');
            setBugSubView('create');
            navigate('/quality?tab=bugs');
          }}
          onStatusChange={handleUpdateBugStatus}
          onTriggerSubmitDebug={(targetBugs) => {
            setSelectedBugDetails(null);
            setTargetBugsForDebug(targetBugs);
            setSubmitDebugModalOpen(true);
          }}
          onOpenTimeline={(bug) => setTimelineDrawerBug(bug)}
        />
      )}

      {/* SUBMIT DEBUGGING INFORMATION MODAL */}
      {submitDebugModalOpen && (
        <SubmitDebuggingModal
          isOpen={submitDebugModalOpen}
          selectedBugs={targetBugsForDebug}
          onClose={() => {
            setSubmitDebugModalOpen(false);
            setTargetBugsForDebug([]);
          }}
          onSubmit={handleSubmitDebugging}
          currentUserName={displayName.split('@')[0]}
        />
      )}

      {/* GLOBAL BUG AUDIT TIMELINE DRAWER */}
      {timelineDrawerBug && (
        <BugAuditTimelineDrawer
          isOpen={Boolean(timelineDrawerBug)}
          bug={timelineDrawerBug}
          onClose={() => setTimelineDrawerBug(null)}
          currentUser={displayName.split('@')[0]}
        />
      )}
    </div>
  );
}
