import React, { useState } from 'react';
import { ChevronRight, ArrowRight, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';

const DEFAULT_ACTION_ITEMS = [
  {
    id: 'QC-00124',
    title: 'Login button not working',
    severity: 'Critical',
    assignee: 'Rahul Shah',
    date: '12 Mar 2026',
    subtitle: 'Quality Central • Maintenance comms 7 hours ago',
    status: 'critical'
  },
  {
    id: 'TC-00123',
    title: 'Profile update error',
    severity: 'High',
    assignee: 'Sneh Shah',
    date: '12 Mar 2026',
    subtitle: 'Talent Central • Awaiting QA reproduction on Chrome',
    status: 'high'
  },
  {
    id: 'TC-00123-B',
    title: 'Profile update error',
    severity: 'High',
    assignee: 'Sneh Shah',
    date: '12 Mar 2026',
    subtitle: 'Talent Central • Edge browser specific regression',
    status: 'high'
  },
  {
    id: 'AC-00121',
    title: 'Profile update error',
    severity: 'High',
    assignee: 'Haul Shah',
    date: '12 Mar 2026',
    subtitle: 'Assessment Central • Network payload validation failure',
    status: 'high'
  },
  {
    id: 'QC-00124-C',
    title: 'Login button not working',
    severity: 'Critical',
    assignee: 'Rahul Shah',
    date: '12 Mar 2026',
    subtitle: 'Quality Central • Maintenance comms 7 hours ago',
    status: 'critical'
  },
  {
    id: 'LEX-00125',
    title: 'Password reset token expires prematurely',
    severity: 'New',
    assignee: 'Vidhi',
    date: '14 Mar 2026',
    subtitle: 'LexAI • Reported by staging automated suite',
    status: 'new'
  }
];

export default function ActionItemsWidget({ 
  items = DEFAULT_ACTION_ITEMS,
  onViewAll,
  onItemClick,
  onQuickStatusChange,
  currentUser = 'Rishit'
}) {
  const [filterTab, setFilterTab] = useState('All');

  const canUserEditItem = (item) => {
    if (!item || !item.assignee) return false;
    const itemAssignee = String(item.assignee).toLowerCase().trim();
    const myName = String(currentUser || 'Rishit').toLowerCase().trim();
    if (myName.includes('rishit') && itemAssignee.includes('rishit')) return true;
    return itemAssignee.includes(myName) || myName.includes(itemAssignee);
  };

  const filteredItems = items.filter((item) => {
    if (filterTab === 'All') return true;
    return item.severity.toLowerCase() === filterTab.toLowerCase();
  });

  const getDotStyle = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
      case 'high':
        return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]';
      case 'new':
        return 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]';
      default:
        return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
    }
  };

  const getSeverityBadgeStyle = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'text-red-600 bg-red-50 border border-red-200';
      case 'high':
        return 'text-amber-700 bg-amber-50 border border-amber-200';
      case 'new':
        return 'text-blue-600 bg-blue-50 border border-blue-200';
      default:
        return 'text-emerald-600 bg-emerald-50 border border-emerald-200';
    }
  };

  return (
    <div className="bg-white border border-[#ebe4ff] rounded-[2rem] p-8 shadow-[0_10px_40px_rgba(180,140,255,0.04)] flex flex-col justify-between transition-all duration-300 hover:shadow-[0_15px_45px_rgba(124,58,237,0.06)] h-full">
      {/* Header and Filter Tabs */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#7C3AED]">
            INBOX / MY ACTION ITEMS
          </h3>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-[#F8FAFC] p-1 rounded-xl border border-slate-200/80">
            {['All', 'Critical', 'High', 'New'].map((tab) => {
              const active = filterTab === tab;
              let activeClass = 'bg-black text-white shadow-sm';
              if (tab === 'Critical' && active) activeClass = 'bg-rose-500 text-white shadow-sm';
              if (tab === 'High' && active) activeClass = 'bg-amber-500 text-white shadow-sm';
              if (tab === 'New' && active) activeClass = 'bg-blue-600 text-white shadow-sm';

              return (
                <button
                  key={tab}
                  onClick={() => setFilterTab(tab)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    active ? activeClass : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* List of Items */}
        <div className="divide-y divide-slate-100">
          {filteredItems.slice(0, 5).map((item, idx) => (
            <div
              key={item.id + idx}
              onClick={() => onItemClick ? onItemClick(item) : toast.success(`Viewing details for ${item.id}`)}
              className="py-3 px-2 rounded-xl transition-all duration-200 hover:bg-[#FAF8FF] group cursor-pointer flex items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3 min-w-0">
                {/* Status Dot */}
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${getDotStyle(item.severity)}`}
                />
                
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-900 leading-snug">
                    <span className="font-extrabold text-[#7C3AED] group-hover:underline">
                      [{item.id}]
                    </span>
                    <span className="truncate">{item.title}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.2 rounded-full uppercase tracking-wider ${getSeverityBadgeStyle(
                        item.severity
                      )}`}
                    >
                      {item.severity}
                    </span>
                    <span className="text-slate-500 font-normal">
                      - {item.assignee}
                    </span>
                  </div>

                  {item.subtitle && (
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      {item.subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Side: Quick Action Button, Date & Chevron */}
              <div className="flex items-center gap-2.5 shrink-0">
                {canUserEditItem(item) ? (
                  <>
                    {onQuickStatusChange && item.currentStatus === 'Open' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickStatusChange(item.id, 'In Progress');
                        }}
                        className="px-2.5 py-1 text-[10px] font-bold rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 transition-all flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                        title="Put bug into In Progress"
                      >
                        <span>➔ In Progress</span>
                      </button>
                    )}

                    {onQuickStatusChange && item.currentStatus === 'In Progress' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onQuickStatusChange(item.id, 'Resolved');
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 transition-all flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                          title="Mark bug as Resolved"
                        >
                          <span>✓ Resolve</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onQuickStatusChange(item.id, 'Closed');
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 transition-all flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                          title="Close bug ticket"
                        >
                          <span>Close</span>
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <span 
                    className="px-2 py-0.5 text-[9px] font-bold rounded bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1"
                    title={`Assigned to ${item.assignee} (View-Only)`}
                  >
                    <Lock size={9} /> View-Only
                  </span>
                )}

                <span className="text-xs font-semibold text-slate-400">
                  {item.date}
                </span>
                <ChevronRight
                  size={14}
                  className="text-slate-400 group-hover:text-[#7C3AED] group-hover:translate-x-0.5 transition-transform"
                />
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="py-8 text-center text-xs font-semibold text-slate-400">
              No action items found under {filterTab} priority.
            </div>
          )}
        </div>
      </div>

      {/* Footer Link */}
      <div className="pt-4 border-t border-slate-100 mt-4 flex justify-start">
        <button
          onClick={() => onViewAll ? onViewAll() : toast('Opening complete Action Items register...')}
          className="text-xs font-extrabold text-[#7C3AED] hover:text-[#6D28D9] flex items-center gap-1.5 group cursor-pointer"
        >
          See All Action Items
          <ArrowRight
            size={13}
            className="group-hover:translate-x-1 transition-transform"
          />
        </button>
      </div>
    </div>
  );
}
