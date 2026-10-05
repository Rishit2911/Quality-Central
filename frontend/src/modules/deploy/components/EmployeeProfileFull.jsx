import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Mail, Phone, MapPin, Briefcase, Calendar, 
  ShieldCheck, FileText, User, ChevronRight,
  TrendingUp, Award, Clock, ArrowLeft, Download,
  ExternalLink, Building, Landmark, GraduationCap,
  Save, Edit3, Image, Upload, Trash2, Package, CheckCircle, Key, AlertTriangle, Plus, Home
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import ComboBox from '../../../core/components/ComboBox';
import useUnsavedChangesWarning from '../../../core/hooks/useUnsavedChangesWarning';
import HasPermission from '../../../components/common/HasPermission';
import { usePermissions } from '../../../core/auth/usePermissions';
import { useAuth } from '../../../core/auth/AuthContext';
import { P } from '../../../core/permissions';
import {
  isValidEmail,
  isValidPhone,
  isValidPAN,
  isValidBankAccount,
  isValidPincode,
  isValidDate,
  isDateAfter,
  isValidURL,
  isNonNegativeNumber
} from '../../../core/utils/validators';

// Splits a combined display name into first/middle/last, for records where
// first_name/middle_name/last_name were never split out in the database
// (legacy/seeded rows) — mirrors backend split_full_name().
const splitFullName = (fullName) => {
    const words = (fullName || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return { first_name: '', middle_name: '', last_name: '' };
    if (words.length === 1) return { first_name: words[0], middle_name: '', last_name: '' };
    if (words.length === 2) return { first_name: words[0], middle_name: '', last_name: words[1] };
    return { first_name: words[0], middle_name: words.slice(1, -1).join(' '), last_name: words[words.length - 1] };
};

// Mirrors the backend's profile-completeness check for education_details
// (JSONB column — arrives as an array, or occasionally as a raw JSON string).
const hasEducationDetails = (edu) => {
    try {
        const parsed = typeof edu === 'string' ? JSON.parse(edu) : edu;
        return Array.isArray(parsed) && parsed.some(e => e && (e.degree || e.university || e.year || e.percentage));
    } catch {
        return false;
    }
};

// ── STATUS CONFIG ──
const STATUS_OPTIONS = ['Active', 'Notice Period', 'On Leave', 'Inactive'];
const EXITED_STATUSES = ['Exited', 'Terminated'];

// Fallback lists — same as the onboarding invite form — used only until
// /api/options resolves with the tenant's actual designations/departments.
const DESIGNATIONS = [
    'Software Engineer', 'Senior Engineer', 'Team Lead', 'Project Manager',
    'Product Manager', 'Designer', 'QA Analyst', 'Sales Executive',
    'HR Associate', 'Accountant', 'Marketing Specialist', 'Operations Manager'
];

const DEPARTMENTS = [
    'Engineering', 'Product', 'Design', 'Marketing', 'Sales',
    'Human Resources', 'Finance', 'Operations', 'Quality Assurance'
];

const DEGREE_OPTIONS = [
    '10th / SSC', '12th / HSC', 'Diploma',
    'B.Tech', 'B.E.', 'B.Sc', 'B.Com', 'B.A.', 'BBA', 'BCA',
    'M.Tech', 'M.E.', 'M.Sc', 'M.Com', 'M.A.', 'MBA', 'MCA', 'PhD'
];

const EMPTY_EDUCATION_ENTRY = { degree: '', university: '', year: '', percentage: '' };

const STATUS_COLORS = {
  Active: '#10B981',
  'Notice Period': '#F59E0B',
  'On Leave': '#F59E0B',
  'Inactive': '#000000',
  'Exited': '#EF4444',
  'Terminated': '#EF4444',
};

export default function EmployeeProfileFull({ employeeCode: initialCode, onBack }) {
    const [employeeCode, setEmployeeCode] = useState(initialCode);
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    useUnsavedChangesWarning(editMode);
    const [formData, setFormData] = useState({});
    const [assets, setAssets] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [managers, setManagers] = useState([]);
    const [dynDesignations, setDynDesignations] = useState([]);
    const [dynDepartments, setDynDepartments] = useState([]);
    const [errors, setErrors] = useState({});
    const fileInputPfp = useRef();
    const fileInputCv = useRef();
    const fileInputId = useRef();

    // ── Granular edit permissions ──
    const { hasPermission } = usePermissions();
    const { user } = useAuth();
    const isSelf = user?.employee_code === employeeCode;

    const isOrgAdmin = user?.role === 'org_admin' || (user?.roles || []).includes('org_admin');
    const isSuperAdmin = user?.role === 'super_admin' || (user?.roles || []).includes('super_admin');
    const isAdmin = isOrgAdmin || isSuperAdmin;

    const canEditBasic     = isAdmin || hasPermission(P.DEPLOY_EMP_EDIT_BASIC) || isSelf;
    const canEditJob       = isAdmin || hasPermission(P.DEPLOY_EMP_EDIT_JOB) || hasPermission(P.DEPLOY_EMP_APPROVE_BASIC);
    const canEditFinancial = isAdmin || hasPermission(P.DEPLOY_EMP_EDIT_FINANCIAL) || hasPermission(P.DEPLOY_EMP_APPROVE_FINANCIAL);
    const canManageDocs    = isAdmin || hasPermission(P.DEPLOY_EMP_MANAGE_DOCS) || isSelf;

    const canApproveBasic     = isAdmin || hasPermission(P.DEPLOY_EMP_APPROVE_BASIC);
    const canApproveSensitive = isAdmin || hasPermission(P.DEPLOY_EMP_APPROVE_SENSITIVE);
    const canApproveFinancial = isAdmin || hasPermission(P.DEPLOY_EMP_APPROVE_FINANCIAL);

    // Derived edit modes — only the relevant section becomes interactive
    const editBasic     = editMode && (canEditBasic || canApproveBasic);
    const editJob       = editMode && (canEditJob || canApproveBasic);
    const editFinancial = editMode && (canEditFinancial || canApproveFinancial);
    const editDocs      = editMode && (canManageDocs || canEditBasic || canApproveSensitive);

    // ── Check if status is editable ──
    const isStatusEditable = () => {
      const currentStatus = formData.employment_status || details?.employment_status || 'Active';
      return !EXITED_STATUSES.includes(currentStatus);
    };

    // Shapes a raw /api/employee record into the edit form's shape — used both
    // after a fetch and to revert formData back to last-saved state on Abort.
    const buildFormData = (data) => {
        // Legacy/seeded rows may only have the combined `name` column
        // populated, with first/middle/last never split out — fall back to
        // splitting `name` so the edit form isn't blank for those employees.
        const needsNameSplit = !(data.first_name && data.last_name);
        const nameParts = needsNameSplit ? splitFullName(data.name) : {};
        return {
            ...data,
            ...(needsNameSplit ? {
                first_name: data.first_name || nameParts.first_name,
                middle_name: data.middle_name || nameParts.middle_name,
                last_name: data.last_name || nameParts.last_name,
            } : {}),
            primary_skillset: data.skill_matrix?.primary_skillset || '',
            secondary_skillset: data.skill_matrix?.secondary_skillset || '',
            experience_years: data.skill_matrix?.experience_years || '0',
            doj: (data.doj || '').split('T')[0],
            dob: (data.dob || '').split('T')[0],
            pf_included: ['Yes', 'yes', 'true', '1', true].includes(data.pf_included),
            mediclaim_included: ['Yes', 'yes', 'true', '1', true].includes(data.mediclaim_included),
        };
    };

    const fetchDetails = async (code) => {
        try {
            setLoading(true);
            const res = await fetch(`/api/employee/${code}`, { credentials: 'include' });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setDetails(data);
            setFormData(buildFormData(data));
        } catch {
            toast.error('Failed to load employee profile');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (employeeCode) {
            fetchDetails(employeeCode);
            fetch(`/api/assets/${employeeCode}`, { credentials: 'include' })
                .then(r => r.json()).then(d => setAssets(d)).catch(() => {});
            
            fetch('/api/options', { credentials: 'include' })
                .then(r => r.json())
                .then(data => {
                    if(data.managers) setManagers(data.managers);
                    setDynDesignations(data.designations || []);
                    setDynDepartments(data.departments || []);
                }).catch(() => {});
        }
    }, [employeeCode]);

    // ── Validation Functions (ONLY ONCE) ──
    const validateForm = () => {
        const newErrors = {};

        // Email validation - only if filled
        if (formData.email_id && !isValidEmail(formData.email_id)) {
            newErrors.email_id = 'Please enter a valid email address';
        }

        // Phone validation - only if filled
        if (formData.contact_number && !isValidPhone(formData.contact_number)) {
            newErrors.contact_number = 'Please enter a valid phone number (10 digits)';
        }

        // Emergency contact validation - only if filled
        if (formData.emergency_contact && !isValidPhone(formData.emergency_contact)) {
            newErrors.emergency_contact = 'Please enter a valid emergency contact number (10 digits)';
        }

        // DOB validation - only if filled
        if (formData.dob && !isValidDate(formData.dob)) {
            newErrors.dob = 'Please enter a valid date of birth';
        }

        // DOJ validation - only if BOTH DOJ and DOB are filled
        if (formData.doj && formData.dob) {
            if (!isValidDate(formData.doj)) {
                newErrors.doj = 'Please enter a valid date of joining';
            } else if (!isDateAfter(formData.doj, formData.dob)) {
                newErrors.doj = 'Date of joining cannot be before date of birth';
            }
        } else if (formData.doj && !formData.dob) {
            // DOJ provided but DOB not - just validate DOJ format
            if (!isValidDate(formData.doj)) {
                newErrors.doj = 'Please enter a valid date of joining';
            }
        }

        // Experience validation - only if filled
        if (formData.experience_years && !isNonNegativeNumber(formData.experience_years)) {
            newErrors.experience_years = 'Experience years must be a positive number';
        }

        // Bank Account validation - only if filled
        if (formData.bank_account_no && !isValidBankAccount(formData.bank_account_no)) {
            newErrors.bank_account_no = 'Please enter a valid bank account number (digits only, 9-18 digits)';
        }

        // PAN validation - only if filled
        if (formData.pan_no && !isValidPAN(formData.pan_no)) {
            newErrors.pan_no = 'Please enter a valid PAN (e.g. ABCDE1234F)';
        }

        // URL validations - only if filled
        if (formData.linkedin_url && !isValidURL(formData.linkedin_url)) {
            newErrors.linkedin_url = 'Please enter a valid LinkedIn URL';
        }
        if (formData.portfolio_url && !isValidURL(formData.portfolio_url)) {
            newErrors.portfolio_url = 'Please enter a valid portfolio URL';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // The dropdown from /api/options only lists roles eligible to be picked as a
    // *new* manager. An employee's *current* manager may not have such a role
    // (e.g. was demoted, or never had one) — without this, the <select> can't
    // match formData.reporting_manager to any <option> and silently falls back
    // to the "Select Manager" placeholder even though a manager is assigned.
    const getManagerOptions = () => {
        const options = managers.map(m => ({ label: m.name, value: m.code }));
        const currentCode = formData.reporting_manager;
        if (currentCode && !options.some(o => o.value === currentCode)) {
            options.push({ label: currentCode, value: currentCode });
        }
        return options;
    };

    // ── Education list helpers (structured degree/university/year/percentage) ──
    const getEducationList = () => {
        try {
            const parsed = typeof formData.education_details === 'string'
                ? JSON.parse(formData.education_details)
                : formData.education_details;
            return Array.isArray(parsed) && parsed.length > 0 ? parsed : [{ ...EMPTY_EDUCATION_ENTRY }];
        } catch {
            return [{ ...EMPTY_EDUCATION_ENTRY }];
        }
    };

    const updateEducationEntry = (idx, field, value) => {
        const list = getEducationList().map((entry, i) => i === idx ? { ...entry, [field]: value } : entry);
        setFormData({ ...formData, education_details: list });
    };

    const addEducationEntry = () => {
        setFormData({ ...formData, education_details: [...getEducationList(), { ...EMPTY_EDUCATION_ENTRY }] });
    };

    const removeEducationEntry = (idx) => {
        const list = getEducationList();
        if (list.length > 1) {
            setFormData({ ...formData, education_details: list.filter((_, i) => i !== idx) });
        }
    };

    if (loading && !details) {
        return (
            <div className="flex flex-col items-center justify-center h-96">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest text-black/80">Loading employee profile...</p>
            </div>
        );
    }

    if (!details) return null;

    const handleSave = async () => {
    if (!validateForm()) {
        const firstError = Object.keys(errors)[0];
        if (firstError) {
            const el = document.getElementById(`field-${firstError}`);
            if (el) el.focus();
        }
        toast.error('Please fix the errors before saving');
        return;
    }

    setIsSaving(true);
    try {
        const payload = {
            // Basic fields — always included (user passed edit_basic to get here)
            first_name:       formData.first_name,
            middle_name:      formData.middle_name,
            last_name:        formData.last_name,
            email_id:         formData.email_id,
            contact_number:   formData.contact_number,
            emergency_contact: formData.emergency_contact,
            emergency_contact_first_name:  formData.emergency_contact_first_name,
            emergency_contact_middle_name: formData.emergency_contact_middle_name,
            emergency_contact_last_name:   formData.emergency_contact_last_name,
            current_address:  formData.current_address,
            permanent_address: formData.permanent_address,
            dob:              formData.dob,
            notes:            formData.notes,
            education_details: formData.education_details,
            primary_skillset:  formData.primary_skillset,
            secondary_skillset: formData.secondary_skillset,
            // Job fields — only included when user has edit_job or approve_basic
            ...((canEditJob || canApproveBasic) && {
                designation:       formData.designation,
                team:              formData.team,
                employment_type:   formData.employment_type,
                reporting_manager: formData.reporting_manager,
                location:          formData.location,
                doj:               formData.doj,
                employment_status: formData.employment_status,
                experience_years:  formData.experience_years,
            }),
            // Financial fields — only included when user has edit_financial
            ...(canEditFinancial && {
                bank_name:        formData.bank_name,
                bank_account_no:  formData.bank_account_no,
                pan_no:           formData.pan_no,
                pf_included:      formData.pf_included,
                mediclaim_included: formData.mediclaim_included,
            }),
        };

        const res = await fetch(`/api/employee/${details.employee_code}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.detail || 'Update failed');
        
        toast.success('Profile updated successfully');
        setEditMode(false);
        setErrors({});
        fetchDetails(details.employee_code);
    } catch (e) {
        toast.error(e.message);
    } finally {
        setIsSaving(false);
    }
};

    const handleFileUpload = async (type, file) => {
        if (!file) return;
        
        // ── File Validation with correct specs ──
        const fileRules = {
            pfp: {
                types: ['image/jpeg', 'image/png'],
                maxSize: 2 * 1024 * 1024, // 2MB
                label: 'Profile Photo',
                formats: 'JPG, JPEG, PNG (max 2MB)'
            },
            cv: {
                types: ['application/pdf'],
                maxSize: 5 * 1024 * 1024, // 5MB
                label: 'Resume/CV',
                formats: 'PDF only (max 5MB)'
            },
            id: {
                types: ['image/jpeg', 'image/png', 'application/pdf'],
                maxSize: 5 * 1024 * 1024, // 5MB
                label: 'Government ID Proof',
                formats: 'PDF, JPG, JPEG, PNG (max 5MB)'
            }
        };
        
        const rule = fileRules[type];
        
        if (!rule.types.includes(file.type)) {
            toast.error(`Please upload a valid ${rule.label} file: ${rule.formats}`);
            return;
        }
        
        if (file.size > rule.maxSize) {
            const maxMB = rule.maxSize / (1024 * 1024);
            toast.error(`${rule.label} size must be less than ${maxMB}MB`);
            return;
        }

        const fd = new FormData();
        if (type === 'pfp') fd.append('photo_file', file);
        if (type === 'cv') fd.append('cv_file', file);
        if (type === 'id') fd.append('id_proof_file', file);

        try {
            toast.loading('Uploading file...', { id: 'upload' });
            const res = await fetch(`/api/employee/${details.employee_code}/documents`, {
                method: 'POST',
                credentials: 'include',
                body: fd
            });
            if (!res.ok) throw new Error('Upload failed');
            toast.success('Document uploaded successfully', { id: 'upload' });
            fetchDetails(details.employee_code);
        } catch {
            toast.error('Upload failed', { id: 'upload' });
        }
    };

    const handleRemovePfp = async () => {
        if (!window.confirm('Remove this profile photo?')) return;
        try {
            toast.loading('Removing photo...', { id: 'remove-pfp' });
            const res = await fetch(`/api/employee/${details.employee_code}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photo_path: '' })
            });
            if (!res.ok) throw new Error('Failed to remove photo');
            toast.success('Profile photo removed', { id: 'remove-pfp' });
            fetchDetails(details.employee_code);
        } catch {
            toast.error('Failed to remove photo', { id: 'remove-pfp' });
        }
    };

    const handleOffboard = async () => {
        if (!window.confirm('Are you sure you want to initiate offboarding? This action is irreversible.')) return;
        const exitDate = new Date().toISOString().split('T')[0];
        try {
            const res = await fetch(`/api/employee/${details.employee_code}/offboard`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ exit_date: exitDate, exit_reason: 'Administrative Exit', exit_type: 'Immediate' })
            });
            if (res.ok) {
                toast.success("Employee offboarded successfully");
                window.location.reload();
            }
        } catch {
            toast.error("Decoupling failed");
        }
    };

    const handleAdminReset = async (type) => {
        try {
            const res = await fetch(`/api/auth/admin-reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    employee_code: details.employee_code,
                    reset_type: type
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || data.message || 'Action failed');
            
            if (type === 'temp_password') {
                const tempPass = data.temporary_password || data.temp_password;
                if (data.email_sent === false) {
                    toast.error(`Temporary Password: ${tempPass} (Email delivery failed: check SMTP configuration)`, { duration: 15000 });
                } else {
                    toast.success(`Temporary Password: ${tempPass} (Emailed to employee)`, { duration: 10000 });
                }
            } else {
                if (data.email_sent === false) {
                    toast.error(data.message || 'Failed to send reset link email');
                } else {
                    toast.success('Reset link sent to employee email');
                }
            }
        } catch (e) {
            toast.error(e.message);
        }
    };

    // Helper to render error message
    const renderError = (field) => {
        if (errors[field]) {
            return <p className="text-red-500 text-[9px] font-bold mt-1">{errors[field]}</p>;
        }
        return null;
    };

    const currentStatus = formData.employment_status || details?.employment_status || 'Active';
    const statusColor = STATUS_COLORS[currentStatus] || '#8B5CF6';
    const isExited = EXITED_STATUSES.includes(currentStatus);

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Action Bar */}
            <div className="flex justify-between items-center bg-gradient-to-r from-[#f7f3ff] to-[#faf7ff] p-4 rounded-2xl border border-[#e9ddff] shadow-lg shadow-primary/5">
                <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black/90 hover:text-black transition-all">
                    <ArrowLeft size={14} /> Back 
                </button>
                <div className="flex gap-3">
                    {editMode ? (
                        <>
                            <button
                                onClick={() => {
                                    setFormData(buildFormData(details));
                                    setErrors({});
                                    setEditMode(false);
                                }}
                                className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-black/90 hover:bg-[#faf7ff] transition-all"
                            >
                                Abort
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-8 py-2 bg-primary text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white transition-all shadow-lg shadow-primary/20"
                            >
                                {isSaving ? 'Saving...' : <><Save size={14} /> Save Profile</>}
                            </button>
                        </>
                    ) : (
                        <HasPermission permission={['deploy.employees.edit_basic', 'deploy.employees.edit_job', 'deploy.employees.edit_financial']}>
                            <button 
                                onClick={() => setEditMode(true)}
                                className="flex items-center gap-2 px-8 py-2 bg-white border border-[#ece4ff] shadow-sm border-[#e9defd] text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[#7c3aed] hover:text-white transition-all"
                            >
                                <Edit3 size={14} /> Edit Profile
                            </button>
                        </HasPermission>
                    )}
                </div>
            </div>

            {/* Header / Hero Section */}
            <div className="bg-gradient-to-br from-white via-[#faf7ff] to-[#f7f3ff] border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-primary/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
                
                <div className="flex flex-col md:flex-row gap-8 items-start md:items-center relative z-10">
                    {/* Profile Photo */}
                    <div className="relative group">
                        <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 border-2 border-primary/30 flex items-center justify-center text-primary font-display font-black text-5xl shrink-0 shadow-2xl shadow-primary/20 overflow-hidden">
                            {details.photo_path ? (
                                <img src={`/api/employee/${details.employee_code}/document/pfp`} className="w-full h-full object-cover" alt="" />
                            ) : (
                                details.name?.[0]
                            )}
                        </div>
                        {editDocs && (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 rounded-3xl text-white text-[9px] font-black uppercase tracking-widest">
                                <button
                                    onClick={() => fileInputPfp.current.click()}
                                    className="flex items-center gap-1 hover:text-primary transition-colors"
                                >
                                    <Image size={16} /> Upload PFP
                                </button>
                                {details.photo_path && (canEditBasic || isSelf) && (
                                    <button
                                        onClick={handleRemovePfp}
                                        className="flex items-center gap-1 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 size={16} /> Remove PFP
                                    </button>
                                )}
                            </div>
                        )}
                        <input type="file" ref={fileInputPfp} hidden accept="image/jpeg,image/png" onChange={e => handleFileUpload('pfp', e.target.files[0])} />
                    </div>
                    
                    <div className="flex-1 space-y-4">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-4 flex-wrap">
                                {editBasic ? (
                                    <div className="grid grid-cols-3 gap-2 w-full max-w-md">
                                        <input
                                            type="text"
                                            value={formData.first_name || ''}
                                            onChange={e => setFormData({...formData, first_name: e.target.value})}
                                            className="text-xs font-bold text-black uppercase tracking-tight bg-[#faf7ff] border border-[#e9defd] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary w-full"
                                            placeholder="First Name"
                                        />
                                        <input
                                            type="text"
                                            value={formData.middle_name || ''}
                                            onChange={e => setFormData({...formData, middle_name: e.target.value})}
                                            className="text-xs font-bold text-black uppercase tracking-tight bg-[#faf7ff] border border-[#e9defd] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary w-full"
                                            placeholder="Middle Name"
                                        />
                                        <input
                                            type="text"
                                            value={formData.last_name || ''}
                                            onChange={e => setFormData({...formData, last_name: e.target.value})}
                                            className="text-xs font-bold text-black uppercase tracking-tight bg-[#faf7ff] border border-[#e9defd] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary w-full"
                                            placeholder="Last Name"
                                        />
                                        {renderError('name')}
                                    </div>
                                ) : (
                                    <h2 className="text-4xl font-display font-black text-black uppercase tracking-tighter italic">{details.name}</h2>
                                )}
                                
                                {/* ── EDITABLE STATUS TAG ── */}
                                {editJob && isStatusEditable() ? (
                                    <select
                                        value={currentStatus}
                                        onChange={e => setFormData({...formData, employment_status: e.target.value})}
                                        className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-2 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                                        style={{
                                            background: `${statusColor}15`,
                                            color: statusColor,
                                            borderColor: `${statusColor}40`
                                        }}
                                    >
                                        {STATUS_OPTIONS.map(status => (
                                            <option key={status} value={status}>{status}</option>
                                        ))}
                                    </select>
                                ) : editMode && !isStatusEditable() ? (
                                    <span
                                        className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest opacity-50 cursor-not-allowed"
                                        style={{
                                            background: `${statusColor}10`,
                                            color: statusColor,
                                            border: `1px solid ${statusColor}20`
                                        }}
                                    >
                                        {currentStatus} (🔒 Locked)
                                    </span>
                                ) : (
                                    <span
                                        className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest"
                                        style={{
                                            background: `${statusColor}15`,
                                            color: statusColor,
                                            border: `1px solid ${statusColor}30`
                                        }}
                                    >
                                        {currentStatus}
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3">
                            {editJob ? (
                                <>
                                    <div className="flex items-center gap-1.5">
                                        <ComboBox
                                            className="w-56"
                                            options={dynDesignations.length > 0 ? dynDesignations : DESIGNATIONS}
                                            value={formData.designation}
                                            onChange={val => setFormData({...formData, designation: val})}
                                            placeholder="Select Designation..."
                                        />
                                        {!details.designation && <MissingMark />}
                                    </div>
                                    <span className="text-black/90">//</span>
                                    <div className="flex items-center gap-1.5">
                                        <ComboBox
                                            className="w-56"
                                            options={dynDepartments.length > 0 ? dynDepartments : DEPARTMENTS}
                                            value={formData.team}
                                            onChange={val => setFormData({...formData, team: val})}
                                            placeholder="Select Department..."
                                        />
                                        {!details.team && <MissingMark />}
                                    </div>
                                </>
                            ) : (
                                <p className="text-gray-700 font-black text-sm uppercase tracking-[0.3em] flex items-center gap-2">
                                    {details.designation} {!details.designation && <MissingMark />} <span className="text-black/90">//</span> {details.team} {!details.team && <MissingMark />}
                                </p>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">

<div className="bg-[#f4ecff] border border-[#ddd6fe] rounded-2xl px-4 py-3 hover:border-[#7c3aed] hover:shadow-md hover:shadow-[#7c3aed]/10 transition-all">
    <div className="flex items-center gap-2 mb-2">
        <Mail size={12} className="text-[#7c3aed]" />
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#7B1FFF] flex items-center gap-1.5">Email {!details.email_id && <MissingMark />}</p>
    </div>
    {editBasic ? (
        <div>
            <input
                type="email"
                value={formData.email_id || ''}
                onChange={e => setFormData({...formData, email_id: e.target.value})}
                className="w-full bg-white border border-[#ddd6fe] rounded-xl px-3 py-2 text-xs text-black font-semibold focus:outline-none focus:border-[#7c3aed]"
                placeholder="employee@company.com"
                id="field-email_id"
            />
            {renderError('email_id')}
        </div>
    ) : (
        <p className="text-xs font-normal text-black truncate">{formData.email_id || '—'}</p>
    )}
</div>

{details?._meta?.can_view_sensitive !== false && (
<div className="bg-[#f4ecff] border border-[#ddd6fe] rounded-2xl px-4 py-3 hover:border-[#7c3aed] hover:shadow-md hover:shadow-[#7c3aed]/10 transition-all">
    <div className="flex items-center gap-2 mb-2">
        <Phone size={12} className="text-[#7c3aed]" />
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#7B1FFF] flex items-center gap-1.5">Contact {!details.contact_number && <MissingMark />}</p>
    </div>
    {editBasic ? (
        <div>
            <input
                type="tel"
                value={formData.contact_number || ''}
                onChange={e => setFormData({...formData, contact_number: e.target.value})}
                className="w-full bg-white border border-[#ddd6fe] rounded-xl px-3 py-2 text-xs text-black font-semibold focus:outline-none focus:border-[#7c3aed]"
                placeholder="9876543210"
                id="field-contact_number"
            />
            {renderError('contact_number')}
        </div>
    ) : (
        <p className="text-xs font-normal text-black truncate">{formData.contact_number || '—'}</p>
    )}
</div>
)}

<div className="bg-[#f4ecff] border border-[#ddd6fe] rounded-2xl px-4 py-3 hover:border-[#7c3aed] hover:shadow-md hover:shadow-[#7c3aed]/10 transition-all">
    <div className="flex items-center gap-2 mb-2">
        <MapPin size={12} className="text-[#7c3aed]" />
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#7B1FFF] flex items-center gap-1.5">Work Location {!details.location && <MissingMark />}</p>
    </div>
    {editJob ? (
        <input
            type="text"
            value={formData.location || ''}
            onChange={e => setFormData({...formData, location: e.target.value})}
            className="w-full bg-white border border-[#ddd6fe] rounded-xl px-3 py-2 text-xs text-black font-semibold focus:outline-none focus:border-[#7c3aed]"
            placeholder="City, Country"
        />
    ) : (
        <p className="text-xs font-normal text-black truncate">{formData.location || '—'}</p>
    )}
</div>

<div className="bg-[#f4ecff] border border-[#ddd6fe] rounded-2xl px-4 py-3 hover:border-[#7c3aed] hover:shadow-md hover:shadow-[#7c3aed]/10 transition-all">
    <div className="flex items-center gap-2 mb-2">
        <Briefcase size={12} className="text-[#7c3aed]" />
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#7B1FFF]">Employee ID</p>
    </div>
    <p className="text-xs font-normal text-black truncate">{formData.employee_code || '—'}</p>
</div>

</div>
                    </div>
                </div>
            </div>

            {/* Main Grid: Left (2/3) + Right (1/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* ── LEFT COLUMN ── */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Employee Statistics */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <EditStatCard label="Date of Joining (DOJ)" value={formData.doj} sub="Joined Date" type="date" editMode={editJob} onChange={v => setFormData({...formData, doj: v})} error={errors.doj} missing={!details.doj} />
                        <EditStatCard label="Engagement Mode" sentenceCase value={formData.employment_type} sub="" editMode={editJob} onChange={v => setFormData({...formData, employment_type: v})} missing={!details.employment_type} />
                        <EditStatCard label="Experience" value={formData.experience_years} sub="Years" type="number" editMode={editJob} onChange={v => setFormData({...formData, experience_years: v})} error={errors.experience_years} missing={!details.skill_matrix?.experience_years} />
                        <EditStatCard label="Manager" value={formData.reporting_manager} sub="Reporting Manager" editMode={editJob} type="select" options={getManagerOptions()} onChange={v => setFormData({...formData, reporting_manager: v})} displayValue={managers.find(m => m.code === formData.reporting_manager)?.name || formData.reporting_manager} missing={!details.reporting_manager} />
                    </div>

                    {/* Skill Synergy */}
                    <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl">
                        <SectionHeader icon={TrendingUp} title="Skills & Expertise" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#7B1FFF] mb-4 italic flex items-center gap-1.5">
                                    Primary SKILL {!details.skill_matrix?.primary_skillset && <MissingMark />}
                                </p>
                                {editBasic ? (
                                    <textarea 
                                        value={formData.primary_skillset}
                                        onChange={e => setFormData({...formData, primary_skillset: e.target.value})}
                                        className="w-full bg-gradient-to-br from-[#f7f3ff] to-[#faf7ff] border border-[#e9ddff] rounded-xl p-4 text-xs text-black focus:outline-none focus:border-primary"
                                        rows={3}
                                        placeholder="Comma separated skills..."
                                    />
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {(details.skill_matrix?.primary_skillset || '').split(',').map((s, i) => (
                                            <span key={i} className="px-3 py-1.5 bg-gradient-to-r from-[#f7f3ff] to-[#faf7ff] text-black/75 text-[10px] font-bold uppercase rounded-lg border border-[#e9ddff] shadow-sm">
                                                {s.trim()}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#7B1FFF] mb-4 italic flex items-center gap-1.5">
                                    secondary SKILL {!details.skill_matrix?.secondary_skillset && <MissingMark />}
                                </p>
                                {editBasic ? (
                                    <textarea 
                                        value={formData.secondary_skillset}
                                        onChange={e => setFormData({...formData, secondary_skillset: e.target.value})}
                                        className="w-full bg-gradient-to-br from-[#f7f3ff] to-[#faf7ff] border border-[#e9ddff] rounded-xl p-4 text-xs text-black focus:outline-none focus:border-primary/20"
                                        rows={3}
                                        placeholder="Comma separated skills..."
                                    />
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {(details.skill_matrix?.secondary_skillset || '').split(',').map((s, i) => (
                                            <span key={i} className="px-3 py-1.5 bg-gradient-to-r from-[#f7f3ff] to-[#faf7ff] text-black/75 text-[10px] font-bold uppercase rounded-lg border border-[#e9ddff] shadow-sm">
                                                {s.trim()}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Education Logs */}
                    <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl">
                        <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5">
                                <SectionHeader icon={GraduationCap} title="Academic Foundation Blocks" />
                                {!hasEducationDetails(details.education_details) && <MissingMark />}
                            </div>
                            {editBasic && (
                                <button
                                    type="button"
                                    onClick={addEducationEntry}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#f4ecff] hover:bg-[#ece2ff] text-[#7c3aed] rounded-xl transition-all border border-[#ddd6fe] shrink-0"
                                >
                                    <Plus size={14} /> <span className="text-[10px] font-black uppercase tracking-widest">Add education</span>
                                </button>
                            )}
                        </div>
                        <div className="mt-6 space-y-4">
                            {editBasic ? (
                                <div className="space-y-4">
                                    {getEducationList().map((edu, idx) => (
                                        <div key={idx} className="relative p-6 bg-gradient-to-r from-[#f7f3ff] to-[#faf7ff] rounded-2xl border border-[#e9ddff] space-y-4 group">
                                            {getEducationList().length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeEducationEntry(idx)}
                                                    className="absolute top-4 right-4 p-2 text-black/20 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <ComboBox
                                                    options={DEGREE_OPTIONS}
                                                    value={edu.degree}
                                                    onChange={val => updateEducationEntry(idx, 'degree', val)}
                                                    placeholder="Select or type degree..."
                                                />
                                                <input
                                                    value={edu.university || ''}
                                                    onChange={e => updateEducationEntry(idx, 'university', e.target.value)}
                                                    placeholder="Institution / University"
                                                    className="w-full bg-white border border-[#e9ddff] rounded-xl px-4 py-3 text-xs text-black focus:outline-none focus:border-primary/30"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <input
                                                    value={edu.year || ''}
                                                    onChange={e => updateEducationEntry(idx, 'year', e.target.value)}
                                                    placeholder="Passout Year"
                                                    className="w-full bg-white border border-[#e9ddff] rounded-xl px-4 py-3 text-xs text-black focus:outline-none focus:border-primary/30"
                                                />
                                                <input
                                                    value={edu.percentage || ''}
                                                    onChange={e => updateEducationEntry(idx, 'percentage', e.target.value)}
                                                    placeholder="CGPA / %"
                                                    className="w-full bg-white border border-[#e9ddff] rounded-xl px-4 py-3 text-xs text-black focus:outline-none focus:border-primary/30"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                (() => {
                                    let edu = details.education_details;
                                    try { if (typeof edu === 'string') edu = JSON.parse(edu); } catch { return null; }
                                    if (Array.isArray(edu)) {
                                        edu = edu.filter(e => e && (e.degree || e.university || e.year || e.percentage));
                                    }

                                    if (Array.isArray(edu) && edu.length > 0) {
                                        return edu.map((e, i) => (
                                            <div key={i} className="flex gap-6 items-start p-6 bg-gradient-to-r from-[#f7f3ff] to-[#faf7ff] rounded-2xl border border-[#e9ddff] hover:border-primary/30 hover:bg-primary/5 transition-all group shadow-sm hover:shadow-md hover:shadow-primary/10">
                                                <div className="w-12 h-12 rounded-xl bg-[#faf7ff] flex items-center justify-center text-black/90 shrink-0 group-hover:text-primary transition-colors">
                                                    <Landmark size={20} />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="text-black font-bold text-sm uppercase">{e.degree}</h4>
                                                        <span className="text-xs font-black text-primary font-mono">{e.year}</span>
                                                    </div>
                                                    <p className="text-xs text-black/90 mt-1 uppercase tracking-widest">{e.university}</p>
                                                </div>
                                            </div>
                                        ));
                                    }
                                    return <p className="text-xs text-black/80 italic text-center py-4">No academic history detected.</p>;
                                })()
                            )}
                        </div>
                    </div>

                    {/* Compliance Toggles */}
                    {details?._meta?.can_view_financial !== false && (
                    <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl">
                        <SectionHeader icon={ShieldCheck} title="Compliance Checklist" />
                        <div className="mt-6 space-y-4">
                            <ComplianceRow
                                label="PF Included"
                                active={formData.pf_included}
                                editMode={editFinancial}
                                onToggle={() => setFormData({...formData, pf_included: !formData.pf_included})}
                                missing={!details.pf_included}
                            />
                            <ComplianceRow
                                label="Mediclaim Included"
                                active={formData.mediclaim_included}
                                editMode={editFinancial}
                                onToggle={() => setFormData({...formData, mediclaim_included: !formData.mediclaim_included})}
                                missing={!details.mediclaim_included}
                            />
                        </div>
                    </div>
                    )}

                    {/* Documents */}
                    {details?._meta?.can_view_sensitive !== false && (
                    <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl">
                        <SectionHeader icon={FileText} title="Document Artifacts" />
                        <div className="mt-6 space-y-3">
                            <FileCard
                                label="Curriculum Vitae"
                                path={details.cv_path}
                                employeeCode={details.employee_code}
                                docType="cv"
                                editMode={editDocs}
                                onUpload={() => fileInputCv.current.click()}
                                missing={!details.cv_path}
                            />
                            <FileCard
                                label="Identity Proof"
                                path={details.id_proofs}
                                employeeCode={details.employee_code}
                                docType="id_proof"
                                editMode={editDocs}
                                onUpload={() => fileInputId.current.click()}
                                missing={!details.id_proofs}
                            />
                        </div>
                        <input type="file" ref={fileInputCv} hidden accept=".pdf" onChange={e => handleFileUpload('cv', e.target.files[0])} />
                        <input type="file" ref={fileInputId} hidden accept=".pdf,image/jpeg,image/png" onChange={e => handleFileUpload('id', e.target.files[0])} />
                    </div>
                    )}

                    {/* Allocated Assets */}
                    {details?._meta?.can_view_sensitive !== false && (
                    <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/10 overflow-hidden rounded-2xl">
                        <div className="p-6 border-b border-[#ece4ff] bg-[#f4ecff] flex items-center justify-between">
                            <SectionHeader icon={Package} title="Allocated Assets" />
                        </div>

                        <div className="p-2 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#ece4ff]">
                            {/* Onboarding Section */}
                            <div className="space-y-1 md:pr-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                <div className="px-4 py-2 bg-[#f4ecff] rounded-lg mb-2 border border-[#e9ddff]">
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#7c3aed] italic">
                                        I. Onboarding Checklist
                                    </p>
                                </div>
                                {[
                                    { key: 'ob_laptop', label: 'Laptop Unit' },
                                    { key: 'ob_laptop_bag', label: 'Laptop Bag' },
                                    { key: 'ob_headphones', label: 'Headphones' },
                                    { key: 'ob_mouse', label: 'External Mouse' },
                                    { key: 'ob_id_card', label: 'Identity Card' },
                                    { key: 'ob_email_access', label: 'Email Access' },
                                    { key: 'ob_groups', label: 'Group Access' },
                                    { key: 'ob_mediclaim', label: 'Mediclaim' },
                                    { key: 'ob_pf', label: 'Provident Fund' }
                                ].map(a => (
                                    <div key={a.key} className="flex items-center justify-between p-3 px-6 hover:bg-[#f4ecff] transition-all border-b border-[#ece4ff] last:border-0 group">
                                        <span className="text-[10px] font-medium uppercase tracking-widest text-black group-hover:text-[#6d28d9] transition-colors">
                                            {a.label}
                                        </span>
                                        {assets?.[a.key] ? (
                                            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[8px] font-black uppercase border border-emerald-200 shadow-sm">
                                                <CheckCircle size={8} /> Allocated
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 bg-black/5 text-black rounded-full text-[8px] font-black uppercase border border-black/5">
                                                Not Allocated
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Clearance Section */}
                            <div className="space-y-1 pt-4 md:pt-0 md:pl-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                <div className="px-4 py-2 bg-[#f4ecff] rounded-lg mb-2 border border-[#e9ddff]">
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#7c3aed] italic">
                                        II. Access Permissions
                                    </p>
                                </div>
                                {[
                                    { key: 'cl_laptop', label: 'Laptop Returned' },
                                    { key: 'cl_laptop_bag', label: 'Bag Returned' },
                                    { key: 'cl_headphones', label: 'Headphones Returned' },
                                    { key: 'cl_mouse', label: 'Mouse Returned' },
                                    { key: 'cl_extra_hardware', label: 'Extra Hardware Returned' },
                                    { key: 'cl_client_assets', label: 'Client Assets Verified' },
                                    { key: 'cl_id_card', label: 'ID Surrendered' },
                                    { key: 'cl_email_access', label: 'Email Disabled' },
                                    { key: 'cl_groups', label: 'Access Purged' },
                                    { key: 'cl_relieving_letter', label: 'Relieving Letter' }
                                ].map(a => (
                                    <div key={a.key} className="flex items-center justify-between p-3 px-6 hover:bg-[#f4ecff] transition-all border-b border-[#ece4ff] last:border-0 group">
                                        <span className="text-[10px] font-medium uppercase tracking-widest text-black group-hover:text-[#7c3aed] transition-colors">
                                            {a.label}
                                        </span>
                                        {assets?.[a.key] ? (
                                            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[8px] font-black uppercase border border-emerald-200 shadow-sm">
                                                <CheckCircle size={8} /> Resolved
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 bg-black/5 text-black rounded-full text-[8px] font-black uppercase border border-black/5">
                                                Pending Verification
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Manage Employee Assets Button */}
                        <div className="p-4 bg-[#faf7ff] border-t border-[#ece4ff]">
                            <button
                                onClick={() => window.location.href = `/deploy?tab=assets&code=${details.employee_code}`}
                                className="w-full py-3 px-4 rounded-xl border border-[#d8c7ff] bg-white text-[#6d28d9] text-[9px] font-black uppercase tracking-[0.2em] hover:bg-[#7c3aed] hover:text-white hover:scale-[1.02] hover:shadow-lg hover:shadow-[#7c3aed]/20 transition-all"
                            >
                                Manage Employee Assets
                            </button>
                        </div>
                    </div>
                    )}

                </div>
                {/* ── END LEFT COLUMN ── */}

                {/* ── RIGHT COLUMN ── */}
                <div className="space-y-8">

                    {/* Geographic Anchors */}
                    {details?._meta?.can_view_sensitive !== false && (
                    <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl">
                        <SectionHeader icon={Home} title="Location details" />
                        <div className="mt-6 space-y-6">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-[#7B1FFF] mb-2 flex items-center gap-1.5">
                                    Current Address {!details.current_address && <MissingMark />}
                                </p>
                                {editBasic ? (
                                    <div>
                                        <textarea
                                            value={formData.current_address}
                                            onChange={e => setFormData({...formData, current_address: e.target.value})}
                                            className="w-full bg-[#f4ecff] border border-[#ddd6fe] rounded-xl p-4 text-xs text-black focus:outline-none focus:border-[#7c3aed]"
                                            rows={2}
                                        />
                                        {renderError('current_address')}
                                    </div>
                                ) : (
                                    <p className="text-xs text-black leading-relaxed bg-[#f4ecff] p-4 rounded-xl border border-[#e9ddff] shadow-sm">
                                        {details.current_address || 'Unregistered'}
                                    </p>
                                )}
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-[#7B1FFF] mb-2 flex items-center gap-1.5">
                                    Permanent Address {!details.permanent_address && <MissingMark />}
                                </p>
                                {editBasic ? (
                                    <div>
                                        <textarea
                                            value={formData.permanent_address}
                                            onChange={e => setFormData({...formData, permanent_address: e.target.value})}
                                            className="w-full bg-[#f4ecff] border border-[#ddd6fe] rounded-xl p-4 text-xs text-black focus:outline-none focus:border-[#7c3aed]"
                                            rows={2}
                                        />
                                        {renderError('permanent_address')}
                                    </div>
                                ) : (
                                    <p className="text-xs text-black leading-relaxed bg-[#f4ecff] p-4 rounded-xl border border-[#e9ddff] shadow-sm">
                                        {details.permanent_address || 'Matches Primary'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Financial Details */}
                    {details?._meta?.can_view_financial !== false && (
                    <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl">
                        <SectionHeader icon={Landmark} title="Financial Info" />
                        <div className="mt-6 space-y-6">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-[#7B1FFF] mb-2 flex items-center gap-1.5">
                                    Bank Name {!details.bank_name && <MissingMark />}
                                </p>
                                {editFinancial ? (
                                    <input
                                        type="text"
                                        value={formData.bank_name || ''}
                                        onChange={e => setFormData({...formData, bank_name: e.target.value})}
                                        className="w-full bg-[#f4ecff] border border-[#ddd6fe] rounded-xl px-4 py-3 text-xs text-black focus:outline-none focus:border-[#7c3aed]"
                                        placeholder="e.g. HDFC Bank"
                                    />
                                ) : (
                                    <p className="text-xs text-black font-normal bg-[#f4ecff] p-4 rounded-xl border border-[#e9ddff]">
                                        {details.bank_name || 'Not recorded'}
                                    </p>
                                )}
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-[#7B1FFF] mb-2 flex items-center gap-1.5">
                                    Bank Account No. {!details.bank_account_no && <MissingMark />}
                                </p>
                                {editFinancial ? (
                                    <div>
                                        <input
                                            type="text"
                                            value={formData.bank_account_no || ''}
                                            onChange={e => setFormData({...formData, bank_account_no: e.target.value})}
                                            className="w-full bg-[#f4ecff] border border-[#ddd6fe] rounded-xl px-4 py-3 text-xs text-black focus:outline-none focus:border-[#7c3aed]"
                                            placeholder="Enter 9-18 digit account number"
                                            id="field-bank_account_no"
                                        />
                                        {renderError('bank_account_no')}
                                    </div>
                                ) : (
                                    <p className="text-xs text-black font-normal bg-[#f4ecff] p-4 rounded-xl border border-[#e9ddff]">
                                        {details.bank_account_no || 'Not recorded'}
                                    </p>
                                )}
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-[#7B1FFF] mb-2 flex items-center gap-1.5">
                                    PAN No. {!details.pan_no && <MissingMark />}
                                </p>
                                {editFinancial ? (
                                    <div>
                                        <input
                                            type="text"
                                            value={formData.pan_no || ''}
                                            onChange={e => setFormData({...formData, pan_no: e.target.value})}
                                            className="w-full bg-[#f4ecff] border border-[#ddd6fe] rounded-xl px-4 py-3 text-xs text-black focus:outline-none focus:border-[#7c3aed] uppercase"
                                            placeholder="ABCDE1234F"
                                            id="field-pan_no"
                                        />
                                        {renderError('pan_no')}
                                    </div>
                                ) : (
                                    <p className="text-xs text-black font-normal bg-[#f4ecff] p-4 rounded-xl border border-[#e9ddff] uppercase">
                                        {details.pan_no || 'Not recorded'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Emergency Contact */}
                    {details?._meta?.can_view_sensitive !== false && (
                    <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl">
                        <SectionHeader icon={Phone} title="Emergency Contact" />
                        <div className="mt-6 space-y-5">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-black/50 mb-2 flex items-center gap-1.5">
                                    Contact Name {!(details.emergency_contact_first_name || details.emergency_contact_last_name) && <MissingMark />}
                                </p>
                                {editBasic ? (
                                    <div className="grid grid-cols-3 gap-2">
                                        <input
                                            type="text"
                                            value={formData.emergency_contact_first_name || ''}
                                            onChange={e => setFormData({...formData, emergency_contact_first_name: e.target.value})}
                                            className="w-full bg-[#f4ecff] border border-[#ddd6fe] rounded-xl px-4 py-3 text-xs text-black focus:outline-none focus:border-[#7c3aed]"
                                            placeholder="First Name"
                                            id="field-emergency_contact_first_name"
                                        />
                                        <input
                                            type="text"
                                            value={formData.emergency_contact_middle_name || ''}
                                            onChange={e => setFormData({...formData, emergency_contact_middle_name: e.target.value})}
                                            className="w-full bg-[#f4ecff] border border-[#ddd6fe] rounded-xl px-4 py-3 text-xs text-black focus:outline-none focus:border-[#7c3aed]"
                                            placeholder="Middle Name"
                                            id="field-emergency_contact_middle_name"
                                        />
                                        <input
                                            type="text"
                                            value={formData.emergency_contact_last_name || ''}
                                            onChange={e => setFormData({...formData, emergency_contact_last_name: e.target.value})}
                                            className="w-full bg-[#f4ecff] border border-[#ddd6fe] rounded-xl px-4 py-3 text-xs text-black focus:outline-none focus:border-[#7c3aed]"
                                            placeholder="Last Name"
                                            id="field-emergency_contact_last_name"
                                        />
                                    </div>
                                ) : (
                                    <p className="text-xs text-black font-normal bg-[#f4ecff] p-4 rounded-xl border border-[#e9ddff]">
                                        {[details.emergency_contact_first_name, details.emergency_contact_middle_name, details.emergency_contact_last_name]
                                            .filter(Boolean).join(' ') || 'Not registered'}
                                    </p>
                                )}
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-black/50 mb-2 flex items-center gap-1.5">
                                    Contact Number {!details.emergency_contact && <MissingMark />}
                                </p>
                                {editBasic ? (
                                    <div>
                                        <input
                                            type="tel"
                                            value={formData.emergency_contact || ''}
                                            onChange={e => setFormData({...formData, emergency_contact: e.target.value})}
                                            className="w-full bg-[#f4ecff] border border-[#ddd6fe] rounded-xl px-4 py-3 text-xs text-black focus:outline-none focus:border-[#7c3aed]"
                                            placeholder="Enter 10-digit emergency contact number"
                                            id="field-emergency_contact"
                                        />
                                        {renderError('emergency_contact')}
                                    </div>
                                ) : (
                                    <p className="text-xs text-black font-normal bg-[#f4ecff] p-4 rounded-xl border border-[#e9ddff]">
                                        {details.emergency_contact || 'Not registered'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Date of Birth */}
                    {details?._meta?.can_view_sensitive !== false && (
                    <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl">
                        <div className="flex items-center gap-1.5">
                            <SectionHeader icon={Calendar} title="DOB" />
                            {!details.dob && <MissingMark />}
                        </div>
                        <div className="mt-6">
                            {editBasic ? (
                                <div>
                                    <input
                                        type="date"
                                        value={formData.dob || ''}
                                        onChange={e => setFormData({...formData, dob: e.target.value})}
                                        className="w-full bg-[#f4ecff] border border-[#ddd6fe] rounded-xl px-4 py-3 text-xs text-black focus:outline-none focus:border-[#7c3aed]"
                                        id="field-dob"
                                    />
                                    {renderError('dob')}
                                </div>
                            ) : (
                                <p className="text-xs text-black font-normal bg-[#f4ecff] p-4 rounded-xl border border-[#e9ddff]">
                                    {details.dob ? details.dob.split('T')[0] : 'Not recorded'}
                                </p>
                            )}
                        </div>
                    </div>
                    )}

                    {/* Security & Access */}
                    {!isExited && (
                        <HasPermission permission={['deploy.employees.edit_basic', 'admin.users.manage']}>
                            <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl">
                                <SectionHeader icon={Key} title="Security & Access" />
                                <div className="mt-6 space-y-3">
                                    <p className="text-[10px] text-black/70 uppercase tracking-widest mb-2">
                                        Account Recovery & Access Control
                                    </p>
                                    <button
                                        onClick={() => handleAdminReset('temp_password')}
                                        className="w-full py-3 px-4 rounded-xl border border-[#ddd6fe] bg-[#f4ecff] text-[#6d28d9] text-[9px] font-black uppercase tracking-[0.2em] hover:bg-[#7c3aed] hover:text-white transition-all"
                                    >
                                        Generate Temp Password
                                    </button>
                                    <button
                                        onClick={() => handleAdminReset('reset_link')}
                                        className="w-full py-3 px-4 rounded-xl border border-[#ddd6fe] bg-white text-[#6d28d9] text-[9px] font-black uppercase tracking-[0.2em] hover:bg-[#f4ecff] transition-all"
                                    >
                                        Send Reset Link
                                    </button>
                                </div>
                            </div>
                        </HasPermission>
                    )}

                    {/* Offboard Danger Zone */}
                    {!isExited && (
                        <HasPermission permission="deploy.employees.offboard">
                            <div className="bg-white border border-red-200 shadow-lg shadow-red-500/5 p-8 rounded-2xl">
                                <SectionHeader icon={X} title="Danger Zone" />
                                <div className="mt-6">
                                    <p className="text-[10px] text-black/70 uppercase tracking-widest mb-4">
                                        Initiating offboard will immediately decouple this personnel record.
                                    </p>
                                    <button
                                        onClick={handleOffboard}
                                        className="w-full py-3 px-4 rounded-xl border border-red-200 bg-red-50 text-red-600 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
                                    >
                                        Initiate Offboard Sequence
                                    </button>
                                </div>
                            </div>
                        </HasPermission>
                    )}

                </div>
                {/* ── END RIGHT COLUMN ── */}

            </div>
            {/* ── END MAIN GRID ── */}

        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EditMetaItem({ editMode, icon: Icon, label, value, onChange }) {
    return (
        <div className="space-y-1.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-black flex items-center gap-2">
                <Icon size={10} className="text-[#7c3aed]" />
                {label}
            </p>
            {editMode ? (
                <input
                    type="text"
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    className="w-full bg-[#f4ecff] border border-[#ddd6fe] rounded-lg px-3 py-2 text-xs text-black font-semibold focus:outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#c4b5fd] transition-all"
                />
            ) : (
                <p className="text-xs text-black font-bold truncate">
                    {value || 'Unknown'}
                </p>
            )}
        </div>
    );
}

function EditStatCard({ label, value, sub, editMode, onChange, type = "text", options = [], displayValue, error, missing, sentenceCase = false }) {
    return (
        <div className={`bg-white border border-[#e9ddff] rounded-2xl shadow-sm hover:shadow-md hover:shadow-[#7c3aed]/10 p-6 transition-all ${editMode ? 'ring-2 ring-[#c4b5fd]' : ''}`}>
            <p className={`text-[9px] font-black tracking-widest text-[#7B1FFF] mb-2 flex items-center gap-1.5 ${sentenceCase ? '' : 'uppercase'}`}>
                {label} {missing && <MissingMark />}
            </p>
            {editMode ? (
                <>
                    {type === 'select' ? (
                        <select
                            value={value || ''}
                            onChange={e => onChange(e.target.value)}
                            className={`w-full bg-[#f4ecff] border ${error ? 'border-red-400' : 'border-[#ddd6fe]'} rounded-lg px-3 py-2 text-sm text-black font-black uppercase focus:outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#c4b5fd] appearance-none`}
                        >
                            <option value="">Select Manager</option>
                            {options.map((opt, i) => (
                                <option key={i} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    ) : type === 'date' ? (
                        <input
                            type="date"
                            value={value || ''}
                            onChange={e => onChange(e.target.value)}
                            className={`w-full bg-[#f4ecff] border ${error ? 'border-red-400' : 'border-[#ddd6fe]'} rounded-lg px-3 py-2 text-sm text-black font-black uppercase focus:outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#c4b5fd]`}
                        />
                    ) : (
                        <input
                            type={type}
                            value={value || ''}
                            onChange={e => onChange(e.target.value)}
                            className={`w-full bg-[#f4ecff] border ${error ? 'border-red-400' : 'border-[#ddd6fe]'} rounded-lg px-3 py-2 text-sm text-black font-black uppercase focus:outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#c4b5fd]`}
                        />
                    )}
                    {error && <p className="text-red-500 text-[9px] font-bold mt-1">{error}</p>}
                </>
            ) : (
                <p className="text-xs font-bold text-black uppercase truncate">
                    {displayValue || value || '—'}
                </p>
            )}
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#7c3aed] mt-2">
                {sub}
            </p>
        </div>
    );
}

// Small yellow "!" badge — flags a field that's part of the profile-completeness
// checklist (same fields the "Incomplete profile" Directory badge is derived
// from) and is currently empty, so it's obvious at a glance what to fill in.
function MissingMark() {
    return (
        <span
            title="Missing — required for a complete profile"
            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-100 border border-amber-200 shrink-0"
        >
            <AlertTriangle size={9} className="text-amber-500" fill="#fef3c7" />
        </span>
    );
}

function SectionHeader({ icon: Icon, title }) {
    return (
        <div className="flex items-center gap-3 border-b border-[#ece4ff] pb-4">
            <div className="w-8 h-8 rounded-lg bg-[#f4ecff] flex items-center justify-center text-[#7c3aed] border border-[#ddd6fe]">
                <Icon size={14} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#7B1FFF]">
                {title}
            </h3>
        </div>
    );
}

function FileCard({ label, path, editMode, onUpload, employeeCode, docType, missing }) {
    // Served through a backend endpoint (reads the file server-side, or redirects
    // to a presigned S3 URL) rather than a raw static path — locally-stored files
    // aren't reachable via any static file route. Inline by default (for viewing);
    // ?download=true forces a "Save As" download instead.
    const fileUrl = path ? `/api/employee/${employeeCode}/document/${docType}` : '';

    const handleDownload = async () => {
        if (!path) return;

        try {
            const response = await fetch(`${fileUrl}?download=true`, { credentials: 'include' });
            if (!response.ok) throw new Error();

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = path.split('/').pop() || `${label}.download`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(objectUrl);
        } catch {
            toast.error('Failed to download file');
        }
    };

    return (
        <div className="flex items-center justify-between p-4 bg-[#f8f5ff] rounded-xl border border-[#e9ddff] group hover:border-[#c4b5fd] hover:shadow-md hover:shadow-[#7c3aed]/10 transition-all">
            <div className="flex items-center gap-3">
                <FileText size={16} className="text-[#7c3aed] group-hover:text-[#6d28d9] transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-black flex items-center gap-1.5">
                    {label} {missing && <MissingMark />}
                </span>
            </div>
            <div className="flex gap-2">
                {path && (
                    <>
                        <a
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="View file"
                            className="p-2 bg-white rounded-lg border border-[#e9ddff] text-[#7c3aed] hover:bg-[#7c3aed] hover:text-white hover:shadow-md hover:shadow-[#7c3aed]/20 transition-all"
                        >
                            <ExternalLink size={12} />
                        </a>
                        <button
                            type="button"
                            onClick={handleDownload}
                            title="Download file"
                            className="p-2 bg-white rounded-lg border border-[#e9ddff] text-[#7c3aed] hover:bg-[#7c3aed] hover:text-white hover:shadow-md hover:shadow-[#7c3aed]/20 transition-all"
                        >
                            <Download size={12} />
                        </button>
                    </>
                )}
                {editMode && (
                    <button
                        onClick={onUpload}
                        className="p-2 bg-white rounded-lg border border-[#e9ddff] text-black hover:bg-[#7c3aed] hover:text-white hover:shadow-md hover:shadow-[#7c3aed]/20 transition-all"
                    >
                        <Upload size={12} />
                    </button>
                )}
            </div>
        </div>
    );
}

function ComplianceRow({ label, active, editMode, onToggle, missing }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-black flex items-center gap-1.5">
                {label} {missing && <MissingMark />}
            </span>
            <button
                disabled={!editMode}
                onClick={onToggle}
                className={`w-10 h-5 rounded-full relative transition-all ${active ? 'bg-[#7c3aed]' : 'bg-[#ddd6fe]'} ${!editMode ? 'opacity-50' : 'cursor-pointer'}`}
            >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${active ? 'right-0.5' : 'left-0.5'}`} />
            </button>
        </div>
    );
}