/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/purity */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../../../core/api/axios';
import { usePermission } from '../../../core/permissions/usePermission';
import { 
  Folder, File, ChevronRight, ChevronDown, Search, Upload, Trash2, CalendarDays, Loader, Plus, X, 
  LayoutGrid, List, User, ArrowRightLeft, Zap, Briefcase, CheckCircle2,
  FolderPlus, MoveRight, ArrowLeft, Tag, Edit2, Check, RefreshCw, Sparkles
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';

const PDF_LIMIT_BYTES = 30 * 1024 * 1024;
const ZIP_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;

const getCandidateName = (c) => {
  if (c.full_name && c.full_name.trim() && c.full_name !== 'Unknown Candidate') return c.full_name.trim();
  if (c.name && c.name.trim() && c.name !== 'Unknown Candidate') return c.name.trim();
  if (c.resume_path) {
    const raw = c.resume_path.split('/').pop() || '';
    const clean = raw
      .replace(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}_/, '')
      .replace(/^[0-9a-fA-F]{32}_/, '');
    if (clean && !clean.startsWith('uuid_')) return clean;
  }
  if (c.email && !c.email.startsWith('unknown_')) {
    return c.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  return c.full_name || c.name || 'Unnamed Resume';
};

const MultiSelectDropdown = ({ 
  options = [], 
  selected = [], 
  onChange, 
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
        className={`bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs text-gray-700 outline-none focus:border-purple-400 transition-colors ${widthClass} flex justify-between items-center text-left cursor-pointer`}
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
        <div className={`absolute z-50 mt-1 ${widthClass.includes('w-full') ? 'w-full left-0 right-0' : 'min-w-[220px] w-max max-w-xs'} bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto custom-scrollbar p-2`}>
          {searchable && (
            <div className="p-1 border-b border-gray-100 mb-1.5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded-lg border border-gray-200 focus-within:border-purple-400">
                <Search size={12} className="text-gray-400 shrink-0" />
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
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors">
                <input 
                  type="checkbox" 
                  className="w-3.5 h-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  checked={selected.includes(opt.value)}
                  onChange={(e) => {
                    const newSelected = e.target.checked 
                      ? [...selected, opt.value]
                      : selected.filter(v => v !== opt.value);
                    onChange(newSelected);
                  }}
                />
                <span className="text-xs text-gray-700 select-none truncate">{opt.label}</span>
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

export default function ResumeRepo({ onBulkUpload, onViewProfile }) {
  const hasManagePermission = usePermission('source.candidates.manage');
  const fileInputRef = useRef(null);
  
  // Data state
  const [folders, setFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [jobRoles, setJobRoles] = useState([]);
  const [allTags, setAllTags] = useState([]);
  
  // Navigation state: Year -> Month (currentFolder)
  const [currentYear, setCurrentYear] = useState(null);
  const [currentFolder, setCurrentFolder] = useState(null); // Month folder: { id: "2026-09", label, year, month_num, count, untagged_count, tags: [...] }
  
  // Tag filter within current month
  const [selectedTagFilter, setSelectedTagFilter] = useState('all'); // 'all' | 'untagged' | string
  
  // Candidates in active month view
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selected, setSelected] = useState(new Set());
  
  // View controls
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [manualYears, setManualYears] = useState(new Set());

  // Modals state
  const [showFolderModal, setShowFolderModal] = useState(false); // Year / Month creation
  const [showUploadModal, setShowUploadModal] = useState(false); // Upload with Tag Prompt
  const [showManageTagsModal, setShowManageTagsModal] = useState(false); // Bulk Tag management
  const [showSingleTagModal, setShowSingleTagModal] = useState(false); // Single candidate tag edit
  const [showMoveModal, setShowMoveModal] = useState(false); // Move resumes to another month
  const [showReprocessModal, setShowReprocessModal] = useState(false); // Re-extract skills & ATS modal
  const [reprocessTarget, setReprocessTarget] = useState(null); // { type: 'folder'|'selected'|'all', folderId, candidateIds, label, count }
  const [isReprocessing, setIsReprocessing] = useState(false);

  // Upload modal state
  const [stagedFiles, setStagedFiles] = useState([]);
  const [uploadSelectedTags, setUploadSelectedTags] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // Bulk tag management state
  const [bulkTagAction, setBulkTagAction] = useState('add'); // 'add' | 'remove'
  const [bulkSelectedTags, setBulkSelectedTags] = useState([]);
  const [isSubmittingBulkTags, setIsSubmittingBulkTags] = useState(false);

  // Single candidate tag edit state
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [singleCandidateTags, setSingleCandidateTags] = useState([]);
  const [isSavingSingleTags, setIsSavingSingleTags] = useState(false);

  // Move form state
  const [targetMoveMonth, setTargetMoveMonth] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  // Year/Month modal state
  const currentDate = new Date();
  const [newFolderMonth, setNewFolderMonth] = useState(currentDate.getMonth() + 1);
  const [newFolderYear, setNewFolderYear] = useState(currentDate.getFullYear());

  // ── Fetch folders & job roles & global tags ─────────────────────────────────
  const fetchFolders = async () => {
    setLoadingFolders(true);
    try {
      const res = await api.get('/source/candidates/repository/folders');
      const data = res.data.data || res.data || [];
      setFolders(data);
      
      // If currentFolder is open, refresh its data reference
      if (currentFolder) {
        const updated = data.find(f => f.id === currentFolder.id);
        if (updated) setCurrentFolder(updated);
      }
    } catch (err) {
      toast.error('Failed to load folders');
    } finally {
      setLoadingFolders(false);
    }
  };

  const fetchJobRoles = async () => {
    try {
      const res = await api.get('/source/job-roles');
      setJobRoles(res.data.data || res.data || []);
    } catch (err) {
      console.error('Failed to load job roles:', err);
    }
  };

  const fetchAllTags = async () => {
    try {
      const res = await api.get('/source/candidates/tags');
      setAllTags(res.data.data?.tags || []);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };

  useEffect(() => {
    fetchFolders();
    fetchJobRoles();
    fetchAllTags();
  }, []);

  // ── Fetch candidates for active month folder & tag ──────────────────────────
  const fetchCandidates = async (folderId, tagFilter = 'all') => {
    if (!folderId) return;
    setLoadingCandidates(true);
    try {
      const params = { 
        limit: 1000,
        upload_time: folderId
      };
      if (tagFilter && tagFilter !== 'all') {
        params.tag = tagFilter;
      }

      const res = await api.get('/source/candidates/search', { params });
      const raw = res.data.data || [];
      const normalized = raw.map(c => ({
        ...c,
        name: getCandidateName(c),
        tags: Array.isArray(c.tags) ? c.tags : []
      }));
      setCandidates(normalized);
      setSelected(new Set());
    } catch (err) {
      toast.error('Failed to load resumes');
    } finally {
      setLoadingCandidates(false);
    }
  };

  // Re-fetch candidates when folder or tag filter changes
  useEffect(() => {
    if (currentFolder) {
      fetchCandidates(currentFolder.id, selectedTagFilter);
    } else {
      setCandidates([]);
      setSelected(new Set());
    }
  }, [currentFolder?.id, selectedTagFilter]);

  // Derived filtered & sorted candidates
  const filteredCandidates = useMemo(() => {
    return candidates
      .filter(c => {
        const name = (c.name || c.full_name || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const search = searchQuery.toLowerCase();
        return name.includes(search) || email.includes(search);
      })
      .sort((a, b) => {
        const nameA = a.name || a.full_name || '';
        const nameB = b.name || b.full_name || '';
        if (sortBy === 'name_asc') return nameA.localeCompare(nameB);
        if (sortBy === 'name_desc') return nameB.localeCompare(nameA);
        if (sortBy === 'date_asc') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        if (sortBy === 'date_desc') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        return 0;
      });
  }, [candidates, searchQuery, sortBy]);

  // Year aggregation
  const yearCounts = useMemo(() => {
    return folders.reduce((acc, f) => {
      acc[f.year] = (acc[f.year] || 0) + f.count;
      return acc;
    }, {});
  }, [folders]);

  const yearList = useMemo(() => {
    return Array.from(new Set([...Object.keys(yearCounts).map(Number), ...manualYears])).sort((a, b) => b - a);
  }, [yearCounts, manualYears]);

  const foldersForYear = useMemo(() => {
    return currentYear ? folders.filter(f => f.year === currentYear) : [];
  }, [folders, currentYear]);

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

  const singleCandidateTagOptions = useMemo(() => {
    const existingValues = new Set(jobRoleTagOptions.map(o => o.value.toLowerCase()));
    const extra = (singleCandidateTags || [])
      .filter(t => t && !existingValues.has(t.toLowerCase()))
      .map(t => ({ value: t, label: t }));
    return [...jobRoleTagOptions, ...extra];
  }, [jobRoleTagOptions, singleCandidateTags]);

  // ── Stage files for Upload with Tag Prompt ──────────────────────────────────
  const stageFilesForUpload = (files) => {
    if (!files || files.length === 0) return;
    setStagedFiles(Array.from(files));
    if (selectedTagFilter && selectedTagFilter !== 'all' && selectedTagFilter !== 'untagged' && jobRoleTagOptions.some(o => o.value === selectedTagFilter)) {
      setUploadSelectedTags([selectedTagFilter]);
    } else {
      setUploadSelectedTags([]);
    }
    setShowUploadModal(true);
  };

  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length > 0) {
      toast.error('Some files were rejected due to size or format restrictions.');
    }
    if (accepted.length === 0) return;
    stageFilesForUpload(accepted);
  }, [selectedTagFilter]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
      'application/octet-stream': ['.zip'],
    },
    validator: (file) => {
      const name = (file.name || '').toLowerCase();
      if (name.endsWith('.zip') && file.size > ZIP_LIMIT_BYTES) return { code: 'too-large', message: 'ZIP files must be <= 2GB' };
      if ((name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx')) && file.size > PDF_LIMIT_BYTES) return { code: 'too-large', message: 'Docs must be <= 30MB' };
      return null;
    }
  });

  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      stageFilesForUpload(files);
      e.target.value = '';
    }
  };

  // Execute Upload after Tag Prompt
  const handleExecuteUpload = async () => {
    if (stagedFiles.length === 0) return;
    setIsUploading(true);

    const overrideDate = currentFolder ? currentFolder.id : null;
    const tags = uploadSelectedTags;

    try {
      if (onBulkUpload) {
        await onBulkUpload(stagedFiles, overrideDate, tags);
      } else {
        const fd = new FormData();
        stagedFiles.forEach(f => fd.append('files', f));
        if (overrideDate) fd.append('override_date', overrideDate);
        if (tags && tags.length > 0) fd.append('tags', JSON.stringify(tags));
        await api.post('/source/candidates/bulk-upload', fd);
        toast.success(`Queued ${stagedFiles.length} file(s) for processing.`);
      }

      setShowUploadModal(false);
      setStagedFiles([]);
      setUploadSelectedTags([]);

      setTimeout(() => {
        fetchFolders();
        fetchAllTags();
        if (currentFolder) {
          fetchCandidates(currentFolder.id, selectedTagFilter);
        }
      }, 1500);
    } catch (err) {
      toast.error('Upload failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveUploadTag = (tagToRemove) => {
    setUploadSelectedTags(uploadSelectedTags.filter(t => t.toLowerCase() !== tagToRemove.toLowerCase()));
  };

  // ── Selection helpers ──────────────────────────────────────────────────────
  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelected(new Set(filteredCandidates.map(c => c.id)));
    } else {
      setSelected(new Set());
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  // ── Post-Upload Bulk Tag Management ─────────────────────────────────────────
  const handleOpenManageTagsModal = () => {
    if (selected.size === 0) return;
    setBulkTagAction('add');
    setBulkSelectedTags([]);
    setShowManageTagsModal(true);
  };

  const handleRemoveBulkTag = (tagToRemove) => {
    setBulkSelectedTags(bulkSelectedTags.filter(t => t.toLowerCase() !== tagToRemove.toLowerCase()));
  };

  const handleApplyBulkTags = async (e) => {
    e.preventDefault();
    if (selected.size === 0) return;
    if (bulkSelectedTags.length === 0) {
      toast.error('Please select at least one job role tag');
      return;
    }

    setIsSubmittingBulkTags(true);
    try {
      const res = await api.post('/source/candidates/bulk-tag', {
        candidate_ids: Array.from(selected),
        tags: bulkSelectedTags,
        action: bulkTagAction
      });

      toast.success(res.data.message || `Updated tags for ${selected.size} resume(s)!`);
      setShowManageTagsModal(false);
      setSelected(new Set());

      await fetchFolders();
      await fetchAllTags();
      if (currentFolder) {
        fetchCandidates(currentFolder.id, selectedTagFilter);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update tags');
    } finally {
      setIsSubmittingBulkTags(false);
    }
  };

  // ── Post-Upload Single Candidate Tag Edit ──────────────────────────────────
  const handleOpenSingleTagModal = (candidate, e) => {
    if (e) e.stopPropagation();
    setEditingCandidate(candidate);
    setSingleCandidateTags(Array.isArray(candidate.tags) ? [...candidate.tags] : []);
    setShowSingleTagModal(true);
  };

  const handleRemoveSingleTag = (tagToRemove) => {
    setSingleCandidateTags(singleCandidateTags.filter(t => t.toLowerCase() !== tagToRemove.toLowerCase()));
  };

  const handleSaveSingleTags = async (e) => {
    e.preventDefault();
    if (!editingCandidate) return;

    setIsSavingSingleTags(true);
    try {
      const res = await api.put(`/source/candidates/${editingCandidate.id}/tags`, {
        tags: singleCandidateTags
      });

      toast.success('Tags updated successfully!');
      setShowSingleTagModal(false);
      setEditingCandidate(null);

      setCandidates(prev => prev.map(c => c.id === editingCandidate.id ? { ...c, tags: res.data.data || singleCandidateTags } : c));
      
      await fetchFolders();
      await fetchAllTags();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update tags');
    } finally {
      setIsSavingSingleTags(false);
    }
  };

  // ── Move Candidates ─────────────────────────────────────────────────────────
  const handleOpenMoveModal = () => {
    if (selected.size === 0) return;
    setTargetMoveMonth(currentFolder ? currentFolder.id : (folders[0]?.id || ''));
    setShowMoveModal(true);
  };

  const handleMoveCandidates = async (e) => {
    e.preventDefault();
    if (selected.size === 0) return;

    setIsMoving(true);
    try {
      const payload = {
        candidate_ids: Array.from(selected),
        target_month: targetMoveMonth || null
      };

      const res = await api.post('/source/candidates/move', payload);
      toast.success(res.data.message || `Moved ${selected.size} resume(s) successfully!`);
      setShowMoveModal(false);
      setSelected(new Set());
      
      await fetchFolders();
      if (currentFolder) {
        fetchCandidates(currentFolder.id, selectedTagFilter);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to move resumes');
    } finally {
      setIsMoving(false);
    }
  };

  // ── Bulk Delete ────────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selected.size} resume(s)?`)) return;

    try {
      await api.post('/source/candidates/bulk-delete', { candidate_ids: Array.from(selected) });
      toast.success(`${selected.size} resume(s) deleted successfully`);
      setSelected(new Set());
      await fetchFolders();
      if (currentFolder) {
        fetchCandidates(currentFolder.id, selectedTagFilter);
      }
    } catch (err) {
      toast.error('Failed to delete resumes');
    }
  };

  // ── Reprocess Resumes Handler ──────────────────────────────────────────────
  const handleOpenReprocessModal = (target) => {
    setReprocessTarget(target);
    setShowReprocessModal(true);
  };

  const handleExecuteReprocess = async () => {
    if (!reprocessTarget) return;
    setIsReprocessing(true);
    try {
      const payload = {};
      if (reprocessTarget.type === 'folder') {
        payload.month_year = reprocessTarget.folderId;
      } else if (reprocessTarget.type === 'selected') {
        payload.candidate_ids = reprocessTarget.candidateIds;
      } else if (reprocessTarget.type === 'all') {
        payload.all = true;
      }

      const res = await api.post('/source/candidates/reprocess', payload);
      if (res.data?.success) {
        const total = res.data.total_items || res.data.data?.total_items || 0;
        const jobId = res.data.job_id || res.data.data?.job_id;
        toast.success(`Queued ${total} resume(s) for re-extraction and ATS scoring!`);
        
        if (jobId && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('bulk-job-started', { detail: { jobId } }));
        }
        
        setShowReprocessModal(false);
        setSelected(new Set());
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Reprocessing failed');
    } finally {
      setIsReprocessing(false);
    }
  };

  // ── Year / Month creation ──────────────────────────────────────────────────
  const handleCreateFolder = () => {
    if (!currentYear) {
      setManualYears(prev => new Set(prev).add(newFolderYear));
      setCurrentYear(newFolderYear);
      setShowFolderModal(false);
      return;
    }
    
    const monthStr = newFolderMonth.toString().padStart(2, '0');
    const folderId = `${currentYear}-${monthStr}`;
    const date = new Date(currentYear, newFolderMonth - 1);
    const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    const existing = folders.find(f => f.id === folderId);
    if (existing) {
      setCurrentFolder(existing);
    } else {
      setCurrentFolder({ id: folderId, label, year: currentYear, month_num: newFolderMonth, count: 0, untagged_count: 0, tags: [] });
    }
    setShowFolderModal(false);
  };

  return (
    <div {...getRootProps()} style={{ outline: 'none', minHeight: '100%', height: '100%' }}>
      <input {...getInputProps()} />
      {/* Hidden dedicated file input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileInputChange} 
        style={{ display: 'none' }} 
        accept=".pdf,.doc,.docx,.txt,.zip" 
        multiple 
      />
      
      {/* Drag Overlay */}
      {isDragActive && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(147, 51, 234, 0.12)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, border: '4px dashed #9333EA', borderRadius: '16px', margin: '20px'
        }}>
          <div style={{ textAlign: 'center', color: '#9333EA', background: '#FFFFFF', padding: '40px', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <Upload size={64} style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              {currentFolder 
                ? `Drop resumes to upload into "${currentFolder.label}"` 
                : 'Drop resumes to upload'}
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#6B7280', marginTop: 8 }}>
              You will be prompted to assign Job Role tags. Resumes without tags enter the General Pool.
            </p>
          </div>
        </div>
      )}

      {/* Header & Breadcrumbs */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.1rem', fontWeight: 600 }}>
            <span 
              style={{ color: (!currentYear && !currentFolder) ? '#111827' : '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => { setCurrentYear(null); setCurrentFolder(null); setSelectedTagFilter('all'); }}
              className="hover:text-purple-600 transition-colors"
            >
              <Folder size={18} />
              Resume Repo
            </span>
            
            {currentYear && (
              <>
                <ChevronRight size={16} color="#9CA3AF" />
                <span 
                  style={{ color: currentFolder ? '#6B7280' : '#111827', cursor: 'pointer' }}
                  onClick={() => { setCurrentFolder(null); setSelectedTagFilter('all'); }}
                  className="hover:text-purple-600 transition-colors"
                >
                  {currentYear}
                </span>
              </>
            )}

            {currentFolder && (
              <>
                <ChevronRight size={16} color="#9CA3AF" />
                <span style={{ color: '#9333EA', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CalendarDays size={16} />
                  {currentFolder.label}
                </span>
              </>
            )}
          </div>

          {/* Quick Back button & Global Upload button */}
          <div className="flex items-center gap-2">
            {currentFolder && (
              <button 
                onClick={() => { setCurrentFolder(null); setSelectedTagFilter('all'); }}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft size={14} /> Back to {currentYear}
              </button>
            )}

            {hasManagePermission && !currentFolder && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleOpenReprocessModal({ type: 'all', label: 'All Resumes (Entire Vault)', count: folders.reduce((a, b) => a + (b.count || 0), 0) })}
                  className="bg-white border border-purple-200 hover:border-purple-300 hover:bg-purple-50 text-purple-700 font-semibold py-1.5 px-3.5 rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
                  title="Re-extract skills with enhanced parser and refresh ATS scores for all resumes"
                >
                  <Sparkles size={13} /> Re-extract All Skills
                </button>
                <button 
                  onClick={handleTriggerFileInput}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-1.5 px-3.5 rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <Upload size={14} /> Upload Resumes
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* ══════════════════════════════════════════════════════════════════════
            LEVEL 1: YEAR VIEW
            ══════════════════════════════════════════════════════════════════════ */}
        {!currentYear && !currentFolder && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  className="form-input w-full" 
                  placeholder="Search years..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: 36, borderRadius: '10px' }}
                />
              </div>

              {hasManagePermission && (
                <button 
                  className="btn btn-outline" 
                  onClick={() => setShowFolderModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: '10px' }}
                >
                  <Plus size={16} /> Add Year Folder
                </button>
              )}
            </div>

            {loadingFolders ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner spinner-lg" /></div>
            ) : yearList.length === 0 ? (
              <div className="empty-state" style={{ textAlign: 'center', padding: 64, background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB' }}>
                <Folder size={48} color="#9CA3AF" style={{ opacity: 0.5, margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: '1.2rem', color: '#111827', fontWeight: 700 }}>No Resumes in Repository</h3>
                <p style={{ color: '#6B7280', fontSize: '0.9rem', maxWidth: 420, margin: '8px auto 20px' }}>
                  Upload resumes to automatically create month folders with job role tags, or drop files here to get started.
                </p>
                {hasManagePermission && (
                  <button 
                    onClick={handleTriggerFileInput}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-xl text-xs transition-colors flex items-center gap-2 mx-auto"
                  >
                    <Upload size={14} /> Upload First Resume
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {yearList.filter(y => y.toString().includes(searchQuery)).map(year => (
                  <div 
                    key={year} 
                    className="card"
                    style={{ padding: '24px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 14, border: '1px solid #E5E7EB', borderRadius: 16, background: '#FFFFFF', transition: 'transform 0.2s, box-shadow 0.2s' }}
                    onClick={() => setCurrentYear(year)}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Folder size={36} color="#9333EA" style={{ fill: 'rgba(147, 51, 234, 0.1)' }} />
                      <span className="badge badge-secondary" style={{ fontSize: '0.8rem', fontWeight: 600, background: '#F3F4F6', color: '#4B5563', padding: '3px 10px', borderRadius: 8 }}>
                        {yearCounts[year] || 0} resumes
                      </span>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#111827', fontWeight: 700 }}>{year}</h3>
                      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#6B7280' }}>
                        {folders.filter(f => f.year === year).length} active month(s)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            LEVEL 2: MONTH VIEW (Folders for Current Year)
            ══════════════════════════════════════════════════════════════════════ */}
        {currentYear && !currentFolder && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  className="form-input w-full" 
                  placeholder="Search months..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: 36, borderRadius: '10px' }}
                />
              </div>

              {hasManagePermission && (
                <button 
                  className="btn btn-outline" 
                  onClick={() => setShowFolderModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: '10px' }}
                >
                  <Plus size={16} /> Add Month Folder
                </button>
              )}
            </div>

            {foldersForYear.length === 0 ? (
              <div className="empty-state" style={{ textAlign: 'center', padding: 48, background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB' }}>
                <CalendarDays size={48} color="#9CA3AF" style={{ opacity: 0.5, margin: '0 auto 16px' }} />
                <p style={{ fontWeight: 600, color: '#374151' }}>No resumes uploaded in {currentYear}.</p>
                <p style={{ color: '#9CA3AF', fontSize: '0.85rem', marginTop: 4 }}>
                  Upload resumes to create the first month folder in {currentYear}.
                </p>
                {hasManagePermission && (
                  <button 
                    onClick={handleTriggerFileInput}
                    className="mt-4 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-xl text-xs transition-colors inline-flex items-center gap-2"
                  >
                    <Upload size={14} /> Upload to {currentYear}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {foldersForYear.filter(f => f.label.toLowerCase().includes(searchQuery.toLowerCase())).map((f) => {
                  const tagList = f.tags || [];
                  return (
                    <div 
                      key={f.id} 
                      className="card"
                      style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid #E5E7EB', borderRadius: 14, background: '#FFFFFF', transition: 'transform 0.2s, box-shadow 0.2s' }}
                      onClick={() => { setCurrentFolder(f); setSelectedTagFilter('all'); }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Folder size={32} color="#9333EA" style={{ fill: 'rgba(147, 51, 234, 0.1)' }} />
                        <span className="badge badge-secondary" style={{ fontSize: '0.75rem', fontWeight: 600, background: '#F3F4F6', color: '#4B5563', padding: '2px 8px', borderRadius: 6 }}>
                          {f.count} {f.count === 1 ? 'resume' : 'resumes'}
                        </span>
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#111827', fontWeight: 700 }}>{f.label}</h3>
                        
                        {/* Tags preview */}
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {tagList.length > 0 ? (
                            <>
                              {tagList.slice(0, 3).map(t => (
                                <span key={t.name} className="text-[11px] font-medium bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-100 flex items-center gap-1">
                                  <Tag size={10} /> {t.name} ({t.count})
                                </span>
                              ))}
                              {tagList.length > 3 && (
                                <span className="text-[10px] text-gray-400 self-center">+{tagList.length - 3} more</span>
                              )}
                            </>
                          ) : (
                            <span className="text-[11px] text-gray-400 italic">General Pool only</span>
                          )}
                          {f.untagged_count > 0 && tagList.length > 0 && (
                            <span className="text-[10px] text-gray-400 self-center">· {f.untagged_count} general</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            LEVEL 3: INSIDE MONTH (Direct Resumes with Tag Filter Pills)
            ══════════════════════════════════════════════════════════════════════ */}
        {currentFolder && (
          <div className="animate-fade-in flex flex-col gap-5">
            {/* Month Banner with Tags Filter Pills */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 shrink-0">
                    <CalendarDays size={20} />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900 m-0">{currentFolder.label}</h1>
                    <p className="text-xs text-gray-500 m-0 mt-0.5">
                      {currentFolder.count || 0} total resumes · Filter by Job Role tags or General Pool below
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {hasManagePermission && (
                    <>
                      <button
                        onClick={() => handleOpenReprocessModal({ type: 'folder', folderId: currentFolder.id, label: currentFolder.label, count: currentFolder.count || 0 })}
                        disabled={(currentFolder.count || 0) === 0}
                        className="bg-white border border-purple-200 hover:border-purple-300 hover:bg-purple-50 text-purple-700 font-semibold py-1.5 px-3 rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                        title="Re-extract skills and recalculate ATS scores for all resumes in this month"
                      >
                        <Sparkles size={13} /> Re-extract Folder Skills
                      </button>
                      <button
                        onClick={handleTriggerFileInput}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-1.5 px-3.5 rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
                      >
                        <Upload size={13} /> Upload to this Month
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* TAG FILTER PILLS BAR */}
              <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-gray-100">
                <span className="text-xs font-semibold text-gray-500 mr-1 flex items-center gap-1">
                  <Tag size={13} /> Filter Tags:
                </span>
                
                {/* Pill: All */}
                <button
                  onClick={() => setSelectedTagFilter('all')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    selectedTagFilter === 'all'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All ({currentFolder.count || 0})
                </button>

                {/* Pill: General Pool (Untagged) */}
                <button
                  onClick={() => setSelectedTagFilter('untagged')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    selectedTagFilter === 'untagged'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  General Pool ({currentFolder.untagged_count || 0})
                </button>

                {/* Individual Tag Pills */}
                {(currentFolder.tags || []).map(t => (
                  <button
                    key={t.name}
                    onClick={() => setSelectedTagFilter(t.name)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      selectedTagFilter.toLowerCase() === t.name.toLowerCase()
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                    }`}
                  >
                    🏷️ {t.name} ({t.count})
                  </button>
                ))}
              </div>
            </div>

            {/* Candidate List Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', padding: '12px 18px', borderRadius: '14px', border: '1px solid #E5E7EB', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input 
                  type="checkbox" 
                  style={{ accentColor: '#9333EA', width: 16, height: 16, cursor: 'pointer' }}
                  checked={filteredCandidates.length > 0 && selected.size === filteredCandidates.length}
                  onChange={toggleSelectAll}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4B5563' }}>Select All ({filteredCandidates.length})</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, maxWidth: 280 }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={15} color="#9CA3AF" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text" 
                    className="form-input w-full" 
                    placeholder="Search candidate or email..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: 32, width: '100%', borderRadius: '8px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <select 
                  className="form-input" 
                  value={sortBy} 
                  onChange={e => setSortBy(e.target.value)} 
                  style={{ borderRadius: '8px', padding: '6px 10px', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="name_asc">Name (A-Z)</option>
                  <option value="name_desc">Name (Z-A)</option>
                </select>

                <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: '8px', padding: '3px' }}>
                  <button 
                    className={`btn btn-sm ${viewMode === 'list' ? 'bg-white shadow-2xs font-semibold' : 'text-gray-500 hover:text-gray-700'}`} 
                    style={{ padding: '4px 8px', height: 'auto', border: 'none', borderRadius: 6 }} 
                    onClick={() => setViewMode('list')}
                  >
                    <List size={15} />
                  </button>
                  <button 
                    className={`btn btn-sm ${viewMode === 'grid' ? 'bg-white shadow-2xs font-semibold' : 'text-gray-500 hover:text-gray-700'}`} 
                    style={{ padding: '4px 8px', height: 'auto', border: 'none', borderRadius: 6 }} 
                    onClick={() => setViewMode('grid')}
                  >
                    <LayoutGrid size={15} />
                  </button>
                </div>

                {hasManagePermission && selected.size > 0 && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleOpenReprocessModal({ type: 'selected', candidateIds: Array.from(selected), label: `${selected.size} selected resume(s)`, count: selected.size })}
                      className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-semibold py-1 px-3 rounded-lg text-xs transition-colors flex items-center gap-1.5"
                      title="Re-extract skills and recalculate ATS scores for selected candidates"
                    >
                      <Sparkles size={13} /> Re-extract ({selected.size})
                    </button>
                    <button 
                      onClick={handleOpenManageTagsModal}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-1 px-3 rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
                    >
                      <Tag size={13} /> Manage Tags ({selected.size})
                    </button>
                    <button 
                      onClick={handleOpenMoveModal}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-1 px-3 rounded-lg text-xs transition-colors flex items-center gap-1.5"
                    >
                      <ArrowRightLeft size={13} /> Move ({selected.size})
                    </button>
                    <button 
                      onClick={handleBulkDelete}
                      className="text-red-600 hover:bg-red-50 border border-red-200 font-semibold py-1 px-3 rounded-lg text-xs transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 size={13} /> Delete ({selected.size})
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Candidates Display */}
            {loadingCandidates ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
            ) : filteredCandidates.length === 0 ? (
              <div className="empty-state" style={{ textAlign: 'center', padding: '48px 20px', background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB' }}>
                <File size={40} color="#9CA3AF" style={{ opacity: 0.5, margin: '0 auto 12px' }} />
                <p style={{ fontWeight: 600, color: '#374151', fontSize: '0.95rem' }}>
                  {selectedTagFilter !== 'all' 
                    ? `No resumes match tag "${selectedTagFilter === 'untagged' ? 'General Pool' : selectedTagFilter}" in ${currentFolder.label}.`
                    : `No resumes found in ${currentFolder.label}.`}
                </p>
                <p style={{ color: '#9CA3AF', fontSize: '0.8rem', marginTop: 4 }}>
                  Drop files here or click Upload to add resumes into this month with Job Role tags.
                </p>
                {hasManagePermission && (
                  <button 
                    onClick={handleTriggerFileInput}
                    className="mt-3 bg-purple-600 hover:bg-purple-700 text-white font-medium py-1.5 px-3.5 rounded-xl text-xs transition-colors inline-flex items-center gap-1.5"
                  >
                    <Upload size={13} /> Upload Resumes
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(290px, 1fr))' : '1fr', gap: 12 }}>
                {filteredCandidates.map((c) => {
                  const cTags = Array.isArray(c.tags) ? c.tags : [];
                  return (
                    <div 
                      key={c.id} 
                      className="card group"
                      style={{ 
                        padding: '14px', 
                        border: selected.has(c.id) ? '2px solid #9333EA' : '1px solid #E5E7EB',
                        borderRadius: 12,
                        background: selected.has(c.id) ? '#FAF5FF' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'var(--transition)',
                        display: 'flex',
                        flexDirection: viewMode === 'grid' ? 'column' : 'row',
                        alignItems: viewMode === 'grid' ? 'stretch' : 'center',
                        gap: 10
                      }}
                      onClick={() => toggleSelect(c.id)}
                    >
                      <div style={{ display: 'flex', alignItems: viewMode === 'grid' ? 'flex-start' : 'center', gap: 12, flex: 1 }}>
                        <input 
                          type="checkbox" 
                          style={{ accentColor: '#9333EA', width: 16, height: 16, marginTop: viewMode === 'grid' ? 4 : 0 }}
                          checked={selected.has(c.id)}
                          onChange={() => {}}
                        />
                        <div style={{ flex: 1, minWidth: 0, display: viewMode === 'list' ? 'flex' : 'block', alignItems: 'center', gap: 20 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: viewMode === 'grid' ? 4 : 0 }}>
                              <File size={16} color="#9333EA" style={{ flexShrink: 0 }} />
                              <span 
                                style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} 
                                title={c.name || c.full_name}
                                className="hover:text-purple-600 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewProfile?.(c);
                                }}
                              >
                                {c.name || c.full_name || getCandidateName(c)}
                              </span>
                            </div>
                            
                            <div style={{ fontSize: '0.75rem', color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.email}
                            </div>
                          </div>

                          {/* TAGS BADGES */}
                          <div className={`flex items-center gap-1.5 flex-wrap ${viewMode === 'list' ? 'max-w-[340px]' : 'mt-2'}`}>
                            {cTags.length > 0 ? (
                              cTags.map(tag => (
                                <span 
                                  key={tag} 
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200"
                                  onClick={(e) => handleOpenSingleTagModal(c, e)}
                                  title="Click to edit tags"
                                >
                                  🏷️ {tag}
                                </span>
                              ))
                            ) : (
                              <span 
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500"
                                onClick={(e) => handleOpenSingleTagModal(c, e)}
                                title="Click to add tags"
                              >
                                General Pool
                              </span>
                            )}
                            
                            {hasManagePermission && (
                              <button
                                onClick={(e) => handleOpenSingleTagModal(c, e)}
                                className="text-[10px] text-gray-400 hover:text-purple-600 hover:bg-purple-50 px-1.5 py-0.5 rounded transition-colors flex items-center gap-0.5"
                                title="Edit tags"
                              >
                                <Plus size={10} /> Tag
                              </button>
                            )}
                          </div>

                          {viewMode === 'list' && (
                            <div style={{ width: 120, fontSize: '0.8rem', color: '#9CA3AF' }}>
                              {new Date(c.created_at || Date.now()).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: viewMode === 'grid' ? 'auto' : 0, paddingTop: viewMode === 'grid' ? 8 : 0, borderTop: viewMode === 'grid' ? '1px solid #F3F4F6' : 'none', gap: 8 }}>
                        <button
                          className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 font-medium py-1 px-2.5 rounded-lg text-xs transition-colors duration-200 flex items-center gap-1"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewProfile?.(c);
                          }}
                        >
                          <User size={13} />
                          View Profile
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: UPLOAD WITH JOB ROLE TAGS PROMPT
          ══════════════════════════════════════════════════════════════════════ */}
      {showUploadModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card animate-fade-in" style={{ width: 520, maxWidth: '95vw', padding: 24, borderRadius: 16, background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
                  <Upload size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#111827', fontWeight: 700 }}>
                    Upload Resumes
                  </h3>
                  <p className="text-xs text-gray-500 m-0 mt-0.5">
                    Target Month: <strong>{currentFolder ? currentFolder.label : 'Current Month'}</strong>
                  </p>
                </div>
              </div>
              <button 
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors" 
                onClick={() => { setShowUploadModal(false); setStagedFiles([]); }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Staged Files Preview */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4 border border-gray-100 max-h-32 overflow-y-auto">
              <div className="text-xs font-semibold text-gray-700 mb-1.5 flex justify-between items-center">
                <span>Selected Files ({stagedFiles.length})</span>
                <span className="text-[11px] text-gray-400">PDF, DOCX, ZIP</span>
              </div>
              <div className="flex flex-col gap-1">
                {stagedFiles.slice(0, 5).map((file, i) => (
                  <div key={i} className="text-xs text-gray-600 flex items-center gap-1.5 truncate">
                    <File size={12} className="text-purple-600 shrink-0" />
                    <span className="truncate">{file.name}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                ))}
                {stagedFiles.length > 5 && (
                  <span className="text-[11px] text-gray-400 italic">+{stagedFiles.length - 5} more files</span>
                )}
              </div>
            </div>

            {/* TAG ASSIGNMENT SECTION */}
            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  Assign Job Role Tag(s)
                </label>
                <p className="text-[11px] text-gray-500 mb-2">
                  Select job roles to categorize these resumes. Resumes can be filtered by these tags.
                </p>

                {/* Multi-Select Dropdown with Search */}
                <div className="mb-2.5">
                  <MultiSelectDropdown
                    options={jobRoleTagOptions}
                    selected={uploadSelectedTags}
                    onChange={setUploadSelectedTags}
                    placeholder="Select Job Role(s)..."
                    emptyText={jobRoleTagOptions.length === 0 ? "No active job roles found" : "No matching job roles"}
                    widthClass="w-full"
                    searchable={true}
                    searchPlaceholder="Search job roles..."
                  />
                </div>

                {/* Selected Tags Display */}
                <div className="flex flex-wrap gap-1.5 min-h-[34px] p-2 bg-purple-50/50 border border-purple-100 rounded-xl items-center">
                  {uploadSelectedTags.length === 0 ? (
                    <span className="text-xs text-purple-400 italic flex items-center gap-1">
                      No job roles selected → Will be stored in <strong>General Pool (Untagged)</strong>
                    </span>
                  ) : (
                    uploadSelectedTags.map(tag => (
                      <span 
                        key={tag} 
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-600 text-white shadow-2xs"
                      >
                        💼 {tag}
                        <button 
                          type="button" 
                          onClick={() => handleRemoveUploadTag(tag)}
                          className="hover:text-red-200 ml-0.5 cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* General Pool Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-800 leading-snug">
                💡 <strong>Tip:</strong> Job role tagging is optional. Resumes without tags land in the <strong>General Pool</strong> and can be tagged or re-tagged at any time later.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button 
                type="button" 
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                onClick={() => { setShowUploadModal(false); setStagedFiles([]); }}
                disabled={isUploading}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleExecuteUpload}
                disabled={isUploading || stagedFiles.length === 0}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-xl text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
              >
                {isUploading ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploadSelectedTags.length > 0 ? `Upload with ${uploadSelectedTags.length} Tag(s)` : 'Upload to General Pool'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: BULK MANAGE TAGS FOR SELECTED CANDIDATES
          ══════════════════════════════════════════════════════════════════════ */}
      {showManageTagsModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card animate-fade-in" style={{ width: 480, maxWidth: '95vw', padding: 24, borderRadius: 16, background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#111827', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                <Tag size={18} color="#9333EA" /> Manage Tags ({selected.size} selected)
              </h3>
              <button 
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors" 
                onClick={() => setShowManageTagsModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleApplyBulkTags} className="flex flex-col gap-4">
              {/* Action Type Toggle */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Action</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkTagAction('add')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      bulkTagAction === 'add'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    + Add Tag(s)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkTagAction('remove')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      bulkTagAction === 'remove'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    - Remove Tag(s)
                  </button>
                </div>
              </div>

              {/* Tags Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Job Role Tag(s) to {bulkTagAction === 'add' ? 'Add' : 'Remove'}
                </label>
                <p className="text-[11px] text-gray-500 mb-2">
                  Select active job roles to {bulkTagAction === 'add' ? 'assign to' : 'remove from'} the {selected.size} selected candidate(s).
                </p>

                {/* Multi-Select Dropdown with Search */}
                <div className="mb-2.5">
                  <MultiSelectDropdown
                    options={jobRoleTagOptions}
                    selected={bulkSelectedTags}
                    onChange={setBulkSelectedTags}
                    placeholder={`Select Job Role(s) to ${bulkTagAction === 'add' ? 'add' : 'remove'}...`}
                    emptyText={jobRoleTagOptions.length === 0 ? "No active job roles found" : "No matching job roles"}
                    widthClass="w-full"
                    searchable={true}
                    searchPlaceholder="Search job roles..."
                  />
                </div>

                {/* Active selected tags */}
                <div className="flex flex-wrap gap-1.5 min-h-[34px] p-2 bg-gray-50 border border-gray-200 rounded-xl mb-2 items-center">
                  {bulkSelectedTags.length === 0 ? (
                    <span className="text-xs text-gray-400 italic">No job roles chosen yet</span>
                  ) : (
                    bulkSelectedTags.map(tag => (
                      <span 
                        key={tag} 
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          bulkTagAction === 'add' ? 'bg-purple-600 text-white' : 'bg-red-600 text-white'
                        }`}
                      >
                        💼 {tag}
                        <button 
                          type="button" 
                          onClick={() => handleRemoveBulkTag(tag)}
                          className="hover:text-red-200 ml-0.5 cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 mt-2 pt-3 border-t border-gray-100">
                <button 
                  type="button" 
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                  onClick={() => setShowManageTagsModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmittingBulkTags || bulkSelectedTags.length === 0}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-xl text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingBulkTags ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
                  Apply Tags to {selected.size} Candidate(s)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: EDIT TAGS FOR A SINGLE CANDIDATE
          ══════════════════════════════════════════════════════════════════════ */}
      {showSingleTagModal && editingCandidate && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card animate-fade-in" style={{ width: 440, maxWidth: '95vw', padding: 24, borderRadius: 16, background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#111827', fontWeight: 700 }}>
                  Edit Resume Tags
                </h3>
                <p className="text-xs text-gray-500 m-0 mt-0.5 truncate max-w-[340px]">
                  {editingCandidate.name || editingCandidate.full_name}
                </p>
              </div>
              <button 
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors" 
                onClick={() => { setShowSingleTagModal(false); setEditingCandidate(null); }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSingleTags} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Assign Job Role Tag(s)
                </label>
                <p className="text-[11px] text-gray-500 mb-2">
                  Select job roles to categorize this candidate. Tags are strictly based on active jobs.
                </p>

                {/* Multi-Select Dropdown with Search */}
                <div className="mb-2.5">
                  <MultiSelectDropdown
                    options={singleCandidateTagOptions}
                    selected={singleCandidateTags}
                    onChange={setSingleCandidateTags}
                    placeholder="Select Job Role(s)..."
                    emptyText={jobRoleTagOptions.length === 0 ? "No active job roles found" : "No matching job roles"}
                    widthClass="w-full"
                    searchable={true}
                    searchPlaceholder="Search job roles..."
                  />
                </div>

                {/* Current tags display */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Current Assigned Tags</label>
                  <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 bg-purple-50/50 border border-purple-100 rounded-xl items-center">
                    {singleCandidateTags.length === 0 ? (
                      <span className="text-xs text-gray-400 italic">No tags (General Pool)</span>
                    ) : (
                      singleCandidateTags.map(tag => (
                        <span 
                          key={tag} 
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-600 text-white shadow-2xs"
                        >
                          💼 {tag}
                          <button 
                            type="button" 
                            onClick={() => handleRemoveSingleTag(tag)}
                            className="hover:text-red-200 ml-0.5 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 mt-2 pt-3 border-t border-gray-100">
                <button 
                  type="button" 
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                  onClick={() => { setShowSingleTagModal(false); setEditingCandidate(null); }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSavingSingleTags}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-xl text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingSingleTags ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
                  Save Tags
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: MOVE RESUMES TO ANOTHER MONTH
          ══════════════════════════════════════════════════════════════════════ */}
      {showMoveModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card animate-fade-in" style={{ width: 440, padding: 24, borderRadius: 16, background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#111827', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                <ArrowRightLeft size={18} color="#9333EA" /> Move Resumes
              </h3>
              <button 
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors" 
                onClick={() => setShowMoveModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              Move <strong>{selected.size}</strong> selected resume(s) to a different month folder. Tags will remain preserved.
            </p>

            <form onSubmit={handleMoveCandidates} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Target Month Folder</label>
                <select
                  className="form-input w-full text-xs"
                  value={targetMoveMonth}
                  onChange={e => setTargetMoveMonth(e.target.value)}
                  required
                >
                  <option value="">Select target month...</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.label} ({f.count} resumes)</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2.5 mt-2 pt-3 border-t border-gray-100">
                <button 
                  type="button" 
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                  onClick={() => setShowMoveModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isMoving || !targetMoveMonth}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-xl text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isMoving ? <Loader size={14} className="animate-spin" /> : <MoveRight size={14} />}
                  Confirm Move
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: CREATE YEAR / MONTH FOLDER
          ══════════════════════════════════════════════════════════════════════ */}
      {showFolderModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card animate-fade-in" style={{ width: 400, padding: 24, borderRadius: 16, background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#111827', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                <Folder size={20} color="#9333EA" /> Create Folder
              </h3>
              <button 
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors" 
                onClick={() => setShowFolderModal(false)}
              >
                <X size={16} />
              </button>
            </div>
            
            <div style={{ marginBottom: 20 }}>
              {!currentYear ? (
                <>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 8, color: '#4B5563' }}>Select Year</label>
                  <select 
                    className="form-input w-full" 
                    value={newFolderYear} 
                    onChange={e => setNewFolderYear(Number(e.target.value))}
                    style={{ width: '100%' }}
                  >
                    {Array.from({ length: 10 }).map((_, i) => {
                      const y = currentDate.getFullYear() - i;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                </>
              ) : (
                <>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 8, color: '#4B5563' }}>Select Month for {currentYear}</label>
                  <select 
                    className="form-input w-full" 
                    value={newFolderMonth} 
                    onChange={e => setNewFolderMonth(Number(e.target.value))}
                    style={{ width: '100%' }}
                  >
                    {Array.from({ length: 12 }).map((_, i) => {
                      const monthNum = i + 1;
                      const date = new Date(2000, i);
                      const monthName = date.toLocaleString('default', { month: 'long' });
                      const isFuture = currentYear === currentDate.getFullYear() && monthNum > currentDate.getMonth() + 1;
                      return <option key={monthNum} value={monthNum} disabled={isFuture}>{monthName}</option>;
                    })}
                  </select>
                </>
              )}
              <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: 8 }}>
                Folders organize resumes by upload month.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="text-gray-600 hover:bg-gray-100 font-medium py-2 px-4 rounded-xl transition-colors duration-200" onClick={() => setShowFolderModal(false)}>Cancel</button>
              <button className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-xl transition-colors duration-200" onClick={handleCreateFolder}>Create & Open</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: RE-EXTRACT & PROCESS RESUMES (SKILLS + ATS)
          ══════════════════════════════════════════════════════════════════════ */}
      {showReprocessModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card animate-fade-in" style={{ width: 480, padding: 24, borderRadius: 16, background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#111827', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                <Sparkles size={18} color="#9333EA" /> Re-extract Skills & ATS Score
              </h3>
              <button 
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors" 
                onClick={() => setShowReprocessModal(false)}
                disabled={isReprocessing}
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3.5 mb-4 text-xs text-purple-900 leading-relaxed">
              <p className="font-semibold mb-1 text-purple-950 flex items-center gap-1.5">
                <Zap size={13} className="text-purple-600" /> Enhanced Multi-Category Parser & ATS Engine
              </p>
              <ul className="list-disc pl-4 space-y-1 text-purple-800">
                <li>Extracts <strong>Methodologies</strong> (Agile, SDLC, Shift-Left), <strong>Domain Knowledge</strong> (HIPAA, EHR), and <strong>QA Practices</strong> (Defect Reporting, Test Cases).</li>
                <li>Normalizes slashes and parenthetical items (e.g. <em>Agile/Scrum</em> &rarr; <em>Agile, Scrum</em>).</li>
                <li>Recalculates candidate match scores across all active job roles automatically.</li>
              </ul>
            </div>

            <div className="text-xs text-gray-600 mb-5">
              <span className="font-semibold text-gray-700">Target:</span>{' '}
              <span className="font-bold text-purple-700">{reprocessTarget?.label}</span>
              {reprocessTarget?.count !== undefined && (
                <span className="text-gray-500"> ({reprocessTarget.count} resume{reprocessTarget.count === 1 ? '' : 's'})</span>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button 
                type="button" 
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                onClick={() => setShowReprocessModal(false)}
                disabled={isReprocessing}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleExecuteReprocess}
                disabled={isReprocessing}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              >
                {isReprocessing ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {isReprocessing ? 'Starting Reprocess...' : 'Start Re-extraction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
