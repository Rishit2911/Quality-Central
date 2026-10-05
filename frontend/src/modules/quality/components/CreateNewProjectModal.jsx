import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, FolderPlus, Check, AlertTriangle, CheckCircle2,
  Search, Plus, UserPlus, Users
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { QUALITY_CENTRAL_TEAM, ALLOWED_TEAM_NAMES, getMemberByName } from '../constants/teamPool';

export default function CreateNewProjectModal({
  isOpen,
  onClose,
  onSubmitProject,
  existingProjects = [],
  initialProject = null
}) {
  const isEditing = !!initialProject;
  const [name, setName] = useState(initialProject?.name || '');
  const [prefix, setPrefix] = useState(initialProject?.prefix || '');
  const [severity, setSeverity] = useState(initialProject?.severity || 'Normal'); // 'Critical' | 'High' | 'Normal'
  const [healthRate, setHealthRate] = useState(initialProject?.health_rate ?? 98);
  const [status, setStatus] = useState(initialProject?.status || 'Active'); // 'Active' | 'Archived'
  const [lead, setLead] = useState(initialProject?.lead || 'Bhupesh');
  const [developers, setDevelopers] = useState(initialProject?.developers || ['Rishit', 'Vidhi']);
  const [qa, setQa] = useState(initialProject?.qa || ['Vidhi']);
  const [description, setDescription] = useState(initialProject?.description || '');
  const [errors, setErrors] = useState({});

  // ==========================================================================
  // WHATSAPP-STYLE SEARCH & ADD STAGING STATE
  // ==========================================================================
  const [searchPickerRole, setSearchPickerRole] = useState(null); // 'lead' | 'developer' | 'qa' | null
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');
  const [stagedMembers, setStagedMembers] = useState([]); // array of member objects staged for addition
  const [teamMembers, setTeamMembers] = useState(QUALITY_CENTRAL_TEAM);

  // Fetch active team employees dynamically from PostgreSQL
  useEffect(() => {
    let isMounted = true;
    async function loadTeam() {
      try {
        const res = await fetch('/api/quality/team', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data?.team && Array.isArray(data.team) && data.team.length > 0 && isMounted) {
            const mapped = data.team.map(m => {
              const base = getMemberByName(m.name);
              return {
                ...base,
                ...m,
                initials: m.initials || base.initials,
                avatarBg: base.avatarBg
              };
            });
            setTeamMembers(mapped);
          }
        }
      } catch (err) {
        console.warn('Using local team pool fallback:', err);
      }
    }
    loadTeam();
    return () => { isMounted = false; };
  }, []);

  const openSearchPicker = (role) => {
    setSearchPickerRole(role);
    setPickerSearchQuery('');
    if (role === 'lead') {
      const current = teamMembers.find(m => m.name.toLowerCase() === lead.toLowerCase()) || getMemberByName(lead);
      setStagedMembers([current]);
    } else {
      setStagedMembers([]);
    }
  };

  const closeSearchPicker = () => {
    setSearchPickerRole(null);
    setPickerSearchQuery('');
    setStagedMembers([]);
  };

  const toggleStageMember = (member) => {
    if (searchPickerRole === 'lead') {
      setStagedMembers([member]);
      return;
    }
    setStagedMembers(prev => {
      const exists = prev.some(m => m.name.toLowerCase() === member.name.toLowerCase());
      if (exists) {
        return prev.filter(m => m.name.toLowerCase() !== member.name.toLowerCase());
      } else {
        return [...prev, member];
      }
    });
  };

  const handleConfirmAddStagedMembers = () => {
    if (stagedMembers.length === 0) return;

    if (searchPickerRole === 'lead') {
      const selectedLead = stagedMembers[0].name;
      setLead(selectedLead);
      if (errors.lead) setErrors(prev => ({ ...prev, lead: null }));
      toast.success(`Designated ${selectedLead} as Team Lead`);
    } else if (searchPickerRole === 'developer') {
      const newNames = stagedMembers.map(m => m.name);
      setDevelopers(prev => Array.from(new Set([...prev, ...newNames])));
      toast.success(`Added ${newNames.length} member(s) to Developers`);
    } else if (searchPickerRole === 'qa') {
      const newNames = stagedMembers.map(m => m.name);
      setQa(prev => Array.from(new Set([...prev, ...newNames])));
      toast.success(`Added ${newNames.length} member(s) to QA Specialists`);
    }

    closeSearchPicker();
  };

  const removeDeveloper = (devName) => {
    setDevelopers(prev => {
      if (prev.length <= 1) {
        toast.error('At least one developer must remain assigned to the project');
        return prev;
      }
      return prev.filter(d => d.toLowerCase() !== devName.toLowerCase());
    });
  };

  const removeQA = (qaName) => {
    setQa(prev => {
      if (prev.length <= 1) {
        toast.error('At least one QA specialist must remain assigned to the project');
        return prev;
      }
      return prev.filter(q => q.toLowerCase() !== qaName.toLowerCase());
    });
  };

  const filteredTeamList = useMemo(() => {
    if (!pickerSearchQuery.trim()) return teamMembers;
    const q = pickerSearchQuery.toLowerCase().trim();
    return teamMembers.filter(m => 
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.role && m.role.toLowerCase().includes(q)) ||
      (m.email && m.email.toLowerCase().includes(q))
    );
  }, [pickerSearchQuery, teamMembers]);

  const handleNameChange = (val) => {
    setName(val);
    if (errors.name) setErrors(prev => ({ ...prev, name: null }));
    if (!prefix || prefix === '#' || prefix.startsWith('#BT-') || prefix.startsWith('#PRJ-')) {
      const clean = val
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim()
        .split(/\s+/)
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 4);
      if (clean) {
        setPrefix(`#${clean}-${Math.floor(10 + Math.random() * 89)}`);
      }
    }
  };

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleDeveloper = (devName) => {
    setDevelopers(prev => 
      prev.includes(devName)
        ? (prev.length > 1 ? prev.filter(d => d !== devName) : prev) // keep at least one dev
        : [...prev, devName]
    );
  };

  const toggleQA = (qaName) => {
    setQa(prev => 
      prev.includes(qaName)
        ? (prev.length > 1 ? prev.filter(q => q !== qaName) : prev) // keep at least one qa
        : [...prev, qaName]
    );
  };

  const CORE_MODULES = [
    'talent central',
    'learning central',
    'assessment central',
    'employee central',
    'quality central',
    'lexai'
  ];

  const validate = () => {
    const errs = {};
    const cleanName = name.trim().toLowerCase();
    if (!name.trim()) {
      errs.name = 'Project name is required';
    } else if (!CORE_MODULES.includes(cleanName)) {
      errs.name = 'Only the 6 core Phygitron360 modules (Talent Central, Learning Central, Assessment Central, Employee Central, Quality Central, LexAI) can be registered';
    }

    if (!prefix.trim()) {
      errs.prefix = 'Prefix code is required (e.g. #TC-01)';
    } else if (!prefix.startsWith('#')) {
      errs.prefix = 'Prefix code must start with "#" (e.g. #TC-01)';
    } else if (prefix.trim().length < 3) {
      errs.prefix = 'Prefix code is too short';
    } else {
      const exists = existingProjects.some(
        p => p.prefix.toLowerCase() === prefix.trim().toLowerCase() && (!isEditing || p.id !== initialProject?.id)
      );
      if (exists) {
        errs.prefix = 'This prefix code is already registered to another project';
      }
    }

    if (!ALLOWED_TEAM_NAMES.includes(lead)) {
      errs.lead = 'Team Lead must be one of the 5 authorized team members';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const formattedPrefix = prefix.trim().toUpperCase().startsWith('#') 
      ? prefix.trim().toUpperCase() 
      : `#${prefix.trim().toUpperCase()}`;

    const projectPayload = {
      ...(initialProject || {}),
      id: initialProject?.id || `proj-${Date.now()}`,
      name: name.trim(),
      prefix: formattedPrefix,
      severity,
      health_rate: Number(healthRate),
      status,
      lead,
      developers: developers.filter(d => ALLOWED_TEAM_NAMES.includes(d)),
      qa: qa.filter(q => ALLOWED_TEAM_NAMES.includes(q)),
      description: description.trim() || `Project repository under Quality Central oversight. Lead: ${lead}.`,
      ...(!isEditing ? {
        open_bugs: severity === 'Critical' ? 3 : severity === 'High' ? 1 : 0,
        in_progress_bugs: severity === 'Critical' ? 2 : severity === 'High' ? 1 : 0,
        active_bugs: severity === 'Critical' ? 5 : severity === 'High' ? 2 : 0,
        critical_bugs: severity === 'Critical' ? 1 : 0,
        high_bugs: severity === 'High' ? 1 : 0,
        normal_bugs: severity === 'Normal' ? 1 : 0,
        created_at: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      } : {})
    };

    onSubmitProject(projectPayload);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F5F9] bg-[#FAF5FF]/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-700 shadow-xs">
              <FolderPlus size={18} />
            </div>
            <div>
              <h3 id="modal-title" className="text-base font-bold text-[#0F172A] leading-tight">
                {isEditing ? 'Edit Project Details' : 'Create New Project'}
              </h3>
              <p className="text-xs text-[#64748B] font-medium mt-0.5">
                {isEditing ? 'Update project metadata, assigned developers, and quality parameters' : 'Register a new repository or service under Quality Central governance'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">
          {/* Row 1: Project Name & Prefix Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider m-0">
                  Project Name <span className="text-rose-500">*</span>
                </label>
                {isEditing && (
                  <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                    Core Module (Fixed)
                  </span>
                )}
              </div>
              <input
                type="text"
                value={name}
                disabled={isEditing}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Talent Central"
                className={`w-full text-xs font-medium py-2.5 px-3.5 border rounded-xl focus:outline-none transition-all text-[#0F172A] ${
                  isEditing 
                    ? 'bg-slate-100 text-slate-600 cursor-not-allowed border-[#E2E8F0]'
                    : errors.name ? 'border-rose-300 ring-1 ring-rose-200 bg-rose-50/20' : 'bg-[#F8FAFC] border-[#E2E8F0] focus:ring-2 focus:ring-violet-500 focus:bg-white'
                }`}
                autoFocus={!isEditing}
              />
              {errors.name && (
                <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                  <AlertTriangle size={12} /> {errors.name}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider m-0">
                  Prefix Code <span className="text-rose-500">*</span>
                </label>
              </div>
              <input
                type="text"
                value={prefix}
                disabled={isEditing}
                onChange={(e) => {
                  setPrefix(e.target.value);
                  if (errors.prefix) setErrors(prev => ({ ...prev, prefix: null }));
                }}
                placeholder="#TC-01"
                className={`w-full text-xs font-mono font-bold py-2.5 px-3.5 border rounded-xl focus:outline-none transition-all text-[#0F172A] ${
                  isEditing
                    ? 'bg-slate-100 text-slate-600 cursor-not-allowed border-[#E2E8F0]'
                    : errors.prefix ? 'border-rose-300 ring-1 ring-rose-200 bg-rose-50/20' : 'bg-[#F8FAFC] border-[#E2E8F0] focus:ring-2 focus:ring-violet-500 focus:bg-white'
                }`}
              />
              {errors.prefix && (
                <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                  <AlertTriangle size={12} /> {errors.prefix}
                </p>
              )}
            </div>
          </div>

          {/* Row 2: Severity Status & Initial Health Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Severity Status Badge Logic */}
            <div>
              <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1.5">
                Initial Severity Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'Normal', label: 'Normal', bg: 'bg-[#DCFCE7]', text: 'text-[#16A34A]', border: 'border-[#86EFAC]' },
                  { key: 'High', label: 'High', bg: 'bg-[#FEF3C7]', text: 'text-[#D97706]', border: 'border-[#FDE68A]' },
                  { key: 'Critical', label: 'Critical', bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]', border: 'border-[#FECACA]' }
                ].map(item => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setSeverity(item.key);
                      if (item.key === 'Critical' && healthRate > 84) setHealthRate(82);
                      if (item.key === 'High' && (healthRate < 85 || healthRate > 94)) setHealthRate(89);
                      if (item.key === 'Normal' && healthRate < 95) setHealthRate(98);
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                      severity === item.key 
                        ? `${item.bg} ${item.text} ${item.border} ring-2 ring-violet-500/20 shadow-xs` 
                        : 'bg-white border-[#E2E8F0] text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${severity === item.key ? (item.key === 'Critical' ? 'bg-[#DC2626]' : item.key === 'High' ? 'bg-[#D97706]' : 'bg-[#16A34A]') : 'bg-slate-300'}`} />
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#64748B] mt-1.5">
                {severity === 'Critical' && 'Marked with soft red badge (#FEE2E2 / #DC2626) indicating urgent blockers.'}
                {severity === 'High' && 'Marked with soft yellow badge (#FEF3C7 / #D97706) indicating high priority issues.'}
                {severity === 'Normal' && 'Marked with soft green badge (#DCFCE7 / #16A34A) defect-free baseline.'}
              </p>
            </div>

            {/* Quality Health Rate */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Quality Health Rate
                </label>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                  healthRate < 85 
                    ? 'bg-rose-50 border-rose-200 text-[#DC2626]' 
                    : healthRate <= 94 
                      ? 'bg-amber-50 border-amber-200 text-[#D97706]' 
                      : 'bg-emerald-50 border-emerald-200 text-[#16A34A]'
                }`}>
                  {healthRate}% Health Rate
                </span>
              </div>
              <input
                type="range"
                min="60"
                max="100"
                value={healthRate}
                onChange={(e) => setHealthRate(Number(e.target.value))}
                className="w-full accent-violet-600 cursor-pointer h-2 bg-slate-100 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                <span>&lt;85% Critical</span>
                <span>85-94% High</span>
                <span>95-100% Normal</span>
              </div>
            </div>
          </div>

          {/* SECTION 5: TEAM POOL ASSIGNMENT & WHATSAPP-STYLE SEARCH PICKER */}
          <div className="pt-2 border-t border-[#F1F5F9] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-extrabold text-[#0F172A] uppercase tracking-wider">
                  Team Pool Assignment
                </h4>
                <p className="text-[11px] text-[#64748B]">
                  Search, multi-select, and assign team members as Lead, Developers, or QA Specialists
                </p>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200 rounded-full">
                Interactive Team Directory
              </span>
            </div>

            {/* ==========================================================
                WHATSAPP-STYLE SEARCH & ADD DRAWER (When active)
            ========================================================== */}
            {searchPickerRole && (
              <div className="bg-[#FAF5FF] border-2 border-violet-200 rounded-2xl p-4 space-y-3.5 animate-fade-in shadow-xs">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h5 className="text-xs font-black text-slate-900">
                      {searchPickerRole === 'lead' && 'Search & Assign Designated Team Lead'}
                      {searchPickerRole === 'developer' && 'Search & Add to Developers'}
                      {searchPickerRole === 'qa' && 'Search & Add to QA Specialists'}
                    </h5>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {searchPickerRole === 'lead' ? 'Single Select' : 'Multi-Select'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={closeSearchPicker}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                    title="Close search"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* 1. Search Bar (WhatsApp style: rounded pill with magnifying glass) */}
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={pickerSearchQuery}
                    onChange={(e) => setPickerSearchQuery(e.target.value)}
                    placeholder={
                      searchPickerRole === 'lead' 
                        ? 'Search person to assign as Team Lead...' 
                        : `Search team member by name, email, or role...`
                    }
                    className="w-full text-xs font-medium bg-white text-slate-900 border border-slate-200 rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-400 shadow-2xs"
                    autoFocus
                  />
                  {pickerSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setPickerSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* 2. Top Selected Tray (Exact WhatsApp style: horizontal avatars with green tick) */}
                {stagedMembers.length > 0 && (
                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 px-0.5">
                      <span>Selected for Addition ({stagedMembers.length})</span>
                      {searchPickerRole !== 'lead' && (
                        <button
                          type="button"
                          onClick={() => setStagedMembers([])}
                          className="text-[10px] font-semibold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          Clear all
                        </button>
                      )}
                    </div>

                    {/* Staged Avatars Row */}
                    <div className="flex items-center gap-3 overflow-x-auto pb-1.5 pt-0.5 px-0.5 scrollbar-thin">
                      {stagedMembers.map((m) => (
                        <div 
                          key={`staged-${m.id || m.name}`} 
                          className="flex flex-col items-center gap-1 shrink-0 relative group/avatar cursor-pointer"
                          onClick={() => toggleStageMember(m)}
                          title={`Click to unselect ${m.name}`}
                        >
                          {/* Circular Avatar Container with Green Checkmark Badge (Screenshot 2 Look) */}
                          <div className="relative">
                            <div 
                              className="w-11 h-11 rounded-full text-white font-bold text-xs flex items-center justify-center shadow-xs ring-2 ring-emerald-500/40"
                              style={{ backgroundColor: m.avatarBg }}
                            >
                              {m.initials}
                            </div>
                            {/* Green Circle with White Checkmark Badge */}
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-xs ring-2 ring-white">
                              <Check size={10} strokeWidth={3} />
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-800 max-w-[60px] truncate text-center">
                            {m.name.split(' ')[0]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Filtered Team Directory List */}
                <div className="max-h-[220px] overflow-y-auto divide-y divide-slate-100 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  {filteredTeamList.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No team members match "{pickerSearchQuery}"
                    </div>
                  ) : (
                    filteredTeamList.map((member) => {
                      const isStaged = stagedMembers.some(sm => sm.name.toLowerCase() === member.name.toLowerCase());
                      const isAlreadyAssigned = 
                        searchPickerRole === 'lead' ? lead.toLowerCase() === member.name.toLowerCase() :
                        searchPickerRole === 'developer' ? developers.some(d => d.toLowerCase() === member.name.toLowerCase()) :
                        qa.some(q => q.toLowerCase() === member.name.toLowerCase());

                      return (
                        <div
                          key={member.id || member.name}
                          onClick={() => toggleStageMember(member)}
                          className={`flex items-center justify-between px-3.5 py-2.5 transition-colors cursor-pointer select-none ${
                            isStaged ? 'bg-emerald-50/70 hover:bg-emerald-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          {/* Member Identity */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div 
                              className="w-9 h-9 rounded-full text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs"
                              style={{ backgroundColor: member.avatarBg }}
                            >
                              {member.initials}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {member.name}
                                </span>
                                {isAlreadyAssigned && (
                                  <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                    Already Assigned
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500 truncate block">
                                {member.role}
                              </span>
                            </div>
                          </div>

                          {/* Selection Checkmark on Right (WhatsApp style green tick) */}
                          <div className="shrink-0 ml-2">
                            {isStaged ? (
                              <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                                <Check size={12} strokeWidth={3} />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-slate-300 hover:border-emerald-400 transition-colors" />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* 4. Bottom Action Bar with Add Button */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={closeSearchPicker}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200/50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={stagedMembers.length === 0}
                    onClick={handleConfirmAddStagedMembers}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                      stagedMembers.length > 0
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 active:scale-98'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Plus size={14} strokeWidth={2.5} />
                    <span>
                      {searchPickerRole === 'lead' 
                        ? `Set as Designated Lead` 
                        : `Add (${stagedMembers.length}) to ${searchPickerRole === 'developer' ? 'Developers' : 'QA Specialists'}`}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* ==========================================================
                1. DESIGNATED TEAM LEAD
            ========================================================== */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span>Designated Team Lead</span>
                </label>
                <button
                  type="button"
                  onClick={() => openSearchPicker('lead')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-violet-700 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors cursor-pointer border border-violet-200/80 shadow-2xs"
                >
                  <Search size={12} />
                  <span>Search &amp; Change Lead</span>
                </button>
              </div>

              {/* Lead Card Displayed As Now */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(() => {
                  const leadMember = getMemberByName(lead);
                  return (
                    <div
                      className="p-2 rounded-xl border border-violet-500 bg-violet-50/60 ring-2 ring-violet-500/20 shadow-xs flex items-center gap-2"
                    >
                      <div 
                        className="w-7 h-7 rounded-lg text-white text-[11px] font-bold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: leadMember.avatarBg }}
                      >
                        {leadMember.initials}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-[#0F172A] truncate">
                          {leadMember.name}
                        </span>
                        <span className="block text-[10px] text-violet-700 font-semibold truncate">
                          ★ Lead
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Other quick selectable leads from pool */}
                {QUALITY_CENTRAL_TEAM.filter(m => m.name.toLowerCase() !== lead.toLowerCase()).slice(0, 4).map((member) => (
                  <button
                    key={`quick-lead-${member.id}`}
                    type="button"
                    onClick={() => {
                      setLead(member.name);
                      if (errors.lead) setErrors(prev => ({ ...prev, lead: null }));
                    }}
                    className="p-2 rounded-xl border border-[#E2E8F0] bg-white hover:bg-slate-50 text-left flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <div 
                      className="w-7 h-7 rounded-lg text-white text-[11px] font-bold flex items-center justify-center shrink-0 opacity-80"
                      style={{ backgroundColor: member.avatarBg }}
                    >
                      {member.initials}
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-[#0F172A] truncate">
                        {member.name}
                      </span>
                      <span className="block text-[10px] text-[#64748B] truncate">
                        Member
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              {errors.lead && (
                <p className="text-[11px] font-semibold text-rose-600 mt-1">{errors.lead}</p>
              )}
            </div>

            {/* ==========================================================
                2. ASSIGNED DEVELOPERS (MULTI-SELECT)
            ========================================================== */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span>Assigned Developers (Multi-select)</span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.2 rounded-full border border-blue-200">
                    {developers.length} Assigned
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => openSearchPicker('developer')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer border border-blue-200/80 shadow-2xs"
                >
                  <Search size={12} />
                  <span>Search &amp; Add Developer</span>
                </button>
              </div>

              {/* Developer Pills Displayed As Now */}
              <div className="flex flex-wrap items-center gap-2">
                {developers.map((devName) => {
                  const member = getMemberByName(devName);
                  return (
                    <div
                      key={`dev-${devName}`}
                      className="px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all bg-blue-50 border-blue-300 text-blue-800 shadow-xs"
                    >
                      <div 
                        className="w-4 h-4 rounded text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: member.avatarBg }}
                      >
                        {member.initials}
                      </div>
                      <span>{member.name}</span>
                      <Check size={13} className="text-blue-600" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDeveloper(member.name);
                        }}
                        title={`Remove ${member.name} from Developers`}
                        className="p-0.5 hover:bg-blue-200/60 rounded text-blue-600 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ==========================================================
                3. ASSIGNED QA SPECIALISTS (MULTI-SELECT)
            ========================================================== */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span>Assigned QA Specialists (Multi-select)</span>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.2 rounded-full border border-purple-200">
                    {qa.length} Assigned
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => openSearchPicker('qa')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer border border-purple-200/80 shadow-2xs"
                >
                  <Search size={12} />
                  <span>Search &amp; Add QA</span>
                </button>
              </div>

              {/* QA Pills Displayed As Now */}
              <div className="flex flex-wrap items-center gap-2">
                {qa.map((qaName) => {
                  const member = getMemberByName(qaName);
                  return (
                    <div
                      key={`qa-${qaName}`}
                      className="px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all bg-purple-50 border-purple-300 text-purple-800 shadow-xs"
                    >
                      <div 
                        className="w-4 h-4 rounded text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: member.avatarBg }}
                      >
                        {member.initials}
                      </div>
                      <span>{member.name}</span>
                      <Check size={13} className="text-purple-600" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeQA(member.name);
                        }}
                        title={`Remove ${member.name} from QA Specialists`}
                        className="p-0.5 hover:bg-purple-200/60 rounded text-purple-600 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 4: Lifecycle Status & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full text-xs font-semibold py-2.5 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-800 cursor-pointer"
              >
                <option value="Active">Active Project</option>
                <option value="Archived">Archived Project</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1.5">
                Description / Scope (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of repository scope and deliverables..."
                className="w-full text-xs font-medium py-2.5 px-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all text-[#0F172A]"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F1F5F9]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md hover:shadow transition-all flex items-center gap-2 cursor-pointer active:scale-98"
            >
              <CheckCircle2 size={16} />
              <span>{isEditing ? 'Save Changes' : 'Initialize Project'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
