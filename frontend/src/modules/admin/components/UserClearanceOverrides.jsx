import React from 'react';
import { Shield, X, Check, Activity } from 'lucide-react';
import { MANAGEMENT_CATEGORIES, PERSONAL_CATEGORIES } from './ClearanceMatrix';
import useEscapeClose from '../../../core/hooks/useEscapeClose';

export default function UserClearanceOverrides({
  user,
  overrides,
  onUpdate,
  onClose
}) {
  useEscapeClose(onClose, !!user);

  if (!user) return null;

  // ── For each super-section, check if the user has at least one perm
  // currently set to true or false (i.e. any override at all) in that section.
  // If ZERO overrides exist for a section, that section header + cards are hidden.
  const mgmtKeys    = MANAGEMENT_CATEGORIES.flatMap(c => c.perms.map(p => p.key));
  const personalKeys = PERSONAL_CATEGORIES.flatMap(c => c.perms.map(p => p.key));

  const hasMgmtOverrides    = mgmtKeys.some(k => overrides[k] !== undefined && overrides[k] !== null);
  const hasPersonalOverrides = personalKeys.some(k => overrides[k] !== undefined && overrides[k] !== null);

  // A section is only rendered if at least one of its permissions has an override set.
  // A brand-new user with no overrides will see both sections (fallback: show both).
  const showBoth = !hasMgmtOverrides && !hasPersonalOverrides;
  const showMgmt    = showBoth || hasMgmtOverrides;
  const showPersonal = showBoth || hasPersonalOverrides;

  /** Renders all category groups + their permission cards for a given categories array */
  const renderSection = (categories) =>
    categories.map(cat => (
      <div key={cat.group} className="space-y-4">
        {/* GROUP LABEL */}
        <div className="flex items-center gap-3">
          <h5 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500 whitespace-nowrap">
            {cat.group}
          </h5>
          <div className="h-px bg-[#ede8f7] flex-1" />
        </div>

        {/* PERMISSION CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cat.perms.map(p => {
            const overrideValue = overrides[p.key];
            const isOverridden  = overrideValue !== undefined && overrideValue !== null;

            return (
              <div
                key={p.key}
                className={`
                  rounded-[1.75rem] border p-5
                  flex items-center justify-between gap-5
                  transition-all duration-300
                  ${isOverridden
                    ? 'bg-[#f7f1ff] border-[#d9c8ff] shadow-[0_8px_24px_rgba(180,140,255,0.09)]'
                    : 'bg-white border-[#ece7fa]'
                  }
                `}
              >
                {/* LEFT — label + key */}
                <div className="space-y-1.5 min-w-0">
                  <p className={`text-[14px] font-semibold tracking-tight truncate ${isOverridden ? 'text-[#8b5cf6]' : 'text-black'}`}>
                    {p.label}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-mono">
                    {p.key}
                  </p>
                </div>

                {/* RIGHT — Allow / Block / Default buttons */}
                <div className="flex gap-1.5 p-1.5 rounded-2xl bg-[#f4f0fc] border border-[#ebe5fa] shrink-0">
                  {/* ALLOW */}
                  <button
                    onClick={() => onUpdate(user.id, p.key, true)}
                    title="Allow"
                    className={`
                      w-10 h-10 rounded-xl flex items-center justify-center
                      transition-all duration-300
                      ${overrideValue === true
                        ? 'bg-gradient-to-br from-[#c084fc] to-[#8b5cf6] text-white shadow-[0_6px_18px_rgba(180,140,255,0.35)]'
                        : 'bg-white border border-[#ebe5fa] text-[#8b5cf6] hover:bg-[#f3eeff]'
                      }
                    `}
                  >
                    <Check size={15} strokeWidth={3} />
                  </button>

                  {/* BLOCK */}
                  <button
                    onClick={() => onUpdate(user.id, p.key, false)}
                    title="Block"
                    className={`
                      w-10 h-10 rounded-xl flex items-center justify-center
                      transition-all duration-300
                      ${overrideValue === false
                        ? 'bg-black text-white shadow-[0_6px_18px_rgba(0,0,0,0.15)]'
                        : 'bg-white border border-[#ebe5fa] text-black hover:bg-[#f3f4f6]'
                      }
                    `}
                  >
                    <X size={15} strokeWidth={3} />
                  </button>

                  {/* DEFAULT (clear override) */}
                  <button
                    onClick={() => onUpdate(user.id, p.key, null)}
                    title="Use role default"
                    className={`
                      w-10 h-10 rounded-xl flex items-center justify-center
                      transition-all duration-300
                      ${!isOverridden
                        ? 'bg-[#8b5cf6] text-white shadow-[0_6px_18px_rgba(180,140,255,0.35)]'
                        : 'bg-white border border-[#ebe5fa] text-gray-400 hover:bg-[#f3f4f6]'
                      }
                    `}
                  >
                    <Activity size={15} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
      <div
        className="
          w-full max-w-5xl max-h-[92vh]
          overflow-hidden rounded-[2.8rem]
          border border-[#e9e2fb]
          bg-[#faf8ff]
          shadow-[0_35px_100px_rgba(120,80,255,0.18)]
          animate-fade-in-up flex flex-col
        "
      >
        {/* HEADER */}
        <div className="
          px-5 sm:px-10 py-6 sm:py-8
          border-b border-[#ece7fa]
          bg-gradient-to-r from-white to-[#f6f1ff]
          flex flex-wrap justify-between items-start gap-4 sm:gap-6
        ">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="
                w-10 h-10 rounded-2xl
                bg-gradient-to-br from-[#c084fc] to-[#8b5cf6]
                flex items-center justify-center text-white
                shadow-[0_10px_25px_rgba(180,140,255,0.35)]
              ">
                <Shield size={18} />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[#8b5cf6]">
                Individual Permission Settings
              </p>
            </div>

            <h3 className="text-2xl sm:text-4xl font-bold tracking-tight text-black">
              User Access Controls
            </h3>

            <p className="mt-3 text-[15px] text-gray-500 font-normal leading-relaxed">
              Adjusting permissions for{' '}
              <span className="font-semibold text-black">@{user.username}</span>
              <span className="text-[11px] text-gray-400 ml-2 font-mono uppercase tracking-widest">
                — overrides stack on top of role defaults
              </span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="
              px-6 py-3 rounded-2xl bg-black text-white
              text-[10px] font-semibold uppercase tracking-[0.25em]
              hover:bg-[#8b5cf6] transition-all duration-300 active:scale-95
            "
          >
            Close
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-10 py-6 sm:py-10 space-y-12">

          {/* ── MANAGEMENT SECTION ──────────────────────────────────────── */}
          {showMgmt && (
            <div className="space-y-8">
              {/* Section label */}
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-8 rounded-full bg-violet-500 shrink-0" />
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-violet-600">
                    Management Permissions
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Org &amp; team-wide operations
                  </p>
                </div>
                <div className="flex-1 h-px bg-[#e8e2f7] ml-2" />
              </div>

              {renderSection(MANAGEMENT_CATEGORIES)}
            </div>
          )}

          {/* ── PERSONAL SECTION ────────────────────────────────────────── */}
          {showPersonal && (
            <div className="space-y-8">
              {/* Section label */}
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-8 rounded-full bg-pink-500 shrink-0" />
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-pink-600">
                    Personal Permissions
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Self-service &amp; own data access
                  </p>
                </div>
                <div className="flex-1 h-px bg-[#fce7f3] ml-2" />
              </div>

              {renderSection(PERSONAL_CATEGORIES)}
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="
          px-10 py-7 border-t border-[#ece7fa]
          bg-gradient-to-r from-white to-[#f7f2ff]
          flex items-center justify-between gap-6 flex-wrap
        ">
          <div className="flex items-center gap-3">
            <Shield className="text-[#8b5cf6]" size={18} />
            <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-gray-500">
              Custom overrides stack on top of role defaults
            </p>
          </div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-semibold text-[#8b5cf6]">
            Security Layer Active
          </p>
        </div>
      </div>
    </div>
  );
}