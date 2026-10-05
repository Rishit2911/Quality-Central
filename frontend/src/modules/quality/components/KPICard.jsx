import React from 'react';
import { Bug, Pill, FolderKanban, CheckCircle2, Calendar } from 'lucide-react';

const METRICS_CONFIG = [
  {
    key: 'new_bugs',
    label: 'New Bugs',
    value: 0,
    color: '#2563EB',
    bgColor: '#EFF6FF',
    borderColor: '#DBEAFE',
    icon: Bug,
    sub: '0 new bugs logged'
  },
  {
    key: 'open_bugs',
    label: 'Open',
    value: 0,
    color: '#E11D48',
    bgColor: '#FFF1F2',
    borderColor: '#FFE4E6',
    icon: Pill,
    sub: 'All issues cleared'
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    value: 0,
    color: '#059669',
    bgColor: '#ECFDF5',
    borderColor: '#D1FAE5',
    icon: FolderKanban,
    sub: '0 active tickets'
  },
  {
    key: 'resolved_bugs',
    label: 'Resolved',
    value: 0,
    color: '#0D9488',
    bgColor: '#F0FDFA',
    borderColor: '#CCFBF1',
    icon: CheckCircle2,
    sub: '0 pending verification'
  },
  {
    key: 'overdue_bugs',
    label: 'Overdue',
    value: 0,
    color: '#D97706',
    bgColor: '#FFFBEB',
    borderColor: '#FEF3C7',
    icon: Calendar,
    sub: '0 past SLA deadline'
  }
];

export default function KPICardsGrid({ 
  stats = {},
  scope = 'personal',
  onScopeChange,
  myBugsCount = 0,
  teamBugsCount = 0,
  onFilterStatus
}) {
  return (
    <div className="space-y-4">
      {/* Scope Selector Header above KPI Cards */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
            Real-Time Quality Metrics
          </span>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
            {scope === 'personal' ? '👤 Assigned to You' : '👥 To the Team'}
          </span>
        </div>

        {/* Scope Pill Toggle */}
        {onScopeChange && (
          <div className="inline-flex items-center bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => onScopeChange('personal')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                scope === 'personal'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="Show metrics strictly for bugs assigned to you"
            >
              <span>👤 Assigned to You</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                scope === 'personal' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {myBugsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onScopeChange('team')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                scope === 'team'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="Show all organization bugs across all projects"
            >
              <span>👥 To the Team</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                scope === 'team' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {teamBugsCount}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* 5 KPI Cards Grid matching Screenshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
        {METRICS_CONFIG.map((metric) => {
          const Icon = metric.icon;
          const displayValue = stats[metric.key] !== undefined ? stats[metric.key] : metric.value;

          // Dynamic subtext that adapts to the real-time count
          let subText = metric.sub;
          if (metric.key === 'new_bugs') {
            subText = `${displayValue} new bug${displayValue === 1 ? '' : 's'} logged`;
          } else if (metric.key === 'open_bugs') {
            subText = displayValue === 0 ? 'All issues cleared' : `${displayValue} active open issue${displayValue === 1 ? '' : 's'}`;
          } else if (metric.key === 'in_progress') {
            subText = `${displayValue} active ticket${displayValue === 1 ? '' : 's'}`;
          } else if (metric.key === 'resolved_bugs') {
            subText = `${displayValue} resolved issue${displayValue === 1 ? '' : 's'}`;
          } else if (metric.key === 'overdue_bugs') {
            subText = displayValue === 0 ? '0 past SLA deadline' : `${displayValue} past SLA deadline`;
          }

          return (
            <div
              key={metric.key}
              onClick={() => onFilterStatus?.(metric.key)}
              className="bg-white border border-[#ebe4ff] rounded-[2rem] p-6 shadow-[0_10px_40px_rgba(180,140,255,0.04)] relative overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_rgba(124,58,237,0.08)] group cursor-pointer"
            >
              {/* Ambient light glow inside the card */}
              <div
                className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-[40px] opacity-20 pointer-events-none transition-opacity duration-300 group-hover:opacity-35"
                style={{ background: metric.color }}
              />

              {/* Icon Block */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-105"
                style={{
                  background: metric.bgColor,
                  border: `1px solid ${metric.borderColor}`,
                  color: metric.color
                }}
              >
                <Icon size={22} style={{ color: metric.color }} />
              </div>

              {/* Value */}
              <h3
                className="text-4xl lg:text-5xl font-black leading-none mb-3 tracking-tight"
                style={{ color: '#0F172A' }}
              >
                {displayValue}
              </h3>

              {/* Label */}
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-black/50">
                {metric.label}
              </p>

              {/* Sub-text */}
              {subText && (
                <p className="text-[9px] text-black/35 mt-2.5 uppercase tracking-wider font-bold">
                  {subText}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
