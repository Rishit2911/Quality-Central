import React, { useState } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  FileText, 
  FileDown, 
  Tag, 
  Filter, 
  Briefcase, 
  ArrowDownUp, 
  CheckCircle2, 
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import useEscapeClose from '../../../core/hooks/useEscapeClose';
import { 
  exportCandidatesToExcel, 
  exportCandidatesToCSV, 
  exportCandidatesToPDF 
} from '../utils/candidateExport';

export default function CandidateReportModal({
  isOpen,
  onClose,
  candidates = [],
  roleTitle = '',
  filters = {},
  companyName = 'Phygitron 360'
}) {
  useEscapeClose(onClose);
  const [showPreview, setShowPreview] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  if (!isOpen) return null;

  const topCandidates = candidates.slice(0, 20);
  const totalCount = topCandidates.length;

  const handleExcelExport = () => {
    exportCandidatesToExcel({
      candidates: topCandidates,
      roleTitle,
      filtersSummary: filters,
      companyName
    });
  };

  const handleCSVExport = () => {
    exportCandidatesToCSV({
      candidates: topCandidates,
      roleTitle,
      filtersSummary: filters,
      companyName
    });
  };

  const handlePDFExport = async () => {
    setIsExportingPDF(true);
    try {
      await exportCandidatesToPDF({
        candidates: topCandidates,
        roleTitle,
        filtersSummary: filters,
        companyName
      });
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Sort label display
  const sortLabels = {
    required_score: 'Required Fit (High → Low)',
    preferred_score: 'Preferred Fit (High → Low)',
    newest: 'Newest Added',
    experience: 'Experience'
  };
  const activeSortLabel = sortLabels[filters.sort_by] || filters.sort_by || 'Newest';

  // Tags label display
  const activeTags = (filters.tags && filters.tags.length > 0)
    ? filters.tags
    : (filters.tag ? [filters.tag] : []);

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-gray-100 my-8 overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 via-white to-purple-50/40">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs border border-purple-200/60">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Generate Candidate Report</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Export the top {totalCount} candidate{totalCount === 1 ? '' : 's'} matching current filters
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Filter Context Bar */}
          <div className="bg-purple-50/70 border border-purple-100 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                <Filter size={13} /> Active Filter Criteria
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 bg-purple-600 text-white rounded-full">
                Top {totalCount} Candidates
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-purple-200 rounded-xl text-xs font-semibold text-purple-800 shadow-2xs">
                <Briefcase size={12} className="text-purple-600" />
                Role: {roleTitle || 'All Roles / General Pool'}
              </span>
              {activeTags.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-purple-200 rounded-xl text-xs font-semibold text-purple-800 shadow-2xs">
                  <Tag size={12} className="text-purple-600" />
                  Tags: {activeTags.join(', ')}
                </span>
              )}
              {filters.exp_range && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-purple-200 rounded-xl text-xs font-semibold text-purple-800 shadow-2xs">
                  <Layers size={12} className="text-purple-600" />
                  Exp: {filters.exp_range} yrs
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-purple-200 rounded-xl text-xs font-semibold text-purple-800 shadow-2xs">
                <ArrowDownUp size={12} className="text-purple-600" />
                Sort: {activeSortLabel}
              </span>
            </div>
          </div>

          {/* Export Format Cards */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Select Download Format
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* 1. Excel Card */}
              <div className="relative group border border-emerald-200/80 rounded-2xl p-4 bg-gradient-to-b from-white to-emerald-50/30 hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <FileSpreadsheet size={20} />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md uppercase">
                      .XLSX
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">Excel Workbook</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Formatted multi-column spreadsheet with metadata header, match percentages, and ratios.
                  </p>
                </div>
                <button
                  onClick={handleExcelExport}
                  disabled={totalCount === 0}
                  className="mt-4 w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <FileSpreadsheet size={14} /> Download Excel
                </button>
              </div>

              {/* 2. CSV Card */}
              <div className="relative group border border-blue-200/80 rounded-2xl p-4 bg-gradient-to-b from-white to-blue-50/30 hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                      <FileText size={20} />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md uppercase">
                      .CSV
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">CSV Document</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Universal comma-separated format with UTF-8 BOM encoding for spreadsheets & ATS imports.
                  </p>
                </div>
                <button
                  onClick={handleCSVExport}
                  disabled={totalCount === 0}
                  className="mt-4 w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <FileText size={14} /> Download CSV
                </button>
              </div>

              {/* 3. PDF Card */}
              <div className="relative group border border-purple-200/80 rounded-2xl p-4 bg-gradient-to-b from-white to-purple-50/30 hover:border-purple-400 hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                      <FileDown size={20} />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md uppercase">
                      .PDF
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">Executive PDF</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    High-res landscape vector report with KPI strip, ATS match badges, skills, and pagination.
                  </p>
                </div>
                <button
                  onClick={handlePDFExport}
                  disabled={totalCount === 0 || isExportingPDF}
                  className="mt-4 w-full py-2.5 px-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <FileDown size={14} /> {isExportingPDF ? 'Generating...' : 'Download PDF'}
                </button>
              </div>
            </div>
          </div>

          {/* Candidate List Accordion Preview */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowPreview(prev => !prev)}
              className="w-full px-4 py-3 bg-gray-50/70 hover:bg-gray-100/70 flex items-center justify-between transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700">Preview Candidates in Report</span>
                <span className="text-[11px] px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full font-medium">
                  {totalCount} record{totalCount === 1 ? '' : 's'}
                </span>
              </div>
              {showPreview ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            </button>

            {showPreview && (
              <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 bg-white">
                {totalCount === 0 ? (
                  <div className="py-6 text-center text-xs text-gray-400">
                    No candidates match the current filters.
                  </div>
                ) : (
                  topCandidates.map((c, idx) => {
                    const reqPct = c.required_score != null ? Math.round(c.required_score) : null;
                    const prefPct = c.preferred_score != null ? Math.round(c.preferred_score) : null;

                    return (
                      <div key={c.id || idx} className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-gray-50/60">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-gray-400 font-bold w-6 shrink-0">#{idx + 1}</span>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate m-0">{c.full_name || '—'}</p>
                            <p className="text-[11px] text-gray-400 truncate m-0">{c.current_designation || c.email || '—'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {reqPct != null && (
                            <span className="px-2 py-0.5 rounded-md font-bold bg-rose-50 text-rose-700 border border-rose-200 text-[11px]">
                              Req: {reqPct}%
                            </span>
                          )}
                          {prefPct != null && (
                            <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]">
                              Pref: {prefPct}%
                            </span>
                          )}
                          <span className="text-gray-500 text-[11px] font-medium">
                            {c.total_experience_years ?? '—'} yrs
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Reports download directly with no limit on exports.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
