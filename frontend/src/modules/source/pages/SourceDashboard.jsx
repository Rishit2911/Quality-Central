import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Search, Upload, Trash2, MapPin, Zap, Database, Shield,
  CheckSquare, Loader2, Download, X, AlertTriangle, Mail,
  ArrowUpRight, Plus, Send, Star, Filter, Users, ChevronDown,
  RefreshCw, Briefcase, Clock, CheckCircle, UserCheck,
  TrendingUp, PieChart, Activity, Edit, XCircle, UserPlus,
  FileText, Award, User, Calendar, Building, MapPin as MapPinIcon,
  Briefcase as BriefcaseIcon, Mail as MailIcon, Phone, ExternalLink,
  ChevronRight, BarChart, Users as UsersIcon, CheckCircle as CheckCircleIcon,
  Clock as ClockIcon, XCircle as XCircleIcon, AlertCircle,
  Archive, Pause, Play, Folder, Tag, Check, FileSpreadsheet
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';
import CandidateDrawer from './CandidateDrawer';
import OfferApprovals from './OfferApprovals';
import ActiveCandidates from './ActiveCandidates';
import InviteStatus from './InviteStatus';
import ResumeRepo from './ResumeRepo';
import CandidateReportModal from '../components/CandidateReportModal';
import RoleDetailsModal from '../components/RoleDetailsModal';

import "../../../styles/light-theme-override.css";
import logo from "../../../assets/phy360.png";
import ewandzLogo from "../../../assets/EWANDZ.png";
import bellIcon from "../../../assets/bell.png";
import logoutIcon from "../../../assets/exit.png";
import { getHubTabs } from "../../../core/navigation/hubTabs";
import {
  MAX_FILE_SIZE,
  isNonNegativeNumber,
  validateFile,
} from '../../../core/utils/validators';

// ── Import Notification Context ──
import { useNotifications } from '../../../core/context/NotificationContext';
import useEscapeClose from '../../../core/hooks/useEscapeClose';
import useTabListKeyNav from '../../../core/hooks/useTabListKeyNav';
import { P } from '../../../core/permissions';
import { getInitials } from '../../../core/utils/nameHelpers';
import api from '../../../core/api/axios';

const SCORE_COLOR = (s) => {
  if (!s && s !== 0) return 'text-gray-400 bg-gray-50 border-gray-200';
  if (s >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (s >= 50) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-600 bg-rose-50 border-rose-200';
};

const STATUS_STYLE = {
  active:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  favourite:   'bg-purple-50 text-purple-700 border-purple-200',
  invited:     'bg-indigo-50 text-indigo-700 border-indigo-200',
  hired:       'bg-blue-50 text-blue-700 border-blue-200',
  rejected:    'bg-rose-50 text-rose-700 border-rose-200',
  new:         'bg-gray-50 text-gray-700 border-gray-200',
  archived:    'bg-gray-100 text-gray-600 border-gray-200',
};

// ── Professional tag color schemes (one color per role) ──
const TAG_COLORS = [
  { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' },
  { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
];

const initFilters = { pool: 'all', location: '', min_exp: 0, exp_range: '', upload_time: [], tag: '', tags: [], sort_by: 'newest', role_id: '', limit: 20 };


const InlineEmailEditor = ({ candidate, fetchCandidates }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [email, setEmail] = useState(candidate.email || '');
  const [loading, setLoading] = useState(false);
  
  const handleSave = async (e) => {
    e.stopPropagation();
    if (!email.trim() || email === candidate.email) {
      setIsEditing(false);
      return;
    }
    try {
      setLoading(true);
      // PUT API call to update the candidate email
      // We will need to have a candidate update endpoint. Does it exist? Let's assume it does or we will update it.
      await api.put(`/source/candidates/${candidate.id}`, { email });
      setIsEditing(false);
      fetchCandidates();
    } catch (err) {
      console.error(err);
      alert('Failed to update email');
    } finally {
      setLoading(false);
    }
  };
  
  if (isEditing) {
    return (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <input 
          autoFocus
          className="text-xs border border-gray-300 rounded px-1 py-0.5 w-32"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(e); if (e.key === 'Escape') setIsEditing(false); }}
        />
        <button onClick={handleSave} disabled={loading} className="text-green-600 hover:text-green-700">✓</button>
        <button onClick={() => setIsEditing(false)} className="text-red-500 hover:text-red-600">✕</button>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1 group/email">
      <p className="text-xs text-gray-500 truncate">{candidate.email}</p>
      <button 
        onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
        className="opacity-0 group-hover/email:opacity-100 text-gray-400 hover:text-purple-600 p-0.5"
      >
        ✎
      </button>
    </div>
  );
};


const MultiSelectDropdown = ({ 
  options = [], 
  selected = [], 
  onChange, 
  label, 
  placeholder = "Select...", 
  emptyText = "No options found", 
  widthClass = "w-44",
  searchable = false,
  searchPlaceholder = "Search..."
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen, searchable]);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(opt =>
      (opt.label || '').toLowerCase().includes(term) ||
      (opt.value || '').toLowerCase().includes(term)
    );
  }, [options, searchable, searchTerm]);

  return (
    <div className={`relative ${widthClass.includes('w-full') ? 'w-full' : ''}`} ref={dropdownRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 transition-colors ${widthClass} flex justify-between items-center text-left cursor-pointer`}
      >
        <span className="truncate pr-2">
          {selected.length === 0 
            ? <span className="text-gray-400">{placeholder}</span> 
            : selected.length === 1 
              ? (options.find(o => o.value === selected[0])?.label || selected[0]) 
              : `${selected.length} Selected`}
        </span>
        <ChevronDown size={14} className="text-gray-400 shrink-0" />
      </button>
      
      {isOpen && (
        <div className={`absolute z-50 mt-1 ${widthClass.includes('w-full') ? 'w-full left-0 right-0' : 'min-w-[220px] w-max max-w-xs'} bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto custom-scrollbar p-2`}>
          {searchable && (
            <div className="p-1 border-b border-gray-100 mb-1.5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-200 focus-within:border-purple-400">
                <Search size={13} className="text-gray-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none w-full"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {filteredOptions.length === 0 ? (
            <div className="text-xs text-gray-400 py-3 text-center">
              {searchTerm ? `No matches for "${searchTerm}"` : emptyText}
            </div>
          ) : (
            filteredOptions.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded transition-colors">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  checked={selected.includes(opt.value)}
                  onChange={(e) => {
                    const newSelected = e.target.checked 
                      ? [...selected, opt.value]
                      : selected.filter(v => v !== opt.value);
                    onChange(newSelected);
                  }}
                />
                <span className="text-sm text-gray-700 select-none truncate">{opt.label}</span>
              </label>
            ))
          )}

          {selected.length > 0 && (
            <div className="flex justify-between items-center px-2 pt-2 border-t border-gray-100 mt-1 text-[11px] text-gray-500">
              <span>{selected.length} selected</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
                className="text-purple-600 hover:text-purple-700 font-medium cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function SourceDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const query = new URLSearchParams(location.search);
  const currentTab = query.get('tab') || 'home';

  const { user, hasPermission, logout } = useAuth();
  const displayName = user?.name || user?.email?.split('@')[0] || "User";

  // ── Use Notification Context ──
  const { setShowNotifications } = useNotifications();

  const appModules = getHubTabs({ hasPermission, hasRole });

  // Dynamic role display based on actual user roles
  const getRoleDisplay = () => {
    if (hasRole?.('super_admin')) return 'Super Admin';
    if (hasRole?.('org_admin')) return 'Organization Admin';
    if (hasRole?.('manager')) return 'Manager';
    if (hasRole?.('recruiter')) return 'Recruiter';
    return 'Employee';
  };

  const isCandidate = hasRole('candidate');

  if (!hasPermission(P.MODULE_SOURCE_ACCESS) && !isCandidate) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center bg-gray-50">
        <Shield size={48} className="text-gray-300" />
        <div>
          <h2 className="text-xl font-bold text-gray-800">Access Restricted</h2>
          <p className="text-sm text-gray-500 mt-1">You do not have access to this module.</p>
        </div>
      </div>
    );
  }

  if (isCandidate) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-6 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-2xl p-8 border border-purple-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full blur-2xl opacity-50"></div>
          <p className="text-xs font-medium text-purple-600 mb-2">CANDIDATE PORTAL</p>
          <h1 className="text-3xl font-bold text-gray-800">Application Status</h1>
          
          <div className="mt-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 font-bold text-xl">
              {user?.name?.[0] || 'C'}
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-800">{user?.name}</p>
              <p className="text-sm text-gray-500 mt-0.5">Identity Verified • Application Processing</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
               <Activity size={16} className="text-purple-600" /> Active Candidates
            </h3>
            <div className="space-y-3">
               <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Resume Screening</p>
                    <p className="text-xs text-gray-500 mt-0.5">Stage 1</p>
                  </div>
                  <CheckCircleIcon className="text-emerald-500" size={18} />
               </div>
               <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-purple-700">Pre-Employment Assessment</p>
                    <p className="text-xs text-purple-600 mt-0.5">Stage 2 • Action Required</p>
                  </div>
                  <button onClick={() => navigate('/verify')} className="px-4 py-2 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 transition-colors">
                    Start
                  </button>
               </div>
               <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex justify-between items-center opacity-50">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Technical Interview</p>
                    <p className="text-xs text-gray-400 mt-0.5">Stage 3</p>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
               </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
               <Database size={16} className="text-purple-600" /> My Profile
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              Your profile is being reviewed to find matching opportunities. Ensure your skills are current for the best matches.
            </p>
            <div className="space-y-3">
               <div className="flex justify-between text-sm font-medium text-gray-600">
                  <span>Compatibility Score</span>
                  <span className="text-purple-600">Searching...</span>
               </div>
               <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-300 w-1/3 animate-pulse"></div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const [candidates, setCandidates] = useState([]);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [jobRoles, setJobRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(initFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [drawerCandidate, setDrawerCandidate] = useState(null);
  
  const fileRef = useRef(null);
  const folderRef = useRef(null);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Activity feed state
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Pending offer approvals KPI state
  const [pendingOffersCount, setPendingOffersCount] = useState(0);

  // Modals
  const [showUpload, setShowUpload] = useState(false);
  const [showNewRole, setShowNewRole] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [autoRanking, setAutoRanking] = useState(false);

  // Invite-status tab: role selector
  const [inviteStatusRoleId, setInviteStatusRoleId] = useState('');
  const [showInviteStatus, setShowInviteStatus] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [viewingRole, setViewingRole] = useState(null);

  // Filter helpers - repository folders
  const [repoFolders, setRepoFolders] = useState([]);

  const currentRoleTitle = useMemo(() => {
    if (!filters.role_id) return '';
    const r = jobRoles.find(j => String(j.id) === String(filters.role_id));
    return r ? r.title : '';
  }, [filters.role_id, jobRoles]);

  const fetchRepoFolders = useCallback(async () => {
    try {
      const r = await fetch('/api/source/candidates/repository/folders', { credentials: 'include' });
      const d = await r.json();
      if (r.ok && d.success && Array.isArray(d.data)) {
        setRepoFolders(d.data);
      }
    } catch {
      /* silent */
    }
  }, []);

  const uploadDateOptions = useMemo(() => repoFolders.map(f => ({
    value: f.id,
    label: f.label || f.id
  })), [repoFolders]);

  const handleTabKeyNav = useTabListKeyNav();

  // Form states
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [bulkJobId, setBulkJobId] = useState(null);
  const [bulkJobProgress, setBulkJobProgress] = useState(null);
  const [bulkUploadTriggered, setBulkUploadTriggered] = useState(false);
  const [newRole, setNewRole] = useState({ title: '', description: '', min_experience: 0, required_skills: [] });
  const [availableTags, setAvailableTags] = useState([]);
  const tagOptions = useMemo(() => [
    { value: '__untagged__', label: 'General Pool (Untagged)' },
    ...(Array.isArray(availableTags) ? availableTags.map(t => {
      const tagLabel = t?.name || t?.tag || (typeof t === 'string' ? t : '');
      if (!tagLabel || tagLabel === '__untagged__' || tagLabel.toLowerCase() === 'general pool') return null;
      return {
        value: tagLabel,
        label: `🏷️ ${tagLabel} (${t?.count ?? 0} CVs)`
      };
    }).filter(Boolean) : [])
  ], [availableTags]);
  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [bulkTagAction, setBulkTagAction] = useState('add');
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [bulkSelectedTags, setBulkSelectedTags] = useState([]);
  const [bulkTagging, setBulkTagging] = useState(false);

  // ── Upload with Tag Prompt states (Upload tab & Quick Upload) ──
  const quickUploadFileRef = useRef(null);
  const [stagedUploadFiles, setStagedUploadFiles] = useState([]);
  const [showUploadTagModal, setShowUploadTagModal] = useState(false);
  const [uploadSelectedTags, setUploadSelectedTags] = useState([]);
  const [uploadTargetMonth, setUploadTargetMonth] = useState('');

  // Tags strictly derived from active Job Roles
  const jobRoleTagOptions = useMemo(() => {
    if (!Array.isArray(jobRoles)) return [];
    const titles = jobRoles
      .map(r => (r.title || '').trim())
      .filter(Boolean);
    const unique = Array.from(new Set(titles));
    return unique.map(title => ({
      value: title,
      label: title
    }));
  }, [jobRoles]);

  const handleRemoveUploadTag = (tagToRemove) => {
    setUploadSelectedTags(prev => prev.filter(t => t.toLowerCase() !== tagToRemove.toLowerCase()));
  };

  const handleCancelUploadTagModal = () => {
    setShowUploadTagModal(false);
    setStagedUploadFiles([]);
    setUploadSelectedTags([]);
    setUploadTargetMonth('');
  };
  const [newSkillInput, setNewSkillInput] = useState({ name: '', level: 'required' });
  const [editingSkillIdx, setEditingSkillIdx] = useState(null);
  const [editingSkillName, setEditingSkillName] = useState('');
  const [scoreStatus, setScoreStatus] = useState({});
  const [inviteForm, setInviteForm] = useState({
    role_id: '',
    templateType: 'prebuilt',
    subject: '',
    custom_body: '',
  });
  const [scoreRoleId, setScoreRoleId] = useState('');
  const [scoring, setScoring] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchJobRoles = useCallback(async () => {
    try {
      const r = await fetch('/api/source/job-roles', { credentials: 'include' });
      const d = await r.json();
      setJobRoles(d.data || []);
    } catch { /* silent */ }
  }, []);

  const fetchAvailableTags = useCallback(async () => {
    try {
      const r = await fetch('/api/source/candidates/tags', { credentials: 'include' });
      if (!r.ok) return;
      const d = await r.json();
      const tagsList = Array.isArray(d.data?.tags) 
        ? d.data.tags 
        : (Array.isArray(d.data) ? d.data : []);
      setAvailableTags(tagsList);
    } catch { /* silent */ }
  }, []);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.pool !== 'all') params.set('pool', filters.pool);
      if (filters.location) params.set('location', filters.location);
      if (filters.exp_range) params.set('exp_range', filters.exp_range);
      if (filters.upload_time && filters.upload_time.length > 0) {
        filters.upload_time.forEach(time => params.append('upload_time', time));
      }
      if (filters.tags && filters.tags.length > 0) {
        filters.tags.forEach(t => params.append('tags', t));
      } else if (filters.tag) {
        params.set('tag', filters.tag);
      }
      params.set('sort_by', filters.sort_by);
      if (filters.role_id) {
        params.set('role_id', filters.role_id);
        params.set('limit', filters.limit);
      } else {
        params.set('limit', 5000);
      }

      const r = await fetch(`/api/source/candidates/search?${params}`, { credentials: 'include' });
      const d = await r.json();
      setCandidates(d.data || []);
      setTotalCandidates(d.total_count ?? (d.data || []).length);
    } catch {
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchActivities = useCallback(async () => {
    setLoadingActivities(true);
    try {
      const r = await fetch('/api/source/candidates/activity?limit=10', { credentials: 'include' });
      const d = await r.json();
      if (r.ok && d.success) {
        setActivities(d.data || []);
      }
    } catch { /* silent */ }
    finally { setLoadingActivities(false); }
  }, []);

  // Fetches the count of offers awaiting approval, used by the "Pending Offer Approvals" KPI card.
  // Adjust the endpoint/path below to match whatever your backend actually exposes
  // (check OfferApprovals.jsx — it likely already calls the real endpoint for this data).
  const fetchPendingOffers = useCallback(async () => {
      try {
        const r = await fetch('/api/source/offers?status=pending', { credentials: 'include' });
        const d = await r.json();
        if (r.ok) {
          setPendingOffersCount((d.data || []).length);
        }
      } catch { /* silent */ }
    }, []);

  useEffect(() => { 
    fetchJobRoles(); 
    fetchRepoFolders();
    fetchAvailableTags();
  }, [fetchJobRoles, fetchRepoFolders, fetchAvailableTags]);
  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  useEffect(() => {
    if (currentTab === 'directory') {
      fetchRepoFolders();
    }
  }, [currentTab, fetchRepoFolders]);

  // ── Prevent Accidental Tab Closure During Upload ───────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (uploading) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [uploading]);

  useEffect(() => {
    if (currentTab === 'home') {
      fetchActivities();
      fetchPendingOffers();
    }
  }, [currentTab, fetchActivities, fetchPendingOffers]);


  // Restore active bulk upload job on mount and listen for new jobs
  useEffect(() => {
    const fetchActiveJobOnMount = async () => {
      try {
        const res = await fetch('/api/source/candidates/bulk-upload/active', { credentials: 'include' });
        const data = await res.json();
        if (res.ok && data.success && data.data && data.data.job) {
          setBulkJobId(data.data.job.id);
          setBulkJobProgress(data.data);
          setBulkUploadTriggered(true);
        }
      } catch (err) {
        console.error('Failed to fetch active bulk upload job', err);
      }
    };
    fetchActiveJobOnMount();

    const handleJobStarted = (e) => {
      if (e.detail?.jobId) {
        setBulkJobId(e.detail.jobId);
        setBulkJobProgress(null);
        setBulkUploadTriggered(true);
      }
    };
    window.addEventListener('bulk-job-started', handleJobStarted);
    return () => window.removeEventListener('bulk-job-started', handleJobStarted);
  }, []);

  const fetchActiveJob = useCallback(async () => {
    if (!bulkJobId) return;
    try {
      const r = await fetch(`/api/source/candidates/bulk-upload/${bulkJobId}`, { credentials: 'include' });
      if (r.status === 404) {
        setBulkJobId(null);
        setBulkJobProgress(null);
        setBulkUploadTriggered(false);
        return;
      }
      const d = await r.json();
      if (r.ok && d.success) {
        setBulkJobProgress(d.data);
      }
    } catch (err) {
      console.error('Failed to refresh active bulk upload job', err);
    }
  }, [bulkJobId]);

  // Poll bulk upload progress
  useEffect(() => {
    if (!bulkJobId) return;

    const fetchProgress = async () => {
      try {
        const r = await fetch(`/api/source/candidates/bulk-upload/${bulkJobId}`, { credentials: 'include' });
        if (r.status === 404) {
          setBulkJobId(null);
          setBulkJobProgress(null);
          setBulkUploadTriggered(false);
          return;
        }
        const d = await r.json();
        if (r.ok && d.success) {
          setBulkJobProgress(d.data);
          const stats = d.data.items_stats || [];
          const totalProcessed = stats
            .filter(s => s.status !== 'pending' && s.status !== 'processing')
            .reduce((acc, curr) => acc + curr.count, 0);
          const job = d.data.job;

          if (job && (job.status === 'cancelled' || job.status === 'failed' || (job.total_files > 0 && totalProcessed >= job.total_files))) {
             setBulkJobId(null);
             setBulkJobProgress(null);
             if (bulkUploadTriggered && (job.status === 'completed' || (job.total_files > 0 && totalProcessed >= job.total_files))) {
                 toast.success('Bulk processing complete');
                 fetchCandidates();
             }
             setBulkUploadTriggered(false);
             return;
          }
        }
      } catch (err) {
        console.error('Polling error', err);
      }
    };

    fetchProgress();
    const interval = setInterval(fetchProgress, 3000);
    return () => clearInterval(interval);
  }, [bulkJobId, bulkUploadTriggered, fetchCandidates, currentTab]);

  // ── Filter candidates client-side ──
  const filteredCandidates = candidates.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const nameMatch = c.full_name?.toLowerCase().includes(term);
    const emailMatch = c.email?.toLowerCase().includes(term);
    const designationMatch = c.current_designation?.toLowerCase().includes(term);
    const locationMatch = c.location?.toLowerCase().includes(term);
    const skillStrings = [
      ...(Array.isArray(c.skills) ? c.skills : []),
      ...(Array.isArray(c.structured_skills) ? c.structured_skills.map(s => s.skill_name || s.name) : [])
    ];
    const skillMatch = skillStrings.some(s => s?.toLowerCase().includes(term));
    return nameMatch || emailMatch || designationMatch || locationMatch || skillMatch;
  });

  // ── Selection helpers ──────────────────────────────────────────────────────
  const toggle = (id) => setSelectedIds(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });
  const allSelected = filteredCandidates.length > 0 && filteredCandidates.every(c => selectedIds.has(c.id));
  
  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredCandidates.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredCandidates.forEach(c => next.add(c.id));
        return next;
      });
    }
  };
  const clearSel = () => setSelectedIds(new Set());

  // ── Upload ─────────────────────────────────────────────────────────────────
  
  const handleBulkUploadDirect = async (filesArray, overrideDate = null, tagsOrLegacy = null, maybeTags = null) => {
    if (!filesArray || filesArray.length === 0) return;

    let tags = null;
    if (Array.isArray(maybeTags) || (typeof maybeTags === 'string' && maybeTags)) {
      tags = maybeTags;
    } else if (Array.isArray(tagsOrLegacy) || (typeof tagsOrLegacy === 'string' && tagsOrLegacy)) {
      tags = tagsOrLegacy;
    }

    setUploading(true);
    setUploadProgress(0);
    const fd = new FormData();
    const validExtensions = ['.pdf', '.doc', '.docx', '.txt', '.zip'];
    let validCount = 0;
    let invalidFiles = [];

    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];

      if (file.size < 1024) {
        invalidFiles.push(`${file.name} (too small)`);
        continue;
      }

      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!validExtensions.includes(ext)) {
        invalidFiles.push(`${file.name} (unsupported format)`);
        continue;
      }

      const cleanFile = (typeof window !== 'undefined' && typeof window.File === 'function')
        ? new window.File([file], file.name, { type: file.type })
        : file;
      fd.append('files', cleanFile);
      validCount++;
    }

    if (overrideDate) {
      fd.append('override_date', overrideDate);
    }
    if (tags && Array.isArray(tags) && tags.length > 0) {
      fd.append('tags', JSON.stringify(tags));
    } else if (tags && typeof tags === 'string') {
      fd.append('tags', tags);
    }

    if (invalidFiles.length > 0) {
      toast.error(`Skipped ${invalidFiles.length} invalid file(s).`);
    }

    if (validCount === 0) {
      toast.error('No valid files found.');
      setUploading(false);
      return;
    }

    try {
      const response = await api.post('/source/candidates/bulk-upload', fd, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.lengthComputable) {
            const percentComplete = (progressEvent.loaded / progressEvent.total) * 100;
            setUploadProgress(percentComplete);
          }
        }
      });
      
      const data = response.data;

      if (data.data?.job_id) {
        const newJobId = data.data.job_id;
        setBulkUploadTriggered(true);
        setBulkJobId(newJobId);
        setBulkJobProgress(null);

        try {
          const r = await fetch(`/api/source/candidates/bulk-upload/${newJobId}`, { credentials: 'include' });
          const d = await r.json();
          if (r.ok && d.success) setBulkJobProgress(d.data);
        } catch (_) { /* silent */ }
      }

      toast.success(`Queued ${validCount} file(s) for processing!`);
      setShowUpload(false);
    } catch (err) {
      const detail = err.response?.data?.detail || err?.message || 'Unknown';
      // Auto-recover: if blocked by an active job, reconnect to its progress
      if (err.response?.status === 400 && detail.includes('bulk upload')) {
        try {
          const res = await fetch('/api/source/candidates/bulk-upload/active', { credentials: 'include' });
          const data = await res.json();
          if (res.ok && data.success && data.data?.job) {
            const activeId = data.data.job.id;
            setBulkJobId(activeId);
            setBulkJobProgress(data.data);
            setBulkUploadTriggered(true);
            toast((t) => (
              <div className="flex items-center justify-between gap-3 w-full">
                <span className="text-xs text-gray-800 font-medium">A previous upload is active. Reconnected to its progress.</span>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    toast.dismiss(t.id);
                    await handleCancelQueue(activeId);
                  }}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-bold whitespace-nowrap transition-colors shadow-sm cursor-pointer"
                >
                  Cancel Old Job
                </button>
              </div>
            ), { icon: 'ℹ️', duration: 15000 });
          } else {
            // Active job was self-healed by backend — retry the upload
            toast('Previous upload completed. Please try uploading again.', { icon: '✅' });
          }
        } catch (_) {
          toast.error('Upload error: ' + detail);
        }
      } else {
        toast.error('Upload error: ' + detail);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleConfirmUploadWithTags = async () => {
    if (!stagedUploadFiles || stagedUploadFiles.length === 0) return;
    const filesToUpload = [...stagedUploadFiles];
    const tagsToAssign = [...uploadSelectedTags];
    const targetMonth = uploadTargetMonth || null;

    setShowUploadTagModal(false);
    setStagedUploadFiles([]);
    setUploadSelectedTags([]);
    setUploadTargetMonth('');

    await handleBulkUploadDirect(filesToUpload, targetMonth, tagsToAssign);
  };

  const handleUpload = (e) => {
    e.preventDefault();
    const files = e.dataTransfer ? e.dataTransfer.files : e.target.files;
    if (!files || files.length === 0) return;

    setStagedUploadFiles(Array.from(files));
    setUploadSelectedTags([]);
    setUploadTargetMonth('');
    setShowUpload(false);
    setShowUploadTagModal(true);

    if (e.target) e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e);
  };

  const handleCancelQueue = async (overrideJobId = null) => {
    const validOverride = (typeof overrideJobId === 'string' || typeof overrideJobId === 'number') && !isNaN(Number(overrideJobId))
      ? Number(overrideJobId)
      : null;
    const idToCancel = validOverride || bulkJobId;
    try {
      let r;
      if (idToCancel) {
        r = await fetch(`/api/source/candidates/bulk-upload/${idToCancel}/cancel`, { 
          method: 'POST', 
          credentials: 'include' 
        });
      } else {
        r = await fetch('/api/source/candidates/bulk-upload/active/cancel', { 
          method: 'POST', 
          credentials: 'include' 
        });
      }
      if (r.ok) {
        toast.success('Previous upload canceled. You can upload new files now!');
        setBulkJobId(null);
        setBulkJobProgress(null);
        setBulkUploadTriggered(false);
      } else {
        // Fallback: try global active cancel if specific ID failed
        const fallback = await fetch('/api/source/candidates/bulk-upload/active/cancel', { 
          method: 'POST', 
          credentials: 'include' 
        });
        if (fallback.ok) {
          toast.success('Upload queue cleared. You can upload new files now!');
          setBulkJobId(null);
          setBulkJobProgress(null);
          setBulkUploadTriggered(false);
        } else {
          const errJson = await fallback.json().catch(() => ({}));
          toast.error(errJson.detail || 'Failed to cancel queue');
        }
      }
    } catch (err) {
      toast.error('Error canceling queue: ' + (err.message || 'Network error'));
    }
  };

  const handlePauseQueue = async () => {
    if (!bulkJobId) return;
    try {
      const r = await fetch(`/api/source/candidates/bulk-upload/${bulkJobId}/pause`, { 
        method: 'POST', 
        credentials: 'include' 
      });
      if (r.ok) {
        toast.success('Queue paused successfully');
        fetchActiveJob();
      } else {
        toast.error('Failed to pause queue');
      }
    } catch {
      toast.error('Error pausing queue');
    }
  };

  const handleResumeQueue = async () => {
    if (!bulkJobId) return;
    try {
      const r = await fetch(`/api/source/candidates/bulk-upload/${bulkJobId}/resume`, { 
        method: 'POST', 
        credentials: 'include' 
      });
      if (r.ok) {
        toast.success('Queue resumed successfully');
        fetchActiveJob();
      } else {
        toast.error('Failed to resume queue');
      }
    } catch {
      toast.error('Error resuming queue');
    }
  };

  const handleRetryFailed = async () => {
    if (!bulkJobId) return;
    try {
      const r = await fetch(`/api/source/candidates/bulk-upload/${bulkJobId}/retry-failed`, { 
        method: 'POST', 
        credentials: 'include' 
      });
      if (r.ok) {
        toast.success('Failed items queued for retry');
        fetchActiveJob();
      } else {
        toast.error('Failed to retry items');
      }
    } catch {
      toast.error('Error retrying items');
    }
  };

  // ── Create / Edit job role ────────────────────────────────────────────────────────
  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!newRole.title.trim()) return toast.error('Role title is required');
    if (!isNonNegativeNumber(newRole.min_experience)) return toast.error('Minimum experience must be 0 or greater');
    const isEdit = !!newRole.id;
    const url = isEdit ? `/api/source/job-roles/${newRole.id}` : '/api/source/job-roles';
    const method = isEdit ? 'PUT' : 'POST';
    
    const payload = { ...newRole };

    try {
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        toast.success(isEdit ? 'Role updated' : 'Role created');
        setShowNewRole(false);
        setNewRole({ title: '', description: '', min_experience: 0, required_skills: [] });
        fetchJobRoles();
      } else { toast.error(`Failed to ${isEdit ? 'update' : 'create'} role`); }
    } catch { toast.error('Error saving role'); }
  };

  const openEditRole = (r) => {
    let parsedSkills = [];
    if (Array.isArray(r.required_skills)) {
      parsedSkills = r.required_skills.map(s => {
        if (typeof s === 'string') return { skill: s, level: 'required' };
        const lvl = (s.level || 'required').toLowerCase();
        return {
          skill: s.skill || s.name || '',
          level: (lvl === 'preferred' || lvl === 'optional' || lvl === 'intermediate' || lvl === 'beginner') ? 'preferred' : 'required'
        };
      });
    }
    setNewRole({
      id: r.id,
      title: r.title,
      description: r.description || '',
      min_experience: r.min_experience || 0,
      required_skills: parsedSkills,
    });
    setEditingSkillIdx(null);
    setEditingSkillName('');
    setNewSkillInput({ name: '', level: 'required' });
    setShowNewRole(true);
  };

  const deleteJobRole = async (roleId) => {
    if (!window.confirm("Are you sure you want to delete this job role? All AI scores and applications tied to this role will also be deleted. This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/source/job-roles/${roleId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Job role deleted successfully');
        fetchJobRoles();
      } else {
        toast.error('Failed to delete job role');
      }
    } catch (e) {
      toast.error('Could not delete job role');
      console.error(e);
    }
  };

  const addSkillToRole = () => {
    const name = newSkillInput.name.trim();
    if (!name) return;
    const already = newRole.required_skills.some(s => (s.name || s.skill || '').toLowerCase() === name.toLowerCase());
    if (already) { toast.error('Skill already added'); return; }
    setNewRole(r => ({ ...r, required_skills: [...r.required_skills, { skill: name, level: newSkillInput.level || 'required' }] }));
    setNewSkillInput(s => ({ ...s, name: '' }));
  };

  const toggleSkillLevel = (idx) => {
    setNewRole(r => ({
      ...r,
      required_skills: r.required_skills.map((s, i) => {
        if (i !== idx) return s;
        const currentLvl = (s.level || 'required').toLowerCase();
        const nextLvl = (currentLvl === 'preferred' || currentLvl === 'optional' || currentLvl === 'intermediate' || currentLvl === 'beginner') ? 'required' : 'preferred';
        return { ...s, level: nextLvl };
      })
    }));
  };

  const updateSkillInRole = (idx, updated) => {
    setNewRole(r => ({
      ...r,
      required_skills: r.required_skills.map((s, i) => i === idx ? { ...s, ...updated } : s)
    }));
  };

  const removeSkillFromRole = (idx) => {
    setNewRole(r => ({ ...r, required_skills: r.required_skills.filter((_, i) => i !== idx) }));
  };

  const fetchScoreStatus = async (roleId) => {
    if (!roleId) return;
    try {
      const r = await fetch(`/api/source/job-roles/${roleId}/score-status`, { credentials: 'include' });
      const d = await r.json();
      if (d.success) setScoreStatus(prev => ({ ...prev, [roleId]: d.data }));
    } catch { /* non-fatal */ }
  };

  // ── Bulk AI score ──────────────────────────────────────────────────────────
  const handleScore = async (e) => {
    e.preventDefault();
    if (!scoreRoleId) return toast.error('Select a role');
    setScoring(true);
    try {
      const r = await fetch('/api/source/score-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: parseInt(scoreRoleId), candidate_ids: [...selectedIds] }),
      });
      const d = await r.json();
      if (r.ok) {
        toast.success(`Scored ${d.data.length} candidates`);
        setShowScore(false);
        clearSel();
        fetchCandidates();
      } else { toast.error(d.detail || 'Scoring failed'); }
    } catch { toast.error('Scoring interrupted'); }
    finally { setScoring(false); }
  };

  // ── Send invite ────────────────────────────────────────────────────────────
  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteForm.role_id) return toast.error('Select a role');
    if (inviteForm.templateType === 'custom' && (!inviteForm.subject.trim() || !inviteForm.custom_body.trim())) {
      return toast.error('Custom invite requires both subject and email body');
    }
    const ids = [...selectedIds];
    
    const payload = {
      candidate_ids: ids,
      job_role_id: parseInt(inviteForm.role_id),
    };
    
    if (inviteForm.templateType === 'custom') {
      if (inviteForm.subject) payload.subject = inviteForm.subject;
      if (inviteForm.custom_body) payload.custom_body = inviteForm.custom_body;
    }

    const tid = toast.loading('Sending invites...');
    try {
      const r = await fetch('/api/source/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (r.ok) {
        toast.success(d.message || `Invited ${ids.length} candidate(s)!`, { id: tid });
        setShowInvite(false);
        clearSel();
        fetchCandidates();
        fetchActivities();
      } else {
        toast.error(d.detail || 'Invitation failed', { id: tid });
      }
    } catch {
      toast.error('Invitation error', { id: tid });
    }
  };

  const handleCancelInvite = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to cancel the invite for ${ids.length} candidate(s)? This will unlink their user account if they are a trainee and convert them back to an active candidate.`)) return;

    const tid = toast.loading('Canceling invites...');
    try {
      const r = await fetch('/api/source/cancel-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_ids: ids }),
      });
      const d = await r.json();
      if (r.ok) {
        toast.success(d.message || `Canceled invites for ${ids.length} candidate(s)!`, { id: tid });
        clearSel();
        fetchCandidates();
        fetchActivities();
      } else {
        toast.error(d.detail || 'Cancel failed', { id: tid });
      }
    } catch {
      toast.error('Cancel error', { id: tid });
    }
  };

  const handleAutoRank = async (roleId, targetTags = null) => {
    if (!roleId) return;
    setAutoRanking(true);
    let tagsArray = [];
    if (Array.isArray(targetTags)) {
      tagsArray = targetTags;
    } else if (typeof targetTags === 'string' && targetTags.trim()) {
      tagsArray = [targetTags.trim()];
    }

    let msg = 'Searching through all resumes for matches...';
    if (tagsArray.length === 1) {
      const label = tagsArray[0] === '__untagged__' ? 'General Pool' : tagsArray[0];
      msg = `Scoring candidates in "${label}"...`;
    } else if (tagsArray.length > 1) {
      msg = `Scoring candidates matching ${tagsArray.length} selected tags...`;
    }
    const tid = toast.loading(msg);
    try {
      const params = new URLSearchParams();
      tagsArray.forEach(t => params.append('tags', t));
      const url = tagsArray.length > 0 
        ? `/api/source/job-roles/${roleId}/auto-rank?${params.toString()}` 
        : `/api/source/job-roles/${roleId}/auto-rank`;
      const r = await fetch(url, { method: 'POST' });
      const d = await r.json();
      if (r.ok) {
        toast.success(d.message || 'Auto-ranking complete!', { id: tid });
        if (filters.role_id === roleId) fetchCandidates();
      } else {
        toast.error(d.detail || 'Auto-ranking failed', { id: tid });
      }
    } catch {
      toast.error('Process interrupted', { id: tid });
    } finally {
      setAutoRanking(false);
    }
  };

  const handleBulkTagSubmit = async (e) => {
    e?.preventDefault?.();
    const tagList = Array.isArray(bulkSelectedTags) && bulkSelectedTags.length > 0
      ? bulkSelectedTags
      : bulkTagInput.split(',').map(s => s.trim()).filter(Boolean);
    if (tagList.length === 0) {
      toast.error('Please select at least one job role tag');
      return;
    }
    setBulkTagging(true);
    const tid = toast.loading('Updating tags on selected candidates...');
    try {
      const res = await fetch('/api/source/candidates/bulk-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_ids: Array.from(selectedIds),
          action: bulkTagAction,
          tags: tagList
        }),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Tags updated successfully', { id: tid });
        setShowBulkTagModal(false);
        setBulkSelectedTags([]);
        setBulkTagInput('');
        fetchCandidates();
        fetchAvailableTags();
      } else {
        toast.error(data.detail || 'Failed to update tags', { id: tid });
      }
    } catch {
      toast.error('Network error updating tags', { id: tid });
    } finally {
      setBulkTagging(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this candidate permanently?')) return;
    try {
      await fetch(`/api/source/candidates/${id}`, { method: 'DELETE' });
      toast.success('Deleted');
      if (drawerCandidate?.id === id) setDrawerCandidate(null);
      selectedIds.delete(id);
      setSelectedIds(new Set(selectedIds));
      fetchCandidates();
    } catch { toast.error('Delete failed'); }
  };

  const anySelected = selectedIds.size > 0;
  const setTab = (tab) => navigate(`/source?tab=${tab}`);

  // Calculate stats for dashboard
  const favouriteCount = candidates.filter(c => c.status?.toLowerCase() === 'favourite').length;
  const invitedCount = candidates.filter(c => c.status?.toLowerCase() === 'invited').length;
  const archivedCount = candidates.filter(c => c.status?.toLowerCase() === 'archived').length;
  const hiredCount = candidates.filter(c => c.status?.toLowerCase() === 'hired').length;
  const newCount = candidates.filter(c => !c.status || c.status?.toLowerCase() === 'new').length;
  const rejectedCount = candidates.filter(c => c.status?.toLowerCase() === 'rejected').length;

  // Calculate today's stats
  const today = new Date().toISOString().split('T')[0];
  const resumesUploadedToday = candidates.filter(c => c.created_at?.startsWith(today)).length;

  return (
    <div className="dashboard-page light-theme-override" style={{ backgroundColor: '#FAF8FF' }}>
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

      <div className="dashboard-body">
        <div className="sidebar" data-no-tooltip onKeyDown={handleTabKeyNav}>
          <button className={currentTab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>Home</button>
          {hasPermission(P.SOURCE_CANDIDATES_VIEW) && <button className={currentTab === 'directory' ? 'active' : ''} onClick={() => setTab('directory')}>Directory</button>}
          {hasPermission(P.SOURCE_CANDIDATES_VIEW) && <button className={currentTab === 'repo' ? 'active' : ''} onClick={() => setTab('repo')}>Resume Repo</button>}
          {hasPermission(P.SOURCE_JOBS_VIEW) && <button className={currentTab === 'jobs' ? 'active' : ''} onClick={() => setTab('jobs')}>Jobs</button>}
          {hasPermission(P.SOURCE_CANDIDATES_MANAGE) && <button className={currentTab === 'upload' ? 'active' : ''} onClick={() => setTab('upload')}>Upload</button>}
          {hasPermission(P.SOURCE_OFFERS_VIEW) && <button className={currentTab === 'offers' ? 'active' : ''} onClick={() => setTab('offers')}>Offer Approvals</button>}
          {hasPermission(P.SOURCE_CANDIDATES_VIEW) && <button className={currentTab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>Active Candidates</button>}
          <div className="sidebar-brand">
            <img src={ewandzLogo} alt="Ewandz" />
          </div>
        </div>
        
        <div className="content" style={{ backgroundColor: '#FAF8FF', padding: '24px' }}>
        <div className="flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#7c3aed] mb-3">
            {currentTab === 'upload' ? 'RESUME PROCESSING' :
             currentTab === 'jobs' ? 'JOB MANAGEMENT' :
             currentTab === 'home' ? 'RECRUITMENT ANALYTICS' :
             currentTab === 'offers' ? 'OFFER MANAGEMENT' :
             currentTab === 'active' ? 'RECRUITMENT STAGES' :
             currentTab === 'invite-status' ? 'CANDIDATE INVITATIONS' :
             currentTab === 'archive' ? 'CANDIDATE ARCHIVE' :
             currentTab === 'repo' ? 'RESUME REPOSITORY' :
             'CANDIDATE DATABASE'}
          </p>
          <h1 className="text-4xl font-black text-black tracking-tight leading-none">
            {currentTab === 'upload' ? (
              <>Resume Processing Center</>
            ) : currentTab === 'jobs' ? (
              <>Job Roles</>
            ) : currentTab === 'home' ? (
              <>Talent Central Dashboard</>
            ) : currentTab === 'offers' ? (
              <>Offer Management</>
            ) : currentTab === 'active' ? (
              <>Recruitment Stages</>
            ) : currentTab === 'repo' ? (
              <>Resume Repository</>
            ) : currentTab === 'invite-status' ? (
              <>Candidate Invitations</>
            ) : (
              <>Candidate Database</>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {currentTab === 'upload'
              ? 'Upload and process resumes for AI-powered candidate matching'
              : currentTab === 'jobs'
              ? `${jobRoles.length} active roles`
              : currentTab === 'offers' || currentTab === 'active' || currentTab === 'invite-status'
              ? `${user?.company_name || 'Source'} · Talent Acquisition`
              : `${searchTerm ? `${filteredCandidates.length} of ` : ''}${candidates.length} records · ${user?.company_name || 'Source'}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {(currentTab === 'directory' || currentTab === 'home' || currentTab === 'jobs') && (
            <button
              onClick={() => { fetchCandidates(); fetchJobRoles(); fetchRepoFolders(); }}
              aria-label="Refresh"
              className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors duration-150"
            >
              <RefreshCw size={16} />
            </button>
          )}

          {currentTab === 'directory' && (
            <>
              <div className="relative w-64 md:w-80">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                  <Search size={15} />
                </span>
                <input
                  type="text"
                  placeholder="Search name, email, role, skills..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                  title="Search"  // ← Add this
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(f => !f)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-medium transition-colors duration-150 ${
                  showFilters 
                    ? 'bg-purple-50 border-purple-300 text-purple-700' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Filter size={15} /> Filters
              </button>
              <button
                onClick={() => setShowReportModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 text-sm font-semibold transition-colors duration-150 shadow-xs"
                title="Generate Candidate Shortlist Report (CSV, Excel, PDF)"
              >
                <FileSpreadsheet size={15} className="text-purple-600" />
                <span>Generate Report</span>
              </button>
              {/* <button
                onClick={() => setShowUpload(true)}
                className="
              px-7
              py-4
              rounded-2xl
              bg-gradient-to-r
              from-[#8b5cf6]
              to-[#c084fc]
              text-white
              text-sm
              font-black
              tracking-wide
              flex
              items-center
              gap-3
              shadow-lg
              shadow-purple-200
            "
              >
                <Upload size={15} /> Upload Resume
              </button> */}
            </>
          )}

          {currentTab === 'jobs' && hasPermission(P.SOURCE_JOBS_MANAGE) && (
            <button
              onClick={() => { setNewRole({ title: '', description: '', min_experience: 0, required_skills: [] }); setEditingSkillIdx(null); setEditingSkillName(''); setNewSkillInput({ name: '', level: 'required' }); setShowNewRole(true); }}
              className="
              px-7
              py-4
              
              bg-[#7c3aed] 
              !text-white 
              text-sm
              font-black 
              tracking-wide
              flex items-center 
              gap-3 shadow-lg 
              shadow-[#7c3aed]/20
            "
            >
              <Plus size={15} /> Add Job Role
            </button>
          )}

          {currentTab === 'invite-status' && jobRoles.length > 0 && (
            <div className="flex items-center gap-3">
              <select
                className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 transition-colors"
                value={inviteStatusRoleId}
                onChange={e => { setInviteStatusRoleId(e.target.value); setShowInviteStatus(false); }}
              >
                <option value="">Select a role...</option>
                {jobRoles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
              {inviteStatusRoleId && (
                <button
                  onClick={() => setShowInviteStatus(true)}
                  className="
              px-7
              py-4
              rounded-2xl
              bg-gradient-to-r
              from-[#8b5cf6]
              to-[#c084fc]
              text-white
              text-sm
              font-black
              tracking-wide
              flex
              items-center
              gap-3
              shadow-lg
              shadow-purple-200
            "
                >
                  View Invites
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── KPI CARDS ── (Purple, Yellow, Green, Pink) */}
      {currentTab === 'home' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          className="bg-white border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer border-t-4 border-t-purple-600"
          onClick={() => setTab('directory')}
        >
          <div className="flex items-center justify-between mb-2">
            <UsersIcon size={20} className="text-purple-600" />
            <span className="text-xs font-medium text-purple-600">Total</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-800">{totalCandidates}</h2>
          <p className="text-sm text-gray-500 mt-1">Total Candidates</p>
        </div>

          <div 
            className="bg-white p-5 border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer border-t-4 border-t-amber-500"
            onClick={() => setTab('jobs')}
          >
            <div className="flex items-center justify-between mb-2">
              <BriefcaseIcon size={20} className="text-amber-500" />
              <span className="text-xs font-medium text-amber-500">Open</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-800">{jobRoles.length}</h2>
            <p className="text-sm text-gray-500 mt-1">Active Job Openings</p>
          </div>

          <div 
            className="bg-white p-5 border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer border-t-4 border-t-emerald-500"
            onClick={() => setTab('upload')}
          >
            <div className="flex items-center justify-between mb-2">
              <Upload size={20} className="text-emerald-500" />
              <span className="text-xs font-medium text-emerald-500">Today</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-800">{resumesUploadedToday}</h2>
            <p className="text-sm text-gray-500 mt-1">Files Uploaded Today</p>
          </div>

          <div 
            className="bg-white p-5 border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer border-t-4 border-t-pink-500"
            onClick={() => setTab('offers')}
          >
            <div className="flex items-center justify-between mb-2">
              <CheckCircleIcon size={20} className="text-pink-500" />
              <span className="text-xs font-medium text-pink-500">Pending</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-800">{pendingOffersCount}</h2>
            <p className="text-sm text-gray-500 mt-1">Pending Offer Approvals</p>
          </div>
        </div>
      )}

      {/* ── Main Tab Content ── */}
      {currentTab === 'home' ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
          {/* Row 1: Activity and Today's Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-purple-600" /> Today's Activity
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                    <p className="text-xs font-medium text-gray-500">Resumes Uploaded Today</p>
                    <p className="text-3xl font-bold text-emerald-600 mt-2">{resumesUploadedToday}</p>
                    <p className="text-xs text-gray-400 mt-1">Updated today</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                  <p className="text-xs font-medium text-gray-500">Invitations Sent Today</p>
                  <p className="text-3xl font-bold text-amber-600 mt-2">
                    {activities.filter(act => {
                      if (!act.action?.toLowerCase().includes('invite')) return false;
                      if (!act.created_at) return false;
                      const date = new Date(act.created_at);
                      const today = new Date();
                      return date.getDate() === today.getDate() &&
                            date.getMonth() === today.getMonth() &&
                            date.getFullYear() === today.getFullYear();
                    }).length}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Updated today</p>
                </div>
                </div>
                <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-3">Weekly Activity</p>
                <div className="space-y-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                    const dayCount = candidates.filter(c => {
                      if (!c.created_at) return false;
                      const date = new Date(c.created_at);
                      return date.getDay() === i + 1;
                    }).length;
                    
                    const maxVal = Math.max(1, ...['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((_, idx) => 
                      candidates.filter(c => {
                        if (!c.created_at) return false;
                        const date = new Date(c.created_at);
                        return date.getDay() === idx + 1;
                      }).length
                    ));
                    
                    const width = maxVal > 0 ? (dayCount / maxVal) * 100 : 0;
                    const isToday = i === new Date().getDay() - 1;
                    
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className={`text-xs font-medium w-10 ${isToday ? 'text-purple-600' : 'text-gray-400'}`}>
                          {day}
                        </span>
                        <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${isToday ? 'bg-purple-500' : 'bg-purple-300'}`}
                            style={{ width: `${width}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right">{dayCount}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              </div>
            </div>
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm h-full">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Activity size={16} className="text-purple-600" /> Recent Activity
                </h3>
                
                <div className="space-y-4 max-h-[280px] overflow-y-auto">
                  {loadingActivities ? (
                    <div className="flex items-center justify-center h-32 text-gray-400 gap-2">
                      <Loader2 size={16} className="animate-spin text-purple-600" />
                      <span className="text-sm font-medium">Loading feed...</span>
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center text-gray-400 gap-2">
                      <Clock size={24} className="opacity-50" />
                      <p className="text-sm font-medium">No activities logged</p>
                    </div>
                  ) : (
                    activities.slice(0, 5).map((act) => {
                      const dateStr = act.created_at ? new Date(act.created_at).toLocaleString() : 'Just now';
                      
                      let Icon = Activity;
                      let iconColor = 'bg-gray-100 text-gray-500';
                      const action = act.action?.toLowerCase();
                      if (action?.includes('invite')) {
                        Icon = MailIcon;
                        iconColor = 'bg-indigo-50 text-indigo-600';
                      } else if (action?.includes('create') || action?.includes('upload')) {
                        Icon = UserPlus;
                        iconColor = 'bg-purple-50 text-purple-600';
                      } else if (action?.includes('status') || action?.includes('shortlist') || action?.includes('archive')) {
                        Icon = Zap;
                        iconColor = 'bg-amber-50 text-amber-600';
                      } else if (action?.includes('score') || action?.includes('rank')) {
                        Icon = Star;
                        iconColor = 'bg-emerald-50 text-emerald-600';
                      }
                      
                      return (
                        <div key={act.id} className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800">{act.candidate_name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{act.detail || act.action}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-400">{act.actor_name || 'System'}</span>
                              <span className="w-1 h-1 rounded-full bg-gray-300" />
                              <span className="text-xs text-gray-400">{dateStr}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Job Openings and Recruitment Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <BriefcaseIcon size={16} className="text-purple-600" /> Job Openings
              </h3>
              <div className="space-y-3">
                {jobRoles.slice(0, 4).map(role => (
                  <div key={role.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{role.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Min Exp: {role.min_experience} yrs</p>
                    </div>
                    <span className="text-sm font-medium text-purple-600">
                      {candidates.filter(c => c.role_id === role.id).length} candidates
                    </span>
                  </div>
                ))}
                {jobRoles.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-8">No job roles created yet</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <BarChart size={16} className="text-purple-600" /> Recruitment Summary
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                  <UserPlus size={20} className="text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-800">{totalCandidates}</p>
                  <p className="text-xs text-gray-500">Candidates Added</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                  <MailIcon size={20} className="text-indigo-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-800">{invitedCount}</p>
                  <p className="text-xs text-gray-500">Invitations Sent</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                  <FileText size={20} className="text-emerald-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-800">{hiredCount}</p>
                  <p className="text-xs text-gray-500">Offers Issued</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                  <CheckCircleIcon size={20} className="text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-800">{hiredCount}</p>
                  <p className="text-xs text-gray-500">Hires Completed</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : currentTab === 'jobs' ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {jobRoles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center bg-white rounded-2xl border border-gray-200 shadow-sm">
              <Briefcase size={48} className="text-gray-300" />
              <div>
                <p className="text-lg font-semibold text-gray-800 mb-1">No active roles</p>
                <p className="text-sm text-gray-500">Click Add Role to define a job requisition</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 pb-4 mt-4">
              {jobRoles.slice().sort((a, b) => new Date(a.created_at || a.updated_at || 0) - new Date(b.created_at || b.updated_at || 0)).map((r, index) => {
                const colors = TAG_COLORS[index % TAG_COLORS.length];
                const candidateCount = candidates.filter(c => c.role_id === r.id).length;
                
                return (
                  <div 
                    key={r.id} 
                    onClick={() => setViewingRole(r)}
                    className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-lg transition-all hover:scale-[1.01] hover:z-10 flex flex-col cursor-pointer group"
                    title="Click to view full job role description & skills"
                  >
                    <div className="flex w-full items-start justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center ${colors.text} shrink-0`}>
                          <Briefcase size={16} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 truncate group-hover:text-purple-700 transition-colors">{r.title}</h3>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button 
                          onClick={(e) => { e.stopPropagation(); openEditRole(r); }} 
                          title="Edit role" 
                          className="p-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteJobRole(r.id); }} 
                          title="Delete role" 
                          className="p-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1 mb-3 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${colors.bg} ${colors.text} border ${colors.border}`}>
                        Min Exp: {r.min_experience} yrs
                      </span>
                      <span className={`text-sm font-bold ${candidateCount > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                        {candidateCount} {candidateCount === 1 ? 'candidate' : 'candidates'}
                      </span>
                    </div>

                    {r.folder_name && (
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          <Folder size={11} /> Folder: {r.folder_name} {r.folder_month_year ? `(${r.folder_month_year})` : ''}
                        </span>
                      </div>
                    )}
                    
                    {/* Skills chips */}
                    {Array.isArray(r.required_skills) && r.required_skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {r.required_skills.slice(0, 6).map((s, i) => {
                          const skillName = s.name || s.skill || (typeof s === 'string' ? s : '');
                          const rawLvl = (s.level || 'required').toLowerCase();
                          const isReq = rawLvl === 'required' || rawLvl === 'critical' || rawLvl === 'expert' || rawLvl === 'advanced';
                          return (
                            <span 
                              key={i} 
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                isReq 
                                  ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {skillName}
                            </span>
                          );
                        })}
                        {r.required_skills.length > 6 && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
                            +{r.required_skills.length - 6} more
                          </span>
                        )}
                      </div>
                    )}
                    
                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-4 flex-1 group-hover:text-gray-700 transition-colors">
                      {r.description || 'No description provided.'}
                    </p>
                    
                    <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${candidateCount > 0 ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        <span className="text-sm text-gray-600">
                          {candidateCount > 0 ? `${candidateCount} assigned` : '0 assigned'}
                        </span>
                      </div>
                    </div>
                    
                    {scoreStatus[r.id] && (
                      <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        {scoreStatus[r.id].scored_count} scored
                        {scoreStatus[r.id].last_scored_at ? ` · ${new Date(scoreStatus[r.id].last_scored_at).toLocaleString()}` : ''}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : currentTab === 'upload' ? (
        <div className="flex-1 flex items-center justify-center flex-col gap-6">
          <div className="bg-white w-full max-w-xl rounded-2xl p-8 border border-gray-200 shadow-sm relative">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Upload size={24} className="text-purple-600"/> Resume Processing Center
            </h2>
            
            {/* Upload Area - Click anywhere to upload files/folders */}
            <div 
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all group flex flex-col items-center cursor-pointer ${
                isDragging ? 'border-purple-400 bg-purple-50' : 'border-gray-300 bg-gray-50 hover:border-purple-400 hover:bg-purple-50/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !uploading && fileRef.current?.click()}
            >
              {/* Hidden file inputs - supports files and folders */}
              <input 
                type="file" 
                ref={fileRef} 
                onChange={handleUpload} 
                className="hidden" 
                accept=".pdf,.doc,.docx,.txt,.zip" 
                multiple 
              />
              <input 
                type="file" 
                ref={folderRef} 
                onChange={handleUpload} 
                className="hidden" 
                webkitdirectory="true" 
                directory="true" 
                multiple 
              />
              
              {/* Upload Icon - Clickable */}
              <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform cursor-pointer">
                {uploading ? (
                  <div className="relative flex items-center justify-center w-14 h-14">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#E9D5FF" strokeWidth="10" />
                      <circle 
                        cx="50" cy="50" r="40" fill="none" stroke="#9333EA" strokeWidth="10" 
                        strokeDasharray="251.2" 
                        strokeDashoffset={251.2 - (251.2 * (uploadProgress || 1)) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-300 ease-out"
                      />
                    </svg>
                  </div>
                ) : (
                  <Upload size={32} className="text-purple-600" />
                )}
              </div>
              
              <p className="text-gray-800 font-semibold text-base mb-2">
                {uploading ? 'Queueing Files...' : 'Click to upload or drag & drop'}
              </p>
              <p className="text-sm text-gray-500">Supported: PDF, DOCX, TXT, ZIP · Upload files or entire folders</p>
              
              {/* Hidden hint - click the icon or the box */}
              <div className="mt-4 flex items-center gap-6 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span> Single files
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span> Entire folders
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span> ZIP archives
                </span>
              </div>
            </div>
          </div>
          
          {/* Bulk Upload Progress */}
          {bulkUploadTriggered && bulkJobId && (
            <div className="bg-white w-full max-w-xl rounded-2xl p-6 border border-purple-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 h-1 bg-purple-100 w-full">
                {bulkJobProgress?.job?.status === 'extracting' ? (
                  <div className="h-full bg-purple-400 animate-pulse" style={{ width: '100%' }} />
                ) : bulkJobProgress?.job?.total_files > 0 ? (
                  <div 
                    className={`h-full transition-all duration-500 ${
                      bulkJobProgress?.job?.status === 'paused' ? 'bg-amber-500' : 'bg-purple-600'
                    }`} 
                    style={{ width: `${((bulkJobProgress.items_stats?.filter(s => s.status !== 'pending' && s.status !== 'processing').reduce((a,b)=>a+b.count,0) || 0) / bulkJobProgress.job.total_files) * 100}%` }}
                  ></div>
                ) : null}
              </div>
              <div className="flex justify-between items-center mb-4 mt-1">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  {bulkJobProgress?.job?.status === 'paused' ? (
                    <>
                      <Pause size={14} className="text-amber-500" /> Queue Paused
                    </>
                  ) : bulkJobProgress?.job?.status === 'extracting' ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-purple-600" /> Scanning &amp; Queueing Files...
                    </>
                  ) : (
                    <>
                      <Loader2 size={14} className="animate-spin text-purple-600" /> Processing Candidates
                    </>
                  )}
                </h3>
                {bulkJobProgress?.job?.status === 'extracting' ? (
                  <span className="text-sm font-semibold text-purple-600">
                    {bulkJobProgress?.job?.total_files > 0 ? `${bulkJobProgress.job.total_files} queued` : 'Scanning...'}
                  </span>
                ) : bulkJobProgress?.job?.total_files > 0 ? (
                  <span className={`text-sm font-semibold ${
                    bulkJobProgress?.job?.status === 'paused' ? 'text-amber-600' : 'text-purple-600'
                  }`}>
                    {Math.round(((bulkJobProgress.items_stats?.filter(s => s.status !== 'pending' && s.status !== 'processing').reduce((a,b)=>a+b.count,0) || 0) / bulkJobProgress.job.total_files) * 100)}%
                  </span>
                ) : null}
              </div>
              {(() => {
                const failedCount = bulkJobProgress?.items_stats?.find(s => s.status === 'failed')?.count || 0;
                if (failedCount > 0) {
                  return (
                    <div className="flex items-center gap-3 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <span className="text-red-400 font-medium">
                        {failedCount} file(s) failed
                      </span>
                      <button
                        onClick={handleRetryFailed}
                        className="px-3 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-md text-sm font-medium transition-colors"
                      >
                        Retry Failed
                      </button>
                    </div>
                  );
                }
                return null;
              })()}
              <div className="flex flex-wrap gap-3">
                {bulkJobProgress?.items_stats?.map(st => (
                  <div key={st.status} className="bg-gray-50 px-4 py-2 rounded-lg text-sm border border-gray-100 flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      st.status === 'success' ? 'bg-emerald-500' : 
                      st.status === 'failed' ? 'bg-rose-500' : 
                      st.status === 'pending' ? 'bg-gray-300' : 'bg-amber-500'
                    }`}></div>
                    <span className="text-gray-500 font-medium mr-2">{st.status}:</span>
                    <span className="text-gray-800 font-semibold">{st.count}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-6">
                <p className="text-xs text-gray-500">Total Files Discovered: {bulkJobProgress?.job?.total_files || '...'}</p>
                <div className="flex gap-3 items-center">
                  {bulkJobProgress?.job?.status === 'paused' ? (
                    <button onClick={handleResumeQueue} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-xs font-medium transition-colors flex items-center gap-1">
                      <Play size={12} /> Resume
                    </button>
                  ) : (
                    <button onClick={handlePauseQueue} className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg text-xs font-medium transition-colors flex items-center gap-1">
                      <Pause size={12} /> Pause
                    </button>
                  )}
                  <button onClick={() => handleCancelQueue()} className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-medium transition-colors">
                    Cancel Queue
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : currentTab === 'offers' ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <OfferApprovals />
        </div>
      ) : currentTab === 'active' ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <ActiveCandidates onViewProfile={(c) => setDrawerCandidate(c)} />
        </div>
      ) : currentTab === 'repo' ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <ResumeRepo onBulkUpload={handleBulkUploadDirect} onViewProfile={(c) => setDrawerCandidate(c)} />
        </div>
      ) : currentTab === 'invite-status' ? (
        <div className="flex-1 flex items-center justify-center">
          {!inviteStatusRoleId ? (
            <div className="bg-white rounded-2xl flex flex-col items-center justify-center gap-4 py-16 px-12 border border-gray-200 shadow-sm max-w-md w-full">
              <Briefcase size={40} className="text-gray-300" />
              <div>
                <p className="text-lg font-semibold text-gray-800 mb-1">Select a Job Role</p>
                <p className="text-sm text-gray-500">Choose a role from the dropdown above to view invite tracking.</p>
              </div>
              <select
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 transition-colors mt-2"
                value={inviteStatusRoleId}
                onChange={e => { setInviteStatusRoleId(e.target.value); setShowInviteStatus(e.target.value !== ''); }}
              >
                <option value="">Select a role...</option>
                {jobRoles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-gray-500">Role selected. Click <span className="text-purple-600 font-semibold">View Invites</span> in the header.</p>
            </div>
          )}
          {showInviteStatus && inviteStatusRoleId && (
            <InviteStatus
              roleId={inviteStatusRoleId}
              roleName={jobRoles.find(r => String(r.id) === String(inviteStatusRoleId))?.title}
              onClose={() => setShowInviteStatus(false)}
            />
          )}
        </div>
      ) : (
        <>
          {/* ── Filter Bar ── */}
          {showFilters && (
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-wrap gap-4 items-end shrink-0">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">Job Role</label>
                <div className="flex items-center gap-2">
                  <select
                    className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 transition-colors"
                    value={filters.role_id}
                    onChange={e => {
                      const newRoleId = e.target.value;
                      setFilters(f => ({ 
                        ...f, 
                        role_id: newRoleId,
                      }));
                    }}
                  >
                    <option value="">All Roles</option>
                    {jobRoles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">Job Role Tags</label>
                <MultiSelectDropdown
                  options={tagOptions}
                  selected={filters.tags || []}
                  onChange={(newSelected) => setFilters(f => ({ ...f, tags: newSelected, tag: '' }))}
                  placeholder="All Tags"
                  emptyText="No tags found"
                  widthClass="w-52"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">Status</label>
                <select
                  className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 transition-colors"
                  value={filters.pool}
                  onChange={e => setFilters(f => ({ ...f, pool: e.target.value }))}
                >
                  <option value="all">All</option>
                  <option value="new">New</option>
                  <option value="favourite">Favorite</option>
                  <option value="invited">Invited</option>
                  <option value="hired">Hired</option>
                  <option value="archived">Archived</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">Experience</label>
                <select
                  className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 transition-colors"
                  value={filters.exp_range}
                  onChange={e => setFilters(f => ({ ...f, exp_range: e.target.value }))}
                >
                  <option value="">Any</option>
                  <option value="fresher">Fresher (&lt; 1 yr)</option>
                  <option value="1-2">1 - 2 years</option>
                  <option value="2-5">2 - 5 years</option>
                  <option value="5+">5+ years</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">Upload Date</label>
                <MultiSelectDropdown 
                  options={uploadDateOptions} 
                  selected={filters.upload_time} 
                  onChange={(newSelected) => setFilters(f => ({ ...f, upload_time: newSelected }))} 
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">Location</label>
                <input
                  type="text" placeholder="City or Remote"
                  className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 transition-colors"
                  value={filters.location}
                  onChange={e => setFilters(f => ({ ...f, location: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">Sort By</label>
                <select
                  className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 transition-colors"
                  value={filters.sort_by}
                  onChange={e => setFilters(f => ({ ...f, sort_by: e.target.value }))}
                >
                  <option value="newest">Newest</option>
                  <option value="experience">Experience</option>
                  {filters.role_id && (
                    <>
                      <option value="required_score">Required Skills Score</option>
                      <option value="preferred_score">Preferred Skills Score</option>
                    </>
                  )}
                </select>
              </div>

              {filters.role_id && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-500">Show</label>
                  <select
                    className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 transition-colors"
                    value={filters.limit}
                    onChange={e => setFilters(f => ({ ...f, limit: parseInt(e.target.value) }))}
                  >
                    {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              )}

              <button
                onClick={fetchCandidates}
                className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors duration-150 shadow-sm"
              >
                Apply
              </button>
              <button
                onClick={() => setFilters(initFilters)}
                className="px-5 py-2.5 text-gray-500 rounded-xl text-sm font-medium hover:text-gray-700 transition-colors duration-150"
              >
                Reset
              </button>
              <button
                onClick={() => setShowReportModal(true)}
                className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 hover:border-gray-300 transition-colors duration-150 flex items-center gap-2 shadow-xs"
                title="Generate Candidate Shortlist Report (CSV, Excel, PDF)"
              >
                <FileSpreadsheet size={14} className="text-purple-600" />
                <span>Generate Report</span>
              </button>
              {(() => {
                const selectedTags = (filters.tags && filters.tags.length > 0)
                  ? filters.tags
                  : (filters.tag ? [filters.tag] : []);
                const count = selectedTags.length;
                let tagLabel = '';
                if (count === 1) {
                  tagLabel = selectedTags[0] === '__untagged__' ? 'General Pool' : selectedTags[0];
                } else if (count > 1) {
                  tagLabel = `${count} Tags`;
                }

                if (filters.role_id) {
                  return (
                    <button
                      onClick={() => handleAutoRank(filters.role_id, selectedTags)}
                      disabled={autoRanking}
                      className="px-6 py-2.5 ml-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors duration-150 flex items-center gap-2 shadow-sm disabled:opacity-50"
                      title={count > 0 ? `Score only CVs matching ${tagLabel} against selected role` : 'Auto score all candidates in database'}
                    >
                      {autoRanking ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                      {count > 0 ? `Score: ${tagLabel}` : `Auto Score All`}
                    </button>
                  );
                }
                if (count > 0) {
                  return (
                    <button
                      onClick={() => toast.error('Please select a Job Role in the filter above to score these candidates against')}
                      className="px-5 py-2.5 ml-auto bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-sm font-semibold hover:bg-purple-100 transition-colors duration-150 flex items-center gap-2 shadow-xs"
                      title="Select a Job Role in the filter to score these tags"
                    >
                      <Zap size={14} /> Score Tags (Select Role First)
                    </button>
                  );
                }
                return null;
              })()}
            </div>
          )}

          {/* ── Candidate Table ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Table header */}
          <div className={`grid ${filters.role_id ? 'grid-cols-[40px_1fr_95px_95px_90px_110px_100px_56px]' : 'grid-cols-[40px_1fr_90px_110px_100px_56px]'} gap-4 px-6 py-3 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider shrink-0 items-center bg-gray-50/50`}>
            <div className="flex items-center justify-center" onClick={toggleAll}>
              <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors cursor-pointer ${allSelected ? 'bg-purple-600 border-purple-600' : 'border-gray-300 hover:border-purple-400'}`}>
                {allSelected && <span className="text-white text-xs font-bold">✓</span>}
              </div>
            </div>
            <div>Candidate</div>
            {filters.role_id && (
              <>
                <div className="text-center font-bold text-rose-700">Required</div>
                <div className="text-center font-bold text-emerald-700">Preferred</div>
              </>
            )}
            <div className="text-center">Experience</div>
            <div className="text-center">Status</div>
            <div>Location</div>
            <div></div>
          </div>

          {/* Rows - Scrollable */}
          <div 
            className="flex-1 overflow-y-auto divide-y divide-gray-100" 
            style={{ 
              overscrollBehavior: 'contain',
              maxHeight: '500px',  // ← This triggers scrolling when content exceeds 600px
              minHeight: '400px'
            }}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-3 py-24 text-gray-500">
                <Loader2 size={24} className="animate-spin text-purple-600" />
                <span className="text-sm font-medium">Syncing directory...</span>
              </div>
            ) : candidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                <Database size={48} className="text-gray-300" />
                <div>
                  <p className="text-lg font-semibold text-gray-800 mb-1">Directory is empty</p>
                  <p className="text-sm text-gray-500">Upload resumes to get started</p>
                </div>
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                <Search size={48} className="text-gray-300" />
                <div>
                  <p className="text-lg font-semibold text-gray-800 mb-1">No matches found</p>
                  <p className="text-sm text-gray-500">Try adjusting your search query</p>
                </div>
              </div>
            ) : (
              filteredCandidates.map(c => (
                <div
                  key={c.id}
                  onClick={() => setDrawerCandidate(c)}
                  className={`grid ${filters.role_id ? 'grid-cols-[40px_1fr_95px_95px_90px_110px_100px_56px]' : 'grid-cols-[40px_1fr_90px_110px_100px_56px]'} gap-4 px-6 py-4 items-center cursor-pointer transition-colors duration-150 group ${drawerCandidate?.id === c.id ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
                >
                  {/* Checkbox */}
                  <div className="flex items-center justify-center" onClick={e => { e.stopPropagation(); toggle(c.id); }}>
                    <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${selectedIds.has(c.id) ? 'bg-purple-60 border-purple-600' : 'border-gray-300 hover:border-purple-400'}`}>
                      {selectedIds.has(c.id) && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                  </div>

                  {/* Identity */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center font-semibold text-sm text-purple-700 group-hover:border-purple-300 transition-colors shrink-0">
                      {(c.full_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800 text-sm truncate m-0">{c.full_name || '—'}</p>
                        {c.tags && Array.isArray(c.tags) && c.tags.length > 0 ? (
                          c.tags.slice(0, 3).map((t, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded font-medium">
                              <Tag size={10} /> {t}
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded font-medium">
                            General Pool
                          </span>
                        )}
                        {c.tags && c.tags.length > 3 && (
                          <span className="text-[10px] text-gray-400 font-medium">+{c.tags.length - 3}</span>
                        )}
                      </div>
                      <InlineEmailEditor candidate={c} fetchCandidates={fetchCandidates} />
                    </div>
                  </div>

                  {/* Required & Preferred Scores */}
                  {filters.role_id && (() => {
                    const reqTot = c.required_total || 0;
                    const reqMat = c.required_matched || 0;
                    const reqPct = reqTot > 0 ? Math.round((reqMat / reqTot) * 100) : (c.required_score != null ? Math.round(c.required_score) : null);

                    const prefTot = c.preferred_total || 0;
                    const prefMat = c.preferred_matched || 0;
                    const prefPct = prefTot > 0 ? Math.round((prefMat / prefTot) * 100) : (c.preferred_score != null ? Math.round(c.preferred_score) : null);

                    return (
                      <>
                        {/* Required */}
                        <div className="flex flex-col items-center justify-center">
                          <span 
                            className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${SCORE_COLOR(reqPct)}`}
                            title={reqTot > 0 ? `${reqMat}/${reqTot} required skills matched` : 'No required skills'}
                          >
                            {reqPct != null ? `${reqPct}%` : '—'}
                          </span>
                          {reqTot > 0 && (
                            <span className="text-[10px] text-gray-400 font-medium mt-0.5">
                              {reqMat}/{reqTot}
                            </span>
                          )}
                        </div>

                        {/* Preferred */}
                        <div className="flex flex-col items-center justify-center">
                          <span 
                            className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${SCORE_COLOR(prefPct)}`}
                            title={prefTot > 0 ? `${prefMat}/${prefTot} preferred skills matched` : 'No preferred skills'}
                          >
                            {prefPct != null ? `${prefPct}%` : '—'}
                          </span>
                          {prefTot > 0 && (
                            <span className="text-[10px] text-gray-400 font-medium mt-0.5">
                              {prefMat}/{prefTot}
                            </span>
                          )}
                        </div>
                      </>
                    );
                  })()}

                  {/* Exp */}
                  <div className="text-center">
                    <span className="text-sm font-medium text-gray-700">{c.total_experience_years ?? '—'} yrs</span>
                  </div>

                  {/* Status */}
                  <div className="flex justify-center">
                    <span className={`px-3 py-1 rounded-lg border text-xs font-medium ${STATUS_STYLE[c.status?.toLowerCase()] || 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                      {c.status || 'New'}
                    </span>
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-1.5 text-gray-500 min-w-0">
                    <MapPin size={12} className="shrink-0" />
                    <span className="text-xs truncate">{c.location || 'N/A'}</span>
                  </div>

                  {/* Delete */}
                  <div className="flex justify-center" onClick={e => handleDelete(c.id, e)}>
                    <button aria-label="Delete candidate permanently" className="p-2 rounded-lg text-gray-300 hover:text-rose-600 hover:bg-rose-50 transition-colors duration-150 opacity-0 group-hover:opacity-100">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        </>
      )}

      {/* ── Bulk Action Bar ── */}
{anySelected && (
  <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-8 py-4 bg-white rounded-2xl border border-purple-200 shadow-2xl">
    <span className="text-sm font-semibold text-purple-600">{selectedIds.size} selected</span>
    <div className="w-px h-6 bg-gray-200" />
    
    {/* ── SELECT ALL BUTTON ── */}
    <button
      onClick={toggleAll}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-50 border border-purple-300 text-purple-700 text-sm font-medium hover:bg-purple-100 transition-colors duration-150"
    >
      <CheckSquare size={14} /> {allSelected ? 'Deselect All' : 'Select All'}
    </button>
    
    <button
      onClick={() => setShowScore(true)}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors duration-150"
    >
      <Star size={14} /> Score vs Role
    </button>
    <button
      onClick={() => {
        setBulkTagInput('');
        setBulkSelectedTags([]);
        setBulkTagAction('add');
        setShowBulkTagModal(true);
      }}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors duration-150"
    >
      <Tag size={14} /> Manage Tags
    </button>
    <button
      onClick={() => setShowInvite(true)}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors duration-150"
    >
      <Send size={14} /> Send Invite
    </button>
    <button
      onClick={async () => {
        if(!confirm('Are you sure you want to delete these candidates?')) return;
        try {
          const r = await fetch('/api/source/candidates/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candidate_ids: Array.from(selectedIds) }),
            credentials: 'include'
          });
          if(r.ok) {
            toast.success('Candidates deleted successfully');
            setSelectedIds(new Set());
            fetchCandidates();
          } else {
            toast.error('Failed to delete candidates');
          }
        } catch(e) {
          toast.error('Error deleting candidates');
        }
      }}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-100 hover:border-rose-300 transition-colors duration-150"
    >
      <Trash2 size={14} /> Delete
    </button>

    <button onClick={clearSel} className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors duration-150">
      <X size={16} />
    </button>
  </div>
)}

      {/* ── Candidate Profile Drawer ── */}
      <CandidateDrawer
        candidate={drawerCandidate}
        jobRoles={jobRoles}
        roleId={filters.role_id}
        onClose={() => setDrawerCandidate(null)}
        onRefresh={fetchCandidates}
      />

      {/* ── Quick Upload Modal ── */}
      {showUpload && (
        <Modal onClose={() => setShowUpload(false)} title="Upload Resume">
          <input ref={quickUploadFileRef} type="file" accept=".pdf,.doc,.docx,.txt,.zip" className="hidden" onChange={handleUpload} multiple />
          <button
            onClick={() => quickUploadFileRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center gap-6 w-full border-2 border-dashed border-gray-300 rounded-2xl p-16 hover:border-purple-400 hover:bg-purple-50/50 transition-colors duration-150 cursor-pointer"
          >
            {uploading ? (
              <><Loader2 size={40} className="text-purple-600 animate-spin" /><p className="text-sm font-medium text-gray-700">Processing resume...</p></>
            ) : (
              <><Upload size={40} className="text-purple-400" /><div><p className="text-base font-semibold text-gray-800 mb-1">Click to select file(s)</p><p className="text-sm text-gray-500">PDF, DOC, DOCX, TXT, ZIP</p></div></>
            )}
          </button>
        </Modal>
      )}

      {/* ── Upload Tag Assignment Modal ── */}
      {showUploadTagModal && (
        <Modal onClose={handleCancelUploadTagModal} title="Upload Resumes">
          <div className="flex flex-col gap-4">
            {/* Staged Files Preview */}
            <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200/80 max-h-36 overflow-y-auto">
              <div className="text-xs font-semibold text-gray-700 mb-2 flex justify-between items-center">
                <span className="flex items-center gap-1.5 font-bold">
                  <FileText size={14} className="text-purple-600" />
                  Selected Files ({stagedUploadFiles.length})
                </span>
                <span className="text-[11px] text-gray-400 font-medium">PDF, DOCX, TXT, ZIP</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {stagedUploadFiles.slice(0, 5).map((file, i) => (
                  <div key={i} className="text-xs text-gray-600 flex items-center justify-between gap-2 py-0.5 px-1.5 rounded hover:bg-gray-100">
                    <span className="truncate flex-1 font-medium">{file.name}</span>
                    <span className="text-[11px] text-gray-400 shrink-0 font-mono">{(file.size / 1024).toFixed(0)} KB</span>
                  </div>
                ))}
                {stagedUploadFiles.length > 5 && (
                  <span className="text-[11px] text-purple-600 font-medium italic mt-0.5">
                    +{stagedUploadFiles.length - 5} more files selected
                  </span>
                )}
              </div>
            </div>

            {/* Target Month Folder (Optional) */}
            {Array.isArray(repoFolders) && repoFolders.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Target Month Folder
                </label>
                <select
                  className="form-input w-full text-xs"
                  value={uploadTargetMonth}
                  onChange={e => setUploadTargetMonth(e.target.value)}
                >
                  <option value="">Auto-Detect / Current Month Folder</option>
                  {repoFolders.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.label || f.id} ({f.count || 0} resumes)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* TAG ASSIGNMENT SECTION */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  Assign Job Role Tag(s)
                </label>
                <p className="text-[11px] text-gray-500 mb-2">
                  Select job roles to categorize these resumes. You can filter and score candidates by these tags.
                </p>

                {/* Multi-Select Dropdown with Search */}
                <div className="mb-2.5">
                  <MultiSelectDropdown
                    options={jobRoleTagOptions}
                    selected={uploadSelectedTags}
                    onChange={setUploadSelectedTags}
                    placeholder="Select Job Role(s)..."
                    emptyText={jobRoleTagOptions.length === 0 ? "No active job roles found. Create job roles in Roles tab." : "No matching job roles"}
                    widthClass="w-full"
                    searchable={true}
                    searchPlaceholder="Search job roles..."
                  />
                </div>

                {/* Selected Tags Display */}
                <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 bg-purple-50/50 border border-purple-100 rounded-xl items-center">
                  {uploadSelectedTags.length === 0 ? (
                    <span className="text-xs text-purple-500 italic flex items-center gap-1">
                      No job roles selected → Will be stored in <strong>General Pool (Untagged)</strong>
                    </span>
                  ) : (
                    uploadSelectedTags.map(tag => (
                      <span 
                        key={tag} 
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-600 text-white shadow-xs"
                      >
                        💼 {tag}
                        <button 
                          type="button" 
                          onClick={() => handleRemoveUploadTag(tag)}
                          className="hover:text-red-200 ml-1 transition-colors cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* General Pool Notice */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-800 leading-snug">
                💡 <strong>Tip:</strong> Job role tagging is optional. Resumes without tags land in the <strong>General Pool</strong> and can be tagged, re-tagged, or filtered at any time.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100 mt-1">
              <button 
                type="button" 
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                onClick={handleCancelUploadTagModal}
                disabled={uploading}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleConfirmUploadWithTags}
                disabled={uploading || stagedUploadFiles.length === 0}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-xl text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploadSelectedTags.length > 0 
                  ? `Upload ${stagedUploadFiles.length} File(s) with ${uploadSelectedTags.length} Tag(s)` 
                  : `Upload ${stagedUploadFiles.length} File(s) to General Pool`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── New / Edit Role Modal ── */}
      {showNewRole && (
        <Modal onClose={() => setShowNewRole(false)} title={newRole.id ? "Edit Job Role" : "Create Job Role"}>
          <form onSubmit={handleSaveRole} className="flex flex-col gap-5">
            <Field label="Role Title" required>
              <input required className="form-input" placeholder="e.g. Senior Backend Engineer" value={newRole.title} onChange={e => setNewRole(r => ({ ...r, title: e.target.value }))} />
            </Field>
            <Field label="Description">
              <textarea rows={3} className="form-input resize-none" placeholder="Describe requirements..." value={newRole.description} onChange={e => setNewRole(r => ({ ...r, description: e.target.value }))} />
            </Field>
            <Field label="Min. Experience (years)">
              <input type="number" min={0} className="form-input" value={newRole.min_experience} onChange={e => setNewRole(r => ({ ...r, min_experience: parseInt(e.target.value) || 0 }))} />
            </Field>



            {/* Skills Builder */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Role Skills ({newRole.required_skills.length})
                </label>
                <span className="text-[11px] font-semibold flex items-center gap-2">
                  <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-lg font-bold">
                    {newRole.required_skills.filter(s => {
                      const l = (s.level || 'required').toLowerCase();
                      return l === 'required' || l === 'critical' || l === 'expert' || l === 'advanced';
                    }).length} Required
                  </span>
                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg font-bold">
                    {newRole.required_skills.filter(s => {
                      const l = (s.level || 'required').toLowerCase();
                      return l === 'preferred' || l === 'optional' || l === 'intermediate' || l === 'beginner';
                    }).length} Preferred
                  </span>
                </span>
              </div>

              {/* Existing skill chips */}
              {newRole.required_skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 max-h-48 overflow-y-auto p-2 bg-gray-50 border border-gray-100 rounded-xl">
                  {newRole.required_skills.map((s, i) => {
                    const skillName = s.name || s.skill || (typeof s === 'string' ? s : '');
                    const rawLvl = (s.level || 'required').toLowerCase();
                    const isReq = rawLvl === 'required' || rawLvl === 'critical' || rawLvl === 'expert' || rawLvl === 'advanced';
                    const isEditingThis = editingSkillIdx === i;

                    if (isEditingThis) {
                      return (
                        <div key={i} className="flex items-center gap-1.5 p-1 bg-white border-2 border-purple-400 rounded-xl shadow-xs">
                          <input
                            type="text"
                            autoFocus
                            className="text-xs px-2 py-1 border border-gray-200 rounded-lg outline-none text-gray-800 w-32"
                            value={editingSkillName}
                            onChange={e => setEditingSkillName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (editingSkillName.trim()) {
                                  updateSkillInRole(i, { skill: editingSkillName.trim(), name: editingSkillName.trim() });
                                }
                                setEditingSkillIdx(null);
                              } else if (e.key === 'Escape') {
                                setEditingSkillIdx(null);
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => toggleSkillLevel(i)}
                            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                              isReq ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                            title="Click to toggle level"
                          >
                            {isReq ? 'Required' : 'Preferred'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (editingSkillName.trim()) {
                                updateSkillInRole(i, { skill: editingSkillName.trim(), name: editingSkillName.trim() });
                              }
                              setEditingSkillIdx(null);
                            }}
                            className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                            title="Save"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSkillIdx(null)}
                            className="p-1 rounded-md text-gray-400 hover:bg-gray-100 cursor-pointer"
                            title="Cancel"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={i}
                        className={`group flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                          isReq
                            ? 'bg-rose-50/80 border-rose-200 hover:border-rose-300 text-gray-900'
                            : 'bg-emerald-50/80 border-emerald-200 hover:border-emerald-300 text-gray-900'
                        }`}
                      >
                        {/* Skill Name */}
                        <span
                          onClick={() => { setEditingSkillIdx(i); setEditingSkillName(skillName); }}
                          className="cursor-pointer hover:underline font-bold text-gray-900 text-xs"
                          title="Click to edit name"
                        >
                          {skillName}
                        </span>

                        {/* Level badge (click to toggle) */}
                        <button
                          type="button"
                          onClick={() => toggleSkillLevel(i)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider cursor-pointer transition-transform active:scale-95 shadow-2xs ${
                            isReq
                              ? 'bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                          }`}
                          title="Click to toggle between Required and Preferred"
                        >
                          {isReq ? 'Required' : 'Preferred'}
                        </button>

                        {/* Edit button */}
                        <button
                          type="button"
                          onClick={() => { setEditingSkillIdx(i); setEditingSkillName(skillName); }}
                          className={`p-0.5 rounded cursor-pointer ${
                            isReq ? 'text-gray-400 hover:text-rose-700' : 'text-gray-400 hover:text-emerald-700'
                          }`}
                          title="Edit skill name"
                        >
                          <Edit size={11} />
                        </button>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => removeSkillFromRole(i)}
                          className="p-0.5 text-gray-400 hover:text-rose-600 rounded cursor-pointer"
                          title="Remove skill"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add new skill row */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-purple-500 focus:bg-white transition-colors"
                  style={{ flex: '1 1 0%', minWidth: '0' }}
                  placeholder="Skill name e.g. Python"
                  value={newSkillInput.name}
                  onChange={e => setNewSkillInput(s => ({ ...s, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkillToRole(); } }}
                />
                <select
                  className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-purple-500 focus:bg-white transition-colors cursor-pointer shrink-0 font-medium"
                  style={{ width: '135px' }}
                  value={newSkillInput.level}
                  onChange={e => setNewSkillInput(s => ({ ...s, level: e.target.value }))}
                >
                  <option value="required">Required</option>
                  <option value="preferred">Preferred</option>
                </select>
                <button
                  type="button"
                  onClick={addSkillToRole}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors whitespace-nowrap shrink-0 flex items-center justify-center gap-1 shadow-sm"
                >
                  + Add
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">
                Click a skill's badge to toggle between <strong className="text-rose-700 font-bold">Required</strong> and <strong className="text-emerald-700 font-bold">Preferred</strong>, or click the name to edit.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowNewRole(false)} className="flex-1 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors">Cancel</button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold shadow-sm transition-colors hover:bg-purple-700"
              >
                {newRole.id ? "Save Changes" : "Create Role"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Score Modal ── */}
      {showScore && (
        <Modal onClose={() => setShowScore(false)} title={`Score ${selectedIds.size} candidate${selectedIds.size > 1 ? 's' : ''}`}>
          <form onSubmit={handleScore} className="flex flex-col gap-5">
            <p className="text-sm text-gray-500">Run AI fit analysis for selected candidates against a job role.</p>
            <Field label="Job Role" required>
              <select required className="form-input" value={scoreRoleId} onChange={e => setScoreRoleId(e.target.value)}>
                <option value="">Select role...</option>
                {jobRoles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowScore(false)} className="flex-1 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors">Cancel</button>
              <button type="submit" disabled={scoring} className="flex-1 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 shadow-sm">
                {scoring ? 'Scoring...' : 'Run AI Score'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Bulk Tag Modal ── */}
      {showBulkTagModal && (
        <Modal onClose={() => setShowBulkTagModal(false)} title={`Manage Tags (${selectedIds.size} selected)`}>
          <form onSubmit={handleBulkTagSubmit} className="flex flex-col gap-4">
            <div className="flex gap-2">
              {[
                { id: 'add', label: 'Add Tags' },
                { id: 'remove', label: 'Remove Tags' },
                { id: 'set', label: 'Replace All Tags' }
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setBulkTagAction(m.id)}
                  className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                    bulkTagAction === m.id
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Job Role Tag(s) to {bulkTagAction === 'remove' ? 'Remove' : bulkTagAction === 'set' ? 'Set' : 'Add'}
              </label>
              <p className="text-[11px] text-gray-500 mb-2">
                Select active job roles to {bulkTagAction === 'remove' ? 'remove from' : bulkTagAction === 'set' ? 'assign as sole tags to' : 'add to'} the {selectedIds.size} selected candidate(s).
              </p>

              {/* Multi-Select Dropdown with Search */}
              <div className="mb-2.5">
                <MultiSelectDropdown
                  options={jobRoleTagOptions}
                  selected={bulkSelectedTags}
                  onChange={setBulkSelectedTags}
                  placeholder={`Select Job Role(s) to ${bulkTagAction === 'remove' ? 'remove' : bulkTagAction === 'set' ? 'set' : 'add'}...`}
                  emptyText={jobRoleTagOptions.length === 0 ? "No active job roles found. Create job roles in Roles tab." : "No matching job roles"}
                  widthClass="w-full"
                  searchable={true}
                  searchPlaceholder="Search job roles..."
                />
              </div>

              {/* Selected Tags Display */}
              <div className="flex flex-wrap gap-1.5 min-h-[34px] p-2 bg-gray-50 border border-gray-200 rounded-xl items-center">
                {bulkSelectedTags.length === 0 ? (
                  <span className="text-xs text-gray-400 italic">No job roles chosen yet</span>
                ) : (
                  bulkSelectedTags.map(tag => (
                    <span 
                      key={tag} 
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        bulkTagAction === 'remove' ? 'bg-red-600 text-white' : 'bg-purple-600 text-white'
                      }`}
                    >
                      💼 {tag}
                      <button 
                        type="button" 
                        onClick={() => setBulkSelectedTags(prev => prev.filter(t => t !== tag))}
                        className="hover:text-red-200 ml-0.5 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowBulkTagModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={bulkTagging}
                className="px-5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl disabled:opacity-50 transition-colors"
              >
                {bulkTagging ? 'Applying...' : 'Apply Tags'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Invite Modal ── */}
      {showInvite && (
        <Modal onClose={() => setShowInvite(false)} title={`Invite ${selectedIds.size} candidate${selectedIds.size > 1 ? 's' : ''}`}>
          <form onSubmit={handleInvite} className="flex flex-col gap-5">
            <Field label="Job Role" required>
              <select required className="form-input" value={inviteForm.role_id} onChange={e => setInviteForm(f => ({ ...f, role_id: e.target.value }))}>
                <option value="">Select role...</option>
                {jobRoles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </Field>
            
            <Field label="Invitation Email Template">
              <select
                className="form-input"
                value={inviteForm.templateType}
                onChange={e => setInviteForm(f => ({ ...f, templateType: e.target.value }))}
              >
                <option value="prebuilt">Pre-built (Default Phygitron 360 Template)</option>
                <option value="custom">Custom Template</option>
              </select>
            </Field>

            {inviteForm.templateType === 'custom' && (
              <>
                <Field label="Email Subject">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Invitation to complete pre-employment assessment"
                    value={inviteForm.subject}
                    onChange={e => setInviteForm(f => ({ ...f, subject: e.target.value }))}
                  />
                </Field>
                <Field label="Email Body (Markdown supported)">
                  <textarea
                    rows={5}
                    className="form-input resize-none"
                    placeholder={`Dear {candidate_name},\n\nWe invite you to take the assessment for {role}.\nYour temporary password is: {temp_password}\nLink: {assessment_link}`}
                    value={inviteForm.custom_body}
                    onChange={e => setInviteForm(f => ({ ...f, custom_body: e.target.value }))}
                  />
                  <div className="text-xs text-gray-500 leading-relaxed mt-1">
                    <strong>Guidelines:</strong> You can use these tokens:
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      <li><code className="text-purple-600">{`{candidate_name}`}</code> - Full name</li>
                      <li><code className="text-purple-600">{`{role}`}</code> - Job role title</li>
                      <li><code className="text-purple-600">{`{org_name}`}</code> - Organization name</li>
                      <li><code className="text-purple-600">{`{assessment_link}`}</code> - URL to access the portal</li>
                      <li><code className="text-purple-600">{`{temp_password}`}</code> - Temporary password</li>
                    </ul>
                  </div>
                </Field>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowInvite(false)} className="flex-1 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors">Cancel</button>
              <button type="submit" className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">Send Invites</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Candidate Report Modal ── */}
      <CandidateReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        candidates={filteredCandidates}
        roleTitle={currentRoleTitle}
        filters={filters}
        companyName={user?.company_name || 'Phygitron 360'}
      />

      {/* ── Role Details Dialogue ── */}
      {viewingRole && (
        <RoleDetailsModal
          isOpen={Boolean(viewingRole)}
          role={viewingRole}
          onClose={() => setViewingRole(null)}
          onEdit={(role) => {
            setViewingRole(null);
            openEditRole(role);
          }}
          onViewCandidates={(roleId) => {
            setViewingRole(null);
            setFilters(prev => ({ ...prev, role_id: String(roleId) }));
            setTab('directory');
          }}
          candidateCount={candidates.filter(c => c.role_id === viewingRole.id).length}
          scoreStatus={scoreStatus[viewingRole.id]}
        />
      )}

        </div>
      </div>
    </div>

      {/* Global Floating Progress Widget (when not on upload tab) */}
      {bulkUploadTriggered && (bulkJobId || uploading) && currentTab !== 'upload' && (
        <div 
          className="fixed bottom-6 right-6 z-50 w-80 bg-white rounded-xl shadow-xl border border-purple-200 p-4 cursor-pointer hover:shadow-2xl transition-all"
          onClick={() => setTab('upload')}
        >
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              {uploading ? (
                <><Upload size={12} className="text-purple-600 animate-bounce" /> Uploading ZIP...</>
              ) : bulkJobProgress?.job?.status === 'paused' ? (
                <><Pause size={12} className="text-amber-500" /> Paused</>
              ) : bulkJobProgress?.job?.status === 'extracting' ? (
                <><Loader2 size={12} className="animate-spin text-purple-600" /> Scanning ZIP</>
              ) : (
                <><Loader2 size={12} className="animate-spin text-purple-600" /> Processing Resumes</>
              )}
            </h4>
            {uploading ? (
              <span className="text-xs font-bold text-purple-600">
                {Math.round(uploadProgress || 0)}%
              </span>
            ) : bulkJobProgress?.job?.status === 'extracting' ? (
              <span className="text-xs font-semibold text-purple-600">
                {bulkJobProgress?.job?.total_files > 0 ? `${bulkJobProgress.job.total_files} queued` : '...'}
              </span>
            ) : bulkJobProgress?.job?.total_files > 0 ? (
              <span className={`text-xs font-bold ${
                bulkJobProgress?.job?.status === 'paused' ? 'text-amber-600' : 'text-purple-600'
              }`}>
                {Math.round(((bulkJobProgress.items_stats?.filter(s => s.status !== 'pending' && s.status !== 'processing').reduce((a,b)=>a+b.count,0) || 0) / bulkJobProgress.job.total_files) * 100)}%
              </span>
            ) : null}
          </div>
          
          <div className="w-full bg-purple-100 h-1.5 rounded-full overflow-hidden">
            {uploading ? (
              <div 
                className="h-full bg-purple-600 transition-all duration-300"
                style={{ width: `${uploadProgress || 0}%` }}
              ></div>
            ) : bulkJobProgress?.job?.status === 'extracting' ? (
              <div className="h-full bg-purple-400 animate-pulse w-full"></div>
            ) : bulkJobProgress?.job?.total_files > 0 ? (
              <div 
                className={`h-full transition-all duration-500 ${
                  bulkJobProgress?.job?.status === 'paused' ? 'bg-amber-500' : 'bg-purple-600'
                }`} 
                style={{ width: `${((bulkJobProgress.items_stats?.filter(s => s.status !== 'pending' && s.status !== 'processing').reduce((a,b)=>a+b.count,0) || 0) / bulkJobProgress.job.total_files) * 100}%` }}
              ></div>
            ) : null}
          </div>
          <div className="flex justify-between items-center mt-2">
            <p className="text-[10px] text-gray-400 font-medium">Click to view details</p>
            {bulkJobId && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelQueue();
                }}
                className="text-[11px] font-semibold text-rose-500 hover:text-rose-700 hover:underline transition-colors"
              >
                Cancel Queue
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// ── Reusable sub-components ───────────────────────────────────────────────────
function Modal({ children, title, onClose }) {
  useEscapeClose(onClose);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl p-5 sm:p-8 shadow-2xl border border-gray-200 my-8 max-h-[85vh] overflow-y-auto">
        <div className="relative flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, required = false }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-gray-500">{label} {required && <span className="text-red-500">*</span>}</label>
      {children}
    </div>
  );
}