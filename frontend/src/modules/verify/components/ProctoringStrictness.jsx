import React from 'react';

const LEVELS = [
  { key: 'lenient', label: 'Lenient', color: '#22c55e' },
  { key: 'balanced', label: 'Balanced', color: '#eab308' },
  { key: 'strict', label: 'Strict', color: '#ef4444' },
];

export default function ProctoringStrictness({ value, onChange, descriptions }) {
  const idx = LEVELS.findIndex(l => l.key === value);
  const current = LEVELS[idx] || LEVELS[1];

  return (
    <div className="p-3 rounded-xl bg-white/5 border border-gray-200">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold text-gray-700">Proctoring Strictness</span>
        <span className="text-xs font-bold" style={{ color: current.color }}>{current.label}</span>
      </div>
      <div role="slider" aria-valuemin={0} aria-valuemax={2} aria-valuenow={idx < 0 ? 1 : idx} aria-label="Proctoring strictness" className="flex gap-1.5 items-center">
        {LEVELS.map((lvl, i) => {
          const selected = (idx < 0 ? 1 : idx) === i;
          return (
            <button key={lvl.key} type="button" onClick={() => onChange(lvl.key)} title={lvl.label}
              className="flex-1 h-2.5 rounded-full border-0 cursor-pointer transition-all"
              style={{ background: selected ? lvl.color : 'rgba(0,0,0,0.10)', boxShadow: selected ? `0 0 0 2px ${lvl.color}55` : 'none' }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        {LEVELS.map(l => (
          <span key={l.key} className="text-[10px] font-medium" style={{ color: l.key === value ? l.color : '#9ca3af' }}>{l.label}</span>
        ))}
      </div>
      {(descriptions && descriptions[value]) && (
        <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">{descriptions[value]}</p>
      )}
    </div>
  );
}
