import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { X, Upload, Download, FileSpreadsheet, User, Briefcase, CreditCard, FileText, CheckCircle, ShieldCheck, GraduationCap, Plus, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  MAX_FILE_SIZE,
  isAtLeastAge,
  isDateString,
  isEmail,
  isEmployeeCode,
  isNonNegativeNumber,
  isPhone,
  isBankAccount,
  isPan,
  isIfsc,
  validateFile,
} from '../../../core/utils/validators';
import useEscapeClose from '../../../core/hooks/useEscapeClose';
import useTabListKeyNav from '../../../core/hooks/useTabListKeyNav';
import useOverlayClose from '../../../core/hooks/useOverlayClose';
import useUnsavedChangesWarning from '../../../core/hooks/useUnsavedChangesWarning';
import ComboBox from '../../../core/components/ComboBox';

const ROLES = ['org_admin', 'manager', 'employee', 'trainee'];

const DEGREE_OPTIONS = [
  '10th / SSC', '12th / HSC', 'Diploma',
  'B.Tech', 'B.E.', 'B.Sc', 'B.Com', 'B.A.', 'BBA', 'BCA',
  'M.Tech', 'M.E.', 'M.Sc', 'M.Com', 'M.A.', 'MBA', 'MCA', 'PhD'
];

const Field = ({ label, k, type = 'text', options, form, set, required = false }) => (
  <div>
    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8b5cf6] block mb-3">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {options ? (
      <select value={form[k]} onChange={e => set(k, e.target.value)} className="w-full rounded-2xl border border-[#e8defc] bg-[#f8f5ff] text-black text-[13px] font-semibold px-5 py-4 focus:outline-none focus:border-[#b78cff] transition-all">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    ) : (
      <input type={type} value={form[k]} onChange={e => set(k, e.target.value)} className="w-full rounded-2xl border border-[#e8defc] bg-white text-black text-[13px] px-5 py-4 focus:outline-none focus:border-[#b78cff] transition-all placeholder:text-[#b0a8c5]" />
    )}
  </div>
);

export default function AddEmployeeModal({ onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('single'); // 'single' or 'bulk'
  const [managers, setManagers] = useState([]);
  const [dynamicRoles, setDynamicRoles] = useState(ROLES);
  useEscapeClose(onClose);
  const overlayHandlers = useOverlayClose(onClose);
  useUnsavedChangesWarning(true);
  const handleTabKeyNav = useTabListKeyNav();

  useEffect(() => {
    fetch('/api/options', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setManagers(data.managers || []);
        if (data.custom_roles) {
          setDynamicRoles([...ROLES, ...data.custom_roles]);
        }
      })
      .catch(() => {});
  }, []);
  
  // Single Add State
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    code: '', first_name: '', middle_name: '', last_name: '', email: '', dob: '', phone: '', emergency: '',
    doj: '', team: '', role: 'employee', type: 'Full-time', manager: '',
    location: '', designation: '', current_address: '', permanent_address: '',
    pf: 'No', mediclaim: 'No', notes: '', primary_skillset: '',
    secondary_skillset: '', experience_years: '',
    bank_name: '', bank_account_no: '', pan_no: '', ifsc_code: '',
  });

  // File uploads state
  const [files, setFiles] = useState({
    photo_file: null,
    cv_file: null,
    id_proof_file: null,
    passbook_file: null
  });

  // Education list state
  const [educationList, setEducationList] = useState([
    { degree: '', university: '', year: '', percentage: '' }
  ]);

  const addEducation = () => {
    setEducationList([...educationList, { degree: '', university: '', year: '', percentage: '' }]);
  };

  const removeEducation = (index) => {
    if (educationList.length > 1) {
      setEducationList(educationList.filter((_, i) => i !== index));
    }
  };

  const updateEducation = (index, field, value) => {
    const newList = [...educationList];
    newList[index] = { ...newList[index], [field]: value };
    setEducationList(newList);
  };

  // Bulk Upload State
  const [bulkData, setBulkData] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const fileRules = {
      photo_file: { exts: ['.jpg', '.jpeg', '.png'], size: MAX_FILE_SIZE.image, label: 'Profile photo' },
      cv_file: { exts: ['.pdf'], size: MAX_FILE_SIZE.resume, label: 'Resume/CV' },
      id_proof_file: { exts: ['.pdf', '.jpg', '.jpeg', '.png'], size: MAX_FILE_SIZE.document, label: 'ID proof' },
      passbook_file: { exts: ['.pdf', '.jpg', '.jpeg', '.png'], size: MAX_FILE_SIZE.document, label: 'Bank passbook' },
    };
    
    const rule = fileRules[type];
    const error = rule ? validateFile(file, rule.exts, rule.size, rule.label) : '';
    if (error) {
      toast.error(error);
      e.target.value = '';
      return;
    }
    setFiles(prev => ({ ...prev, [type]: file }));
  };

  const validateSingle = () => {
    // ── FIRST NAME AND LAST NAME ARE MANDATORY, MIDDLE NAME IS OPTIONAL ──
    if (!form.first_name || !form.first_name.trim()) {
      return 'First Name is required.';
    }
    if (!form.last_name || !form.last_name.trim()) {
      return 'Last Name is required.';
    }

    // ── All other fields are optional, only validate if filled ──
    
    // Employee Code - only validate if filled
    if (form.code && !isEmployeeCode(form.code)) {
      return 'Employee ID must be 3-20 letters, numbers, hyphens, or underscores.';
    }
    
    // Email - only validate if filled
    if (form.email && !isEmail(form.email)) {
      return 'Enter a valid email address.';
    }
    
    // Phone - only validate if filled
    if (form.phone && !isPhone(form.phone)) {
      return 'Phone number must be 7-15 digits, optionally starting with +.';
    }
    
    // Emergency contact - only validate if filled
    if (form.emergency && !isPhone(form.emergency)) {
      return 'Emergency contact must be 7-15 digits, optionally starting with +.';
    }
    
    // DOB - only validate if filled
    if (form.dob && !isAtLeastAge(form.dob, 18)) {
      return 'Employee must be at least 18 years old.';
    }
    
    // Experience years - only validate if filled
    if (form.experience_years !== '' && !isNonNegativeNumber(form.experience_years)) {
      return 'Experience must be 0 or greater.';
    }
    
    // Role - only validate if filled
    if (form.role && !dynamicRoles.includes(form.role)) {
      return 'Select a valid system access role.';
    }
    
    // Bank Account - only validate if filled
    if (form.bank_account_no && !isBankAccount(form.bank_account_no)) {
      return 'Bank account must be 9-18 digits only.';
    }
    
    // PAN - only validate if filled
    if (form.pan_no && !isPan(form.pan_no)) {
      return 'PAN must follow ABCDE1234F format.';
    }

    // IFSC - only validate if filled
    if (form.ifsc_code && !isIfsc(form.ifsc_code)) {
      return 'IFSC must follow ABCD0123456 format.';
    }

    return '';
  };

  const submitSingle = async () => {
    const validationError = validateSingle();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    
    // ── CV is now optional ──
    // No file validation required
    
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v) fd.append(k, v);
      });

      const filledEducation = educationList.filter(e => e.degree || e.university || e.year || e.percentage);
      if (filledEducation.length > 0) {
        fd.append('education_details', JSON.stringify(filledEducation));
      }

      // Append files
      Object.entries(files).forEach(([k, v]) => {
        if (v) fd.append(k, v);
      });
      
      const res = await fetch('/api/employee', {
        method: 'POST',
        credentials: 'include',
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      
      toast.success(data.message || 'Employee added');
      if (data.login_credentials) {
        toast.success(
          `Login: ${data.login_credentials.username} / ${data.login_credentials.temporary_password}`,
          { duration: 10000 }
        );
      }
      onSuccess();
    } catch (e) {
      toast.error(e.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const error = validateFile(file, ['.xlsx', '.xls', '.csv'], MAX_FILE_SIZE.spreadsheet, 'Employee bulk file');
    if (error) {
      toast.error(error);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        // cellDates:true makes SheetJS convert Excel date serials to JS Date objects
        // instead of raw numbers, so our age validation always receives a real date.
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const raw = XLSX.utils.sheet_to_json(ws);

        // Normalise every cell that looks like a Date object to YYYY-MM-DD string
        const DATE_COLS = ['Date of Birth', 'Date of Joining'];
        const normalised = raw.map((row) => {
          const copy = { ...row };
          DATE_COLS.forEach((col) => {
            if (copy[col] instanceof Date) {
              const d = copy[col];
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              copy[col] = `${yyyy}-${mm}-${dd}`;
            }
          });
          return copy;
        });

        setBulkData(normalised);
        if (normalised.length === 0) {
          toast.error('The uploaded file is empty.');
        } else {
          toast.success(`Loaded ${normalised.length} records. Please review before confirming.`);
        }
      } catch (err) {
        toast.error('Failed to parse Excel file. Please use the provided template.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const submitBulk = async () => {
    if (bulkData.length === 0) {
      toast.error('No data to upload.');
      return;
    }
    const rowError = validateBulkRows(bulkData);
    if (rowError) {
      toast.error(rowError, { duration: 7000 });
      return;
    }
    setBulkUploading(true);
    try {
      const res = await fetch('/api/employees/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(bulkData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      
      if (data.failed > 0) {
        toast.error(`Successfully added ${data.success} employees, but ${data.failed} failed. Check console for details.`, { duration: 6000 });
        console.error("Bulk upload errors:", data.errors);
      } else {
        toast.success(`Successfully added all ${data.success} employees! Check emails for login credentials.`);
      }
      onSuccess();
    } catch (e) {
      toast.error(e.message || 'Bulk upload failed');
    } finally {
      setBulkUploading(false);
    }
  };

  const validateBulkRows = (rows) => {
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const rowNo = i + 2;
      const code = String(row["Employee Code"] || '').trim();
      const firstName = String(row["First Name"] || '').trim();
      const lastName = String(row["Last Name"] || '').trim();
      const email = String(row["Email ID"] || '').trim();
      const phone = String(row["Contact Number"] || '').trim();
      const dob = String(row["Date of Birth"] || '').trim();
      const doj = String(row["Date of Joining"] || '').trim();
      const exp = row["Experience Years"];
      const bankAccount = String(row["Bank Account No."] || '').trim();
      const pan = String(row["PAN No."] || '').trim();

      // ── MANDATORY FIELDS ──
      if (!firstName || !lastName) return `Row ${rowNo}: First Name and Last Name are mandatory.`;
      if (!code) return `Row ${rowNo}: Employee Code is mandatory.`;
      if (!email) return `Row ${rowNo}: Email ID is mandatory.`;

      // ── Format validation ──
      if (!isEmployeeCode(code)) return `Row ${rowNo}: Employee Code must be 3-20 letters/numbers/hyphen/underscore.`;
      
      if (!isEmail(email)) return `Row ${rowNo}: Enter a valid Email ID.`;
      
      if (phone && !isPhone(phone)) return `Row ${rowNo}: Contact Number must be 7-15 digits.`;
      
      if (dob && !isAtLeastAge(dob, 18)) return `Row ${rowNo}: Date of Birth must confirm age 18 or above.`;
      
      if (doj && !isDateString(doj)) return `Row ${rowNo}: Date of Joining is invalid.`;
      
      if (exp !== undefined && exp !== '' && !isNonNegativeNumber(exp)) {
        return `Row ${rowNo}: Experience Years must be 0 or greater.`;
      }
      
      if (bankAccount && !isBankAccount(bankAccount)) {
        return `Row ${rowNo}: Bank account must be 9-18 digits only.`;
      }
      
      if (pan && !isPan(pan)) {
        return `Row ${rowNo}: PAN must follow ABCDE1234F format.`;
      }
    }
    return '';
  };

  // Step labels for the stepper
  const stepLabels = [
    { step: 1, icon: User, label: 'Personal' },
    { step: 2, icon: Briefcase, label: 'Employment' },
    { step: 3, icon: CreditCard, label: 'Financial' },
    { step: 4, icon: GraduationCap, label: 'Education' },
    { step: 5, icon: FileText, label: 'Documents' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-2.5 sm:p-5" {...overlayHandlers}>
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl sm:rounded-[2.8rem] border border-[#ece3ff] bg-[#fcfbff] shadow-[0_30px_100px_rgba(180,140,255,0.18)] p-5 sm:p-8 lg:p-12 custom-scrollbar animate-fade-in-up" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 sm:top-7 sm:right-7 w-11 h-11 rounded-2xl bg-[#f5f1ff] border border-[#e7ddff] flex items-center justify-center hover:bg-[#ede6ff] transition-all">
          <X size={18} className="text-black" />
        </button>

        <div className="mb-10">
          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-[#8b5cf6] mb-3">
            Employee Central
          </p>
          <h2 className="text-4xl font-black tracking-tight text-black leading-none mb-8">
            Add Team Member
          </h2>

          <div onKeyDown={handleTabKeyNav} className="flex bg-[#f5f1ff] p-1.5 rounded-2xl mb-8 w-max">
            <button
              className={`px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all ${activeTab === 'single' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
              onClick={() => setActiveTab('single')}
            >
              Single Add
            </button>
            <button
              className={`px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all ${activeTab === 'bulk' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
              onClick={() => setActiveTab('bulk')}
            >
              Bulk Upload
            </button>
          </div>
        </div>

        {activeTab === 'single' ? (
          <>
            <div className="flex gap-3 mb-8">
              {stepLabels.map((s) => (
                <div key={s.step} className="flex-1">
                  <div className={`h-2 rounded-full transition-all duration-300 ${s.step <= step ? 'bg-gradient-to-r from-[#c084fc] to-[#8b5cf6]' : 'bg-[#ece7fa]'}`} />
                  <div className="flex items-center gap-2 mt-2">
                    <s.icon size={12} className={`${s.step <= step ? 'text-[#8b5cf6]' : 'text-gray-400'}`} />
                    <span className={`text-[8px] font-black uppercase tracking-widest ${s.step <= step ? 'text-[#8b5cf6]' : 'text-gray-400'}`}>{s.label}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-6">
              {/* STEP 1: Personal Details */}
              {step === 1 && (
                <div className="grid grid-cols-2 gap-6">
                  <Field label="Employee ID" k="code" form={form} set={set} />
                  <div className="grid grid-cols-3 gap-3 col-span-2">
                    <Field label="First Name" k="first_name" form={form} set={set} required />
                    <Field label="Middle Name" k="middle_name" form={form} set={set} />
                    <Field label="Last Name" k="last_name" form={form} set={set} required />
                  </div>
                  <Field label="Email Address" k="email" type="email" form={form} set={set} />
                  <Field label="Phone Number" k="phone" form={form} set={set} />
                  <Field label="Date of Birth" k="dob" type="date" form={form} set={set} />
                  <Field label="Emergency Contact" k="emergency" form={form} set={set} />
                </div>
              )}

              {/* STEP 2: Employment Details */}
              {step === 2 && (
                <div className="grid grid-cols-2 gap-6">
                  <Field label="Joining Date" k="doj" type="date" form={form} set={set} />
                  <Field label="Department" k="team" form={form} set={set} />
                  <Field label="Job Title" k="designation" form={form} set={set} />
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8b5cf6] block mb-3">Reporting Manager</label>
                    <select value={form.manager} onChange={e => set('manager', e.target.value)} className="w-full rounded-2xl border border-[#e8defc] bg-[#f8f5ff] text-black text-[13px] font-semibold px-5 py-4 focus:outline-none focus:border-[#b78cff] transition-all">
                      <option value="">Select Manager</option>
                      {managers.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}
                    </select>
                  </div>
                  <Field label="Work Location" k="location" form={form} set={set} />
                  <Field label="Employment Type" k="type" options={['Full-time', 'Part-time', 'Contract', 'Intern']} form={form} set={set} />
                  <Field label="System Access Role" k="role" options={dynamicRoles} form={form} set={set} />
                </div>
              )}

              {/* STEP 3: Financial & Additional Info */}
              {step === 3 && (
                <div className="grid grid-cols-2 gap-6">
                  <Field label="Primary Skills" k="primary_skillset" form={form} set={set} />
                  <Field label="Secondary Skills" k="secondary_skillset" form={form} set={set} />
                  <Field label="Experience (Years)" k="experience_years" type="number" form={form} set={set} />
                  <Field label="Bank Name" k="bank_name" form={form} set={set} />
                  <Field label="Bank Account No." k="bank_account_no" form={form} set={set} />
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8b5cf6] block mb-3">
                      PAN No.
                    </label>
                    <input 
                      type="text" 
                      value={form.pan_no} 
                      onChange={e => set('pan_no', e.target.value.toUpperCase())} 
                      className="w-full rounded-2xl border border-[#e8defc] bg-white text-black text-[13px] px-5 py-4 focus:outline-none focus:border-[#b78cff] transition-all placeholder:text-[#b0a8c5] uppercase" 
                      placeholder="ABCDE1234F"
                    />
                    <p className="text-[8px] text-[#8b5cf6] font-bold uppercase tracking-widest mt-1">Format: ABCDE1234F</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8b5cf6] block mb-3">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      value={form.ifsc_code}
                      onChange={e => set('ifsc_code', e.target.value.toUpperCase())}
                      className="w-full rounded-2xl border border-[#e8defc] bg-white text-black text-[13px] px-5 py-4 focus:outline-none focus:border-[#b78cff] transition-all placeholder:text-[#b0a8c5] uppercase"
                      placeholder="ABCD0123456"
                    />
                    <p className="text-[8px] text-[#8b5cf6] font-bold uppercase tracking-widest mt-1">Format: ABCD0123456</p>
                  </div>
                  <Field label="PF Enabled" k="pf" options={['No', 'Yes']} form={form} set={set} />
                  <Field label="Mediclaim Enabled" k="mediclaim" options={['No', 'Yes']} form={form} set={set} />
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8b5cf6] block mb-3">Additional Notes</label>
                    <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={4} className="w-full rounded-2xl border border-[#e8defc] bg-white text-black text-[13px] px-5 py-4 focus:outline-none focus:border-[#b78cff] resize-none" />
                  </div>
                </div>
              )}

              {/* STEP 4: Education */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <GraduationCap size={16} className="text-[#8b5cf6]" />
                      <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#8b5cf6]">Education (Optional)</h3>
                    </div>
                    <button type="button" onClick={addEducation} className="flex items-center gap-2 px-4 py-2 bg-[#f5f1ff] hover:bg-[#ece2ff] text-[#8b5cf6] rounded-xl transition-all border border-[#e8defc]">
                      <Plus size={14} /> <span className="text-[10px] font-black uppercase tracking-widest">Add education</span>
                    </button>
                  </div>

                  <div className="space-y-4 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                    {educationList.map((edu, idx) => (
                      <div key={idx} className="relative p-6 bg-[#f8f5ff] border border-[#e8defc] rounded-2xl space-y-4 group">
                        {educationList.length > 1 && (
                          <button type="button" onClick={() => removeEducation(idx)} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                            <Trash2 size={14} />
                          </button>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ComboBox options={DEGREE_OPTIONS} value={edu.degree} onChange={val => updateEducation(idx, 'degree', val)} placeholder="Select or type course..." />
                          <input placeholder="Institution / University" value={edu.university} onChange={e => updateEducation(idx, 'university', e.target.value)} className="w-full rounded-2xl border border-[#e8defc] bg-white text-black text-[13px] px-5 py-4 focus:outline-none focus:border-[#b78cff] transition-all placeholder:text-[#b0a8c5]" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <input placeholder="Passout Year" value={edu.year} onChange={e => updateEducation(idx, 'year', e.target.value)} className="w-full rounded-2xl border border-[#e8defc] bg-white text-black text-[13px] px-5 py-4 focus:outline-none focus:border-[#b78cff] transition-all placeholder:text-[#b0a8c5]" />
                          <input placeholder="CGPA / %" value={edu.percentage} onChange={e => updateEducation(idx, 'percentage', e.target.value)} className="w-full rounded-2xl border border-[#e8defc] bg-white text-black text-[13px] px-5 py-4 focus:outline-none focus:border-[#b78cff] transition-all placeholder:text-[#b0a8c5]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 5: Document Uploads */}
              {step === 5 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText size={16} className="text-[#8b5cf6]" />
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#8b5cf6]">Document Uploads (Optional)</h3>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Resume/CV - Optional */}
                    <div className={`flex items-center gap-5 p-5 rounded-2xl border transition-all ${files.cv_file ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/50'}`}>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all ${files.cv_file ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                        {files.cv_file ? <Upload size={20} className="text-emerald-600" /> : <FileText size={20} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">Resume / CV</p>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider truncate">{files.cv_file ? files.cv_file.name : 'PDF only (max 5MB)'}</p>
                      </div>
                      <label className="cursor-pointer px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700 border border-slate-200 rounded-xl transition-all">
                        {files.cv_file ? 'Replace' : 'Upload'}
                        <input type="file" name="cv_file" onChange={e => handleFileChange(e, 'cv_file')} className="hidden" accept=".pdf" />
                      </label>
                    </div>

                    {/* Profile Photo - Optional */}
                    <div className={`flex items-center gap-5 p-5 rounded-2xl border transition-all ${files.photo_file ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/50'}`}>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all ${files.photo_file ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                        {files.photo_file ? <CheckCircle size={20} className="text-emerald-600" /> : <User size={20} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">Profile Photo</p>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider truncate">{files.photo_file ? files.photo_file.name : 'JPG, JPEG, PNG (max 2MB)'}</p>
                      </div>
                      <label className="cursor-pointer px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700 border border-slate-200 rounded-xl transition-all">
                        {files.photo_file ? 'Replace' : 'Upload'}
                        <input type="file" name="photo_file" onChange={e => handleFileChange(e, 'photo_file')} className="hidden" accept=".jpg,.jpeg,.png" />
                      </label>
                    </div>

                    {/* ID Proof - Optional */}
                    <div className={`flex items-center gap-5 p-5 rounded-2xl border transition-all ${files.id_proof_file ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/50'}`}>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all ${files.id_proof_file ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                        {files.id_proof_file ? <CheckCircle size={20} className="text-emerald-600" /> : <ShieldCheck size={20} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">Government ID Proof</p>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider truncate">{files.id_proof_file ? files.id_proof_file.name : 'PDF, JPG, JPEG, PNG (max 5MB)'}</p>
                      </div>
                      <label className="cursor-pointer px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700 border border-slate-200 rounded-xl transition-all">
                        {files.id_proof_file ? 'Replace' : 'Upload'}
                        <input type="file" name="id_proof_file" onChange={e => handleFileChange(e, 'id_proof_file')} className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
                      </label>
                    </div>

                    {/* Bank Passbook - Optional */}
                    <div className={`flex items-center gap-5 p-5 rounded-2xl border transition-all ${files.passbook_file ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/50'}`}>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all ${files.passbook_file ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                        {files.passbook_file ? <CheckCircle size={20} className="text-emerald-600" /> : <CreditCard size={20} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">Bank Passbook</p>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider truncate">{files.passbook_file ? files.passbook_file.name : 'First page - PDF, JPG, JPEG, PNG (max 5MB)'}</p>
                      </div>
                      <label className="cursor-pointer px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700 border border-slate-200 rounded-xl transition-all">
                        {files.passbook_file ? 'Replace' : 'Upload'}
                        <input type="file" name="passbook_file" onChange={e => handleFileChange(e, 'passbook_file')} className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-5 mt-10">
              {step > 1 && (
                <button onClick={() => setStep(s => s - 1)} className="flex-1 py-4 rounded-2xl border border-[#e8defc] bg-white text-black text-[11px] font-black uppercase tracking-[0.25em] hover:bg-[#f5f1ff] transition-all">Back</button>
              )}
              {step < 5 ? (
                <button onClick={() => setStep(s => s + 1)} className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white text-[11px] font-black uppercase tracking-[0.25em] shadow-[0_12px_30px_rgba(180,140,255,0.28)] hover:scale-[1.01] transition-all">Continue</button>
              ) : (
                <button onClick={submitSingle} disabled={submitting} className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white text-[11px] font-black uppercase tracking-[0.25em] shadow-[0_12px_30px_rgba(180,140,255,0.28)] hover:scale-[1.01] transition-all disabled:opacity-50">
                  {submitting ? 'Adding...' : 'Add Employee'}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="bg-[#f8f5ff] border border-[#e8defc] rounded-2xl p-6 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm mb-1 text-black">1. Download Template</h3>
                <p className="text-xs text-gray-500">Get the standard Excel file to ensure your data is formatted correctly.</p>
              </div>
              <a 
                href="/api/employees/bulk-upload/template" 
                download
                className="flex items-center gap-2 bg-white border border-[#e8defc] px-4 py-2 rounded-xl text-xs font-bold text-[#8b5cf6] hover:bg-[#f5f1ff] transition-all"
              >
                <Download size={14} /> Download .xlsx
              </a>
            </div>

            <div className="bg-white border-2 border-dashed border-[#e8defc] rounded-2xl p-8 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 bg-[#f5f1ff] rounded-full flex items-center justify-center mb-4">
                <FileSpreadsheet className="text-[#8b5cf6]" size={24} />
              </div>
              <h3 className="font-bold text-sm mb-2 text-black">2. Upload Filled Template</h3>
              <p className="text-xs text-gray-500 mb-6 max-w-xs">Upload your completed .xlsx file. The system will automatically generate secure temporary passwords for new users.</p>
              
              <label className="cursor-pointer bg-black text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-gray-800 transition-all flex items-center gap-2">
                <Upload size={14} /> Browse Files
                <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>

            {bulkData.length > 0 && (
              <div className="border border-[#e8defc] rounded-2xl overflow-hidden mt-4">
                <div className="bg-[#f5f1ff] px-4 py-3 border-b border-[#e8defc] flex justify-between items-center">
                  <h3 className="font-bold text-xs text-black">Data Preview ({bulkData.length} Records)</h3>
                </div>
                <div className="max-h-60 overflow-y-auto overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs min-w-[520px]">
                    <thead className="bg-white sticky top-0 border-b border-[#e8defc]">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-500">Emp Code</th>
                        <th className="px-4 py-3 font-semibold text-gray-500">First Name</th>
                        <th className="px-4 py-3 font-semibold text-gray-500">Last Name</th>
                        <th className="px-4 py-3 font-semibold text-gray-500">Email</th>
                        <th className="px-4 py-3 font-semibold text-gray-500">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f5f1ff]">
                      {bulkData.slice(0, 10).map((row, i) => (
                        <tr key={i} className="hover:bg-[#faf8ff] transition-all">
                          <td className="px-4 py-3 font-medium">{row["Employee Code"] || '-'}</td>
                          <td className="px-4 py-3">{row["First Name"] || '-'}</td>
                          <td className="px-4 py-3">{row["Last Name"] || '-'}</td>
                          <td className="px-4 py-3">{row["Email ID"] || '-'}</td>
                          <td className="px-4 py-3">{row["Role"] || 'employee'}</td>
                        </tr>
                      ))}
                      {bulkData.length > 10 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-3 text-center text-gray-400 italic">
                            ... and {bulkData.length - 10} more rows
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-5 mt-4">
              <button onClick={submitBulk} disabled={bulkUploading || bulkData.length === 0} className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white text-[11px] font-black uppercase tracking-[0.25em] shadow-[0_12px_30px_rgba(180,140,255,0.28)] hover:scale-[1.01] transition-all disabled:opacity-50">
                {bulkUploading ? 'Uploading & Processing...' : 'Confirm & Upload'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}