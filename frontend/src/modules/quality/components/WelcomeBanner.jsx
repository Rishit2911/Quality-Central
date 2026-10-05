import React from 'react';
import { RefreshCw } from 'lucide-react';
import { getInitials } from '../../../core/utils/nameHelpers';

export default function WelcomeBanner({ 
  user, 
  syncedTime, 
  onRefresh, 
  isRefreshing,
  scope = 'personal',
  onScopeChange,
  myBugsCount = 0,
  teamBugsCount = 0
}) {
  const rawDisplayName = user?.name || (user?.username?.includes('@') ? user.username.split('@')[0] : user?.username) || (user?.email?.includes('@') ? user.email.split('@')[0] : user?.email) || 'Rishit';
  const displayName = rawDisplayName.charAt(0).toUpperCase() + rawDisplayName.slice(1);
  const userShortName = displayName;
  const initials = getInitials(displayName) || (displayName.length >= 2 ? displayName.slice(0, 2).toUpperCase() : 'RS');
  const employeeCode = user?.employee_code || 'EMP001';

  return (
    <div className="bg-[#faf8ff] border border-[#ebe4ff] rounded-[2.5rem] p-8 md:p-10 relative overflow-hidden shadow-[0_10px_40px_rgba(180,140,255,0.04)]">
      {/* Decorative ambient gradient backdrop */}
      <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#7c3aed]/5 to-transparent pointer-events-none rounded-[2.5rem]" />

      <div className="flex justify-between items-center flex-wrap gap-8 relative z-10">
        <div className="flex items-center gap-6">
          {/* Avatar Circle with Online Dot */}
          <div className="relative shrink-0">
            {user?.photo_path ? (
              <img
                src={`/api/employee/${user.employee_code}/document/pfp`}
                alt={displayName}
                className="w-20 h-20 rounded-[1.8rem] object-cover border-2 border-white shadow-lg shadow-[#7c3aed]/10"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className={`w-20 h-20 rounded-[1.8rem] bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] text-white text-3xl font-black items-center justify-center shadow-lg shadow-[#7c3aed]/20 ${
                user?.photo_path ? 'hidden' : 'flex'
              }`}
            >
              {initials}
            </div>
            {/* Online status indicator */}
            <span className="absolute bottom-1 right-1 w-4 h-4 shrink-0 aspect-square bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
          </div>

          <div>
            {/* Badges Pill Row & Scope Switcher */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Interactive Scope Toggle: My Assigned Bugs vs Team Overview */}
              <div className="inline-flex items-center bg-white p-1 rounded-2xl border border-[#ebe4ff] shadow-xs">
                <button
                  type="button"
                  onClick={() => onScopeChange?.('personal')}
                  className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    scope === 'personal'
                      ? 'bg-[#7C3AED] text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Show metrics for bugs assigned to you"
                >
                  <span>👤 My Assigned Bugs</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                    scope === 'personal' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {myBugsCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onScopeChange?.('team')}
                  className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    scope === 'team'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Show all organization bugs"
                >
                  <span>👥 Team Overview</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                    scope === 'team' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {teamBugsCount}
                  </span>
                </button>
              </div>

              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-black/40 px-2 py-0.5 bg-black/5 rounded-full">
                {employeeCode}
              </span>
            </div>

            {/* Dynamic Greeting */}
            <h1 className="text-3xl md:text-5xl font-black text-black tracking-tight mt-2.5 leading-none italic">
              Hello, {displayName}
            </h1>

            {/* Sub-tags Pill Row */}
            <div className="flex flex-wrap items-center gap-2.5 mt-4">
              <span className="bg-[#ede9fe] text-[#7C3AED] text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-2xl border border-[#ddd6fe] flex items-center gap-1.5 font-bold">
                {scope === 'personal' ? (
                  <>🎯 Queue for {userShortName} ({myBugsCount} bug{myBugsCount === 1 ? '' : 's'})</>
                ) : (
                  <>🌐 Total Organization Queue ({teamBugsCount} bugs)</>
                )}
              </span>

              <span className="bg-white text-black/60 text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-2xl border border-[#ebe4ff]">
                🛡 Quality Assurance
              </span>
              <span className="bg-white text-black/60 text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-2xl border border-[#ebe4ff]">
                👥 QA & Release Team
              </span>
              <span className="bg-white text-black/60 text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-2xl border border-[#ebe4ff]">
                📍 Automated Pipeline
              </span>
              <span className="bg-[#fcfaff] text-[#7C3AED] text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-2xl border border-[#ebe4ff]">
                ⏱ Sprint 14 Active
              </span>
            </div>
          </div>
        </div>

        {/* Right-aligned Sync indicator & Refresh Button */}
        <div className="flex items-center gap-4">
          <span className="text-[9px] font-black uppercase tracking-widest text-black/30">
            SYNCED {syncedTime || '04:35 PM'}
          </span>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-5 py-3.5 rounded-2xl bg-black text-white text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2.5 hover:bg-black/90 active:scale-95 transition-all shadow-md disabled:opacity-70 cursor-pointer"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            REFRESH
          </button>
        </div>
      </div>
    </div>
  );
}
