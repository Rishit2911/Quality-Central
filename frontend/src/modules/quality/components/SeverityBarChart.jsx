import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';

const DEFAULT_SEVERITY_DATA = [
  { severity: 'Critical', count: 0, color: '#EF4444', gradientId: 'critGrad' },
  { severity: 'High', count: 0, color: '#F97316', gradientId: 'highGrad' },
  { severity: 'Medium', count: 0, color: '#3B82F6', gradientId: 'medGrad' },
  { severity: 'Low', count: 0, color: '#10B981', gradientId: 'lowGrad' }
];

// Custom top label renderer to show numbers above bars
const renderCustomBarLabel = (props) => {
  const { x, y, width, value } = props;
  return (
    <text
      x={x + width / 2}
      y={y - 8}
      fill="#0F172A"
      textAnchor="middle"
      fontSize={12}
      fontWeight={800}
      fontFamily="inherit"
    >
      {value}
    </text>
  );
};

const CustomSeverityTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white/95 backdrop-blur-md border border-[#ebe4ff] rounded-2xl px-4 py-3 shadow-[0_10px_30px_rgba(124,58,237,0.1)]">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: data.color }} />
        <span className="text-[11px] font-black uppercase tracking-wider text-[#0F172A]">
          {data.severity} Severity
        </span>
      </div>
      <p className="text-xs font-bold text-slate-500">
        Active Issues: <span className="font-extrabold text-[#0F172A]">{data.count}</span>
      </p>
    </div>
  );
};

export default function SeverityBarChart({ data = [] }) {
  const chartData = data && data.length > 0 ? data : DEFAULT_SEVERITY_DATA;

  return (
    <div className="bg-white border border-[#ebe4ff] rounded-[2rem] p-8 shadow-[0_10px_40px_rgba(180,140,255,0.04)] flex flex-col justify-between transition-all duration-300 hover:shadow-[0_15px_45px_rgba(124,58,237,0.06)] h-full">
      {/* SVG Gradient Definitions */}
      <svg width={0} height={0} className="absolute">
        <defs>
          <linearGradient id="critGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EF4444" stopOpacity={1} />
            <stop offset="100%" stopColor="#F87171" stopOpacity={0.7} />
          </linearGradient>
          <linearGradient id="highGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F97316" stopOpacity={1} />
            <stop offset="100%" stopColor="#FB923C" stopOpacity={0.7} />
          </linearGradient>
          <linearGradient id="medGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
            <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.7} />
          </linearGradient>
          <linearGradient id="lowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
            <stop offset="100%" stopColor="#34D399" stopOpacity={0.7} />
          </linearGradient>
        </defs>
      </svg>

      {/* Card Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#7C3AED]">
            BUGS BY SEVERITY
          </h3>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Impact classification and priority distribution
          </p>
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest text-[#059669] bg-[#ECFDF5] px-2.5 py-1 rounded-full border border-[#A7F3D0]">
          SLAs Tracked
        </span>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-[240px] pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 15, left: -20, bottom: 5 }}
            barSize={44}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#F1F5F9"
            />
            <XAxis
              dataKey="severity"
              tickLine={false}
              axisLine={{ stroke: '#E2E8F0' }}
              tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fontWeight: 600, fill: '#94A3B8' }}
              domain={[0, (dataMax) => Math.max(10, dataMax + 2)]}
            />
            <Tooltip content={<CustomSeverityTooltip />} />
            <Bar
              dataKey="count"
              radius={[10, 10, 0, 0]}
              label={renderCustomBarLabel}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`severity-bar-${index}`}
                  fill={entry.color}
                  className="transition-all duration-200 hover:opacity-85 cursor-pointer"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
