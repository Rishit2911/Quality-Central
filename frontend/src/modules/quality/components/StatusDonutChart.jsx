import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const DEFAULT_BREAKDOWN = [
  { name: 'Open', value: 0, pct: 0, color: '#3B82F6' },
  { name: 'In Progress', value: 0, pct: 0, color: '#F59E0B' },
  { name: 'Resolved', value: 0, pct: 0, color: '#10B981' },
  { name: 'Reopened', value: 0, pct: 0, color: '#EF4444' },
  { name: 'Closed', value: 0, pct: 0, color: '#06B6D4' }
];

const CustomDonutTooltip = ({ active, payload, isZero }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  if (isZero) {
    return (
      <div className="bg-white/95 backdrop-blur-md border border-[#ebe4ff] rounded-2xl px-4 py-3 shadow-[0_10px_30px_rgba(124,58,237,0.1)]">
        <p className="text-xs font-bold text-slate-700">0 Active Bugs</p>
        <p className="text-[10px] text-slate-400">All systems verified</p>
      </div>
    );
  }
  return (
    <div className="bg-white/95 backdrop-blur-md border border-[#ebe4ff] rounded-2xl px-4 py-3 shadow-[0_10px_30px_rgba(124,58,237,0.1)]">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: data.color }} />
        <span className="text-[11px] font-black uppercase tracking-wider text-[#0F172A]">
          {data.name}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="font-extrabold text-[#0F172A]">{data.value} Bugs</span>
        <span className="text-[10px] font-bold text-black/50 bg-[#F1F5F9] px-2 py-0.5 rounded-full">
          {data.pct}%
        </span>
      </div>
    </div>
  );
};

export default function StatusDonutChart({ data = {}, onSelectStatus }) {
  const total = data.total !== undefined ? data.total : 0;
  const breakdown = data.breakdown || DEFAULT_BREAKDOWN;
  const isZero = total === 0 || breakdown.every((b) => Number(b.value) === 0);

  // When total is 0, render a soft placeholder ring
  const pieData = isZero
    ? [{ name: 'Zero Issues', value: 1, color: '#EDE9FE' }]
    : breakdown;

  return (
    <div className="bg-white border border-[#ebe4ff] rounded-[2rem] p-8 shadow-[0_10px_40px_rgba(180,140,255,0.04)] flex flex-col justify-between transition-all duration-300 hover:shadow-[0_15px_45px_rgba(124,58,237,0.06)] h-full">
      {/* Card Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#7C3AED]">
            STATUS OVERVIEW
          </h3>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Current lifecycle distribution of project issues
          </p>
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest text-[#7C3AED] bg-[#F5F0FF] px-2.5 py-1 rounded-full border border-[#E9DDFF]">
          Realtime
        </span>
      </div>

      {/* Main Container: Donut + Stacked Legend */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 my-auto">
        {/* Donut Chart with Centered Number */}
        <div className="relative w-[210px] h-[210px] shrink-0 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<CustomDonutTooltip isZero={isZero} />} />
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={96}
                paddingAngle={isZero ? 0 : 3}
                dataKey="value"
                strokeWidth={0}
                onClick={(entry) => !isZero && onSelectStatus?.(entry.name)}
                className={!isZero && onSelectStatus ? "cursor-pointer" : ""}
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    className="transition-all duration-200 outline-none"
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Centered Donut Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span className="text-3xl font-black text-slate-900 tracking-tight leading-none">
              {total}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-1">
              Total
            </span>
          </div>
        </div>

        {/* Stacked Legend */}
        <div className="flex-1 w-full flex flex-col gap-2.5">
          {breakdown.map((item) => (
            <div
              key={item.name}
              onClick={() => onSelectStatus?.(item.name)}
              className="flex items-center justify-between p-2 rounded-xl hover:bg-[#FAF8FF] transition-all cursor-pointer group active:scale-98"
              title={`View ${item.name} bugs in Bug List`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3 h-3 rounded-full shrink-0 shadow-sm transition-transform group-hover:scale-125"
                  style={{ background: item.color }}
                />
                <span className="text-xs font-bold text-slate-800 group-hover:text-violet-700 transition-colors">
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900 group-hover:text-violet-900">
                  {item.value}
                </span>
                <span className="text-[10px] font-bold text-slate-400 min-w-[32px] text-right">
                  {item.pct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
