import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { X, ChevronDown, Check, Upload, Send, AlertCircle } from 'lucide-react';
import useEscapeClose from '../../../core/hooks/useEscapeClose';
import {
  isValidEmail,
  isValidPhone,
  isValidPAN,
  isValidBankAccount,
  isValidIFSC,
  validateFile,
  MAX_FILE_SIZE,
} from '../../../core/utils/validators';

// Job/org-structure fields (designation, team, reporting manager, employment
// type, DOJ) are deliberately not requestable here — those are HR-initiated.
const TEXT_FIELDS = [
  { key: 'first_name', label: 'First Name', type: 'text', group: 'Personal' },
  { key: 'middle_name', label: 'Middle Name', type: 'text', group: 'Personal' },
  { key: 'last_name', label: 'Last Name', type: 'text', group: 'Personal' },
  { key: 'dob', label: 'Date of Birth', type: 'date', group: 'Personal' },
  { key: 'contact_number', label: 'Contact Number', type: 'tel', group: 'Personal' },
  { key: 'emergency_contact_first_name', label: 'Emergency Contact First Name', type: 'text', group: 'Personal' },
  { key: 'emergency_contact_middle_name', label: 'Emergency Contact Middle Name', type: 'text', group: 'Personal' },
  { key: 'emergency_contact_last_name', label: 'Emergency Contact Last Name', type: 'text', group: 'Personal' },
  { key: 'emergency_contact', label: 'Emergency Contact Number', type: 'text', group: 'Personal' },
  { key: 'email_id', label: 'Email', type: 'email', group: 'Personal' },
  { key: 'current_address', label: 'Current Address', type: 'textarea', group: 'Personal' },
  { key: 'permanent_address', label: 'Permanent Address', type: 'textarea', group: 'Personal' },
  { key: 'bank_name', label: 'Bank Name', type: 'text', group: 'Financial' },
  { key: 'bank_account_no', label: 'Bank Account No.', type: 'text', group: 'Financial' },
  { key: 'pan_no', label: 'PAN No.', type: 'text', group: 'Financial' },
  { key: 'ifsc_code', label: 'IFSC Code', type: 'text', group: 'Financial' },
  { key: 'primary_skillset', label: 'Primary Skillset', type: 'textarea', group: 'Skills' },
  { key: 'secondary_skillset', label: 'Secondary Skillset', type: 'textarea', group: 'Skills' },
];

const DOC_FIELDS = [
  { key: 'cv_path', label: 'Resume / CV', accept: '.pdf,.doc,.docx', formKey: 'cv_file', group: 'Documents' },
  { key: 'id_proofs', label: 'ID Proof', accept: 'image/jpeg,image/png,image/webp,.pdf', formKey: 'id_proof_file', group: 'Documents' },
  { key: 'passbook_path', label: 'Bank Passbook', accept: 'image/jpeg,image/png,image/webp,.pdf', formKey: 'passbook_file', group: 'Documents' },
];

const ALL_FIELDS = [...TEXT_FIELDS, ...DOC_FIELDS];
const GROUPS = ['Personal', 'Financial', 'Skills', 'Documents'];

const oldValueFor = (details, field) => {
  if (field.key === 'primary_skillset' || field.key === 'secondary_skillset') {
    return details.skill_matrix?.[field.key] || '';
  }
  return details[field.key] || '';
};

export default function RequestEditsModal({ details, rejectedRequest, onClose, onSubmitted }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selected, setSelected] = useState(() => {
    return rejectedRequest?.requested_fields?.map(f => f.field) || [];
  });
  const [fieldValues, setFieldValues] = useState(() => {
    const vals = {};
    if (rejectedRequest?.requested_fields) {
      rejectedRequest.requested_fields.forEach(f => {
        if (!f.is_document) vals[f.field] = f.new_value;
      });
    }
    return vals;
  });
  const [docFiles, setDocFiles] = useState({});
  const [supportingFiles, setSupportingFiles] = useState([]);
  const [notes, setNotes] = useState(rejectedRequest?.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const dropdownRef = useRef(null);
  const supportInputRef = useRef();

  useEscapeClose(onClose, true);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleField = (key) => {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const selectedFieldDefs = ALL_FIELDS.filter(f => selected.includes(f.key));

  const validate = () => {
    if (selectedFieldDefs.length === 0) {
      toast.error('Choose at least one field to edit');
      return false;
    }

    for (const field of selectedFieldDefs) {
      const isDoc = field.group === 'Documents';
      if (isDoc) {
        if (!docFiles[field.key]) {
          toast.error(`Upload a new file for ${field.label}`);
          return false;
        }
        continue;
      }
      const value = (fieldValues[field.key] || '').trim();
      if (!value) {
        toast.error(`Enter the new value for ${field.label}`);
        return false;
      }
      const oldValue = (oldValueFor(details, field) || '').trim();
      if (value.toLowerCase() === oldValue.toLowerCase()) {
        toast.error(`${field.label} can't be same as old one`);
        return false;
      }
      if (field.key === 'email_id' && !isValidEmail(value)) {
        toast.error('Enter a valid email address');
        return false;
      }
      if ((field.key === 'contact_number' || field.key === 'emergency_contact') && !isValidPhone(value)) {
        toast.error(`Enter a valid ${field.label.toLowerCase()} (10 digits)`);
        return false;
      }
      if (field.key === 'pan_no' && !isValidPAN(value)) {
        toast.error('PAN must follow ABCDE1234F format');
        return false;
      }
      if (field.key === 'bank_account_no' && !isValidBankAccount(value)) {
        toast.error('Bank account must be 9-18 digits only');
        return false;
      }
      if (field.key === 'ifsc_code' && !isValidIFSC(value)) {
        toast.error('IFSC must follow ABCD0123456 format');
        return false;
      }
    }

    if (supportingFiles.length === 0) {
      toast.error('Attach at least one supporting document as proof');
      return false;
    }

    return true;
  };

  const handleDocFile = (field, file) => {
    if (!file) return;
    const exts = field.accept.split(',').filter(a => a.startsWith('.'));
    const maxSize = field.key === 'photo_path' ? MAX_FILE_SIZE.image : MAX_FILE_SIZE.document;
    if (exts.length) {
      const err = validateFile(file, exts, maxSize, field.label);
      if (err) { toast.error(err); return; }
    } else if (file.size > maxSize) {
      toast.error(`${field.label} must be ${(maxSize / (1024 * 1024)).toFixed(0)}MB or smaller.`);
      return;
    }
    setDocFiles(prev => ({ ...prev, [field.key]: file }));
  };

  const handleSupportingFiles = (fileList) => {
    const files = Array.from(fileList || []);
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE.document) {
        toast.error(`${f.name} is too large (max 5MB)`);
        return;
      }
    }
    setSupportingFiles(prev => [...prev, ...files]);
  };

  const removeSupportingFile = (idx) => {
    setSupportingFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const textPayload = {};
      selectedFieldDefs.filter(f => f.group !== 'Documents').forEach(f => {
        textPayload[f.key] = fieldValues[f.key];
      });

      const fd = new FormData();
      fd.append('fields', JSON.stringify(textPayload));
      if (notes.trim()) fd.append('notes', notes.trim());
      selectedFieldDefs.filter(f => f.group === 'Documents').forEach(f => {
        fd.append(f.formKey, docFiles[f.key]);
      });
      supportingFiles.forEach(f => fd.append('supporting_files', f));

      const res = await fetch(`/api/employee/${details.employee_code}/edit-requests`, {
        method: 'POST',
        credentials: 'include',
        body: fd
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Failed to submit edit request');

      toast.success('Your changes have been sent for review.');
      onSubmitted?.();
    } catch (e) {
      toast.error(e.message || 'Failed to submit edit request');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-8 overflow-y-auto">
      <div className="bg-white border border-[#ece4ff] rounded-[2rem] p-8 w-full max-w-2xl space-y-6 shadow-[0_20px_50px_rgba(180,140,255,0.2)] max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#7c3aed] mb-1">Self-Service</p>
            <h3 className="text-xl font-black uppercase tracking-tight text-black">Request Profile Edits</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-[#f5efff] text-[#6b7280] hover:bg-[#7c3aed] hover:text-white transition-all">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-black/50 font-medium">
          Your profile stays exactly as it is until a reviewer approves these changes. You'll get a notification once you submit.
        </p>

        {rejectedRequest && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 items-start">
            <AlertCircle size={14} className="text-red-600 mt-0.5 shrink-0" />
            <div className="text-xs text-red-800">
              <p className="font-bold mb-1">Previous request rejected</p>
              {rejectedRequest.review_notes && <p className="mb-2 text-red-700">Reason: {rejectedRequest.review_notes}</p>}
              <p className="text-red-600/80">We've restored your text inputs. Please review them and re-upload any required documents before submitting again.</p>
            </div>
          </div>
        )}

        {/* Field picker dropdown */}
        <div className="relative" ref={dropdownRef}>
          <label className="text-[9px] font-black uppercase tracking-widest text-[#7c3aed] mb-1.5 block">What all do you want to edit?</label>
          <button
            type="button"
            onClick={() => setDropdownOpen(o => !o)}
            className="w-full flex items-center justify-between text-left text-xs px-4 py-3 rounded-xl bg-[#faf7ff] border border-[#ebe4ff] text-black font-semibold focus:outline-none focus:border-[#c084fc]"
          >
            <span>{selected.length ? `${selected.length} field${selected.length > 1 ? 's' : ''} selected` : 'Select fields...'}</span>
            <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute z-10 mt-2 w-full max-h-72 overflow-y-auto bg-white border border-[#ebe4ff] rounded-xl shadow-xl p-2 space-y-1">
              {GROUPS.map(group => (
                <div key={group}>
                  <p className="px-2 pt-2 pb-1 text-[9px] font-black uppercase tracking-widest text-[#8b8ba3]">{group}</p>
                  {ALL_FIELDS.filter(f => f.group === group).map(f => (
                    <label
                      key={f.key}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#faf7ff] cursor-pointer text-xs font-semibold text-black"
                    >
                      <span className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${selected.includes(f.key) ? 'bg-[#7c3aed] border-[#7c3aed] text-white' : 'border-[#ddd6fe]'}`}>
                        {selected.includes(f.key) && <Check size={11} />}
                      </span>
                      <input type="checkbox" className="hidden" checked={selected.includes(f.key)} onChange={() => toggleField(f.key)} />
                      {f.label}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected field editors */}
        {selectedFieldDefs.length > 0 && (
          <div className="space-y-4 max-h-[18rem] overflow-y-auto pr-1 custom-scrollbar">
            {selectedFieldDefs.map(field => (
              <div key={field.key} className="bg-[#faf7ff] border border-[#f1ebff] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[#7c3aed]">{field.label} <span className="text-red-500">*</span></label>
                  <button type="button" onClick={() => toggleField(field.key)} className="text-[9px] font-black uppercase text-black/30 hover:text-red-500">Remove</button>
                </div>

                {field.group === 'Documents' ? (
                  <div>
                    <p className="text-[10px] text-black/40 font-bold mb-2">
                      Current: {details[field.key] ? details[field.key].split('/').pop() : 'Not uploaded'}
                    </p>
                    <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[#ddd6fe] bg-white text-xs font-bold text-[#7c3aed] cursor-pointer hover:border-[#7c3aed] transition-all">
                      <Upload size={13} />
                      {docFiles[field.key] ? docFiles[field.key].name : `Choose new ${field.label.toLowerCase()} file`}
                      <input type="file" hidden accept={field.accept} onChange={e => handleDocFile(field, e.target.files[0])} />
                    </label>
                  </div>
                ) : (
                  <>
                    <p className="text-[10px] text-black/40 font-bold mb-2">Current: {oldValueFor(details, field) || '—'}</p>
                    {field.type === 'textarea' ? (
                      <textarea
                        value={fieldValues[field.key] || ''}
                        onChange={e => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        rows={2}
                        className="w-full text-xs px-4 py-2 rounded-xl outline-none bg-white border border-[#ebe4ff] text-black focus:border-[#c084fc] resize-none"
                        placeholder={`New ${field.label.toLowerCase()}...`}
                      />
                    ) : (
                      <input
                        type={field.type}
                        value={fieldValues[field.key] || ''}
                        onChange={e => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full text-xs px-4 py-2 rounded-xl outline-none bg-white border border-[#ebe4ff] text-black focus:border-[#c084fc]"
                        placeholder={`New ${field.label.toLowerCase()}...`}
                      />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Supporting documents */}
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-[#7c3aed] mb-1.5 block">Supporting Documents <span className="text-red-500">*</span></label>
          <button
            type="button"
            onClick={() => supportInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[#ddd6fe] bg-[#faf7ff] text-xs font-bold text-[#7c3aed] hover:border-[#7c3aed] transition-all"
          >
            <Upload size={13} /> Attach proof (e.g. address proof, updated document)
          </button>
          <input ref={supportInputRef} type="file" hidden multiple onChange={e => { handleSupportingFiles(e.target.files); e.target.value = ''; }} />
          {supportingFiles.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {supportingFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-[#faf7ff] border border-[#f1ebff] rounded-lg text-xs text-black">
                  <span className="truncate">{f.name}</span>
                  <button type="button" onClick={() => removeSupportingFile(i)} className="text-black/30 hover:text-red-500 shrink-0 ml-2"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-[#7c3aed] mb-1.5 block">Reason for change (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full text-xs px-4 py-2 rounded-xl outline-none bg-[#faf7ff] border border-[#ebe4ff] text-black focus:border-[#c084fc] resize-none"
            placeholder="Add context for the reviewer..."
          />
        </div>

        <div className="flex gap-4 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-[#ebe4ff] text-[#6b7280] hover:bg-[#faf7ff] hover:text-black transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white shadow-lg hover:opacity-95 transition-all disabled:opacity-50"
          >
            <Send size={13} /> {submitting ? 'Sending...' : 'Send for Review'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
