import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, User, Mail, Landmark, Briefcase, GraduationCap,
  FileText, Download, ShieldCheck
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { usePermissions } from '../../../core/auth/usePermissions';
import { P } from '../../../core/permissions';
import { isValidBankAccount, isPan, isValidIFSC } from '../../../core/utils/validators';
import useEscapeClose from '../../../core/hooks/useEscapeClose';

// Finance-facing review of an active employee's onboarding profile, with bank
// name / account number / PAN / IFSC left open for correction. There's no
// separate save step — approving commits whatever's currently in those fields in one shot.
export default function FinanceReviewPanel({ employeeCode, onClose, onSaved }) {
  const { hasPermission } = usePermissions();
  const canEditFinancial = hasPermission(P.DEPLOY_EMP_EDIT_FINANCIAL);
  const canApproveFinancial = hasPermission(P.DEPLOY_EMP_APPROVE_FINANCIAL);

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bankForm, setBankForm] = useState({ bank_name: '', bank_account_no: '', pan_no: '', ifsc_code: '' });
  const [errors, setErrors] = useState({});
  const [approving, setApproving] = useState(false);

  useEscapeClose(onClose, !!employeeCode);

  useEffect(() => {
    if (!employeeCode) return;
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeCode]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/employee/${employeeCode}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDetails(data);
      setBankForm({
        bank_name: data.bank_name && data.bank_name !== '***REDACTED***' ? data.bank_name : '',
        bank_account_no: data.bank_account_no && data.bank_account_no !== '***REDACTED***' ? data.bank_account_no : '',
        pan_no: data.pan_no && data.pan_no !== '***REDACTED***' ? data.pan_no : '',
        ifsc_code: data.ifsc_code && data.ifsc_code !== '***REDACTED***' ? data.ifsc_code : '',
      });
    } catch {
      toast.error('Failed to load employee profile');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDetails = async () => {
    const newErrors = {};
    if (bankForm.bank_account_no && !isValidBankAccount(bankForm.bank_account_no)) {
      newErrors.bank_account_no = 'Enter a valid bank account number (9-18 digits)';
    }
    if (bankForm.pan_no && !isPan(bankForm.pan_no)) {
      newErrors.pan_no = 'PAN must follow ABCDE1234F format';
    }
    if (bankForm.ifsc_code && !isValidIFSC(bankForm.ifsc_code)) {
      newErrors.ifsc_code = 'IFSC must follow ABCD0123456 format';
    }
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setApproving(true);
    try {
      if (canEditFinancial) {
        const saveRes = await fetch(`/api/employee/${employeeCode}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bank_name: bankForm.bank_name,
            bank_account_no: bankForm.bank_account_no,
            pan_no: bankForm.pan_no ? bankForm.pan_no.trim().toUpperCase() : bankForm.pan_no,
            ifsc_code: bankForm.ifsc_code ? bankForm.ifsc_code.trim().toUpperCase() : bankForm.ifsc_code,
          }),
        });
        const saveData = await saveRes.json().catch(() => ({}));
        if (!saveRes.ok) throw new Error(saveData.detail || 'Failed to save bank details');
      }

      const res = await fetch(`/api/onboarding/approve-section/${employeeCode}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'finance' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.detail || 'Failed to approve details');
      toast.success('Finance sign-off recorded');
      setDetails(prev => ({ ...prev, finance_approved: 1, bank_name: bankForm.bank_name, bank_account_no: bankForm.bank_account_no, pan_no: bankForm.pan_no, ifsc_code: bankForm.ifsc_code }));
      onSaved?.();
    } catch (e) {
      toast.error(e.message || 'Failed to approve details');
    } finally {
      setApproving(false);
    }
  };

  if (!employeeCode) return null;

  const financeApproved = ['1', 1, true].includes(details?.finance_approved);

  const canViewFinancial = details?._meta?.can_view_financial !== false;
  let education = details?.education_details;
  try { if (typeof education === 'string') education = JSON.parse(education); } catch { education = null; }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-4xl h-full bg-white border-l border-[#ebe4ff] animate-slide-in-right overflow-y-auto custom-scrollbar">
        <div className="p-10 space-y-10">
          {loading || !details ? (
            <div className="flex items-center justify-center h-52">
              <div className="w-10 h-10 border-4 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex justify-between items-start">
                <div className="flex gap-6 items-center">
                  <div className="w-20 h-20 rounded-3xl bg-[#f3e8ff] text-[#8b5cf6] border border-[#ebe4ff] flex items-center justify-center font-black text-3xl overflow-hidden shrink-0">
                    {details.photo_path ? (
                      <img
                        src={`/api/employee/${employeeCode}/document/pfp`}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    ) : (
                      details.name?.[0]
                    )}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter italic leading-tight text-black">{details.name}</h2>
                    <span className="inline-block mt-2 px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 text-[8px] font-black uppercase tracking-widest border border-emerald-500/20 whitespace-nowrap">
                      {details.employment_status || 'Active'}
                    </span>
                    <p className="font-black text-xs uppercase tracking-[0.3em] mt-2 italic text-[#8b5cf6]">
                      {details.designation} // {details.team}
                    </p>
                    <p className="text-[9px] text-[#8b8ba3] font-mono uppercase mt-1">{details.employee_code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={handleApproveDetails}
                    disabled={!canApproveFinancial || approving || financeApproved}
                    title={!canApproveFinancial ? "You don't have permission to approve financial details" : undefined}
                    className={`flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-lg text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                      financeApproved
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                        : !canApproveFinancial || approving
                          ? 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-400'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20'
                    }`}
                  >
                    <ShieldCheck size={11} /> {financeApproved ? 'Profile Approved' : approving ? 'Approving...' : 'Approve Profile'}
                  </button>
                  <button onClick={onClose} className="p-2 rounded-xl bg-[#f5efff] text-[#6b7280] hover:bg-[#8b5cf6] hover:text-white transition-all">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Financial & Benefits */}
              <Section title="Financial & Benefits" icon={Landmark}>
                {canViewFinancial ? (
                  <>
                    <EditableField
                      label="Bank Name"
                      value={bankForm.bank_name}
                      onChange={v => setBankForm(f => ({ ...f, bank_name: v }))}
                      disabled={!canEditFinancial || financeApproved}
                    />
                    <EditableField
                      label="Account Number"
                      value={bankForm.bank_account_no}
                      onChange={v => setBankForm(f => ({ ...f, bank_account_no: v }))}
                      disabled={!canEditFinancial || financeApproved}
                      error={errors.bank_account_no}
                    />
                    <EditableField
                      label="PAN Number"
                      value={bankForm.pan_no}
                      onChange={v => setBankForm(f => ({ ...f, pan_no: v.toUpperCase() }))}
                      disabled={!canEditFinancial || financeApproved}
                      error={errors.pan_no}
                    />
                    <EditableField
                      label="IFSC Code"
                      value={bankForm.ifsc_code}
                      onChange={v => setBankForm(f => ({ ...f, ifsc_code: v.toUpperCase() }))}
                      disabled={!canEditFinancial || financeApproved}
                      error={errors.ifsc_code}
                    />
                    <ReadField label="PF Included" value={['Yes', 'yes', 'true', '1', true].includes(details.pf_included) ? 'Yes' : 'No'} />
                    <ReadField label="Mediclaim Included" value={['Yes', 'yes', 'true', '1', true].includes(details.mediclaim_included) ? 'Yes' : 'No'} />
                    <div className="md:col-span-2">
                      <DocLink label="Bank Passbook" path={details.passbook_path} employeeCode={details.employee_code} docType="passbook" />
                    </div>
                  </>
                ) : (
                  <div className="col-span-2 flex items-center gap-2 text-xs font-bold text-black/40 italic p-4 bg-[#faf7ff] rounded-xl border border-[#f1ebff]">
                    <ShieldCheck size={14} /> Restricted — you don't have permission to view financial details.
                  </div>
                )}
              </Section>

              {/* Identity */}
              <Section title="Identity" icon={User}>
                <ReadField label="Full Name" value={details.name} />
                <ReadField label="Employee Code" value={details.employee_code} />
                <ReadField label="Date of Birth" value={details.dob ? details.dob.split('T')[0] : ''} />
                <ReadField label="Designation" value={details.designation} />
                <ReadField label="Department" value={details.team} />
                <ReadField label="Employment Status" value={details.employment_status} />
              </Section>

              {/* Employment */}
              <Section title="Employment Details" icon={Briefcase}>
                <ReadField label="Date of Joining" value={details.doj ? details.doj.split('T')[0] : ''} />
                <ReadField label="Reporting Manager" value={details.reporting_manager} />
                <ReadField label="Employment Type" value={details.employment_type} />
                <ReadField label="Location" value={details.location} />
              </Section>

              {/* Contact */}
              {details?._meta?.can_view_sensitive !== false && (
                <Section title="Contact" icon={Mail}>
                  <ReadField label="Email" value={details.email_id} />
                  <ReadField label="Phone" value={details.contact_number} />
                  <ReadField label="Emergency Contact" value={details.emergency_contact} />
                </Section>
              )}

              {/* Address */}
              {details?._meta?.can_view_sensitive !== false && (
                <Section title="Address" icon={Landmark}>
                  <ReadField label="Current Address" value={details.current_address} full />
                  <ReadField label="Permanent Address" value={details.permanent_address} full />
                </Section>
              )}

              {/* Skills */}
              <Section title="Skills & Expertise" icon={GraduationCap}>
                <ReadField label="Primary Skillset" value={details.skill_matrix?.primary_skillset} />
                <ReadField label="Secondary Skillset" value={details.skill_matrix?.secondary_skillset} />
                <ReadField label="Experience (Years)" value={details.skill_matrix?.experience_years} />
              </Section>

              {/* Education */}
              <Section title="Education" icon={GraduationCap}>
                {Array.isArray(education) && education.length > 0 ? (
                  <div className="col-span-2 space-y-3">
                    {education.map((e, i) => (
                      <div key={i} className="flex justify-between items-center p-4 bg-[#faf7ff] rounded-xl border border-[#f1ebff]">
                        <div>
                          <p className="text-xs font-bold text-black uppercase">{e.degree}</p>
                          <p className="text-[10px] text-[#8b8ba3] uppercase tracking-widest mt-1">{e.university}</p>
                        </div>
                        <span className="text-xs font-black text-[#8b5cf6] font-mono">{e.year}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="col-span-2 text-xs text-black/50 italic">No academic history recorded.</p>
                )}
              </Section>

              {/* Documents */}
              {details?._meta?.can_view_sensitive !== false && (
                <Section title="Documents" icon={FileText}>
                  <div className="col-span-2 space-y-3">
                    <DocLink label="Curriculum Vitae" path={details.cv_path} employeeCode={details.employee_code} docType="cv" />
                    <DocLink label="Identity Proof" path={details.id_proofs} employeeCode={details.employee_code} docType="id_proof" />
                  </div>
                </Section>
              )}

              {/* Notes */}
              <Section title="Notes" icon={FileText}>
                <p className="col-span-2 text-xs text-black/70 whitespace-pre-wrap">{details.notes || 'No notes recorded.'}</p>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 border-b border-[#ece4ff] pb-4">
        <div className="w-8 h-8 rounded-lg bg-[#f4ecff] flex items-center justify-center text-[#7c3aed] border border-[#ddd6fe]">
          <Icon size={14} />
        </div>
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#7B1FFF]">{title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  );
}

function ReadField({ label, value, full }) {
  return (
    <div className={`bg-[#faf7ff] border border-[#f1ebff] rounded-xl p-4 ${full ? 'md:col-span-2' : ''}`}>
      <p className="text-[9px] font-black uppercase tracking-widest text-[#8b8ba3] mb-1.5">{label}</p>
      <p className="text-sm font-bold text-black break-words">{value || value === 0 ? value : '—'}</p>
    </div>
  );
}

function EditableField({ label, value, onChange, disabled, error }) {
  return (
    <div className="bg-white border border-[#ddd6fe] rounded-xl p-4">
      <p className="text-[9px] font-black uppercase tracking-widest text-[#7c3aed] mb-1.5">{label}</p>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className={`w-full bg-[#faf7ff] border rounded-lg px-3 py-2 text-sm font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#c4b5fd] disabled:opacity-50 disabled:cursor-not-allowed ${error ? 'border-red-400' : 'border-[#e9ddff]'}`}
      />
      {error && <p className="text-red-500 text-[9px] font-bold mt-1">{error}</p>}
    </div>
  );
}

function DocLink({ label, path, employeeCode, docType }) {
  const handleView = async () => {
    if (!path) return;
    try {
      const res = await fetch(`/api/employee/${employeeCode}/document/${docType}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch {
      toast.error(`Failed to open ${label}`);
    }
  };

  const handleDownload = async () => {
    if (!path) return;
    try {
      const res = await fetch(`/api/employee/${employeeCode}/document/${docType}?download=true`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = path.split('/').pop() || label;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(`Failed to download ${label}`);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-[#faf7ff] rounded-xl border border-[#f1ebff]">
      <p className="text-xs font-bold text-black">{label}</p>
      {path ? (
        <div className="flex items-center gap-2">
          <button onClick={handleView} className="text-[10px] font-black uppercase tracking-widest text-[#8b5cf6] hover:text-[#7c3aed]">View</button>
          <button onClick={handleDownload} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#8b5cf6] hover:text-[#7c3aed]">
            <Download size={11} /> Download
          </button>
        </div>
      ) : (
        <span className="text-[10px] font-black uppercase tracking-widest text-black/30">Not uploaded</span>
      )}
    </div>
  );
}
