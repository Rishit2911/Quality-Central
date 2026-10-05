import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { X, FileText, ExternalLink, Check, Ban } from 'lucide-react';
import useEscapeClose from '../../../core/hooks/useEscapeClose';
import { usePermissions } from '../../../core/auth/usePermissions';
import { P } from '../../../core/permissions';

// Maps our internal document field keys to the existing employee-document
// viewer's doc_type strings, so "Current" can reuse that endpoint.
const CURRENT_DOC_TYPE = {
  photo_path: 'photo',
  cv_path: 'cv',
  id_proofs: 'id_proof',
  passbook_path: 'passbook',
};

export default function EditRequestReviewPanel({ request, onClose, onReviewed }) {
  const { hasPermission } = usePermissions();
  const canApprove = hasPermission(P.DEPLOY_EMP_APPROVE_BASIC);

  const [rejecting, setRejecting] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEscapeClose(onClose, true);

  if (!request) return null;

  const fields = request.requested_fields || [];
  const supportingDocs = request.supporting_docs || [];

  const viewCurrentDoc = (field) => {
    const docType = CURRENT_DOC_TYPE[field];
    window.open(`/api/employee/${request.employee_code}/document/${docType}`, '_blank');
  };

  const viewNewFieldDoc = (field) => {
    window.open(`/api/employee-edit-requests/${request.id}/preview/field/${field}`, '_blank');
  };

  const viewSupportingDoc = (idx) => {
    window.open(`/api/employee-edit-requests/${request.id}/preview/support/${idx}`, '_blank');
  };

  const submitDecision = async (decision) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/employee-edit-requests/${request.id}/review`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, review_notes: reviewNotes.trim() || null })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Failed to submit review');
      toast.success(decision === 'approve' ? 'Changes approved and applied to the profile' : 'Request rejected');
      onReviewed?.();
    } catch (e) {
      toast.error(e.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = () => {
    if (!window.confirm('Approve these changes? They will be applied to the employee\'s profile immediately.')) return;
    submitDecision('approve');
  };

  const confirmReject = () => {
    submitDecision('reject');
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl h-full bg-white border-l border-[#ebe4ff] animate-slide-in-right overflow-y-auto custom-scrollbar">
        <div className="p-10 space-y-8">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex gap-5 items-center">
              <div className="w-16 h-16 rounded-2xl bg-[#f3e8ff] text-[#8b5cf6] border border-[#ebe4ff] flex items-center justify-center font-black text-2xl overflow-hidden shrink-0">
                {request.photo_path ? (
                  <img
                    src={`/api/employee/${request.employee_code}/document/pfp`}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                ) : (
                  (request.employee_name || '?')[0]
                )}
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter italic text-black">{request.employee_name}</h2>
                <p className="text-[10px] text-[#8b8ba3] font-mono uppercase mt-1">{request.employee_code}</p>
                <span className="inline-block mt-2 px-3 py-1 rounded-lg bg-amber-500/10 text-amber-600 text-[8px] font-black uppercase tracking-widest border border-amber-500/20">
                  Pending Review
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-[#f5efff] text-[#6b7280] hover:bg-[#8b5cf6] hover:text-white transition-all">
              <X size={16} />
            </button>
          </div>

          {request.notes && (
            <div className="bg-[#faf7ff] border border-[#f1ebff] rounded-xl p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#8b8ba3] mb-1.5">Reason given by employee</p>
              <p className="text-xs text-black whitespace-pre-wrap">{request.notes}</p>
            </div>
          )}

          {/* Requested changes */}
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7B1FFF]">Requested Changes</p>
            {fields.map((f, i) => (
              <div key={i} className="border border-[#f1ebff] rounded-2xl overflow-hidden">
                <div className="px-5 py-3 bg-[#faf7ff] border-b border-[#f1ebff]">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#7c3aed]">{f.label}</p>
                </div>
                {f.is_document ? (
                  <div className="grid grid-cols-2 divide-x divide-[#f1ebff]">
                    <div className="p-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-black/30 mb-2">Current</p>
                      {f.old_value ? (
                        <button onClick={() => viewCurrentDoc(f.field)} className="flex items-center gap-1.5 text-xs font-bold text-[#7c3aed] hover:text-[#6d28d9]">
                          <FileText size={13} /> View current <ExternalLink size={11} />
                        </button>
                      ) : (
                        <p className="text-xs text-black/30 italic">Not uploaded</p>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-2">Requested</p>
                      <button onClick={() => viewNewFieldDoc(f.field)} className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700">
                        <FileText size={13} /> View new file <ExternalLink size={11} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 divide-x divide-[#f1ebff]">
                    <div className="p-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-black/30 mb-2">Current</p>
                      <p className="text-xs text-black/60 break-words">{f.old_value || '—'}</p>
                    </div>
                    <div className="p-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-2">Requested</p>
                      <p className="text-xs font-bold text-black break-words">{f.new_value || '—'}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Supporting docs */}
          {supportingDocs.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7B1FFF]">Supporting Documents</p>
              {supportingDocs.map((doc, idx) => (
                <button
                  key={idx}
                  onClick={() => viewSupportingDoc(idx)}
                  className="w-full flex items-center justify-between p-4 bg-[#faf7ff] rounded-xl border border-[#f1ebff] hover:border-[#c4b5fd] transition-all text-left"
                >
                  <span className="flex items-center gap-2 text-xs font-bold text-black">
                    <FileText size={14} className="text-[#7c3aed]" /> {doc.label}
                  </span>
                  <ExternalLink size={13} className="text-[#c4b5fd]" />
                </button>
              ))}
            </div>
          )}

          {/* Decision */}
          <div className="pt-4 border-t border-[#ece4ff] space-y-4">
            {rejecting && (
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-[#7c3aed]">Reason for rejection (optional)</label>
                <textarea
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  rows={2}
                  className="w-full text-xs px-4 py-2 rounded-xl outline-none bg-[#faf7ff] border border-[#ebe4ff] text-black focus:border-[#c084fc] resize-none"
                  placeholder="Let the employee know why..."
                />
              </div>
            )}

            {canApprove ? (
              <div className="flex gap-4">
                {rejecting ? (
                  <>
                    <button
                      onClick={() => setRejecting(false)}
                      disabled={submitting}
                      className="flex-1 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-[#ebe4ff] text-[#6b7280] hover:bg-[#faf7ff] transition-all disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmReject}
                      disabled={submitting}
                      className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] bg-red-500 text-white shadow-lg hover:bg-red-600 transition-all disabled:opacity-50"
                    >
                      <Ban size={13} /> {submitting ? 'Submitting...' : 'Confirm Rejection'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setRejecting(true)}
                      disabled={submitting}
                      className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-red-200 text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                      <Ban size={13} /> Reject
                    </button>
                    <button
                      onClick={handleAccept}
                      disabled={submitting}
                      className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
                    >
                      <Check size={13} /> {submitting ? 'Submitting...' : 'Accept'}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="p-3 text-center rounded-xl bg-gray-50 border border-gray-200 text-xs font-medium text-gray-500">
                View only — missing permission to review edit requests
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
