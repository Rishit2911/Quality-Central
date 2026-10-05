import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

import "../styles/admin.css";

import logo from "../../../assets/phy360.png";
import ewandzLogo from "../../../assets/EWANDZ.png";
import bellIcon from "../../../assets/bell.png";
import logoutIcon from "../../../assets/exit.png";

import { useAuth } from "../../../core/auth/AuthContext";
import { MODULE_CONFIG } from "../../../core/config/modules";

import AdminPanel from "../components/AdminPanel";

// ── Import the notification hook ──
import { useNotifications } from "../../../core/context/NotificationContext";
import useTabListKeyNav from "../../../core/hooks/useTabListKeyNav";
import { getInitials } from "../../../core/utils/nameHelpers";

axios.defaults.withCredentials = true;

const hubNameMap = {
  source: "Talent Central",
  forge: "Learning Central",
  verify: "Assessment Central",
  deploy: "Employee Central",
  lexai: "LexAI",
};

// Standardized palette for the Funnel Chart
const PIE_PALETTE = ["#8B5CF6", "#F59E0B", "#10B981","#EC4899"];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-[#ebe4ff] p-3 rounded-xl shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#6b7280] mb-1">{payload[0].name}</p>
        <p className="text-sm font-black" style={{ color: payload[0].payload.fill }}>
          {payload[0].value} candidates
        </p>
      </div>
    );
  }
  return null;
};

export default function OrgDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const { logout, user, hasPermission, hasRole } = useAuth();

  // ── Use the global notification hook ──
  const { setShowNotifications } = useNotifications();

  const [activeSideTab, setActiveSideTab] = useState("overview");
  const handleTabKeyNav = useTabListKeyNav();

  const [stats, setStats] = useState({});
  const [funnel, setFunnel] = useState([]);
  const [activity, setActivity] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [journeys, setJourneys] = useState([]);
  const [team, setTeam] = useState([]);

  const modules = Object.entries(MODULE_CONFIG)
    .filter(([_, config]) => hasPermission?.(config.permission))
    .map(([key, config]) => ({
      id: key,
      name: config.label,
      path: config.route,
    }));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [
        statsRes,
        funnelRes,
        activityRes,
        alertsRes,
        journeysRes,
        teamRes,
      ] = await Promise.all([
        axios.get("/api/org/dashboard-stats"),
        axios.get("/api/org/pipeline-funnel"),
        axios.get("/api/org/recent-activity"),
        axios.get("/api/org/alerts"),
        axios.get("/api/org/journey-overview"),
        axios.get("/api/org/team-overview"),
      ]);

      const statsData = statsRes.data || {};
      setStats(statsData);

      // ── Always use stats data for funnel to ensure consistency ──
      // This guarantees the pie chart matches the KPI cards
      const funnelData = [
        { stage: "Sourced", count: statsData.total_candidates || 0 },
        { stage: "Training", count: statsData.currently_training || 0 },
        { stage: "Verified", count: statsData.verified_ready || 0 },
        { stage: "Deployed", count: statsData.active_employees || 0 },
      ];

      console.log('Funnel Data from Stats:', funnelData);
      setFunnel(funnelData);

      setActivity(Array.isArray(activityRes.data) ? activityRes.data : []);
      setAlerts(Array.isArray(alertsRes.data) ? alertsRes.data : []);
      setJourneys(Array.isArray(journeysRes.data) ? journeysRes.data : []);
      setTeam(Array.isArray(teamRes.data) ? teamRes.data : []);
    } catch (err) {
      console.error("Dashboard error:", err);
    }
  };

  const displayName =
    user?.name || user?.username || user?.email?.split("@")[0] || "User";

  const getRoleDisplay = () => {
    if (hasRole?.("super_admin")) return "Super Admin";
    if (hasRole?.("org_admin")) return "Organization Admin";
    if (hasRole?.("manager")) return "Manager";
    return "Organization Admin";
  };

  // ── Card Click Handlers ──
  const handleCandidatesClick = () => {
    navigate('/source?tab=directory');
  };

  const handleTrainingClick = () => {
    navigate('/forge?tab=academy');
  };

  const handleVerifiedClick = () => {
    navigate('/verify?tab=home');
  };

  const handleEmployeesClick = () => {
    navigate('/deploy?tab=personnel');
  };

  // ── Prepare data for Recharts PieChart ──
  const pieChartData = funnel.map((f, i) => ({
    name: f.stage,
    value: f.count,
    fill: PIE_PALETTE[i % PIE_PALETTE.length],
  }));

  // ── KPI CARDS - ONLY 4 ──
  const kpiItems = [
    {
      label: "Potential Candidates",
      value: stats.total_candidates || 0,
      subtitle: "Total Candidates",
      accent: "#8b5cf6",
      bgIcon: "#f4ecff",
      onClick: handleCandidatesClick,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      )
    },
    {
      label: "Ongoing Training",
      value: stats.currently_training || 0,
      subtitle: "In Training",
      accent: "#F59E0B",
      bgIcon: "#fef3c7",
      onClick: handleTrainingClick,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
          <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
        </svg>
      )
    },
    {
      label: "Assesment Assigned",
      value: stats.verified_ready || 0,
      subtitle: "Proctured & Ready",
      accent: "#10B981",
      bgIcon: "#d1fae5",
      onClick: handleVerifiedClick,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <path d="m9 11 2 2 4-4"></path>
        </svg>
      )
    },
    {
      label: "Onboarded Employees",
      value: stats.active_employees || 0,
      subtitle: "Active Employees",
      accent: "#e731ad",
      bgIcon: "#fce7f3",
      onClick: handleEmployeesClick,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e731ad" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
      )
    }
  ];

  return (
    <div className="dashboard-page">
      {/* TOPBAR */}
      <div className="topbar">
        <div className="top-left">
          <img src={logo} className="logo" alt="logo" />
        </div>
        <div className="top-center">
          <div className="hub-tabs">
            <button
              className={`hub-tab ${
                location.pathname === "/admin" ? "active" : ""
              }`}
              onClick={() => navigate("/admin")}
            >
              Dashboard
            </button>
            {modules.map((m) => (
              <button
                key={m.id}
                className={`hub-tab ${
                  location.pathname.startsWith(m.path) ? "active" : ""
                }`}
                onClick={() => navigate(m.path)}
              >
                {hubNameMap[m.id] || m.name}
              </button>
            ))}
          </div>
        </div>
        <div className="top-right">
          {/* Bell icon - opens notification dropdown */}
          <img 
            src={bellIcon} 
            className="icon cursor-pointer" 
            alt="bell" 
            aria-label="Open notifications"
            onClick={() => {
              console.log("Bell clicked - opening notifications");
              setShowNotifications(true);
            }}
          />
          <img
            src={logoutIcon}
            className="icon logout-icon"
            alt="logout"
            aria-label="Log out"
            onClick={() => {
              logout();
              navigate("/");
            }}
          />
          <div className="profile-wrap">
            <div className="avatar">
              {user?.photo_path ? (
                <img src={`/api/employee/${user.employee_code}/document/pfp`} alt="" />
              ) : (
                getInitials(displayName)
              )}
            </div>
            <div className="profile-text">
              <h4>{displayName}</h4>
              <p>{getRoleDisplay()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="dashboard-body">
        {/* SIDEBAR */}
        <div className="sidebar" data-no-tooltip onKeyDown={handleTabKeyNav}>
          <button
            className={activeSideTab === "overview" ? "active" : ""}
            onClick={() => setActiveSideTab("overview")}
          >
            Overview
          </button>
          {hasPermission?.("admin.users.manage") && (
            <button
              className={activeSideTab === "users" ? "active" : ""}
              onClick={() => setActiveSideTab("users")}
            >
              Users
            </button>
          )}
          <div className="sidebar-brand">
            <img src={ewandzLogo} alt="Ewandz" />
          </div>
        </div>

        {/* CONTENT */}
        <div className="content">
          {/* OVERVIEW */}
          {activeSideTab === "overview" && (
            <>
              <h2 style={{ marginBottom: "32px" }}>Welcome, {displayName}</h2>

              {/* KPI CARDS - 4 columns */}
              <div
                className="grid grid-cols-2 sm:grid-cols-4"
                style={{
                  gap: "20px",
                  marginBottom: "28px",
                }}
              >
                {kpiItems.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #ece4ff",
                      borderTop: `4px solid ${item.accent}`,
                      borderRadius: "20px",
                      padding: "24px",
                      minHeight: "135px",
                      color: "#111827",
                      transition: "all .25s cubic-bezier(0.4, 0, 0.2, 1)",
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(124,58,237,0.08)",
                      position: "relative",
                      display: "flex",
                      flexDirection: "column"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px)";
                      e.currentTarget.style.boxShadow = "0 12px 24px rgba(124,58,237,0.12)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 14px rgba(124,58,237,0.08)";
                    }}
                    onClick={item.onClick}
                  >
                    {/* Left Icon Circle Container */}
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        background: item.bgIcon,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      {item.icon}
                    </div>

                    {/* Decorative Dot Matrix */}
                    <div 
                      className="card-dots"
                      style={{ 
                        position: "absolute", 
                        top: "18px", 
                        right: "18px", 
                        opacity: 0.12, 
                        fontSize: "10px", 
                        lineHeight: "10px",
                        whiteSpace: "pre",
                        letterSpacing: "1.5px"
                      }}
                    >
                      {"• • •\n• • •\n• • •"}
                    </div>

                    <p
                      style={{
                        fontSize: "11px",
                        fontWeight: 800,
                        letterSpacing: ".08em",
                        textTransform: "uppercase",
                        color: "rgba(0,0,0,.55)",
                        marginTop: "16px",
                        marginBottom: "4px"
                      }}
                    >
                      {item.label}
                    </p>
                    
                    <h2
                      style={{
                        fontSize: "42px",
                        fontWeight: 900,
                        color: "#111827",
                        margin: "0 0 4px 0",
                        lineHeight: "1"
                      }}
                    >
                      {item.value}
                    </h2>

                    <p
                      style={{
                        fontSize: "12px",
                        color: "rgba(0,0,0,.45)",
                        margin: 0
                      }}
                    >
                      {item.subtitle}
                    </p>
                  </div>
                ))}
              </div>

              {/* ROW 1: FUNNEL & ACTIVITY */}
              <div
                className="grid grid-cols-1 lg:[grid-template-columns:1.5fr_1fr]"
                style={{
                  gap: "20px",
                  marginBottom: "20px",
                }}
              >
                {/* RECRUITMENT FUNNEL (PIE CHART) - USING RECHARTS */}
                <div className="section boxed" style={{ margin: 0, display: "flex", flexDirection: "column" }}>
                  <h3 style={{ marginBottom: "24px" }}>Candidate Pipeline</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "40px", flex: 1 }}>
                    <div style={{ width: "180px", height: "180px", flexShrink: 0 }}>
                        <PieChart width={180} height={180}>
                          <Pie
                            data={pieChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={4}
                            stroke="none"
                          >
                            {pieChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                      {funnel.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div
                            style={{
                              width: "12px",
                              height: "12px",
                              borderRadius: "50%",
                              background: PIE_PALETTE[i % PIE_PALETTE.length],
                            }}
                          />
                          <span style={{ fontWeight: 600, flex: 1 }}>{f.stage}</span>
                          <span style={{ fontWeight: 800 }}>{f.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* RECENT ACTIVITY TIMELINE */}
                <div className="section boxed" style={{ margin: 0 }}>
                  <h3 style={{ marginBottom: "20px" }}>Recent Activity</h3>
                  {activity.length === 0 ? (
                    <p>No recent activity</p>
                  ) : (
                    <div style={{ position: "relative", paddingLeft: "24px" }}>
                      <div
                        style={{
                          position: "absolute",
                          left: "4px",
                          top: "8px",
                          bottom: "16px",
                          width: "2px",
                          background: "#e5e7eb",
                        }}
                      />
                      {activity.slice(0, 5).map((a, index) => (
                        <div
                          key={index}
                          style={{ position: "relative", marginBottom: "20px" }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              left: "-24px",
                              top: "4px",
                              width: "10px",
                              height: "10px",
                              borderRadius: "50%",
                              background: "#8b5cf6",
                              border: "2px solid #fff",
                            }}
                          />
                          <p style={{ fontWeight: 700, margin: "0 0 4px 0", fontSize: "14px" }}>
                            {a.details || a.message}
                          </p>
                          <span style={{ fontSize: "12px", color: "#888", fontWeight: 500 }}>
                            Activity Event
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ROW 2: CORE TEAM OVERVIEW */}
              <div className="section boxed" style={{ margin: 0, width: "100%" }}>
                <h3 style={{ marginBottom: "20px" }}>Core Team Overview</h3>
                <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: "480px", textAlign: "left", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #eaeaea" }}>
                      <th style={{ paddingBottom: "12px" }}>User</th>
                      <th style={{ paddingBottom: "12px", paddingRight: "48px", width: "1%", whiteSpace: "nowrap", textAlign: "center" }}>Role</th>
                      <th style={{ paddingBottom: "12px", paddingRight: "24px", width: "1%", whiteSpace: "nowrap", textAlign: "center" }}>Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...team].sort((a, b) => (a.username || a.name || a.email || '').localeCompare(b.username || b.name || b.email || '')).map((u, i) => {
                      const cellStyle = {
                        padding: "14px 0",
                        verticalAlign: "middle",
                        borderTop: "none",
                        borderBottom: "1px solid #f5f5f5",
                        lineHeight: 1.2,
                      };
                      return (
                      <tr key={i}>
                        <td style={cellStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div
                              style={{
                                width: "38px",
                                height: "38px",
                                minWidth: "38px",
                                flexShrink: 0,
                                borderRadius: "50%",
                                background: "#CC97FF",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 900,
                                color: "#000",
                              }}
                            >
                              {getInitials(u.username || u.name || u.email)}
                            </div>
                            <div style={{ fontWeight: 600 }}>
                              {u.username || u.name || u.email}
                            </div>
                          </div>
                        </td>
                        <td style={{ ...cellStyle, paddingRight: "48px", width: "1%", whiteSpace: "nowrap", textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-block",
                              background: "#f4ecff",
                              color: "#7c3aed",
                              padding: "6px 12px",
                              borderRadius: "999px",
                              fontSize: "12px",
                              fontWeight: 700,
                              lineHeight: 1.2,
                            }}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td style={{ ...cellStyle, color: "#666", fontSize: "14px", paddingRight: "24px", width: "1%", whiteSpace: "nowrap", textAlign: "center" }}>
                          {u.last_active ? new Date(u.last_active).toLocaleDateString() : "-"}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </>
          )}

          {/* USERS */}
          {activeSideTab === "users" && hasPermission?.("admin.users.manage") && (
            <AdminPanel />
          )}

        </div>
      </div>
    </div>
  );
}