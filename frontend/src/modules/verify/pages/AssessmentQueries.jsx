import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MessageSquare, CheckCircle, Clock, AlertCircle, Search,
  RefreshCw, ChevronRight, X, Send, User, Award, Shield,
  ExternalLink, Filter, HelpCircle, CornerDownRight, Check
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import HorizontalLoader from '../../../core/components/HorizontalLoader';
import { extractErrorMessage } from '../../../core/utils/validators';

const STATUS_CONFIG = {
  open: {
    label: 'Open / Pending',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  resolved: {
    label: 'Resolved',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  closed: {
    label: 'Closed',
    badge: 'bg-gray-100 text-gray-600 border-gray-200',
    dot: 'bg-gray-400',
  },
};

export default function AssessmentQueries() {
  const navigate = useNavigate();
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchQueries = useCallback(async () => {
    setLoading(true);
    try {
      const url = statusFilter === 'all' 
        ? '/api/verify/queries' 
        : `/api/verify/queries?status=${statusFilter}`;
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setQueries(data.data || []);
      } else {
        toast.error(extractErrorMessage(data?.detail, 'Failed to fetch candidate queries'));
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Network error fetching queries'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchQueries();
  }, [fetchQueries]);

  const stats = useMemo(() => {
    const total = queries.length;
    const open = queries.filter(q => q.status === 'open').length;
    const resolved = queries.filter(q => q.status === 'resolved').length;
    const closed = queries.filter(q => q.status === 'closed').length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, open, resolved, closed, resolutionRate };
  }, [queries]);

  const filteredQueries = useMemo(() => {
    const term = searchQuery.toLowerCase().trim();
    return queries.filter(q => {
      const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
      if (!matchesStatus) return false;
      if (!term) return true;
      return (
        (q.candidate_name || '').toLowerCase().includes(term) ||
        (q.candidate_email || '').toLowerCase().includes(term) ||
        (q.assessment_title || '').toLowerCase().includes(term) ||
        (q.subject || '').toLowerCase().includes(term) ||
        (q.message || '').toLowerCase().includes(term)
      );
    });
  }, [queries, statusFilter, searchQuery]);

  const handleOpenDetail = (query) => {
    setSelectedQuery(query);
    setResponseText(query.response || '');
  };

  const handleUpdateStatus = async (newStatus, sendResponse = true) => {
    if (!selectedQuery) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/verify/queries/${selectedQuery.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: newStatus,
          response: sendResponse ? responseText : selectedQuery.response
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Query marked as ${newStatus}`);
        setSelectedQuery(prev => ({
          ...prev,
          status: newStatus,
          response: sendResponse ? responseText : prev.response
        }));
        fetchQueries();
      } else {
        toast.error(extractErrorMessage(data?.detail, 'Failed to update query'));
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Network error updating query'));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="text-purple-600" size={22} />
            Candidate Queries & Appeals
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Review score disputes, evaluation inquiries, and malpractice appeals raised by candidates.
          </p>
        </div>
        <button
          onClick={fetchQueries}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors shadow-sm shrink-0"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-purple-600' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
            <MessageSquare size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs font-medium text-gray-400">Total Queries</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
            <Clock size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-amber-600">{stats.open}</p>
              {stats.open > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </div>
            <p className="text-xs font-medium text-gray-400">Pending Review</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600">{stats.resolved}</p>
            <p className="text-xs font-medium text-gray-400">Resolved Queries</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
            <Award size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-indigo-600">{stats.resolutionRate}%</p>
            <p className="text-xs font-medium text-gray-400">Resolution Rate</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-50 border border-gray-200 rounded-xl w-full sm:w-auto overflow-x-auto">
          {[
            { key: 'all', label: 'All', count: stats.total },
            { key: 'open', label: 'Pending', count: stats.open },
            { key: 'resolved', label: 'Resolved', count: stats.resolved },
            { key: 'closed', label: 'Closed', count: stats.closed },
          ].map(tab => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  active
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  active ? 'bg-purple-700 text-purple-100' : 'bg-gray-200 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search candidate, assessment, or query..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-gray-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
          />
        </div>
      </div>

      {/* Main Queries List / Table */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-200 shadow-sm">
          <HorizontalLoader label="Loading candidate queries..." />
        </div>
      ) : filteredQueries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-2">
            <CheckCircle size={24} />
          </div>
          <h3 className="text-sm font-bold text-gray-800">No Queries Found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
            {searchQuery 
              ? `No candidate queries matched "${searchQuery}". Try clearing your search.`
              : `There are currently no ${statusFilter === 'all' ? '' : statusFilter} queries from candidates.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredQueries.map((q) => {
            const statusStyle = STATUS_CONFIG[q.status] || STATUS_CONFIG.open;
            return (
              <div
                key={q.id}
                onClick={() => handleOpenDetail(q)}
                className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:border-purple-300 hover:shadow-md transition-all cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4 group"
              >
                {/* Left Section: Candidate & Assessment Info */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0">
                    {(q.candidate_name || 'C').slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-bold text-gray-900 truncate">
                        {q.candidate_name || 'Candidate'}
                      </p>
                      <span className="text-[11px] text-gray-400 truncate">
                        ({q.candidate_email || 'No email'})
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1.5 ${statusStyle.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                        {statusStyle.label}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-purple-700">
                      {q.assessment_title || 'Skill Assessment'}
                    </p>

                    <p className="text-xs font-medium text-gray-700">
                      {q.subject || 'Result Evaluation Dispute'}
                    </p>

                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed font-sans bg-gray-50/70 p-2.5 rounded-lg border border-gray-100">
                      "{q.message}"
                    </p>
                  </div>
                </div>

                {/* Right Section: Score, Date & Action */}
                <div className="flex items-center justify-between lg:justify-end gap-6 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                  <div className="text-right">
                    {q.candidate_score !== undefined && q.candidate_score !== null && (
                      <p className="text-xs font-bold text-gray-800">
                        Score: <span className={q.pass_status ? 'text-emerald-600' : 'text-rose-600'}>{Math.round(q.candidate_score)}%</span>
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {q.created_at ? new Date(q.created_at).toLocaleDateString() : 'Recent'}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition-colors text-xs font-semibold"
                  >
                    <span>Review</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Query Detail & Resolution Modal */}
      {selectedQuery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col p-6 space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900">
                    {selectedQuery.subject || 'Candidate Query / Appeal'}
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${STATUS_CONFIG[selectedQuery.status]?.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[selectedQuery.status]?.dot}`} />
                    {STATUS_CONFIG[selectedQuery.status]?.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Assessment: <strong className="text-gray-800">{selectedQuery.assessment_title}</strong>
                </p>
              </div>

              <button
                onClick={() => setSelectedQuery(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Candidate & Assessment Context Card */}
            <div className="bg-gray-50/80 rounded-2xl border border-gray-200 p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Candidate</span>
                <span className="font-semibold text-gray-800">{selectedQuery.candidate_name || 'Candidate'}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Email</span>
                <span className="font-semibold text-gray-800 truncate block">{selectedQuery.candidate_email || '—'}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Score</span>
                <span className={`font-bold ${selectedQuery.pass_status ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {selectedQuery.candidate_score !== null && selectedQuery.candidate_score !== undefined ? `${Math.round(selectedQuery.candidate_score)}%` : '—'}
                </span>
              </div>
            </div>

            {/* Candidate's Message */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Candidate Explanation</label>
              <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-4 text-xs text-gray-800 leading-relaxed whitespace-pre-wrap font-sans">
                {selectedQuery.message}
              </div>
              <div className="flex justify-end">
                {selectedQuery.assessment_result_id && (
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/verify?tab=result&result_id=${selectedQuery.assessment_result_id}`);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-semibold"
                  >
                    <span>View Candidate Full Scorecard</span>
                    <ExternalLink size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* HR Response & Actions */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-between">
                <span>HR Resolution / Response Note</span>
                <span className="text-[10px] font-normal text-gray-400">Visible to candidate in their results</span>
              </label>
              
              <textarea
                rows={4}
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Enter resolution notes, score adjustments, or explanation for the candidate..."
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-xs text-gray-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all resize-none"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  {selectedQuery.status !== 'closed' && (
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => handleUpdateStatus('closed', false)}
                      className="px-3.5 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-semibold transition-colors"
                    >
                      Close Without Response
                    </button>
                  )}
                  {selectedQuery.status !== 'open' && (
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => handleUpdateStatus('open', false)}
                      className="px-3.5 py-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-semibold transition-colors"
                    >
                      Re-open Query
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedQuery(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleUpdateStatus('resolved', true)}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition-colors"
                  >
                    <Check size={14} />
                    <span>Save & Mark Resolved</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
