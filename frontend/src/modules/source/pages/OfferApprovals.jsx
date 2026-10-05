import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, CheckCircle, XCircle, AlertCircle, Send,
  Clock, Loader2, RefreshCw, Briefcase, DollarSign, MapPin, Calendar, Mail, MessageSquare, ExternalLink, Download
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../core/auth/AuthContext';
import { Link } from 'react-router-dom';

const OFFER_STATUS_STYLE = {
  pending:           'bg-amber-100 text-amber-700 border-amber-200',
  approved:          'bg-emerald-100 text-emerald-700 border-emerald-200',
  changes_requested: 'bg-orange-100 text-orange-700 border-orange-200',
  sent:              'bg-violet-100 text-violet-700 border-violet-200',
  rejected:          'bg-rose-100 text-rose-700 border-rose-200',
};

const OFFER_STATUS_ICON = {
  pending:           <Clock size={12} />,
  approved:          <CheckCircle size={12} />,
  changes_requested: <AlertCircle size={12} />,
  sent:              <Send size={12} />,
  rejected:          <XCircle size={12} />,
};

function StatusBadge({ status }) {
  const s = (status || 'pending').toLowerCase();
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-semibold tracking-widest ${OFFER_STATUS_STYLE[s] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
      {OFFER_STATUS_ICON[s]} {s.replace('_', ' ')}
    </span>
  );
}

export default function OfferApprovals() {
  const { hasPermission } = useAuth();
  
  // PBAC Definition
  const canManage = hasPermission('source.offers.manage');
  const canApprove = hasPermission('source.offers.approve');

  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Inline editing state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [actionFeedback, setActionFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const downloadOfferPdf = async (offer) => {
    try {
      const response = await fetch(`/api/source/offers/${offer.id}/preview`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error();

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `offer_${offer.candidate_name || offer.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error('Failed to download offer PDF');
    }
  };

  // Unwrap nested offer_content structure from DB: { content: { offer_content: {...} } }
  const unwrapContent = (raw) => {
    if (!raw) return null;
    let parsed = raw;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { return null; }
    }
    // Handle nested: { content: { offer_content: { ... } } }
    if (parsed?.content?.offer_content) return parsed.content.offer_content;
    // Handle single nesting: { offer_content: { ... } }
    if (parsed?.offer_content && typeof parsed.offer_content === 'object') return parsed.offer_content;
    // Already flat
    return parsed;
  };

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterStatus === 'all' 
        ? '/api/source/offers' 
        : `/api/source/offers?status=${filterStatus}`;
      const r = await fetch(url, { credentials: 'include' });
      const d = await r.json();
      if (r.ok) {
        setOffers(d.data || []);
      } else {
        toast.error(d.detail || 'Failed to load offers');
      }
    } catch { 
      toast.error('Network error'); 
    } finally { 
      setLoading(false); 
    }
  }, [filterStatus]);

  useEffect(() => { 
    fetchOffers(); 
    setEditingId(null);
  }, [fetchOffers]);

  const startEditing = (offer) => {
    setEditingId(offer.id);
    let parsedContent = unwrapContent(offer.offer_content);
    
    // Ensure body_paragraphs exist for editing
    let body_paragraphs = [];
    if (parsedContent && Array.isArray(parsedContent.body_paragraphs)) {
      body_paragraphs = parsedContent.body_paragraphs;
    } else if (parsedContent && typeof parsedContent.body === 'string') {
      body_paragraphs = parsedContent.body.split('\n\n');
    }
    
    setEditForm({ 
      ...offer, 
      offer_content: { ...(parsedContent || {}), body_paragraphs } 
    });
  };

  const handleUpdate = async () => {
    setIsSubmitting(true);
    try {
      const r = await fetch(`/api/source/offers/${editingId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_title: editForm.role_title,
          salary: editForm.salary,
          location: editForm.location,
          start_date: editForm.start_date,
          department: editForm.department,
          offer_content: editForm.offer_content
        })
      });
      if (r.ok) {
        toast.success('Offer updated successfully');
        setEditingId(null);
        fetchOffers();
      } else {
        const d = await r.json();
        toast.error(d.detail || 'Update failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const doAction = async (id, action, feedbackText = '') => {
    if (action === 'approve' && !window.confirm('Approve this offer? It will be locked for the manager to send.')) return;
    if (action === 'reject' && !window.confirm('Reject this offer entirely?')) return;
    if (action === 'send' && !window.confirm('Send this offer letter to the candidate now?')) return;

    setIsSubmitting(true);
    try {
      const r = await fetch(`/api/source/offers/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedbackText || '' })
      });
      if (r.ok) {
        toast.success(`Offer ${action}d successfully`);
        setActionFeedback('');
        fetchOffers();
      } else {
        const d = await r.json();
        // d.detail can be a string or a Pydantic validation error array
        const msg = typeof d.detail === 'string'
          ? d.detail
          : Array.isArray(d.detail)
            ? d.detail.map(e => e.msg || JSON.stringify(e)).join(', ')
            : `Failed to ${action}`;
        toast.error(msg);
      }
    } catch {
      toast.error('Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestChanges = (id) => {
    if (!actionFeedback.trim()) return toast.error('Please provide feedback for the changes required.');
    doAction(id, 'request-changes', actionFeedback);
  };

  const handleReject = (id) => {
    doAction(id, 'reject', actionFeedback);
  };

  return (
    <div className="flex flex-col gap-6 h-full bg-slate-50 p-6">

      {/* Filter Bar */}
      <div className="flex flex-col gap-4 rounded-[32px] border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold uppercase tracking-widest text-slate-500">Filter</span>
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 uppercase tracking-wider outline-none focus:border-violet-400 transition-colors"
          >
            <option className="bg-white text-black" value="pending">Pending Review</option>
            <option className="bg-white text-black" value="changes_requested">Changes Requested</option>
            <option className="bg-white text-black" value="approved">Approved</option>
            <option className="bg-white text-black" value="sent">Sent</option>
            <option className="bg-white text-black" value="rejected">Rejected</option>
            <option className="bg-white text-black" value="all">All Offers</option>
          </select>

          <button
            onClick={fetchOffers}
            className="p-3.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors duration-150"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
            <Loader2 size={32} className="animate-spin text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-widest">Loading offers...</span>
          </div>
        ) : offers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center mx-auto max-w-2xl rounded-[32px] border border-slate-200 bg-white shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Clock size={32} />
            </div>
            <div>
              <p className="text-lg font-black text-slate-900">No {filterStatus !== 'all' ? filterStatus.replace('_', ' ') : ''} offers found</p>
              <p className="text-sm font-medium text-slate-500 mt-1">
                {canManage 
                  ? 'Generate offers from candidate profiles to see them here.' 
                  : 'There are no offers matching this status waiting for your review.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {offers.map((offer) => {
              const isEditing = editingId === offer.id;
              const current = isEditing ? editForm : offer;
              const status = (offer.status || 'pending').toLowerCase();
              
              // As clarified: HR is Manager. Admin (org_admin) cannot edit ever.
              // Manager can ONLY edit when changes_requested.
              const canEditThis = canManage && status === 'changes_requested';
              
              const canSendThis = canManage && status === 'approved';
              const canApproveThis = canApprove && status === 'pending';

              // Unwrap the nested offer_content from DB
              let parsedContent = unwrapContent(current.offer_content);

              return (
                <div key={offer.id} className={`bg-white rounded-[28px] p-0 overflow-hidden border shadow-sm transition-colors ${isEditing ? 'border-primary/50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="flex flex-col xl:flex-row min-h-[320px]">
                    
                    {/* Left Panel: Summary Grid */}
                    <div className="flex-1 p-8 border-b xl:border-b-0 xl:border-r border-slate-200 bg-white">
                      <div className="flex items-start justify-between mb-8">
                        <div>
                          <h4 className="text-2xl font-display font-black text-black tracking-tight">{offer.candidate_name || '—'}</h4>
                          <div className="flex items-center gap-2 mt-2 text-gray-400 text-sm font-medium">
                            <Mail size={14} /> {offer.candidate_email || 'No email provided'}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Link to={`/source/directory/${offer.candidate_id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors text-[10px] font-semibold uppercase tracking-widest">
                            <ExternalLink size={12} /> View Profile
                          </Link>
                          
                          {canEditThis && !isEditing && (
                            <button 
                              onClick={() => startEditing(offer)}
                              className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors text-[10px] font-black uppercase tracking-widest"
                            >
                              Edit Details
                            </button>
                          )}
                          <StatusBadge status={offer.status} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Role */}
                        <div className="flex gap-4 p-4 rounded-3xl bg-white border border-slate-200 shadow-sm">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                            <Briefcase size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Role Title</div>
                            {isEditing ? (
                              <input 
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-black font-bold outline-none focus:border-primary/50"
                                value={current.role_title || ''}
                                onChange={e => setEditForm({...editForm, role_title: e.target.value})}
                              />
                            ) : (
                              <div className="font-bold text-black text-base truncate">{offer.role_title || '—'}</div>
                            )}
                          </div>
                        </div>

                        {/* Comp */}
                        <div className="flex gap-4 p-4 rounded-3xl bg-white border border-slate-200 shadow-sm">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                            <DollarSign size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Compensation</div>
                            {isEditing ? (
                              <input 
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-black font-bold outline-none focus:border-primary/50"
                                value={current.salary || ''}
                                onChange={e => setEditForm({...editForm, salary: e.target.value})}
                              />
                            ) : (
                              <div className="font-bold text-black text-base truncate">{offer.salary || '—'}</div>
                            )}
                          </div>
                        </div>

                        {/* Date */}
                        <div className="flex gap-4 p-4 rounded-3xl bg-white border border-slate-200 shadow-sm">
                          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                            <Calendar size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Start Date</div>
                            {isEditing ? (
                              <input 
                                type="date"
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-black font-bold outline-none focus:border-primary/50"
                                value={current.start_date ? new Date(current.start_date).toISOString().split('T')[0] : ''}
                                onChange={e => setEditForm({...editForm, start_date: e.target.value})}
                              />
                            ) : (
                              <div className="font-bold text-black text-base truncate">{offer.start_date ? new Date(offer.start_date).toLocaleDateString() : 'TBD'}</div>
                            )}
                          </div>
                        </div>

                        {/* Location */}
                        <div className="flex gap-4 p-4 rounded-3xl bg-white border border-slate-200 shadow-sm">
                          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                            <MapPin size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Location</div>
                            {isEditing ? (
                              <input 
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-black font-bold outline-none focus:border-primary/50"
                                value={current.location || ''}
                                onChange={e => setEditForm({...editForm, location: e.target.value})}
                              />
                            ) : (
                              <div className="font-bold text-black text-base truncate">{offer.location || 'Remote'}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Panel: Content Review & Actions */}
                    <div className="w-full xl:w-[500px] bg-white p-8 flex flex-col h-full border-t xl:border-t-0 xl:border-l border-slate-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                          <FileText size={14} /> Offer Letter Document
                        </div>
                        {!isEditing && (
                          <div className="flex items-center gap-2">
                            <a
                              href={`/api/source/offers/${offer.id}/preview`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-[10px] font-semibold uppercase tracking-widest"
                            >
                              <ExternalLink size={12} /> Preview PDF
                            </a>
                            <button
                              type="button"
                              onClick={() => downloadOfferPdf(offer)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-[10px] font-semibold uppercase tracking-widest"
                            >
                              <Download size={12} /> Download
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 bg-slate-50 border border-slate-200 rounded-3xl p-6 overflow-y-auto shadow-sm text-sm text-slate-700">
                        {isEditing ? (
                          <div className="flex flex-col gap-4">
                            <div>
                              <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Subject</label>
                              <input 
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-primary/50"
                                value={parsedContent?.subject || ''}
                                onChange={e => setEditForm({
                                  ...editForm,
                                  offer_content: { ...editForm.offer_content, subject: e.target.value }
                                })}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Body Paragraphs (Separated by double newlines)</label>
                              <textarea 
                                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-black outline-none focus:border-primary/50 resize-y min-h-[250px] font-mono leading-relaxed"
                                value={(parsedContent?.body_paragraphs || []).join('\n\n')}
                                onChange={e => setEditForm({
                                  ...editForm,
                                  offer_content: { ...editForm.offer_content, body_paragraphs: e.target.value.split('\n\n') }
                                })}
                              />
                            </div>
                          </div>
                        ) : parsedContent ? (
                          <div className="flex flex-col gap-4">
                            {parsedContent.subject && (
                              <div className="font-bold text-black border-b border-gray-100 pb-4">
                                Subject: {parsedContent.subject}
                              </div>
                            )}
                            {parsedContent.salutation && (
                              <div className="text-black font-medium">{parsedContent.salutation}</div>
                            )}
                            <div className="whitespace-pre-wrap leading-relaxed space-y-4">
                              {(parsedContent.body_paragraphs || [parsedContent.body]).flat().filter(Boolean).map((p, i) => (
                                <p key={i}>{p}</p>
                              ))}
                            </div>
                            {(parsedContent.closing || parsedContent.signatory_name) && (
                              <div className="pt-4 border-t border-gray-100 mt-4">
                                {parsedContent.closing && <p>{parsedContent.closing}</p>}
                                {parsedContent.signatory_name && <p className="font-bold text-black mt-2">{parsedContent.signatory_name}</p>}
                                {parsedContent.signatory_title && <p className="text-xs text-gray-400">{parsedContent.signatory_title}</p>}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center italic text-gray-400 py-10">No detailed content generated.</div>
                        )}
                      </div>

                      {/* Feedback Warning (if present) */}
                      {!isEditing && offer.feedback && (
                        <div className="mt-4 p-4 rounded-3xl bg-orange-50 border border-orange-200 text-orange-700 flex items-start gap-3">
                          <MessageSquare size={16} className="shrink-0 mt-0.5" />
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">Feedback / Requested Changes</div>
                            <div className="text-sm font-medium leading-relaxed">{offer.feedback}</div>
                          </div>
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="mt-6 pt-6 border-t border-slate-200">
                        {isEditing ? (
                          <div className="flex flex-col gap-3 sm:flex-row">
                            <button onClick={handleUpdate} disabled={isSubmitting} className="flex-1 py-3 rounded-2xl bg-indigo-600 text-white font-semibold uppercase tracking-widest text-xs hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2">
                              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Save Changes
                            </button>
                            <button onClick={() => setEditingId(null)} className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-700 font-semibold uppercase tracking-widest text-xs hover:bg-slate-200 transition-colors">
                              Cancel
                            </button>
                          </div>
                        ) : canApproveThis ? (
                          <div className="flex flex-col gap-4">
                            <div>
                              <label htmlFor={`action-feedback-${offer.id}`} className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1 block">
                                Feedback <span className="text-red-500">*</span>
                              </label>
                              <textarea
                                id={`action-feedback-${offer.id}`}
                                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 outline-none focus:border-violet-300 resize-none placeholder-slate-400"
                                rows={2}
                                placeholder="Feedback (if requesting changes or rejecting)..."
                                value={actionFeedback}
                                onChange={e => setActionFeedback(e.target.value)}
                              />
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row">
                              <button onClick={() => doAction(offer.id, 'approve')} disabled={isSubmitting} className="flex-1 py-3 rounded-2xl bg-emerald-600 text-white font-semibold uppercase tracking-widest text-[10px] hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2">
                                <CheckCircle size={14} /> Approve
                              </button>
                              <button onClick={() => handleRequestChanges(offer.id)} disabled={isSubmitting} className="flex-1 py-3 rounded-2xl bg-orange-50 text-orange-600 font-semibold uppercase tracking-widest text-[10px] hover:bg-orange-100 transition-colors flex items-center justify-center gap-2 border border-orange-200">
                                <AlertCircle size={14} /> Req Changes
                              </button>
                              <button onClick={() => doAction(offer.id, 'reject', actionFeedback)} disabled={isSubmitting} className="flex-1 py-3 rounded-2xl bg-rose-50 text-rose-600 font-semibold uppercase tracking-widest text-[10px] hover:bg-rose-100 transition-colors flex items-center justify-center gap-2 border border-rose-200">
                                <XCircle size={14} /> Reject
                              </button>
                            </div>
                          </div>
                        ) : canSendThis ? (
                          <button onClick={() => doAction(offer.id, 'send')} disabled={isSubmitting} className="w-full py-4 rounded-xl bg-indigo-500 text-white font-black uppercase tracking-widest text-xs hover:bg-indigo-400 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Dispatch Offer
                          </button>
                        ) : (
                          <div className="text-center px-4 py-3 rounded-3xl bg-slate-100 border border-slate-200 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                            No actions available for your role in current status
                          </div>
                        )}
                      </div>
                      
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
