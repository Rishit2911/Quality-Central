import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import HorizontalLoader from '../../../core/components/HorizontalLoader';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Activity,
  TrendingUp,
  Briefcase,
  Clock,
  RefreshCw,
  AlertCircle,
  MapPin,
  Package,
  Bell
} from 'lucide-react';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend
} from 'recharts';

import { useNotifications } from '../../../core/context/NotificationContext';
import { usePermissions } from '../../../core/auth/usePermissions';
import { P } from '../../../core/permissions';

const PALETTE = [
  '#8B5CF6', // primary lilac
  '#06B6D4', // cyan
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#3B82F6', // blue
  '#EC4899', // pink
  '#6366F1'  // indigo
];

const CHART_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#6366F1', '#EF4444'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="bg-white border border-[#ebe4ff] rounded-2xl px-4 py-3 shadow-xl">
      <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">
        {label}
      </p>

      {payload.map((p, i) => (
        <div
          key={i}
          className="flex items-center gap-2 text-sm font-bold"
          style={{ color: p.color || p.fill }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: p.color || p.fill }}
          />
          <span>{p.name}:</span>
          <span className="text-black">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const PercentTooltip = ({ active, payload, data }) => {
  if (!active || !payload?.length) return null;

  const entry = payload[0];
  const total = (data || []).reduce((sum, d) => sum + (d.value || 0), 0);
  const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0.0';
  const color = entry.color || entry.payload?.fill;

  return (
    <div className="bg-white border border-[#ebe4ff] rounded-2xl px-4 py-3 shadow-xl">
      <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">
        {entry.name}
      </p>

      <div
        className="flex items-center gap-2 text-sm font-bold"
        style={{ color }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: color }}
        />
        <span className="text-black">{pct}%</span>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, color, borderColor, icon: Icon, sub, onClick }) => (
    <div 
      onClick={onClick}
      className={`bg-white border border-[#ebe4ff] p-6 shadow-[0_10px_40px_rgba(180,140,255,0.08)] relative overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_rgba(124,58,237,0.08)] ${onClick ? 'cursor-pointer' : ''} border-t-4 ${borderColor}`}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
        style={{
          background: `${color}15`,
          border: `1px solid ${color}25`
        }}
      >
        <Icon size={20} style={{ color }} />
      </div>

      {/* ── NUMBER - NOW BLACK ── */}
      <h3 className="text-4xl font-black leading-none mb-2 text-black">
        {value}
      </h3>

      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-black/50">
        {label}
      </p>

      {sub && (
        <p className="text-[9px] text-black mt-2 uppercase tracking-widest flex items-center gap-1">
          {sub}
        </p>
      )}
    </div>
  );

const ChartCard = ({ title, children, className = '' }) => (
  <div
    className={`
      bg-white
      border
      border-[#ebe4ff]
        
      p-8
      shadow-[0_10px_40px_rgba(180,140,255,0.08)]
      flex
      flex-col
      gap-6
      ${className}
    `}
  >
    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#7c3aed]">
      {title}
    </h3>

    <div className="w-full" style={{ height: 320, minHeight: 0 }}>
      {children}
    </div>
  </div>
);

export default function DeployAnalytics() {
  const navigate = useNavigate();
  const { setShowNotifications } = useNotifications();
  const { hasPermission } = usePermissions();

  const canViewKpis = hasPermission(P.DEPLOY_ANALYTICS_VIEW_KPIS);
  const canViewStatus = hasPermission(P.DEPLOY_ANALYTICS_VIEW_STATUS);
  const canViewHiring = hasPermission(P.DEPLOY_ANALYTICS_VIEW_HIRING);
  const canViewDemographics = hasPermission(P.DEPLOY_ANALYTICS_VIEW_DEMO);
  const canViewTalent = hasPermission(P.DEPLOY_ANALYTICS_VIEW_TALENT);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [totalAssets, setTotalAssets] = useState(0);

  const fetchStats = async () => {
    setLoading(true);

    try {
      const res = await fetch('/api/dashboard/stats', {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error(`API Error ${res.status}`);
      }

      const data = await res.json();
      setStats(data);

      await fetchAssetsData();

      setLastRefresh(new Date());
    } catch (e) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssetsData = async () => {
    try {
      const res = await fetch('/api/employees', {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Failed to fetch employees');
      }

      const employees = await res.json();
      const employeeList = Array.isArray(employees) ? employees : [];

      let allocatedCount = 0;
      const assetFields = ['ob_laptop', 'ob_laptop_bag', 'ob_headphones', 'ob_mouse', 
                          'ob_extra_hardware', 'ob_client_assets', 'ob_id_card', 
                          'ob_email_access', 'ob_groups', 'ob_mediclaim', 'ob_pf'];

      const assetPromises = employeeList.map(async (emp) => {
        try {
          const assetRes = await fetch(`/api/assets/${emp.employee_code}`, {
            credentials: 'include'
          });
          if (assetRes.ok) {
            const assetData = await assetRes.json();
            let employeeAllocated = 0;
            assetFields.forEach(field => {
              if (assetData[field] === 1 || assetData[field] === true) {
                employeeAllocated++;
              }
            });
            return employeeAllocated;
          }
          return 0;
        } catch {
          return 0;
        }
      });

      const results = await Promise.all(assetPromises);
      allocatedCount = results.reduce((sum, count) => sum + count, 0);

      setTotalAssets(allocatedCount);

    } catch (error) {
      console.error('Error fetching assets data:', error);
      setTotalAssets(0);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleEmployeesClick = () => {
    navigate('/deploy?tab=personnel');
  };

  const handleAttendanceClick = () => {
    navigate('/deploy?tab=attendance');
  };

  const handleAssetsClick = () => {
    navigate('/deploy?tab=assets');
  };

  const handleAlertsClick = () => {
    setShowNotifications(true);
  };

  if (loading) {
    return <HorizontalLoader label="Loading analytics..." />;
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle size={40} className="text-[#7c3aed]" />

        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-black/40">
          Analytics unavailable
        </p>
      </div>
    );
  }

  const { counts = {}, charts = {}, recent_hires = [] } = stats;

const departmentData = charts.department || [];

// ── GROUP AND NORMALIZE STATUS DATA ──
const rawStatusData = charts.status || [];

// Function to normalize status names
const normalizeStatusName = (name) => {
  if (!name) return 'Unknown';
  const lower = name.toLowerCase().trim();
  if (lower === 'active') return 'Active';
  if (lower === 'notice period' || lower === 'on notice' || lower === 'notice' || lower === 'onnotice') {
    return 'Notice Period';
  }
  if (lower === 'exited' || lower === 'terminated') return 'Exited';
  if (lower === 'inactive') return 'Inactive';
  // Exclude "On Leave" or any status with "leave"
  if (lower.includes('leave')) return null;
  return name;
};

// Group statuses by normalized name
const statusMap = {};
rawStatusData.forEach(item => {
  const normalized = normalizeStatusName(item.name);
  if (normalized === null) return; // Skip "On Leave" and similar
  if (statusMap[normalized]) {
    statusMap[normalized] += item.value;
  } else {
    statusMap[normalized] = item.value;
  }
});

// Convert back to array for chart
const statusData = Object.keys(statusMap).map(name => ({
  name: name,
  value: statusMap[name]
}));

const hiringTrend = (charts.hiring_trend || []).map(h => ({
  name: String(h.Year || h.name),
  value: h.Hires || h.value || 0
}));

  const skillsData = charts.skills || [];

  const experienceData = (charts.experience || []).map(e => ({
    name: e.range || e.name,
    value: e.count || e.value || 0
  }));

  const tenureData = (charts.tenure || []).map(t => ({
    name: t.range || t.name,
    value: t.count || t.value || 0
  }));

  const locationData = charts.location || [];

  return (
    <div className="space-y-8 animate-fade-in-up">

      {/* HEADER */}
      <div className="bg-[#f6f0ff] border border-[#ebe4ff] rounded-[2.5rem] p-10">
        <div className="flex justify-between items-end flex-wrap gap-6">

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#7c3aed] mb-3">
              Organization Analytics
            </p>

            <h1 className="text-5xl font-black text-black tracking-tight leading-none">
              Employee Central Analytics
            </h1>

            {/* <p className="text-black/70 mt-5 text-lg">
              Live operational metrics, employee overview, onboarding health and organization activity.
            </p> */}
          </div>

          <div className="flex items-center gap-4">

            {lastRefresh && (
              <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                Updated {lastRefresh.toLocaleTimeString()}
              </p>
            )}

            <button
              onClick={fetchStats}
              className="
                px-6
                py-4
                rounded-2xl
                bg-black
                text-white
                text-[10px]
                font-black
                uppercase
                tracking-[0.3em]
                flex
                items-center
                gap-3
                hover:opacity-90
                transition-all
              "
            >
              <RefreshCw size={14} />
              Refresh
            </button>

          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      {canViewKpis && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

        {/*  Employees - Purple */}
        <StatCard
          label="Employees"
          value={counts.total ?? 0}
          color="#8B5CF6"
          borderColor="border-t-purple-500"
          icon={Users}
          sub="Total Employee Profiles"
          onClick={handleEmployeesClick}
        />

        {/*  Attendance - amber */}
        <StatCard
          label="Attendance"
          value={`${counts.attendance_rate ?? 0}%`}
          color="#F59E0B"
          borderColor="border-t-amber-500"
          icon={Activity}
          sub="Present Today / Attendance Rate"
          onClick={handleAttendanceClick}
        />

        {/* 📋 Assets - green */}
        <StatCard
          label="Assets"
          value={totalAssets}
          color="#10B981"
          borderColor="border-t-emerald-500"
          icon={Package}
          sub="Total Assets Allocated"
          onClick={handleAssetsClick}
        />

        {/* ⚠️ Alerts - pink */}
        <StatCard
          label="Alerts"
          value={counts.pending_approvals ?? 0}
          color="#EC4899"
          borderColor="border-t-pink-500"
          icon={Bell}
          sub="Pending Approvals / Pending Actions"
          onClick={handleAlertsClick}
        />

        </div>
      )}

      {/* ROW 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {canViewStatus && (
          <ChartCard title="Employment Status">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={4}
              >
                {statusData.map((entry, index) => {
                  // Map specific colors for status names
                  let color = CHART_COLORS[index % CHART_COLORS.length];
                  if (entry.name === 'Active') color = '#10B981';
                  else if (entry.name === 'Notice Period') color = '#F59E0B';
                  else if (entry.name === 'Exited') color = '#EF4444';
                  else if (entry.name === 'Inactive') color = '#3B82F6';
                  return <Cell key={index} fill={color} />;
                })}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#000'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        )}

        {canViewHiring && (
        <ChartCard
          title="Hiring Trend"
          className="xl:col-span-2"
        >
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={hiringTrend}>

              <defs>
                <linearGradient id="purpleGradient">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(124,58,237,0.08)"
              />

              <XAxis
                dataKey="name"
                stroke="rgba(0,0,0,0.35)"
                fontSize={10}
                fontWeight={900}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                allowDecimals={false}
                domain={[0, 'dataMax + 1']}
                stroke="rgba(0,0,0,0.35)"
                fontSize={10}
                fontWeight={900}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip content={<CustomTooltip />} />

              <Area
                type="monotone"
                dataKey="value"
                stroke="#7c3aed"
                strokeWidth={4}
                fill="url(#purpleGradient)"
              />

            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        )}

      </div>

      {/* ROW 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {canViewDemographics && (
          <>
            <ChartCard
              title="Department Distribution"
              className="xl:col-span-2"
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={departmentData}
                  layout="vertical"
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(124,58,237,0.08)"
                  />

                  <XAxis
                    type="number"
                    stroke="rgba(0,0,0,0.35)"
                    fontSize={10}
                    fontWeight={900}
                    tickLine={false}
                    axisLine={false}
                  />

                  <YAxis
                    dataKey="name"
                    type="category"
                    width={120}
                    stroke="rgba(0,0,0,0.35)"
                    fontSize={10}
                    fontWeight={900}
                    tickLine={false}
                    axisLine={false}
                  />

                  <Tooltip content={<CustomTooltip />} />

                  <Bar
                    dataKey="value"
                    radius={[0, 8, 8, 0]}
                  >
                    {departmentData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>

                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Location Distribution">
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>

                  <Pie
                    data={locationData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={100}
                  >
                    {locationData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>

                  <Tooltip content={<PercentTooltip data={locationData} />} />

                  <Legend
                    wrapperStyle={{
                      fontSize: '11px',
                      fontWeight: 700
                    }}
                  />

                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </>
        )}

      </div>

      {/* ROW 3 */}
      {canViewTalent && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        <ChartCard title="Top Skills">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={skillsData}>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(124,58,237,0.08)"
              />

              <XAxis
                dataKey="name"
                stroke="rgba(0,0,0,0.35)"
                fontSize={10}
                fontWeight={900}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                allowDecimals={false}
                domain={[0, 'dataMax + 1']}
                stroke="rgba(0,0,0,0.35)"
                fontSize={10}
                fontWeight={900}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip content={<CustomTooltip />} />

              <Bar dataKey="value">
                {skillsData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
              </Bar>

            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Experience Distribution">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={experienceData}>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(124,58,237,0.08)"
              />

              <XAxis
                dataKey="name"
                stroke="rgba(0,0,0,0.35)"
                fontSize={10}
                fontWeight={900}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                allowDecimals={false}
                domain={[0, 'dataMax + 1']}
                stroke="rgba(0,0,0,0.35)"
                fontSize={10}
                fontWeight={900}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip content={<CustomTooltip />} />

              <Bar
                dataKey="value"
                fill="#3B82F6"
                radius={[6, 6, 0, 0]}
              />

            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tenure Distribution">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={tenureData}>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(124,58,237,0.08)"
              />

              <XAxis
                dataKey="name"
                stroke="rgba(0,0,0,0.35)"
                fontSize={10}
                fontWeight={900}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                allowDecimals={false}
                domain={[0, 'dataMax + 1']}
                stroke="rgba(0,0,0,0.35)"
                fontSize={10}
                fontWeight={900}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip content={<CustomTooltip />} />

              <Bar
                dataKey="value"
                fill="#10B981"
                radius={[6, 6, 0, 0]}
              />

            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        </div>
      )}

      {/* TABLE */}
      {canViewHiring && (
        <div className="bg-white border border-[#ebe4ff]    overflow-hidden shadow-[0_10px_40px_rgba(180,140,255,0.08)]">

        <div className="px-8 py-6 border-b border-[#ebe4ff] flex items-center justify-between">
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-[#7c3aed]">
              Recent Hires
            </h3>

            <p className="text-black/70 mt-2">
              Latest onboarding activity
            </p>
          </div>

          <div className="px-4 py-2 rounded-full bg-[#f3e8ff] text-[#7c3aed] text-[10px] font-black uppercase tracking-[0.2em]">
            {recent_hires.length} Records
          </div>
        </div>

        <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">

          <thead className="bg-[#faf7ff]">
            <tr>
              {[
                'Employee',
                'Department',
                'Designation',
                'Location',
                'Status',
                'Joined'
              ].map(h => (
                <th
                  key={h}
                  className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.25em] text-black/40"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>

            {recent_hires.map((h, i) => (
              <tr
                key={i}
                className="border-t border-[#f3efff] hover:bg-[#faf7ff] transition-colors"
              >

                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">

                    <div className="w-10 h-10 rounded-xl bg-[#f3e8ff] border border-[#e9d5ff] flex items-center justify-center font-black text-[#7c3aed]">
                      {h.name?.[0] || 'A'}
                    </div>

                    <p className="font-bold text-black">
                      {h.name}
                    </p>

                  </div>
                </td>

                <td className="px-8 py-5 text-black/80">
                  {h.team || '—'}
                </td>

                <td className="px-8 py-5 text-black/80">
                  {h.designation || '—'}
                </td>

                <td className="px-8 py-5 text-black/80">
                  <div className="flex items-center gap-2">
                    <MapPin size={14} />
                    {h.location || '—'}
                  </div>
                </td>

                <td className="px-8 py-5">
                  <span className="px-4 py-2 rounded-full bg-[#f3e8ff] text-[#7c3aed] text-[10px] font-black uppercase tracking-[0.2em]">
                    {h.employment_status || 'Active'}
                  </span>
                </td>

                <td className="px-8 py-5 text-black/80 font-mono">
                  {h.doj_str || h.doj || '—'}
                </td>

              </tr>
            ))}

          </tbody>

        </table>
        </div>

      </div>
      )}

    </div>
  );
}