import React, { useState, useEffect, useMemo } from 'react';
import {
  X, MapPin, Mail, Phone, Briefcase, Clock,
  Zap, Shield, MessageSquare, CheckCircle,
  AlertTriangle, ExternalLink, UserCheck, Send,
  Star, Loader2, ChevronRight,
  Globe, Calendar, DollarSign, Activity, FileText,
  Award, Globe2, BookOpen, Plus, Trash2, Edit, Download, Tag, Target
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  isNonNegativeNumber,
  isPhone,
  isValidUrl,
} from '../../../core/utils/validators';
import useEscapeClose from '../../../core/hooks/useEscapeClose';
import useOverlayClose from '../../../core/hooks/useOverlayClose';
import useUnsavedChangesWarning from '../../../core/hooks/useUnsavedChangesWarning';
import { useAuth } from '../../../core/auth/AuthContext';

const LEVEL_COLOR = {
  beginner:     'bg-white/5 border-white/10 text-white/50',
  intermediate: 'bg-indigo/10 border-indigo/20 text-indigo',
  advanced:     'bg-primary/10 border-primary/20 text-primary',
  expert:       'bg-emerald-400/10 border-emerald-400/20 text-emerald-400',
};

const STATUS_STYLE = {
  active:      'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  favourite: 'bg-primary/10 text-primary border-primary/20',
  invited:     'bg-indigo/10 text-indigo border-indigo/20',
  hired:       'bg-secondary/10 text-secondary border-secondary/20',
  rejected:    'bg-rose-400/10 text-rose-400 border-rose-400/20',
  archived:    'bg-rose-400/5 text-rose-400/60 border-rose-400/10',
};

export default function CandidateDrawer({ candidate, jobRoles, roleId, onClose, onRefresh, onConvert }) {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const { hasPermission } = useAuth();
  useEscapeClose(onClose, !!candidate);

  // Edit Mode states
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillLevel, setNewSkillLevel] = useState('intermediate');
  const [newSkillYears, setNewSkillYears] = useState(1);
  const [savingProfile, setSavingProfile] = useState(false);

  // Status transition states
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Invite state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviting, setInviting] = useState(false);

  // Score state
  const [showScoreForm, setShowScoreForm] = useState(false);
  const [scoreRoleId, setScoreRoleId] = useState('');
  const [scoring, setScoring] = useState(false);

  // Offer state
  const [showOfferForm, setShowOfferForm] = useState(false);
  const offerOverlayHandlers = useOverlayClose(() => setShowOfferForm(false));
  useUnsavedChangesWarning(showOfferForm);
  const drawerOverlayHandlers = useOverlayClose(onClose);
  const [offerDetails, setOfferDetails] = useState({ 
    role_title: '', 
    salary: '', 
    department: '', 
    location: '', 
    start_date: '' 
  });
  const [offerPreview, setOfferPreview] = useState(null);
  const [generatingOffer, setGeneratingOffer] = useState(false);
  const [creatingOffer, setCreatingOffer] = useState(false);
  
  // ── Dropdown options ──
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState(['In-Office', 'Remote', 'Hybrid',]);

  // ── Fetch departments on mount ──
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await fetch('/api/options', { credentials: 'include' });
        const data = await res.json();
        if (data.departments && data.departments.length > 0) {
          setDepartments(data.departments);
        } else {
          setDepartments(['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'Human Resources', 'Finance', 'Operations', 'Quality Assurance']);
        }
        if (data.locations && data.locations.length > 0) {
          setLocations(data.locations);
        }
      } catch {
        // Use fallback defaults
        setDepartments(['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'Human Resources', 'Finance', 'Operations', 'Quality Assurance']);
      }
    };
    fetchDepartments();
  }, []);

  // Assessments state
  const [assessmentResults, setAssessmentResults] = useState([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  // Selected role for evaluating ATS fit (defaults to roleId passed from the active dashboard filter)
  const [activeEvalRoleId, setActiveEvalRoleId] = useState(roleId || '');

  useEffect(() => {
    setActiveEvalRoleId(roleId || '');
  }, [roleId]);

  const activeRole = useMemo(() => {
    if (!activeEvalRoleId || !jobRoles) return null;
    return jobRoles.find(r => String(r.id) === String(activeEvalRoleId));
  }, [activeEvalRoleId, jobRoles]);

  // AI analysis parsed from stored scores (strictly scoped to the active role if selected)
  const fitScore = activeEvalRoleId 
    ? profile?.ai_scores?.find(s => s.score_type === 'role_fit' && String(s.job_role_id) === String(activeEvalRoleId)) 
    : null;
  let fitData = null;
  try { fitData = fitScore ? JSON.parse(fitScore.reasoning) : null; } catch { /* ignore */ }

  const activeRoleFit = activeEvalRoleId ? (profile?.role_fit || candidate?.ats_detail || fitData || null) : null;
  const reqMatchedCount = activeRoleFit?.required_matched ?? candidate?.required_matched ?? fitData?.required_matched ?? 0;
  const reqTotalCount = activeRoleFit?.required_total ?? candidate?.required_total ?? fitData?.required_total ?? 0;
  const prefMatchedCount = activeRoleFit?.preferred_matched ?? candidate?.preferred_matched ?? fitData?.preferred_matched ?? 0;
  const prefTotalCount = activeRoleFit?.preferred_total ?? candidate?.preferred_total ?? fitData?.preferred_total ?? 0;

  // Strictly (matched / total) * 100
  const reqScore = reqTotalCount > 0 
    ? Math.round((reqMatchedCount / reqTotalCount) * 100) 
    : (activeRoleFit?.required_score != null ? Math.round(activeRoleFit.required_score) : null);
  const prefScore = prefTotalCount > 0 
    ? Math.round((prefMatchedCount / prefTotalCount) * 100) 
    : (activeRoleFit?.preferred_score != null ? Math.round(activeRoleFit.preferred_score) : null);

  const matchedSkills = activeRoleFit ? (activeRoleFit?.matched_skills || fitData?.matched || []) : [];
  const missingSkills = activeRoleFit ? (activeRoleFit?.missing_skills || fitData?.missing || []) : [];
  const partialSkills = activeRoleFit ? (activeRoleFit?.partial_skills || fitData?.partial || []) : [];

  const confidence = profile?.ai_scores?.find(s => s.score_type === 'confidence_signals');
  let confFlags = [];
  try { 
    const parsed = confidence ? JSON.parse(confidence.reasoning || '[]') : [];
    confFlags = Array.isArray(parsed) ? parsed.map(f => typeof f === 'string' ? f : (f.reason || f.skill || '')).filter(Boolean) : [];
  } catch { /* ignore */ }

  // Fetch full profile when drawer opens or active role changes
  useEffect(() => {
    if (!candidate) { setProfile(null); return; }
    setProfile(null);
    setLoadingProfile(true);
    setShowInviteForm(false);
    setShowScoreForm(false);
    setIsEditing(false);
    const url = activeEvalRoleId ? `/api/source/candidates/${candidate.id}?role_id=${activeEvalRoleId}` : `/api/source/candidates/${candidate.id}`;
    fetch(url)
      .then(r => r.json())
      .then(d => { 
        if (d.success) {
          setProfile(d.data); 
          if (d.data.user_id) {
            setLoadingAssessments(true);
            fetch(`/api/verify/submissions/user/${d.data.user_id}/results`)
              .then(r2 => r2.json())
              .then(d2 => { if (d2.success) setAssessmentResults(d2.data || []); })
              .catch(() => {})
              .finally(() => setLoadingAssessments(false));
          }
        }
      })
      .catch(() => { /* use shallow data */ })
      .finally(() => setLoadingProfile(false));
  }, [candidate?.id, activeEvalRoleId]);

  const data = profile || candidate;

  const downloadResume = async () => {
    try {
      const response = await fetch(`/api/source/candidates/${data.id}/resume`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error();

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = data.resume_path?.split('/').pop() || `${data.full_name || 'candidate'}_resume`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error('Failed to download resume');
    }
  };

  // ── Send invite ──────────────────────────────────────────────────────────
  const handleInvite = async (e) => {
    e?.preventDefault();
    if (!inviteRoleId) {
      return toast.error("Please select a Job Role to invite the candidate for.");
    }
    if (!window.confirm(`Are you sure you want to invite ${data.full_name || 'this candidate'} to the Trainee platform? They will receive an email with login credentials.`)) {
      return;
    }
    setInviting(true);
    try {
      const r = await fetch('/api/source/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          candidate_ids: [candidate.id], 
          job_role_id: parseInt(inviteRoleId), 
          subject: "Welcome to Phygitron 360 Trainee Portal", 
          custom_body: "Your profile has been selected. You can now log in to your Trainee dashboard.\n\nLogin URL: {assessment_link}\nTemporary Password: {temp_password}\n\nPlease log in and change your password immediately." 
        }),
      });
      const d = await r.json();
      if (r.ok) {
        toast.success('Invite sent!');
        setShowInviteForm(false);
        onRefresh();
      } else { toast.error(d.detail || 'Failed'); }
    } catch { toast.error('Error sending invite'); }
    finally { setInviting(false); }
  };

  // ── AI Score ─────────────────────────────────────────────────────────────
  const handleScore = async (e) => {
    e.preventDefault();
    if (!scoreRoleId) return toast.error('Select a role');
    setScoring(true);
    try {
      const r = await fetch('/api/source/score-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: parseInt(scoreRoleId), candidate_ids: [candidate.id] }),
      });
      const d = await r.json();
      if (r.ok) {
        toast.success('Scored!');
        setShowScoreForm(false);
        onRefresh();
        setActiveEvalRoleId(scoreRoleId);
      } else { toast.error(d.detail || 'Scoring failed'); }
    } catch { toast.error('Scoring error'); }
    finally { setScoring(false); }
  };

  // ── Status Transition ────────────────────────────────────────────────────
  const handleStatusUpdate = async (newStatus) => {
    setUpdatingStatus(true);
    const tid = toast.loading(`Updating status to ${newStatus}...`);
    try {
      const effRoleId = activeEvalRoleId || roleId;
      const r = await fetch(`/api/source/candidates/${candidate.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, role_id: effRoleId ? parseInt(effRoleId) : null }),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        toast.success(`Status updated to ${newStatus}`, { id: tid });
        onRefresh();
        setProfile(prev => prev ? { ...prev, status: newStatus } : { ...candidate, status: newStatus });
      } else {
        toast.error(d.detail || 'Failed to update status', { id: tid });
      }
    } catch {
      toast.error('Error updating status', { id: tid });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ── Edit Profile Helpers ─────────────────────────────────────────────────
  const startEditing = () => {
    setEditForm({
      first_name: data.first_name || '',
      middle_name: data.middle_name || '',
      last_name: data.last_name || '',
      email: data.email || '',
      phone: data.phone || '',
      location: data.location || '',
      total_experience_years: data.total_experience_years || 0,
      current_designation: data.current_designation || '',
      linkedin_url: data.linkedin_url || '',
      portfolio_url: data.portfolio_url || '',
      ai_summary: data.ai_summary || '',
      primary_skills: Array.isArray(data.primary_skills) ? data.primary_skills.join(', ') : '',
      secondary_skills: Array.isArray(data.secondary_skills) ? data.secondary_skills.join(', ') : '',
      tags: Array.isArray(data.tags) ? data.tags.join(', ') : '',
      certifications: Array.isArray(data.certifications) ? data.certifications : [],
      experience: Array.isArray(data.experience) ? data.experience : [],
      education: Array.isArray(data.education) ? data.education : [],
    });
    setIsEditing(true);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    const validationError = validateProfileEdit();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSavingProfile(true);
    const tid = toast.loading('Saving profile changes...');
    
    const payload = {
      ...editForm,
      primary_skills: editForm.primary_skills.split(',').map(s => s.trim()).filter(Boolean),
      secondary_skills: editForm.secondary_skills.split(',').map(s => s.trim()).filter(Boolean),
      tags: editForm.tags ? editForm.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
    };
    
    try {
      const r = await fetch(`/api/source/candidates/${candidate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        toast.success('Candidate profile updated!', { id: tid });
        setIsEditing(false);
        onRefresh();
        // Refetch complete profile to sync state
        const rr = await fetch(`/api/source/candidates/${candidate.id}`);
        const dd = await rr.json();
        if (dd.success) setProfile(dd.data);
      } else {
        toast.error(d.detail || 'Failed to save changes', { id: tid });
      }
    } catch {
      toast.error('Error saving changes', { id: tid });
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Offer Generation ──────────────────────────────────────────────────────
  const handleGenerateOffer = async (e) => {
    e.preventDefault();
    if (!offerDetails.role_title.trim()) return toast.error('Please select a Role Title');
    if (!offerDetails.salary.trim()) return toast.error('Salary is required');
    if (!offerDetails.department.trim()) return toast.error('Please select a Department');
    if (!offerDetails.location.trim()) return toast.error('Please select a Location');
    if (offerDetails.start_date && Number.isNaN(new Date(offerDetails.start_date).getTime())) return toast.error('Start date is invalid');
    setGeneratingOffer(true);
    try {
      const r = await fetch(`/api/source/candidates/${candidate.id}/offer-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerDetails),
      });
      const d = await r.json();
      if (r.ok) {
        setOfferPreview(d.data);
      } else {
        toast.error(d.detail || 'Generation failed');
      }
    } catch { toast.error('Error generating offer'); }
    finally { setGeneratingOffer(false); }
  };

  const validateProfileEdit = () => {
    if (!editForm?.first_name?.trim() || !editForm?.last_name?.trim()) return 'First name and last name are required.';
    if (editForm.phone && !isPhone(editForm.phone)) return 'Phone must be 7-15 digits, optionally starting with +.';
    if (editForm.total_experience_years !== undefined && editForm.total_experience_years !== '' && !isNonNegativeNumber(editForm.total_experience_years)) {
      return 'Total experience must be 0 or greater.';
    }
    if (editForm.expected_salary && !/^[0-9,.\sA-Za-z/-]+$/.test(editForm.expected_salary)) {
      return 'Expected salary contains unsupported characters.';
    }
    if (editForm.linkedin_url && !isValidUrl(editForm.linkedin_url)) return 'LinkedIn URL must start with http:// or https://.';
    if (editForm.portfolio_url && !isValidUrl(editForm.portfolio_url)) return 'Portfolio URL must start with http:// or https://.';
    const badSkill = (editForm.skills || []).find(s => s.years_of_use !== null && s.years_of_use !== '' && !isNonNegativeNumber(s.years_of_use));
    if (badSkill) return 'Skill years must be 0 or greater.';
    return '';
  };

  const handleCreateOffer = async () => {
    setCreatingOffer(true);
    try {
      const r = await fetch(`/api/source/candidates/${candidate.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...offerDetails, offer_content: { content: offerPreview } }),
      });
      const d = await r.json();
      if (r.ok) {
        toast.success('Offer letter generated and pending approval!');
        setShowOfferForm(false);
        onRefresh();
      } else {
        toast.error(d.detail || 'Failed');
      }
    } catch { toast.error('Error creating offer'); }
    finally { setCreatingOffer(false); }
  };

  if (!candidate) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-[1px] transition-opacity"
        {...drawerOverlayHandlers}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 h-full z-[110] bg-[#040812] border-l border-white/10 shadow-2xl flex flex-col transition-transform duration-300 w-full max-w-[520px] ${candidate ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: '100%', maxWidth: '520px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 sm:p-8 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl font-display font-black text-primary shrink-0">
              {(data?.full_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <h2 className="text-2xl font-display font-black text-white tracking-tighter">{data?.full_name || '—'}</h2>
              <p className="text-xs text-primary/80 font-bold uppercase tracking-widest mt-1">{data?.current_designation || 'CANDIDATE'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasPermission('source.candidates.manage') && (
              !isEditing ? (
                <button
                  onClick={startEditing}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/80 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5"
                >
                  <Edit size={12} /> Edit Profile
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="px-4 py-2 bg-primary rounded-xl text-[10px] font-black uppercase tracking-widest text-black hover:bg-white transition-colors"
                  >
                    Save
                  </button>
                </>
              )
            )}
            <button onClick={onClose} className="p-2 rounded-xl text-white/30 hover:text-white hover:bg-white/5 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
          {loadingProfile && (
            <div className="flex items-center justify-center gap-2 py-12 text-white/30">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest">Loading profile...</span>
            </div>
          )}

          <div className="p-5 sm:p-8 space-y-8">
            {isEditing ? (
              <form onSubmit={saveProfile} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <Shield size={14} /> Basic Information
                  </h3>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">First Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={editForm.first_name}
                        onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary/40"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Middle Name</label>
                      <input
                        type="text"
                        value={editForm.middle_name}
                        onChange={e => setEditForm({ ...editForm, middle_name: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary/40"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Last Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={editForm.last_name}
                        onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary/40"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">

                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Email <span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        required
                        value={editForm.email}
                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary/40"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Phone</label>
                      <input
                        type="text"
                        value={editForm.phone}
                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary/40"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Location</label>
                      <input
                        type="text"
                        value={editForm.location}
                        onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary/40"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Total Experience (Years)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={editForm.total_experience_years}
                        onChange={e => setEditForm({ ...editForm, total_experience_years: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary/40"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Current Designation</label>
                      <input
                        type="text"
                        value={editForm.current_designation}
                        onChange={e => setEditForm({ ...editForm, current_designation: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary/40"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">LinkedIn URL</label>
                      <input
                        type="text"
                        value={editForm.linkedin_url}
                        onChange={e => setEditForm({ ...editForm, linkedin_url: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary/40"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Portfolio URL</label>
                      <input
                        type="text"
                        value={editForm.portfolio_url}
                        onChange={e => setEditForm({ ...editForm, portfolio_url: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary/40"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">AI Profile Summary</label>
                      <textarea
                        value={editForm.ai_summary}
                        onChange={e => setEditForm({ ...editForm, ai_summary: e.target.value })}
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-primary/40"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Skills (comma separated)</label>
                      <input
                        type="text"
                        value={editForm.primary_skills}
                        onChange={e => setEditForm({ ...editForm, primary_skills: e.target.value })}
                        placeholder="e.g. React, Node.js, TypeScript"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary/40"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Job Role Tags (comma separated)</label>
                      <input
                        type="text"
                        value={editForm.tags}
                        onChange={e => setEditForm({ ...editForm, tags: e.target.value })}
                        placeholder="e.g. Frontend Developer, Senior Engineer (leave empty for General Pool)"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary/40"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="flex-1 py-3 rounded-xl bg-primary text-black text-xs font-black uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving...' : 'Save Profile Details'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* Status Transition Row */}
                <div className="glass-panel p-4 flex items-center justify-between gap-4 border-white/5 bg-white/[0.02] rounded-2xl">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Current Status</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border uppercase w-fit ${STATUS_STYLE[data?.status?.toLowerCase()] || 'bg-white/5 border-white/10 text-white/40'}`}>
                      {data?.status || 'New'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasPermission('source.candidates.manage') && (
                      <>
                        {data?.status?.toLowerCase() !== 'favourite' && (
                          <button
                            disabled={updatingStatus}
                            onClick={() => handleStatusUpdate('Favourite')}
                            className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary hover:text-black text-primary text-[10px] font-black uppercase tracking-widest transition-all"
                          >
                            Favorite
                          </button>
                        )}
                        {data?.status?.toLowerCase() !== 'archived' && (
                          <button
                            disabled={updatingStatus}
                            onClick={() => handleStatusUpdate('Archived')}
                            className="px-3 py-1.5 rounded-lg bg-rose-400/10 border border-rose-400/20 hover:bg-rose-400 hover:text-white text-rose-400 text-[10px] font-black uppercase tracking-widest transition-all"
                          >
                            Archive
                          </button>
                        )}
                        {(data?.status?.toLowerCase() === 'favourite' || data?.status?.toLowerCase() === 'archived' || data?.status?.toLowerCase() === 'rejected') && (
                          <button
                            disabled={updatingStatus}
                            onClick={() => handleStatusUpdate('New')}
                            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white hover:text-black text-white/60 text-[10px] font-black uppercase tracking-widest transition-all"
                          >
                            Restore
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="glass-panel p-5 bg-primary/5 border-primary/20">
                  <SectionLabel icon={<Star size={13} />} label="AI Profile Summary" color="text-primary" />
                  <p className="text-xs text-white/70 leading-relaxed font-medium">{data?.ai_summary || 'None'}</p>
                </div>

                {/* Basic info */}
                <section className="grid grid-cols-2 gap-4">
                  {[
                    { icon: Mail, val: data?.email || 'None', link: data?.email ? `mailto:${data?.email}` : null },
                    { icon: Phone, val: data?.phone || 'None' },
                    { icon: MapPin, val: data?.location || 'None' },
                    { icon: Clock, val: data?.total_experience_years ? `${data.total_experience_years} years` : 'None' },
                    { icon: FileText, val: data?.portfolio_url ? 'Portfolio' : 'Portfolio: None', link: data?.portfolio_url },
                    { icon: Globe, val: data?.linkedin_url ? 'LinkedIn' : 'LinkedIn: None', link: data?.linkedin_url },
                  ].map(({ icon: Icon, val, link }, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm text-white/60">
                      <Icon size={14} className="text-primary/60 shrink-0" />
                      {link ? (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="truncate hover:text-primary transition-colors hover:underline">
                          {val}
                        </a>
                      ) : (
                        <span className="truncate">{val}</span>
                      )}
                    </div>
                  ))}
                </section>
                {/* Assessment Results */}
                {(loadingAssessments || assessmentResults.length > 0) && (
                  <section>
                    <SectionLabel icon={<CheckCircle size={13} />} label="Assessment Results" />
                    {loadingAssessments ? (
                      <div className="flex items-center gap-2 text-white/40 text-xs">
                        <Loader2 size={12} className="animate-spin" /> Loading results...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {assessmentResults.map((ar, i) => (
                          <div key={i} className="glass-panel p-4 flex flex-col gap-2">
                            <div className="flex items-start justify-between">
                              <span className="text-xs font-bold text-white">{ar.assessment?.title || `Assessment #${ar.assessment_id}`}</span>
                              {ar.pass_status !== null && (
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border uppercase ${ar.pass_status ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400' : 'bg-rose-400/10 border-rose-400/20 text-rose-400'}`}>
                                  {ar.pass_status ? 'Passed' : 'Failed'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-white/60">
                              <span>Score: <strong className="text-white">{ar.score !== null ? `${ar.score}%` : 'Pending'}</strong></span>
                              {ar.is_malpractice && (
                                <span className="flex items-center gap-1 text-rose-400">
                                  <AlertTriangle size={12} /> Malpractice Flagged
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Job Role Tags */}
                <section>
                  <SectionLabel icon={<Tag size={13} />} label="Job Role Tags" />
                  {data?.tags && data.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {data.tags.map((t, i) => (
                        <div key={i} className="flex items-center px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                          <span className="text-[11px] font-bold text-purple-300">🏷️ {t}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="glass-panel p-3 text-xs text-white/40 italic">General Pool (Untagged)</div>
                  )}
                </section>

                {/* ATS Role-Fit Analysis - Strictly rendered when a specific job role is selected */}
                {Boolean(activeEvalRoleId) && Boolean(activeRoleFit) && (reqScore != null || prefScore != null || matchedSkills.length > 0 || missingSkills.length > 0) && (
                  <section className="space-y-3">
                    <SectionLabel 
                      icon={<Target size={13} />} 
                      label={activeRole?.title ? `ATS Role-Fit Analysis • ${activeRole.title}` : "ATS Role-Fit Analysis"} 
                      color="text-primary" 
                    />
                    
                    {/* Score Cards Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Required Score Card */}
                      <div className="glass-panel p-4 flex flex-col justify-between border-white/10 bg-white/[0.02]">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-rose-300">Required</span>
                          {reqTotalCount > 0 && (
                            <span className="text-[10px] font-bold text-rose-400">
                              {reqMatchedCount}/{reqTotalCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className={`text-2xl font-black ${reqScore >= 70 ? 'text-emerald-400' : reqScore >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                            {reqScore != null ? `${Math.round(reqScore)}%` : '—'}
                          </span>
                        </div>
                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-3">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${reqScore >= 70 ? 'bg-emerald-400' : reqScore >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`}
                            style={{ width: `${Math.min(reqScore || 0, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Preferred Score Card */}
                      <div className="glass-panel p-4 flex flex-col justify-between border-white/10 bg-white/[0.02]">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Preferred</span>
                          {prefTotalCount > 0 && (
                            <span className="text-[10px] font-bold text-emerald-400">
                              {prefMatchedCount}/{prefTotalCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className={`text-2xl font-black ${prefScore >= 70 ? 'text-emerald-400' : prefScore >= 40 ? 'text-teal-400' : 'text-slate-400'}`}>
                            {prefScore != null ? `${Math.round(prefScore)}%` : '—'}
                          </span>
                        </div>
                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-3">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${prefScore >= 70 ? 'bg-emerald-400' : prefScore >= 40 ? 'bg-teal-400' : 'bg-slate-400'}`}
                            style={{ width: `${Math.min(prefScore || 0, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Matched & Missing Skills Breakdown */}
                    {(matchedSkills.length > 0 || partialSkills.length > 0 || missingSkills.length > 0) && (
                      <div className="glass-panel p-4 space-y-3 border-white/5">
                        {/* Matched Skills */}
                        {matchedSkills.length > 0 && (
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 mb-2">
                              <CheckCircle size={11} /> Matched Skills ({matchedSkills.length})
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {matchedSkills.map((s, idx) => (
                                <span key={idx} className="px-2.5 py-1 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-[11px] font-semibold text-emerald-300">
                                  ✓ {typeof s === 'string' ? s : s.skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Partial Skills */}
                        {partialSkills.length > 0 && (
                          <div className="pt-2 border-t border-white/5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5 mb-2">
                              <Zap size={11} /> Partial / Alias Matches ({partialSkills.length})
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {partialSkills.map((p, idx) => (
                                <span key={idx} className="px-2.5 py-1 rounded-lg bg-amber-400/10 border border-amber-400/20 text-[11px] font-semibold text-amber-300" title={`Candidate skill: ${p.candidate_skill || 'Related'}`}>
                                  ~ {typeof p === 'string' ? p : p.skill} {p.candidate_skill ? `(${p.candidate_skill})` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Missing Skills */}
                        {missingSkills.length > 0 && (
                          <div className="pt-2 border-t border-white/5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-rose-400 flex items-center gap-1.5 mb-2">
                              <X size={11} /> Missing Skills ({missingSkills.length})
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {missingSkills.map((s, idx) => (
                                <span key={idx} className="px-2.5 py-1 rounded-lg bg-rose-400/10 border border-rose-400/20 text-[11px] font-semibold text-rose-300">
                                  ✗ {typeof s === 'string' ? s : s.skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                )}

                {/* Skills */}
                <section>
                  <SectionLabel icon={<Zap size={13} />} label="Skills" />
                  {data?.primary_skills?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {data.primary_skills.map((s, i) => (
                        <div key={i} className="flex items-center pl-3 pr-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
                          <span className="text-[11px] font-bold text-primary">{s}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="glass-panel p-4 text-xs text-white/30 italic">None</div>
                  )}
                </section>

                {/* Experience History */}
                <section>
                  <SectionLabel icon={<Briefcase size={13} />} label="Professional Experience" />
                  {data?.experience?.length > 0 ? (
                    <div className="space-y-3">
                      {data.experience.map((exp, i) => (
                        <div key={i} className="glass-panel p-4">
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-xs font-bold text-white">{exp.designation}</p>
                            <span className="text-[10px] text-white/40 shrink-0 ml-2">{exp.start_date || 'Unknown'} - {exp.end_date || (exp.is_current ? 'Present' : 'Present')}</span>
                          </div>
                          <p className="text-[11px] text-primary/80 mb-2 font-bold uppercase tracking-widest">{exp.company}</p>
                          {exp.description && <p className="text-[11px] text-white/50 leading-relaxed whitespace-pre-wrap">{exp.description}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="glass-panel p-4 text-xs text-white/30 italic">None</div>
                  )}
                </section>

                {/* Education History */}
                <section>
                  <SectionLabel icon={<Shield size={13} />} label="Education" />
                  {data?.education?.length > 0 ? (
                    <div className="space-y-3">
                      {data.education.map((edu, i) => (
                        <div key={i} className="glass-panel p-4">
                          <p className="text-xs font-bold text-white mb-1">{edu.degree} {edu.field_of_study ? `in ${edu.field_of_study}` : ''}</p>
                          <p className="text-[11px] text-primary/80 font-bold uppercase tracking-widest">{edu.institution}</p>
                          {(edu.start_date || edu.end_date || edu.year) && <p className="text-[10px] text-white/40 mt-1">{edu.start_date || edu.year} - {edu.end_date || ''}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="glass-panel p-4 text-xs text-white/30 italic">None</div>
                  )}
                </section>

                {/* Certifications */}
                <section>
                  <SectionLabel icon={<Award size={13} />} label="Certifications" />
                  {data?.certifications?.length > 0 ? (
                    <div className="space-y-2">
                      {data.certifications.map((cert, i) => (
                        <div key={i} className="glass-panel p-3">
                          <p className="text-xs font-bold text-white">{cert.name}</p>
                          {cert.issuer && <p className="text-[10px] text-primary/80 font-bold uppercase tracking-widest mt-1">{cert.issuer}</p>}
                          {cert.year > 0 && <p className="text-[10px] text-white/40 mt-1">{cert.year}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="glass-panel p-4 text-xs text-white/30 italic">None</div>
                  )}
                </section>

                {/* Confidence Flags */}
                {confFlags.length > 0 && (
                  <section>
                    <SectionLabel icon={<AlertTriangle size={13} className="text-amber-400" />} label="Confidence Flags" color="text-amber-400" />
                    <div className="space-y-2">
                      {confFlags.map((f, i) => (
                        <div key={i} className="glass-panel p-4 border-amber-400/10 bg-amber-400/5 flex items-start gap-3">
                          <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-white">{f}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Confidence clear */}
                {profile && confFlags.length === 0 && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-400/5 border border-emerald-400/10">
                    <CheckCircle size={15} className="text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400">No confidence flags detected</span>
                  </div>
                )}

                {/* Suggested Interview Questions */}
                {fitData?.interview_questions?.length > 0 && (
                  <section>
                    <SectionLabel icon={<MessageSquare size={13} />} label="Suggested Interview Questions" />
                    <div className="space-y-2">
                      {fitData.interview_questions.map((q, i) => (
                        <div key={i} className="glass-panel px-5 py-4 border-l-2 border-primary/30">
                          <p className="text-sm text-white/80 leading-relaxed">"{q}"</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Score against role - inline form */}
                {showScoreForm && (
                  <section>
                    <SectionLabel icon={<Star size={13} />} label="Score Against Role" />
                    <form onSubmit={handleScore} className="glass-panel p-5 flex gap-3">
                      <select
                        required
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/40 transition-colors"
                        value={scoreRoleId}
                        onChange={e => setScoreRoleId(e.target.value)}
                      >
                        <option value="">Select role...</option>
                        {jobRoles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                      </select>
                      <button type="submit" disabled={scoring} className="px-5 py-2.5 rounded-xl bg-primary text-black text-xs font-black uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-50">
                        {scoring ? <Loader2 size={14} className="animate-spin" /> : 'Score'}
                      </button>
                      <button type="button" onClick={() => setShowScoreForm(false)} className="px-4 py-2.5 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors">
                        <X size={16} />
                      </button>
                    </form>
                  </section>
                )}

                {/* Invite to role - inline form */}
                {showInviteForm && (
                  <section>
                    <SectionLabel icon={<Send size={13} />} label="Invite to Role" />
                    <form onSubmit={handleInvite} className="glass-panel p-5 flex gap-3">
                      <select
                        required
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/40 transition-colors"
                        value={inviteRoleId}
                        onChange={e => setInviteRoleId(e.target.value)}
                      >
                        <option value="">Select role to invite for...</option>
                        {jobRoles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                      </select>
                      <button type="submit" disabled={inviting} className="px-5 py-2.5 rounded-xl bg-indigo text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-400 transition-colors disabled:opacity-50">
                        {inviting ? <Loader2 size={14} className="animate-spin" /> : 'Send Invite'}
                      </button>
                      <button type="button" onClick={() => setShowInviteForm(false)} className="px-4 py-2.5 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors">
                        <X size={16} />
                      </button>
                    </form>
                  </section>
                )}

                {/* Resume link */}
                {data?.resume_path && (
                  <div className="flex items-center gap-3">
                    <a
                      href={`/api/source/candidates/${data.id}/resume`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-white/40 hover:text-primary transition-colors font-bold uppercase tracking-widest"
                    >
                      <ExternalLink size={13} /> View Resume
                    </a>
                    <button
                      type="button"
                      onClick={downloadResume}
                      className="flex items-center gap-2 text-xs text-white/40 hover:text-primary transition-colors font-bold uppercase tracking-widest"
                    >
                      <Download size={13} /> Download
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer action bar */}
        <div className="p-6 border-t border-white/5 shrink-0 flex gap-3">
          {hasPermission('source.evaluations.manage') && (
            <button
              onClick={() => { setShowScoreForm(s => !s); setShowInviteForm(false); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-colors duration-150 ${showScoreForm ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'}`}
            >
              <Star size={14} /> Score
            </button>
          )}
          {hasPermission('source.interviews.manage') && (
            <button
              onClick={() => { setShowInviteForm(s => !s); setShowScoreForm(false); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-colors duration-150 ${showInviteForm ? 'bg-indigo/10 border-indigo/30 text-indigo' : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'}`}
            >
              <Send size={14} /> Invite
            </button>
          )}
          {hasPermission('source.offers.manage') && data?.status?.toLowerCase() !== 'hired' && (
            <button
              onClick={() => { setShowOfferForm(true); setOfferPreview(null); }}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 text-xs font-black uppercase tracking-widest hover:bg-emerald-400/20 transition-colors duration-150"
            >
              <UserCheck size={14} /> Hire
            </button>
          )}
        </div>
      </div>

      {/* ── OFFER MODAL - WHITE/PURPLE THEME ── */}
      {showOfferForm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" {...offerOverlayHandlers}>
          <div className="bg-white w-full max-w-2xl rounded-3xl p-5 sm:p-10 relative max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            
            {/* Close Button */}
            <button 
              onClick={() => setShowOfferForm(false)} 
              className="absolute top-6 right-6 p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                  <FileText size={20} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-600">Offer Management</p>
              </div>
              <h2 className="text-4xl font-black text-black tracking-tight leading-none">
                <span className="text-purple-600">AI </span> Offer Generation
              </h2>
              <p className="text-sm text-gray-500 mt-2">Fill in the details below to generate a professional offer letter.</p>
            </div>

            {!offerPreview ? (
              <form onSubmit={handleGenerateOffer} className="space-y-6">
                <div className="grid grid-cols-2 gap-5">
                  
                  {/* Role Title - Dropdown from jobRoles */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">
                      Role Title <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={offerDetails.role_title}
                      onChange={e => setOfferDetails({...offerDetails, role_title: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                    >
                      <option value="">Select a role...</option>
                      {jobRoles.map((role) => (
                        <option key={role.id} value={role.title}>{role.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Salary - Text Input */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">
                      Salary <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={offerDetails.salary}
                      onChange={e => setOfferDetails({...offerDetails, salary: e.target.value})}
                      placeholder="e.g. ₹ 12,00,000 per annum"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all placeholder:text-gray-400"
                    />
                  </div>

                  {/* Department - Dropdown */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">
                      Department <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={offerDetails.department}
                      onChange={e => setOfferDetails({...offerDetails, department: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                    >
                      <option value="">Select a department...</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  {/* Location - Dropdown */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">
                      Location <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={offerDetails.location}
                      onChange={e => setOfferDetails({...offerDetails, location: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                    >
                      <option value="">Select a location...</option>
                      <option value="On-Site">On-Site</option>
                      <option value="Remote">Remote</option>
                      <option value="Hybrid">Hybrid</option>
                    </select>
                  </div>

                  {/* Start Date - Calendar */}
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={offerDetails.start_date}
                      onChange={e => setOfferDetails({...offerDetails, start_date: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                    />
                  </div>

                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowOfferForm(false)}
                    className="flex-1 py-4 rounded-xl border border-gray-200 text-gray-600 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={generatingOffer}
                    className="flex-1 py-4 rounded-xl bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {generatingOffer ? (
                      <><Loader2 size={16} className="animate-spin" /> Generating...</>
                    ) : (
                      <><FileText size={16} /> Create Preview</>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* ── PREVIEW SECTION ── */
              <div className="space-y-6">
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 overflow-y-auto max-h-[50vh] custom-scrollbar">
                  <p className="text-[10px] font-black uppercase tracking-widest text-purple-600 mb-4 flex items-center gap-2">
                    <CheckCircle size={14} /> Preview & Edit Offer Letter
                  </p>
                  
                  {(() => {
                    let c = offerPreview;
                    if (c && c.offer_content) c = c.offer_content;
                    if (c && c.content && c.content.offer_content) c = c.content.offer_content;
                    
                    return c ? (
                      <div className="flex flex-col gap-4">
                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Subject</label>
                          <input 
                            className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 transition-all"
                            value={c.subject || ''}
                            onChange={e => {
                              const newC = { ...c, subject: e.target.value };
                              setOfferPreview({ offer_content: newC });
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Body Paragraphs (Separated by double newlines)</label>
                          <textarea 
                            className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 outline-none focus:border-purple-400 transition-all resize-y min-h-[250px] font-mono leading-relaxed"
                            value={(c.body_paragraphs || []).join('\n\n')}
                            onChange={e => {
                              const newC = { ...c, body_paragraphs: e.target.value.split('\n\n') };
                              setOfferPreview({ offer_content: newC });
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <textarea 
                        value={typeof offerPreview === 'string' ? offerPreview : JSON.stringify(offerPreview, null, 2)} 
                        onChange={e => setOfferPreview(e.target.value)} 
                        className="w-full h-[400px] bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-700 outline-none focus:border-purple-400 transition-all resize-none font-mono"
                      />
                    );
                  })()}
                </div>

                {/* Preview Actions */}
                <div className="flex gap-4 pt-4 border-t border-gray-200">
                  <button 
                    onClick={() => setOfferPreview(null)} 
                    className="flex-1 py-4 rounded-xl border border-gray-200 text-gray-600 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
                  >
                    ← Back
                  </button>
                  <button 
                    onClick={handleCreateOffer} 
                    disabled={creatingOffer} 
                    className="flex-1 py-4 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {creatingOffer ? (
                      <><Loader2 size={16} className="animate-spin" /> Submitting...</>
                    ) : (
                      <><CheckCircle size={16} /> Submit for Admin Approval</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function SectionLabel({ icon, label, color = 'text-white/30' }) {
  return (
    <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest mb-3 ${color}`}>
      {icon} {label}
    </div>
  );
}