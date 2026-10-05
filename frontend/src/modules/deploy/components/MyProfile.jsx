import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../core/auth/AuthContext';
import ChangePasswordModal from '../../../core/auth/ChangePasswordModal';
import RequestEditsModal from './RequestEditsModal';
import {
  MapPin, Phone, Mail, Calendar, Key, AlertCircle,
  CheckCircle, Edit3, TrendingUp,
  Landmark, FileText, ExternalLink, Package, Download, Clock, Home,
  Upload, Trash2
} from 'lucide-react';
import { MAX_FILE_SIZE, validateFile } from '../../../core/utils/validators';
import HorizontalLoader from '../../../core/components/HorizontalLoader';

export default function MyProfile() {
  const { user } = useAuth();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [assets, setAssets] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [rejectedRequest, setRejectedRequest] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInputRef = useRef();

  useEffect(() => {
      if (user?.employee_code) {
          fetchDetails(user.employee_code);
          fetchPendingRequest(user.employee_code);
          fetchLatestDecision(user.employee_code);
          fetch(`/api/assets/${user.employee_code}`, { credentials: 'include' })
              .then(r => r.json()).then(d => setAssets(d)).catch(() => {});
      } else {
          setLoading(false);
      }
  }, [user]);

  const fetchDetails = async (code) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/employee/${code}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDetails(data);
    } catch {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequest = async (code) => {
    try {
      const res = await fetch(`/api/employee/${code}/edit-requests/pending`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setPendingRequest(data || null);
    } catch { /* non-critical */ }
  };

  const fetchLatestDecision = async (code) => {
    try {
      const res = await fetch(`/api/employee/${code}/edit-requests/latest-decision`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setRejectedRequest(data || null);
    } catch { /* non-critical */ }
  };

  const dismissRejectedRequest = async () => {
    if (!rejectedRequest) return;
    try {
      await fetch(`/api/employee/${user.employee_code}/edit-requests/${rejectedRequest.id}/acknowledge`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch { /* non-critical */ } finally {
      setRejectedRequest(null);
    }
  };

  const handlePhotoSelected = async (file) => {
    if (!file) return;
    const error = validateFile(file, ['.jpg', '.jpeg', '.png', '.webp'], MAX_FILE_SIZE.image, 'Profile photo');
    if (error) { toast.error(error); return; }

    setPhotoBusy(true);
    try {
      const fd = new FormData();
      fd.append('photo_file', file);
      const res = await fetch(`/api/employee/${user.employee_code}/documents`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!res.ok) throw new Error();
      toast.success('Profile photo updated');
      fetchDetails(user.employee_code);
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoBusy(true);
    try {
      const res = await fetch(`/api/employee/${user.employee_code}/photo`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      toast.success('Profile photo removed');
      fetchDetails(user.employee_code);
    } catch {
      toast.error('Failed to remove photo');
    } finally {
      setPhotoBusy(false);
    }
  };

  if (loading) return <HorizontalLoader label="Loading dashboard..." />;

  if (!details || !user?.employee_code) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
         <div className="w-20 h-20 rounded-[1.6rem] bg-error/10 border border-error/20 flex items-center justify-center text-error mb-6">
            <AlertCircle size={32} />
         </div>
         <h2 className="text-3xl font-display font-black text-black uppercase tracking-tighter mb-2">Employee Link <span className="text-error">Required</span></h2>
         <p className="text-black text-xs max-w-md uppercase tracking-widest leading-relaxed">
            Your profile cannot be accessed without an active personnel sequence. <br/>
            Return to the Management portal and complete an Outbound Invite.
         </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-fade-in-up pb-10">
      {/* Action Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-[1.5rem] border border-[#ece4ff] shadow-sm">
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#6b7280] italic">My Profile // Self Management</h2>
        <div className="flex gap-3">
          <button
              onClick={() => setShowPwdModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black hover:text-[#7c3aed] transition-all"
          >
              <Key size={14} />
              Update Key
          </button>

          <button
              onClick={() => setShowRequestModal(true)}
              disabled={!!pendingRequest}
              title={pendingRequest ? 'You already have an edit request pending review' : undefined}
              className="flex items-center gap-2 px-8 py-2 bg-white border border-[#ece4ff] rounded-[1.2rem] text-black text-[10px] font-black uppercase tracking-widest hover:bg-[#7c3aed] hover:text-white hover:border-[#7c3aed] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-black disabled:hover:border-[#ece4ff]"
          >
              <Edit3 size={14} />
              Request Edits
          </button>
        </div>
      </div>

      {rejectedRequest && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-[1.5rem] px-6 py-4">
          <AlertCircle size={16} className="text-red-600 shrink-0" />
          <p className="text-xs font-bold text-red-700 flex-1">
            Your edits were rejected ({(rejectedRequest.requested_fields || []).map(f => f.label).join(', ')}).
            {rejectedRequest.review_notes ? ` Reason: ${rejectedRequest.review_notes}` : ''}
          </p>
          <button
            onClick={dismissRejectedRequest}
            className="text-[10px] font-black uppercase tracking-widest text-red-700 hover:text-red-900 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {pendingRequest && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-[1.5rem] px-6 py-4">
          <Clock size={16} className="text-amber-600 shrink-0" />
          <p className="text-xs font-bold text-amber-700">
            You have an edit request pending review ({(pendingRequest.requested_fields || []).map(f => f.label).join(', ')}). Your profile will stay as-is until it's reviewed.
          </p>
        </div>
      )}

      {/* Profile Hero */}
      <div className="bg-white border border-[#ece4ff] rounded-[2rem] p-7 shadow-[0_10px_40px_rgba(180,140,255,0.08)] flex flex-col md:flex-row items-start gap-8 relative overflow-hidden">

        <div className="group relative w-24 h-24 rounded-[1.6rem] bg-gradient-to-br from-[#b784f7] to-[#8b5cf6] flex items-center justify-center text-white font-display font-black text-4xl shrink-0 shadow-[0_0_30px_rgba(204,151,255,0.2)] overflow-hidden">
            {details.photo_path ? (
                <img
                  src={`/api/employee/${details.employee_code}/document/pfp`}
                  className="w-full h-full object-cover"
                  alt=""
                />
            ) : (
                details.name?.[0] || 'U'
            )}

            {/* Hover overlay — upload/remove photo directly, no approval needed */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoBusy}
                    title="Upload photo"
                    className="p-2 rounded-lg bg-white/15 text-white hover:bg-white/25 transition-colors disabled:opacity-50"
                >
                    <Upload size={16} />
                </button>
                {details.photo_path && (
                    <button
                        type="button"
                        onClick={handleRemovePhoto}
                        disabled={photoBusy}
                        title="Remove photo"
                        className="p-2 rounded-lg bg-white/15 text-white hover:bg-red-500/70 transition-colors disabled:opacity-50"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
            <input
                ref={photoInputRef}
                type="file"
                hidden
                accept="image/jpeg,image/png,image/webp"
                onChange={e => { handlePhotoSelected(e.target.files[0]); e.target.value = ''; }}
            />
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-black mb-1">
                {details.employee_code} // {details.role || user?.role}
            </p>
            <h1 className="text-3xl font-display font-black text-black uppercase tracking-tighter italic">
                {details.name}
            </h1>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mt-2">
                <p className="text-sm text-black font-bold uppercase tracking-widest">{details.designation} · {details.team}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
            <ProfileField icon={Mail} label="Email" value={details.email_id} />
            <ProfileField icon={Phone} label="Contact" value={details.contact_number} />
            <ProfileField icon={MapPin} label="Work Location" value={details.location} />
            <ProfileField icon={Calendar} label="Date of Birth" value={(details.dob || '').split('T')[0]} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
              {/* Skills */}
              <div className="bg-white border border-[#ece4ff] rounded-[1.8rem] p-8">
                <SectionHeader icon={TrendingUp} title="Skills & Expertise" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#7B1FFF] mb-3">Primary Skills</p>
                        <div className="flex flex-wrap gap-2">
                            {(details.skill_matrix?.primary_skillset || '').split(',').filter(s => s.trim()).map((s, i) => (
                                <span key={i} className="px-2 py-1 bg-[#ede9fe] text-[#6d28d9] text-[9px] font-bold uppercase rounded-lg border border-[#ddd6fe]">
                                    {s.trim()}
                                </span>
                            ))}
                            {!(details.skill_matrix?.primary_skillset || '').trim() && (
                                <span className="text-xs text-black/30">Not recorded</span>
                            )}
                        </div>
                    </div>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#7B1FFF] mb-3">Secondary Skills</p>
                        <div className="flex flex-wrap gap-2">
                            {(details.skill_matrix?.secondary_skillset || '').split(',').filter(s => s.trim()).map((s, i) => (
                                <span key={i} className="px-2 py-1 bg-[#f4ecff] text-black text-[9px] font-bold uppercase rounded-lg border border-[#ece4ff]">
                                    {s.trim()}
                                </span>
                            ))}
                            {!(details.skill_matrix?.secondary_skillset || '').trim() && (
                                <span className="text-xs text-black/30">Not recorded</span>
                            )}
                        </div>
                    </div>
                </div>
              </div>

              {/* Identity Documents */}
              <div className="bg-white border border-[#ece4ff] rounded-[1.8rem] p-8">
                <SectionHeader icon={FileText} title="Documents" />
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FileCard label="CV / Resume" path={details.cv_path} employeeCode={details.employee_code} docType="cv" />
                    <FileCard label="ID Compliance" path={details.id_proofs} employeeCode={details.employee_code} docType="id_proof" />
                    <FileCard label="Bank Passbook" path={details.passbook_path} employeeCode={details.employee_code} docType="passbook" />
                </div>
              </div>

              {/* Detailed Allocation List */}
              <div className="bg-white border border-[#ece4ff] rounded-[1.8rem] overflow-hidden">
                <div className="p-6 border-b border-[#ece4ff] flex items-center justify-between">
                    <SectionHeader icon={Package} title="Allocated Assets" />
                </div>

                <div className="p-2 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-black/[0.06]">
                    {/* Onboarding Section */}
                    <div className="space-y-1 md:pr-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                        <div className="px-4 py-2 bg-black/5 rounded-lg mb-2">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#7c3aed] italic">I. Onboarding Checklist</p>
                        </div>
                        {[
                            { key: 'ob_laptop', label: 'Laptop Unit' },
                            { key: 'ob_laptop_bag', label: 'Laptop Bag' },
                            { key: 'ob_headphones', label: 'Headphones' },
                            { key: 'ob_mouse', label: 'External Mouse' },
                            { key: 'ob_id_card', label: 'Identity Card' },
                            { key: 'ob_email_access', label: 'Email Access' },
                            { key: 'ob_groups', label: 'Group Access' },
                            { key: 'ob_mediclaim', label: 'Mediclaim Status' },
                            { key: 'ob_pf', label: 'Provident Fund' }
                        ].map(a => (
                            <div key={a.key} className="flex items-center justify-between p-3 px-6 hover:bg-black/5 transition-colors border-b border-black/[0.02] last:border-0 group">
                                <span className="text-[10px] font-medium uppercase tracking-widest text-black transition-colors">{a.label}</span>
                                {assets?.[a.key] ? (
                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-[8px] font-black uppercase border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
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
                        <div className="px-4 py-2 bg-black/5 rounded-lg mb-2">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#7c3aed] italic">II. Access Permissions</p>
                        </div>
                        {[
                            { key: 'cl_laptop', label: 'Laptop Returned' },
                            { key: 'cl_laptop_bag', label: 'Bag Returned' },
                            { key: 'cl_assets_verified', label: 'Assets Verified' },
                            { key: 'cl_id_card', label: 'ID Surrendered' },
                            { key: 'cl_email_disabled', label: 'Email Disabled' },
                            { key: 'cl_groups_removed', label: 'Access Purged' },
                            { key: 'cl_accounts_clearance', label: 'Finance Cleared' }
                        ].map(a => (
                            <div key={a.key} className="flex items-center justify-between p-3 px-6 hover:bg-black/5 transition-colors border-b border-black/[0.02] last:border-0 group">
                                <span className="text-[10px] font-medium uppercase tracking-widest text-black transition-colors">{a.label}</span>
                                {assets?.[a.key] ? (
                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full text-[8px] font-black uppercase border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                                        <CheckCircle size={8} /> Cleared
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
              </div>
          </div>

          <div className="space-y-6">
              {/* DOJ */}
              <div className="bg-white border border-[#ece4ff] rounded-[1.8rem] p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                    <Calendar size={12} className="text-[#7c3aed]" />
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#7B1FFF]">DOJ</p>
                </div>
                <p className="text-xs font-normal text-black">{(details.doj || '').split('T')[0] || '—'}</p>
              </div>

              {/* Address Details */}
              <div className="bg-white border border-[#ece4ff] rounded-[1.8rem] p-8 shadow-sm">
                <SectionHeader icon={Home} title="Location Details" />
                <div className="mt-6 space-y-4">
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#7B1FFF] mb-1">Current Address</p>
                        <p className="text-xs text-black">{details.current_address || 'Unregistered'}</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#7B1FFF] mb-1">Permanent Address</p>
                        <p className="text-xs text-black">{details.permanent_address || 'Unregistered'}</p>
                    </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="bg-white border border-[#ece4ff] rounded-[1.8rem] p-8 shadow-sm">
                <SectionHeader icon={Phone} title="Emergency Contact" />
                <div className="mt-6 space-y-4">
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#7B1FFF] mb-1">Contact Name</p>
                        <p className="text-xs text-black">
                            {[details.emergency_contact_first_name, details.emergency_contact_middle_name, details.emergency_contact_last_name]
                                .filter(Boolean).join(' ') || 'Not registered'}
                        </p>
                    </div>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#7B1FFF] mb-1">Contact Number</p>
                        <p className="text-xs text-black">{details.emergency_contact || 'Not registered'}</p>
                    </div>
                </div>
              </div>

              {/* Financial Details */}
              <div className="bg-white border border-[#ece4ff] rounded-[1.8rem] p-8 shadow-sm">
                <SectionHeader icon={Landmark} title="Financial Details" />
                <div className="mt-6 space-y-4">
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#7B1FFF] mb-1">Bank Name</p>
                        <p className="text-xs text-black">{details.bank_name || 'Not recorded'}</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#7B1FFF] mb-1">Bank Account No.</p>
                        <p className="text-xs text-black">{details.bank_account_no || 'Not recorded'}</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#7B1FFF] mb-1">PAN No.</p>
                        <p className="text-xs text-black uppercase">{details.pan_no || 'Not recorded'}</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#7B1FFF] mb-1">IFSC Code</p>
                        <p className="text-xs text-black uppercase">{details.ifsc_code || 'Not recorded'}</p>
                    </div>
                </div>
              </div>
          </div>
          {showPwdModal && <ChangePasswordModal onClose={() => setShowPwdModal(false)} />}
          {showRequestModal && (
            <RequestEditsModal
              details={details}
              rejectedRequest={rejectedRequest}
              onClose={() => setShowRequestModal(false)}
              onSubmitted={() => {
                setShowRequestModal(false);
                fetchPendingRequest(details.employee_code);
                if (rejectedRequest) {
                  dismissRejectedRequest();
                }
              }}
            />
          )}
      </div>
    </div>
  );
}

function ProfileField({ icon: Icon, label, value }) {
    return (
        <div className="bg-[#f4ecff] border border-[#ddd6fe] rounded-2xl px-4 py-3 hover:border-[#7c3aed] hover:shadow-md hover:shadow-[#7c3aed]/10 transition-all">
            <div className="flex items-center gap-2 mb-2">
                <Icon size={12} className="text-[#7c3aed]" />
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#7B1FFF]">{label}</p>
            </div>
            <p className="text-xs font-normal text-black truncate">{value || '—'}</p>
        </div>
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

function FileCard({ label, path, employeeCode, docType }) {
    // Served through a backend endpoint (reads the file server-side, or redirects
    // to a presigned S3 URL) rather than a raw static path — locally-stored files
    // aren't reachable via any static file route. Inline by default (for viewing);
    // ?download=true forces a "Save As" download instead.
    const getFileUrl = (download = false) =>
        `/api/employee/${employeeCode}/document/${docType}${download ? '?download=true' : ''}`;

    const handleView = () => {
        if (!path) {
            toast.error("Document not uploaded yet");
            return;
        }
        window.open(getFileUrl(), '_blank');
    };

    const handleDownload = async (event) => {
        event.stopPropagation();
        if (!path) return;

        try {
            const url = getFileUrl(true);
            const response = await fetch(url, { credentials: 'include' });
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
        <div
            onClick={path ? handleView : undefined}
            className={`flex items-center justify-between p-4 bg-[#f8f5ff] rounded-xl border border-[#e9ddff] group transition-all ${path ? 'cursor-pointer hover:border-[#c4b5fd] hover:shadow-md hover:shadow-[#7c3aed]/10' : ''}`}
        >
            <div className="flex items-center gap-3">
                <FileText
                    size={16}
                    className={`transition-colors ${path ? 'text-[#7c3aed] group-hover:text-[#6d28d9]' : 'text-slate-400'}`}
                />
                <span className={`text-[10px] font-black uppercase tracking-widest ${path ? 'text-black' : 'text-slate-400'}`}>
                    {label}
                </span>
            </div>

            {path && (
                <div className="flex items-center gap-2">
                    <ExternalLink size={14} className="text-[#c4b5fd] group-hover:text-[#7c3aed] transition-colors" />
                    <button
                        type="button"
                        onClick={handleDownload}
                        title="Download file"
                        className="p-1.5 rounded-lg border border-[#e9ddff] bg-white text-[#7c3aed] hover:bg-[#7c3aed] hover:text-white transition-all"
                    >
                        <Download size={12} />
                    </button>
                </div>
            )}
        </div>
    );
}
