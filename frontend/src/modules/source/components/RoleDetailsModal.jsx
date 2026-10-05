import React from 'react';
import { 
  X, 
  Briefcase, 
  Clock, 
  Users, 
  Folder, 
  Zap, 
  Edit, 
  CheckCircle2, 
  Layers,
  Sparkles
} from 'lucide-react';
import useEscapeClose from '../../../core/hooks/useEscapeClose';

export default function RoleDetailsModal({
  isOpen,
  role,
  onClose,
  onEdit,
  onViewCandidates,
  candidateCount = 0,
  scoreStatus = null
}) {
  useEscapeClose(onClose);

  if (!isOpen || !role) return null;

  // Separate skills into required and preferred
  const rawSkills = Array.isArray(role.required_skills) ? role.required_skills : [];
  const requiredSkills = [];
  const preferredSkills = [];

  rawSkills.forEach(s => {
    const name = s.name || s.skill || (typeof s === 'string' ? s : '');
    if (!name) return;
    const rawLvl = (s.level || 'required').toLowerCase();
    const isReq = rawLvl === 'required' || rawLvl === 'critical' || rawLvl === 'expert' || rawLvl === 'advanced';
    if (isReq) {
      requiredSkills.push(name);
    } else {
      preferredSkills.push(name);
    }
  });

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-100 my-8 overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between bg-gradient-to-r from-gray-50 via-white to-purple-50/30">
          <div className="flex items-start gap-4 min-w-0 pr-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200 shadow-2xs mt-0.5">
              <Briefcase size={24} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 block mb-0.5">
                Job Role Details
              </span>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight leading-snug break-words">
                {role.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onEdit && (
              <button
                onClick={() => onEdit(role)}
                className="px-3.5 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Edit this role"
              >
                <Edit size={13} /> Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Metadata Pills Banner */}
        <div className="px-6 py-3 bg-gray-50/80 border-b border-gray-100 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-xl font-semibold text-gray-800 shadow-2xs">
            <Clock size={13} className="text-amber-600" />
            Min Experience: <strong className="text-gray-900">{role.min_experience || 0} yrs</strong>
          </span>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-xl font-semibold text-gray-800 shadow-2xs">
            <Users size={13} className="text-indigo-600" />
            Assigned: <strong className="text-gray-900">{candidateCount} {candidateCount === 1 ? 'candidate' : 'candidates'}</strong>
          </span>

          {role.folder_name && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-xl font-semibold text-purple-700 shadow-2xs">
              <Folder size={13} className="text-purple-600" />
              Folder: {role.folder_name} {role.folder_month_year ? `(${role.folder_month_year})` : ''}
            </span>
          )}

          {scoreStatus && scoreStatus.scored_count > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-emerald-200 rounded-xl font-semibold text-emerald-800 shadow-2xs">
              <Zap size={13} className="text-emerald-600" />
              {scoreStatus.scored_count} Scored
            </span>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Job Description Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <Layers size={14} className="text-purple-600" /> Full Job Description
              </h3>
            </div>
            <div className="bg-gray-50/70 border border-gray-200/80 rounded-2xl p-4.5 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto select-text shadow-2xs font-normal">
              {role.description ? (
                role.description
              ) : (
                <span className="text-gray-400 italic">No description provided for this job role.</span>
              )}
            </div>
          </div>

          {/* Role Skills Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-600" /> Role Skills ({rawSkills.length})
              </h3>
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-lg font-bold">
                  {requiredSkills.length} Required
                </span>
                <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg font-bold">
                  {preferredSkills.length} Preferred
                </span>
              </div>
            </div>

            {rawSkills.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No skills defined for this job role.</p>
            ) : (
              <div className="space-y-4">
                {/* Required Skills */}
                {requiredSkills.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-rose-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Mandatory Skills
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {requiredSkills.map((skill, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 pl-3 pr-2 py-1.5 bg-rose-50/80 border border-rose-200 rounded-xl text-xs font-bold text-gray-900 shadow-2xs"
                        >
                          <span>{skill}</span>
                          <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                            Required
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preferred Skills */}
                {preferredSkills.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Preferred / Bonus Skills
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {preferredSkills.map((skill, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 pl-3 pr-2 py-1.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs font-bold text-gray-900 shadow-2xs"
                        >
                          <span>{skill}</span>
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                            Preferred
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(role)}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Edit size={13} /> Edit Role
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
