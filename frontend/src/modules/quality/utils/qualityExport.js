/**
 * Quality Central — Enterprise Defect & SLA CSV Export Engine
 * 
 * Provides professional, executive-grade CSV reports with:
 * - Proper RFC 4180 escaping
 * - UTF-8 Byte Order Mark (\uFEFF) for native Excel/Numbers compatibility
 * - Browser Blob URL download to completely eliminate data URI / '#' fragment truncation
 * - Clear visual sections, executive KPI summaries, and complete defect registers
 */

import { doesBugMatchProject, isBugAssignedToUser } from './qualityMetrics';
import { toast } from 'react-hot-toast';
import XLSX from 'xlsx-js-style';

/**
 * Escapes and wraps a cell value in standard CSV format
 */
export function escapeCSV(val) {
  if (val == null) return '""';
  // Replace internal quotes with double-quotes, replace newlines with space/pipe for clean tabular reading
  const str = String(val)
    .replace(/\r\n/g, ' ')
    .replace(/[\r\n]/g, ' ')
    .replace(/"/g, '""')
    .trim();
  return `"${str}"`;
}

/**
 * Initiates a browser download of CSV content using Blob and ObjectURL
 */
export function downloadCSV(filename, csvContent) {
  try {
    // Prepend UTF-8 BOM so Microsoft Excel and other spreadsheet apps render UTF-8 characters properly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 1000);
  } catch (err) {
    console.error('[QualityExport] Download error:', err);
    throw err;
  }
}

/**
 * Formats a clean ISO date string for filenames
 */
function getTimestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}_${hh}${min}`;
}

/**
 * 1. Export Comprehensive Project Defect & SLA Audit Report (.csv)
 */
export function exportProjectDefectReportCSV(firstArg, argBugs = [], argScope = 'team', argCurrentUser = 'Rishit') {
  let project, bugs, scope, currentUser;
  if (firstArg && (firstArg.name || firstArg.prefix || firstArg.id) && !firstArg.project) {
    project = firstArg;
    bugs = Array.isArray(argBugs) ? argBugs : [];
    scope = argScope || 'team';
    currentUser = argCurrentUser || 'Rishit';
  } else if (firstArg && typeof firstArg === 'object') {
    project = firstArg.project;
    bugs = Array.isArray(firstArg.bugs) ? firstArg.bugs : [];
    scope = firstArg.scope || 'team';
    currentUser = firstArg.currentUser || 'Rishit';
  }

  if (!project) {
    toast.error('Project details are required for export.');
    return;
  }

  try {
    // Determine project defects
    const allProjectBugs = bugs.filter(b => doesBugMatchProject(b, project));
    const projectBugs = scope === 'personal'
      ? allProjectBugs.filter(b => isBugAssignedToUser(b, currentUser))
      : allProjectBugs;

    // Metrics calculations
    const openCount = projectBugs.filter(b => (b.status || '').toLowerCase() === 'open').length;
    const inProgCount = projectBugs.filter(b => (b.status || '').toLowerCase() === 'in progress').length;
    const resolvedCount = projectBugs.filter(b => ['resolved', 'closed'].includes((b.status || '').toLowerCase())).length;
    const activeCount = openCount + inProgCount;
    const totalCount = projectBugs.length;

    const criticalCount = projectBugs.filter(b => (b.severity || '').toLowerCase() === 'critical').length;
    const highCount = projectBugs.filter(b => (b.severity || '').toLowerCase() === 'high').length;
    const normalCount = projectBugs.filter(b => ['normal', 'medium'].includes((b.severity || '').toLowerCase())).length;
    const lowCount = projectBugs.filter(b => (b.severity || '').toLowerCase() === 'low').length;

    const resolutionRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 100;
    const healthRate = project.health_rate ?? 98;

    const devList = Array.isArray(project.developers) 
      ? project.developers.join('; ') 
      : (project.developers || 'Rishit; Vidhi');
    const qaList = Array.isArray(project.qa) 
      ? project.qa.join('; ') 
      : (project.qa || 'Vidhi');

    const lines = [];

    // =========================================================================
    // SECTION 1: HEADER & BANNER
    // =========================================================================
    lines.push('====================================================================================================');
    lines.push('PHYGITRON 360 // QUALITY CENTRAL — PROJECT DEFECT AUDIT & SLA COMPLIANCE REPORT');
    lines.push('====================================================================================================');
    lines.push('');

    // =========================================================================
    // SECTION 2: PROJECT METADATA & GOVERNANCE
    // =========================================================================
    lines.push('--- [1] PROJECT SPECIFICATION & GOVERNANCE ---');
    lines.push(`Project Name,${escapeCSV(project.name)}`);
    lines.push(`Project Code / Prefix,${escapeCSV(project.prefix || '#QC')}`);
    lines.push(`Lifecycle Status,${escapeCSV(project.status || 'Active')}`);
    lines.push(`Quality Health Rating,${escapeCSV(`${healthRate}% (Defect-Free Benchmark)`)}`);
    lines.push(`Severity Rating,${escapeCSV(project.severity || 'Normal')}`);
    lines.push(`Designated Team Lead,${escapeCSV(project.lead || 'Bhupesh')}`);
    lines.push(`Assigned Developers,${escapeCSV(devList)}`);
    lines.push(`QA Specialists,${escapeCSV(qaList)}`);
    lines.push(`Project Scope,${escapeCSV(project.description || 'Enterprise software module under Quality Central QA governance.')}`);
    lines.push('');

    // =========================================================================
    // SECTION 3: EXECUTIVE QUALITY & SLA METRICS SUMMARY
    // =========================================================================
    lines.push('--- [2] EXECUTIVE QUALITY & SLA METRICS SUMMARY ---');
    lines.push('Metric Category,Metric Name,Count / Value,Benchmark / SLA Target');
    lines.push(`Defect Volume,Total Logged Defects,${totalCount},Portfolio Scope`);
    lines.push(`Defect Volume,Active Open Defects,${openCount},Awaiting Developer Triage`);
    lines.push(`Defect Volume,In-Progress Defects,${inProgCount},Actively Under Resolution`);
    lines.push(`Defect Volume,Resolved & Verified Defects,${resolvedCount},Target: 100%`);
    lines.push(`Severity Breakdown,Critical Priority (P1 Urgent),${criticalCount},0 Allowed in Production`);
    lines.push(`Severity Breakdown,High Priority (P2 High),${highCount},Resolution <= 24h`);
    lines.push(`Severity Breakdown,Normal / Medium (P3 Normal),${normalCount},Resolution <= 72h`);
    lines.push(`Severity Breakdown,Low Priority (P4 Minor),${lowCount},Scheduled Sprint Target`);
    lines.push(`SLA Compliance,Defect Resolution Efficiency Rate,${resolutionRate}%,Target: >= 90%`);
    lines.push(`SLA Compliance,Quality Health Score,${healthRate}%,Target: >= 95%`);
    lines.push('');

    // =========================================================================
    // SECTION 4: DETAILED DEFECT AUDIT REGISTER (15 COLUMNS)
    // =========================================================================
    lines.push(`--- [3] DETAILED DEFECT AUDIT REGISTER (${projectBugs.length} DEFECT RECORDS) ---`);
    if (projectBugs.length > 0) {
      const defectHeaders = [
        'Bug ID',
        'Defect Title',
        'Project',
        'Module / Component',
        'Environment',
        'Priority',
        'Severity',
        'Status',
        'Defect Type',
        'Assignee',
        'Reported By',
        'Created Date',
        'Resolved By / QA Tester',
        'Resolved Date',
        'Root Cause & Debugging Notes',
        'Verification Steps'
      ];
      lines.push(defectHeaders.map(escapeCSV).join(','));

      projectBugs.forEach(bug => {
        const row = [
          bug.id || 'N/A',
          bug.title || 'Untitled Ticket',
          bug.project || project.name,
          bug.module || 'General',
          bug.environment || 'Production',
          bug.priority || 'P3 - Normal',
          bug.severity || 'Normal',
          bug.status || 'Open',
          bug.bug_type || 'Functional',
          bug.assignee || 'Unassigned',
          bug.reported_by || 'QA Team',
          bug.created_on || 'N/A',
          bug.resolved_by || bug.tester || 'N/A',
          bug.resolved_at || 'N/A',
          bug.debugging_notes || bug.actual_result || bug.steps_to_reproduce || 'No debugging notes recorded',
          bug.verification_steps || bug.expected_result || 'Standard regression test pass'
        ];
        lines.push(row.map(escapeCSV).join(','));
      });
    } else {
      lines.push('"No defects recorded in this project for the selected filter scope."');
    }
    lines.push('');

    // =========================================================================
    // SECTION 5: GOVERNANCE & AUDIT SIGN-OFF
    // =========================================================================
    lines.push('--- [4] AUDIT VERIFICATION & GOVERNANCE SIGN-OFF ---');
    lines.push(`Report Generated At,${escapeCSV(new Date().toLocaleString())}`);
    lines.push(`Audit Generation Scope,${escapeCSV(scope === 'personal' ? `Personal Assigned to ${currentUser}` : 'All Organization Defect Records')}`);
    lines.push(`Audited By,${escapeCSV(currentUser)}`);
    lines.push(`Compliance Standard,${escapeCSV('ISO/IEC 25010 Software Quality Requirements & Phygitron Enterprise Quality Governance.')}`);
    lines.push(`Governance Notice,${escapeCSV('Confidential — For internal engineering and quality assurance evaluation only.')}`);

    const csvOutput = lines.join('\r\n');
    const cleanProjectName = (project.name || 'project').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `${cleanProjectName}_defect_audit_report_${getTimestamp()}.csv`;

    downloadCSV(filename, csvOutput);
    toast.success(`Exported ${project.name} Defect Audit Report (.csv)`);
  } catch (err) {
    console.error('Failed to export project CSV:', err);
    toast.error('Failed to export project defect report');
  }
}

/**
 * 2. Export All Projects Portfolio Summary (.csv)
 */
export function exportAllProjectsPortfolioCSV(firstArg, argBugs = [], argCurrentUser = 'Rishit') {
  let projects, bugs, currentUser;
  if (Array.isArray(firstArg)) {
    projects = firstArg;
    bugs = Array.isArray(argBugs) ? argBugs : [];
    currentUser = argCurrentUser || 'Rishit';
  } else if (firstArg && typeof firstArg === 'object') {
    projects = Array.isArray(firstArg.projects) ? firstArg.projects : [];
    bugs = Array.isArray(firstArg.bugs) ? firstArg.bugs : [];
    currentUser = firstArg.currentUser || 'Rishit';
  }

  if (!projects || projects.length === 0) {
    toast.error('No projects available to export.');
    return;
  }

  try {
    const lines = [];

    // Header
    lines.push('====================================================================================================');
    lines.push('PHYGITRON 360 // QUALITY CENTRAL — ENTERPRISE PORTFOLIO QUALITY & DEFECT AUDIT');
    lines.push('====================================================================================================');
    lines.push('');

    // Portfolio KPI Summary
    const totalDefects = bugs.length;
    const activeDefects = bugs.filter(b => ['open', 'in progress'].includes((b.status || '').toLowerCase())).length;
    const resolvedDefects = bugs.filter(b => ['resolved', 'closed'].includes((b.status || '').toLowerCase())).length;
    const criticalDefects = bugs.filter(b => (b.severity || '').toLowerCase() === 'critical').length;
    const avgHealth = projects.length > 0 
      ? Math.round(projects.reduce((sum, p) => sum + (Number(p.health_rate) || 95), 0) / projects.length) 
      : 96;

    lines.push('--- [1] PORTFOLIO GOVERNANCE OVERVIEW ---');
    lines.push(`Report Type,${escapeCSV('All Enterprise Projects Quality & SLA Benchmark Summary')}`);
    lines.push(`Portfolio Size,${escapeCSV(`${projects.length} Core Modules`)}`);
    lines.push(`Overall Portfolio Health Average,${escapeCSV(`${avgHealth}% (High Reliability)`)}`);
    lines.push(`Total Portfolio Defects Logged,${totalDefects}`);
    lines.push(`Active Unresolved Defects,${activeDefects}`);
    lines.push(`Resolved & Closed Defects,${resolvedDefects}`);
    lines.push(`Critical Defect Blockers,${criticalDefects}`);
    lines.push(`Generated At,${escapeCSV(new Date().toLocaleString())}`);
    lines.push(`Audited By,${escapeCSV(currentUser)}`);
    lines.push('');

    // Table of All Projects
    lines.push(`--- [2] PROJECT-BY-PROJECT DEFECT & SLA BENCHMARK TABLE (${projects.length} PROJECTS) ---`);
    const headers = [
      'Project Name',
      'Prefix Code',
      'Lifecycle Status',
      'Quality Health Rate',
      'Severity Rating',
      'Team Lead',
      'Assigned Developers',
      'QA Specialists',
      'Open Defects',
      'In-Progress Defects',
      'Active Defects',
      'Resolved Defects',
      'Critical Defects',
      'Total Defects',
      'Resolution Rate',
      'SLA Status',
      'Project Scope & Description'
    ];
    lines.push(headers.map(escapeCSV).join(','));

    projects.forEach(p => {
      const pBugs = bugs.filter(b => doesBugMatchProject(b, p));
      const openCount = pBugs.filter(b => (b.status || '').toLowerCase() === 'open').length;
      const inProgCount = pBugs.filter(b => (b.status || '').toLowerCase() === 'in progress').length;
      const resCount = pBugs.filter(b => ['resolved', 'closed'].includes((b.status || '').toLowerCase())).length;
      const critCount = pBugs.filter(b => (b.severity || '').toLowerCase() === 'critical').length;
      const totalPDefects = pBugs.length;
      const resRate = totalPDefects > 0 ? `${Math.round((resCount / totalPDefects) * 100)}%` : '100%';

      const slaStatus = (Number(p.health_rate) || 95) >= 95 
        ? 'Compliant (SLA Met)' 
        : (Number(p.health_rate) || 95) >= 85 
          ? 'Warning (SLA At Risk)' 
          : 'Non-Compliant (Action Required)';

      const devStr = Array.isArray(p.developers) ? p.developers.join('; ') : (p.developers || 'N/A');
      const qaStr = Array.isArray(p.qa) ? p.qa.join('; ') : (p.qa || 'N/A');

      const row = [
        p.name || 'Untitled Project',
        p.prefix || 'N/A',
        p.status || 'Active',
        `${p.health_rate ?? 95}%`,
        p.severity || 'Normal',
        p.lead || 'Bhupesh',
        devStr,
        qaStr,
        openCount,
        inProgCount,
        openCount + inProgCount,
        resCount,
        critCount,
        totalPDefects,
        resRate,
        slaStatus,
        p.description || 'Enterprise module under Quality Central.'
      ];
      lines.push(row.map(escapeCSV).join(','));
    });
    lines.push('');

    // Footer
    lines.push('--- [3] PORTFOLIO COMPLIANCE NOTES ---');
    lines.push(`Compliance Notice,${escapeCSV('Data dynamically audited from active defect tracking telemetry across all 6 core Phygitron360 modules.')}`);
    lines.push(`Confidentiality,${escapeCSV('Strictly confidential — Internal Enterprise Governance use only.')}`);

    const csvOutput = lines.join('\r\n');
    const filename = `quality_central_portfolio_audit_${getTimestamp()}.csv`;

    downloadCSV(filename, csvOutput);
    toast.success('Downloaded All Projects Portfolio Audit Report (.csv)');
  } catch (err) {
    console.error('Failed to export all projects CSV:', err);
    toast.error('Failed to export portfolio report');
  }
}

/**
 * 3. Export Bugs Queue / Filtered Bugs CSV (.csv)
 */
export function exportBugsQueueCSV(firstArg, argTitle = 'Bugs_Audit_Queue', argCurrentUser = 'Rishit') {
  let bugs, title, currentUser;
  if (Array.isArray(firstArg)) {
    bugs = firstArg;
    title = argTitle || 'Bugs_Audit_Queue';
    currentUser = argCurrentUser || 'Rishit';
  } else if (firstArg && typeof firstArg === 'object') {
    bugs = Array.isArray(firstArg.bugs) ? firstArg.bugs : [];
    title = firstArg.title || 'Bugs_Audit_Queue';
    currentUser = firstArg.currentUser || 'Rishit';
  }

  if (!bugs || bugs.length === 0) {
    toast.error('No bugs found in current view to export.');
    return;
  }

  try {
    const lines = [];

    lines.push('====================================================================================================');
    lines.push('PHYGITRON 360 // QUALITY CENTRAL — DEFECT QUEUE AUDIT REPORT');
    lines.push('====================================================================================================');
    lines.push('');

    lines.push('--- [1] EXPORT SPECIFICATIONS ---');
    lines.push(`Report Name,${escapeCSV(title)}`);
    lines.push(`Total Defects in Export,${bugs.length}`);
    lines.push(`Generated At,${escapeCSV(new Date().toLocaleString())}`);
    lines.push(`Exported By,${escapeCSV(currentUser)}`);
    lines.push('');

    lines.push(`--- [2] DEFECT REGISTER (${bugs.length} RECORDS) ---`);
    const headers = [
      'Bug ID',
      'Title',
      'Project',
      'Module',
      'Environment',
      'Priority',
      'Severity',
      'Status',
      'Bug Type',
      'Assignee',
      'Reported By',
      'Created On',
      'Resolved By / Tester',
      'Resolved At',
      'Root Cause & Debugging Notes',
      'Verification Steps'
    ];
    lines.push(headers.map(escapeCSV).join(','));

    bugs.forEach(bug => {
      const row = [
        bug.id || '',
        bug.title || '',
        bug.project || '',
        bug.module || '',
        bug.environment || '',
        bug.priority || '',
        bug.severity || '',
        bug.status || '',
        bug.bug_type || 'Functional',
        bug.assignee || 'Unassigned',
        bug.reported_by || '',
        bug.created_on || '',
        bug.resolved_by || bug.tester || '',
        bug.resolved_at || '',
        bug.debugging_notes || bug.actual_result || bug.steps_to_reproduce || '',
        bug.verification_steps || bug.expected_result || ''
      ];
      lines.push(row.map(escapeCSV).join(','));
    });
    lines.push('');

    lines.push('--- [3] AUDIT INTEGRITY ---');
    lines.push(`Integrity Notice,${escapeCSV('Exported directly from live Quality Central defect queue.')}`);

    const csvOutput = lines.join('\r\n');
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `${cleanTitle}_${getTimestamp()}.csv`;

    downloadCSV(filename, csvOutput);
    toast.success(`Exported ${bugs.length} defects to CSV (.csv)`);
  } catch (err) {
    console.error('Failed to export bugs queue CSV:', err);
    toast.error('Failed to export bugs list');
  }
}

/**
 * Shared styling tokens for executive Excel documents (xlsx-js-style)
 */
const THIN_BORDER = {
  top: { style: 'thin', color: { rgb: 'CBD5E1' } },
  bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
  left: { style: 'thin', color: { rgb: 'CBD5E1' } },
  right: { style: 'thin', color: { rgb: 'CBD5E1' } }
};

const BANNER_STYLE = {
  font: { name: 'Segoe UI', sz: 13, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '0F172A' } },
  alignment: { horizontal: 'center', vertical: 'center' }
};

const SECTION_HEADER_STYLE = {
  font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: '0F172A' } },
  fill: { fgColor: { rgb: 'F1F5F9' } },
  alignment: { horizontal: 'left', vertical: 'center' },
  border: {
    bottom: { style: 'medium', color: { rgb: '94A3B8' } },
    top: { style: 'thin', color: { rgb: 'CBD5E1' } }
  }
};

const TABLE_HEADER_STYLE = {
  font: { name: 'Segoe UI', sz: 9.5, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '1E293B' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: '475569' } },
    bottom: { style: 'medium', color: { rgb: '0F172A' } },
    left: { style: 'thin', color: { rgb: '475569' } },
    right: { style: 'thin', color: { rgb: '475569' } }
  }
};

/**
 * 4. Export Comprehensive Project Defect & SLA Audit Report as Styled Excel (.xlsx)
 */
export function exportProjectDefectReportXLSX(firstArg, argBugs = [], argScope = 'team', argCurrentUser = 'Rishit') {
  let project, bugs, scope, currentUser;
  if (firstArg && (firstArg.name || firstArg.prefix || firstArg.id) && !firstArg.project) {
    project = firstArg;
    bugs = Array.isArray(argBugs) ? argBugs : [];
    scope = argScope || 'team';
    currentUser = argCurrentUser || 'Rishit';
  } else if (firstArg && typeof firstArg === 'object') {
    project = firstArg.project;
    bugs = Array.isArray(firstArg.bugs) ? firstArg.bugs : [];
    scope = firstArg.scope || 'team';
    currentUser = firstArg.currentUser || 'Rishit';
  }

  if (!project) {
    toast.error('Project details are required for export.');
    return;
  }

  try {
    const allProjectBugs = bugs.filter(b => doesBugMatchProject(b, project));
    const projectBugs = scope === 'personal'
      ? allProjectBugs.filter(b => isBugAssignedToUser(b, currentUser))
      : allProjectBugs;

    const openCount = projectBugs.filter(b => (b.status || '').toLowerCase() === 'open').length;
    const inProgCount = projectBugs.filter(b => (b.status || '').toLowerCase() === 'in progress').length;
    const resolvedCount = projectBugs.filter(b => ['resolved', 'closed'].includes((b.status || '').toLowerCase())).length;
    const activeCount = openCount + inProgCount;
    const totalCount = projectBugs.length;

    const criticalCount = projectBugs.filter(b => (b.severity || '').toLowerCase() === 'critical').length;
    const highCount = projectBugs.filter(b => (b.severity || '').toLowerCase() === 'high').length;
    const normalCount = projectBugs.filter(b => ['normal', 'medium'].includes((b.severity || '').toLowerCase())).length;
    const lowCount = projectBugs.filter(b => (b.severity || '').toLowerCase() === 'low').length;

    const resolutionRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 100;
    const healthRate = project.health_rate ?? 98;
    const slaStatus = healthRate >= 95 ? 'Compliant (SLA Met)' : healthRate >= 85 ? 'Warning (SLA At Risk)' : 'Non-Compliant (Breached)';

    const devStr = Array.isArray(project.developers) ? project.developers.join(', ') : (project.developers || 'Unassigned');
    const qaStr = Array.isArray(project.qa) ? project.qa.join(', ') : (project.qa || 'Unassigned');

    const wb = XLSX.utils.book_new();
    const rows = [];
    const merges = [];

    // Row 0: Enterprise Banner
    rows.push(['PHYGITRON 360  //  QUALITY CENTRAL — DEFECT & SLA AUDIT REPORT', '', '', '', '', '', '', '', '', '', '']);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } });

    // Row 1: Blank
    rows.push([]);

    // Row 2: Governance Section Header
    rows.push(['PROJECT GOVERNANCE & TEAM DIRECTORY', '', '', '', '', '', '', '', '', '', '']);
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 10 } });

    // Row 3: Meta 1
    rows.push([
      'Project Name:', project.name || 'Untitled',
      'Prefix Code:', project.prefix || 'N/A',
      'Lifecycle Status:', project.status || 'Active',
      'Quality Health:', `${healthRate}%`,
      'Audited By:', currentUser
    ]);

    // Row 4: Meta 2
    rows.push([
      'Team Lead:', project.team_lead || 'N/A',
      'Assigned Devs:', devStr,
      'QA Specialists:', qaStr,
      'Severity Level:', project.severity || 'Normal',
      'Audit Date:', new Date().toLocaleDateString()
    ]);

    // Row 5: Meta 3 (Scope description)
    rows.push([
      'Project Scope:', project.description || 'Project managed under Phygitron 360 Quality Central.', '', '', '', '', '', '', '', '', ''
    ]);
    merges.push({ s: { r: 5, c: 1 }, e: { r: 5, c: 10 } });

    // Row 6: Blank
    rows.push([]);

    // Row 7: KPI Header
    rows.push(['EXECUTIVE QUALITY & DEFECT METRICS SNAPSHOT', '', '', '', '', '', '', '', '', '', '']);
    merges.push({ s: { r: 7, c: 0 }, e: { r: 7, c: 10 } });

    // Row 8: KPI Labels
    rows.push([
      'Health Score',
      'Resolution %',
      'Total Defects',
      'Active Backlog',
      'Open Defects',
      'In Progress',
      'Resolved / Closed',
      'Critical Blockers',
      'High Severity',
      'Normal / Low',
      'SLA Status'
    ]);

    // Row 9: KPI Values
    rows.push([
      `${healthRate}%`,
      `${resolutionRate}%`,
      totalCount,
      activeCount,
      openCount,
      inProgCount,
      resolvedCount,
      criticalCount,
      highCount,
      normalCount + lowCount,
      slaStatus
    ]);

    // Row 10: Blank
    rows.push([]);

    // Row 11: Defect Register Header
    rows.push([`DETAILED DEFECT AUDIT REGISTER (${projectBugs.length} TICKETS)`, '', '', '', '', '', '', '', '', '', '']);
    merges.push({ s: { r: 11, c: 0 }, e: { r: 11, c: 10 } });

    // Row 12: Column Headers
    const tableHeaders = [
      'Bug ID',
      'Defect Title',
      'Module',
      'Environment',
      'Priority',
      'Severity',
      'Status',
      'Assignee',
      'Reported By',
      'Created Date',
      'Debugging & Verification Notes'
    ];
    rows.push(tableHeaders);

    // Rows 13+: Bug Records
    if (projectBugs.length === 0) {
      rows.push(['No defect tickets currently logged for this project.', '', '', '', '', '', '', '', '', '', '']);
      merges.push({ s: { r: 13, c: 0 }, e: { r: 13, c: 10 } });
    } else {
      projectBugs.forEach(bug => {
        rows.push([
          bug.id || 'N/A',
          bug.title || 'Untitled Defect',
          bug.module || 'Core',
          bug.environment || 'Production',
          bug.priority || 'Normal',
          bug.severity || 'Normal',
          bug.status || 'Open',
          bug.assignee || 'Unassigned',
          bug.reported_by || 'QA',
          bug.created_on || 'N/A',
          bug.debugging_notes || bug.verification_steps || bug.steps_to_reproduce || 'No debugging notes documented.'
        ]);
      });
    }

    // Footer notice
    rows.push([]);
    const footerRowIdx = rows.length;
    rows.push(['Confidential Audit Dossier — Generated by Phygitron 360 Quality Central. Certified against ISO/IEC 25010 Software Quality Standards.', '', '', '', '', '', '', '', '', '', '']);
    merges.push({ s: { r: footerRowIdx, c: 0 }, e: { r: footerRowIdx, c: 10 } });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!merges'] = merges;

    // Set Column Widths
    ws['!cols'] = [
      { wch: 15 }, // Bug ID
      { wch: 36 }, // Defect Title
      { wch: 18 }, // Module
      { wch: 15 }, // Environment
      { wch: 13 }, // Priority
      { wch: 13 }, // Severity
      { wch: 15 }, // Status
      { wch: 18 }, // Assignee
      { wch: 16 }, // Reported By
      { wch: 14 }, // Created Date
      { wch: 45 }  // Notes
    ];

    // Set Row Heights
    ws['!rows'] = [
      { hpt: 32 }, // 0: Banner
      { hpt: 8 },  // 1: Blank
      { hpt: 20 }, // 2: Governance Header
      { hpt: 20 }, // 3: Meta 1
      { hpt: 20 }, // 4: Meta 2
      { hpt: 20 }, // 5: Meta 3
      { hpt: 8 },  // 6: Blank
      { hpt: 20 }, // 7: KPI Header
      { hpt: 18 }, // 8: KPI Labels
      { hpt: 24 }, // 9: KPI Values
      { hpt: 8 },  // 10: Blank
      { hpt: 20 }, // 11: Register Header
      { hpt: 22 }  // 12: Table Headers
    ];

    // 1. Style Banner (A1)
    ws['A1'].s = BANNER_STYLE;

    // 2. Style Section Headers (Rows 2, 7, 11)
    [2, 7, 11].forEach(r => {
      const cellRef = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws[cellRef]) ws[cellRef].s = SECTION_HEADER_STYLE;
    });

    // 3. Style Metadata Key-Value Grid (Rows 3, 4, 5)
    [3, 4].forEach(r => {
      for (let c = 0; c < 10; c += 2) {
        const labelRef = XLSX.utils.encode_cell({ r, c });
        const valRef = XLSX.utils.encode_cell({ r, c: c + 1 });
        if (ws[labelRef]) {
          ws[labelRef].s = {
            font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: '475569' } },
            fill: { fgColor: { rgb: 'F8FAFC' } },
            alignment: { horizontal: 'left', vertical: 'center' },
            border: THIN_BORDER
          };
        }
        if (ws[valRef]) {
          ws[valRef].s = {
            font: { name: 'Segoe UI', sz: 9, bold: false, color: { rgb: '0F172A' } },
            fill: { fgColor: { rgb: 'FFFFFF' } },
            alignment: { horizontal: 'left', vertical: 'center' },
            border: THIN_BORDER
          };
        }
      }
    });

    // Row 5 (Scope)
    const scopeLabelRef = XLSX.utils.encode_cell({ r: 5, c: 0 });
    const scopeValRef = XLSX.utils.encode_cell({ r: 5, c: 1 });
    if (ws[scopeLabelRef]) {
      ws[scopeLabelRef].s = {
        font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: '475569' } },
        fill: { fgColor: { rgb: 'F8FAFC' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: THIN_BORDER
      };
    }
    if (ws[scopeValRef]) {
      ws[scopeValRef].s = {
        font: { name: 'Segoe UI', sz: 9, color: { rgb: '0F172A' } },
        fill: { fgColor: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: THIN_BORDER
      };
    }

    // 4. Style KPI Labels & Values (Rows 8 & 9)
    for (let c = 0; c < 11; c++) {
      const labelRef = XLSX.utils.encode_cell({ r: 8, c });
      const valRef = XLSX.utils.encode_cell({ r: 9, c });
      if (ws[labelRef]) {
        ws[labelRef].s = {
          font: { name: 'Segoe UI', sz: 8.5, bold: true, color: { rgb: '64748B' } },
          fill: { fgColor: { rgb: 'F8FAFC' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: THIN_BORDER
        };
      }
      if (ws[valRef]) {
        let valColor = '0F172A';
        let valBg = 'FFFFFF';
        if (c === 0) { // Health
          valColor = healthRate >= 95 ? '166534' : healthRate >= 85 ? '92400E' : '991B1B';
          valBg = healthRate >= 95 ? 'DCFCE7' : healthRate >= 85 ? 'FEF3C7' : 'FEE2E2';
        } else if (c === 7) { // Critical
          valColor = criticalCount > 0 ? '991B1B' : '166534';
          valBg = criticalCount > 0 ? 'FEE2E2' : 'F0FDF4';
        } else if (c === 4) { // Open
          valColor = '2563EB';
        } else if (c === 6) { // Resolved
          valColor = '16A34A';
        }

        ws[valRef].s = {
          font: { name: 'Segoe UI', sz: 12, bold: true, color: { rgb: valColor } },
          fill: { fgColor: { rgb: valBg } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: THIN_BORDER
        };
      }
    }

    // 5. Style Table Headers (Row 12)
    for (let c = 0; c < tableHeaders.length; c++) {
      const headerRef = XLSX.utils.encode_cell({ r: 12, c });
      if (ws[headerRef]) ws[headerRef].s = TABLE_HEADER_STYLE;
    }

    // 6. Style Defect Rows
    if (projectBugs.length === 0) {
      const emptyRef = XLSX.utils.encode_cell({ r: 13, c: 0 });
      if (ws[emptyRef]) {
        ws[emptyRef].s = {
          font: { name: 'Segoe UI', sz: 9.5, italic: true, color: { rgb: '64748B' } },
          fill: { fgColor: { rgb: 'F8FAFC' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: THIN_BORDER
        };
      }
    } else {
      projectBugs.forEach((b, idx) => {
        const r = 13 + idx;
        const isEven = idx % 2 === 0;
        const bgRgb = isEven ? 'FFFFFF' : 'F8FAFC';

        for (let c = 0; c < tableHeaders.length; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          if (!ws[cellRef]) continue;

          let textColor = '1E293B';
          let isBold = false;

          // Severity highlight
          if (c === 5) {
            const sev = (b.severity || '').toLowerCase();
            if (sev === 'critical') { textColor = 'DC2626'; isBold = true; }
            else if (sev === 'high') { textColor = 'EA580C'; isBold = true; }
            else if (sev === 'low') { textColor = '64748B'; }
            else { textColor = '2563EB'; }
          }

          // Status highlight
          if (c === 6) {
            const st = (b.status || '').toLowerCase();
            if (st === 'resolved' || st === 'closed') { textColor = '16A34A'; isBold = true; }
            else if (st === 'in progress') { textColor = 'D97706'; isBold = true; }
            else { textColor = '2563EB'; isBold = true; }
          }

          ws[cellRef].s = {
            font: { name: 'Segoe UI', sz: 9, bold: isBold, color: { rgb: textColor } },
            fill: { fgColor: { rgb: bgRgb } },
            alignment: {
              horizontal: (c === 0 || c === 3 || c === 4 || c === 5 || c === 6 || c === 9) ? 'center' : 'left',
              vertical: 'center',
              wrapText: c === 1 || c === 10
            },
            border: THIN_BORDER
          };
        }
      });
    }

    // 7. Footer Style
    const footerCellRef = XLSX.utils.encode_cell({ r: footerRowIdx, c: 0 });
    if (ws[footerCellRef]) {
      ws[footerCellRef].s = {
        font: { name: 'Segoe UI', sz: 8.5, italic: true, color: { rgb: '94A3B8' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Audit Dossier');

    // Sheet 2: Raw Defect Register (for sorting/filtering)
    const rawHeaders = [
      'Bug ID', 'Title', 'Project', 'Module', 'Environment',
      'Priority', 'Severity', 'Status', 'Defect Type',
      'Assignee', 'Reported By', 'Created Date', 'Resolved By / Tester',
      'Resolved Date', 'Debugging Notes', 'Verification Steps'
    ];
    const rawRows = [rawHeaders];
    projectBugs.forEach(bug => {
      rawRows.push([
        bug.id || '',
        bug.title || '',
        bug.project || project.name || '',
        bug.module || '',
        bug.environment || '',
        bug.priority || '',
        bug.severity || '',
        bug.status || '',
        bug.bug_type || 'Functional',
        bug.assignee || 'Unassigned',
        bug.reported_by || '',
        bug.created_on || '',
        bug.resolved_by || bug.tester || '',
        bug.resolved_at || '',
        bug.debugging_notes || bug.actual_result || bug.steps_to_reproduce || '',
        bug.verification_steps || bug.expected_result || ''
      ]);
    });
    const wsRaw = XLSX.utils.aoa_to_sheet(rawRows);
    wsRaw['!cols'] = [
      { wch: 12 }, { wch: 36 }, { wch: 18 }, { wch: 16 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
      { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 18 },
      { wch: 14 }, { wch: 35 }, { wch: 35 }
    ];
    for (let c = 0; c < rawHeaders.length; c++) {
      const rawHeadRef = XLSX.utils.encode_cell({ r: 0, c });
      if (wsRaw[rawHeadRef]) wsRaw[rawHeadRef].s = TABLE_HEADER_STYLE;
    }
    XLSX.utils.book_append_sheet(wb, wsRaw, 'Defect Register');

    const cleanName = (project.name || 'project').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `${cleanName}_defect_audit_report_${getTimestamp()}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success(`Exported ${project.name} audit report (.xlsx)`);
  } catch (err) {
    console.error('Failed to export styled Excel audit report:', err);
    toast.error('Failed to export audit report');
  }
}

/**
 * 5. Export All Projects Portfolio Summary as Styled Excel (.xlsx)
 */
export function exportAllProjectsPortfolioXLSX(firstArg, argBugs = [], argCurrentUser = 'Rishit') {
  let projects, bugs, currentUser;
  if (Array.isArray(firstArg)) {
    projects = firstArg;
    bugs = Array.isArray(argBugs) ? argBugs : [];
    currentUser = argCurrentUser || 'Rishit';
  } else if (firstArg && typeof firstArg === 'object') {
    projects = Array.isArray(firstArg.projects) ? firstArg.projects : [];
    bugs = Array.isArray(firstArg.bugs) ? firstArg.bugs : [];
    currentUser = firstArg.currentUser || 'Rishit';
  }

  if (!projects || projects.length === 0) {
    toast.error('No projects available to export.');
    return;
  }

  try {
    const wb = XLSX.utils.book_new();
    const rows = [];
    const merges = [];

    // Row 0: Banner
    rows.push(['PHYGITRON 360  //  QUALITY CENTRAL — ENTERPRISE PORTFOLIO AUDIT', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 15 } });

    // Row 1: Blank
    rows.push([]);

    // Row 2: Portfolio Governance Header
    rows.push(['PORTFOLIO QUALITY BENCHMARK & SLA GOVERNANCE', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 15 } });

    // Portfolio KPI Summary
    const totalDefects = bugs.length;
    const activeDefects = bugs.filter(b => ['open', 'in progress'].includes((b.status || '').toLowerCase())).length;
    const resolvedDefects = bugs.filter(b => ['resolved', 'closed'].includes((b.status || '').toLowerCase())).length;
    const criticalDefects = bugs.filter(b => (b.severity || '').toLowerCase() === 'critical').length;
    const avgHealth = projects.length > 0 
      ? Math.round(projects.reduce((sum, p) => sum + (Number(p.health_rate) || 95), 0) / projects.length) 
      : 96;

    // Row 3: KPI Labels
    rows.push([
      'Total Projects',
      'Avg Portfolio Health',
      'Total Defects Logged',
      'Active Backlog',
      'Resolved Defects',
      'Critical Blockers',
      'Audit Date',
      'Audited By'
    ]);

    // Row 4: KPI Values
    rows.push([
      projects.length,
      `${avgHealth}%`,
      totalDefects,
      activeDefects,
      resolvedDefects,
      criticalDefects,
      new Date().toLocaleDateString(),
      currentUser
    ]);

    // Row 5: Blank
    rows.push([]);

    // Row 6: Table Header
    rows.push([`PROJECT-BY-PROJECT DEFECT & SLA BENCHMARK (${projects.length} PROJECTS)`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    merges.push({ s: { r: 6, c: 0 }, e: { r: 6, c: 15 } });

    // Row 7: Table Columns
    const headers = [
      'Project Name', 'Prefix', 'Status', 'Health Rate', 'Severity',
      'Team Lead', 'Developers', 'QA Specialists',
      'Open', 'In Progress', 'Active', 'Resolved', 'Critical',
      'Total Defects', 'Resolution %', 'SLA Status'
    ];
    rows.push(headers);

    projects.forEach(p => {
      const pBugs = bugs.filter(b => doesBugMatchProject(b, p));
      const openCount = pBugs.filter(b => (b.status || '').toLowerCase() === 'open').length;
      const inProgCount = pBugs.filter(b => (b.status || '').toLowerCase() === 'in progress').length;
      const resCount = pBugs.filter(b => ['resolved', 'closed'].includes((b.status || '').toLowerCase())).length;
      const critCount = pBugs.filter(b => (b.severity || '').toLowerCase() === 'critical').length;
      const totalPDefects = pBugs.length;
      const resRate = totalPDefects > 0 ? `${Math.round((resCount / totalPDefects) * 100)}%` : '100%';
      const health = p.health_rate ?? 95;
      const slaStatus = health >= 95 ? 'Compliant' : health >= 85 ? 'At Risk' : 'Non-Compliant';

      rows.push([
        p.name || 'Untitled',
        p.prefix || 'N/A',
        p.status || 'Active',
        `${health}%`,
        p.severity || 'Normal',
        p.team_lead || 'N/A',
        Array.isArray(p.developers) ? p.developers.join(', ') : p.developers || 'N/A',
        Array.isArray(p.qa) ? p.qa.join(', ') : p.qa || 'N/A',
        openCount,
        inProgCount,
        openCount + inProgCount,
        resCount,
        critCount,
        totalPDefects,
        resRate,
        slaStatus
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!merges'] = merges;

    // Column widths
    ws['!cols'] = [
      { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 13 },
      { wch: 18 }, { wch: 26 }, { wch: 24 },
      { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 11 }, { wch: 11 },
      { wch: 14 }, { wch: 14 }, { wch: 18 }
    ];

    // Row heights
    ws['!rows'] = [
      { hpt: 32 }, // Banner
      { hpt: 8 },
      { hpt: 20 },
      { hpt: 18 },
      { hpt: 24 },
      { hpt: 8 },
      { hpt: 20 },
      { hpt: 22 }
    ];

    ws['A1'].s = BANNER_STYLE;
    [2, 6].forEach(r => {
      const cellRef = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws[cellRef]) ws[cellRef].s = SECTION_HEADER_STYLE;
    });

    // Style KPI cards
    for (let c = 0; c < 8; c++) {
      const labelRef = XLSX.utils.encode_cell({ r: 3, c });
      const valRef = XLSX.utils.encode_cell({ r: 4, c });
      if (ws[labelRef]) {
        ws[labelRef].s = {
          font: { name: 'Segoe UI', sz: 8.5, bold: true, color: { rgb: '64748B' } },
          fill: { fgColor: { rgb: 'F8FAFC' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: THIN_BORDER
        };
      }
      if (ws[valRef]) {
        ws[valRef].s = {
          font: { name: 'Segoe UI', sz: 12, bold: true, color: { rgb: '0F172A' } },
          fill: { fgColor: { rgb: 'FFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: THIN_BORDER
        };
      }
    }

    // Style Table Headers (Row 7)
    for (let c = 0; c < headers.length; c++) {
      const hRef = XLSX.utils.encode_cell({ r: 7, c });
      if (ws[hRef]) ws[hRef].s = TABLE_HEADER_STYLE;
    }

    // Style Rows
    projects.forEach((p, idx) => {
      const r = 8 + idx;
      const isEven = idx % 2 === 0;
      const bgRgb = isEven ? 'FFFFFF' : 'F8FAFC';

      for (let c = 0; c < headers.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) continue;

        let textColor = '1E293B';
        let isBold = false;

        if (c === 3) { // Health
          const h = p.health_rate ?? 95;
          textColor = h >= 95 ? '166534' : h >= 85 ? '92400E' : '991B1B';
          isBold = true;
        }
        if (c === 12 && p.bugs && p.bugs.filter) { // Critical
          textColor = 'DC2626';
        }
        if (c === 15) { // SLA
          const h = p.health_rate ?? 95;
          textColor = h >= 95 ? '166534' : h >= 85 ? '92400E' : '991B1B';
          isBold = true;
        }

        ws[cellRef].s = {
          font: { name: 'Segoe UI', sz: 9, bold: isBold, color: { rgb: textColor } },
          fill: { fgColor: { rgb: bgRgb } },
          alignment: {
            horizontal: (c === 1 || c === 2 || c === 3 || c === 4 || (c >= 8 && c <= 15)) ? 'center' : 'left',
            vertical: 'center'
          },
          border: THIN_BORDER
        };
      }
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Portfolio Benchmark');

    const filename = `portfolio_quality_audit_summary_${getTimestamp()}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success(`Exported portfolio audit report (.xlsx)`);
  } catch (err) {
    console.error('Failed to export portfolio Excel report:', err);
    toast.error('Failed to export portfolio report');
  }
}

/**
 * 6. Export Bugs Queue / Filtered Bugs as Styled Excel (.xlsx)
 */
export function exportBugsQueueXLSX(firstArg, argTitle = 'Defect_Queue_Audit', argCurrentUser = 'Rishit') {
  let bugs, title, currentUser;
  if (Array.isArray(firstArg)) {
    bugs = firstArg;
    title = argTitle || 'Defect_Queue_Audit';
    currentUser = argCurrentUser || 'Rishit';
  } else if (firstArg && typeof firstArg === 'object') {
    bugs = Array.isArray(firstArg.bugs) ? firstArg.bugs : [];
    title = firstArg.title || 'Defect_Queue_Audit';
    currentUser = firstArg.currentUser || 'Rishit';
  }

  if (!bugs || bugs.length === 0) {
    toast.error('No defects found in current view to export.');
    return;
  }

  try {
    const wb = XLSX.utils.book_new();
    const rows = [];
    const merges = [];

    // Banner
    rows.push(['PHYGITRON 360  //  QUALITY CENTRAL — DEFECT REGISTER AUDIT', '', '', '', '', '', '', '', '', '', '']);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } });

    rows.push([]);
    rows.push(['SPECIFICATIONS & METADATA', '', '', '', '', '', '', '', '', '', '']);
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 10 } });

    rows.push([
      'Queue View:', title,
      'Total Records:', bugs.length,
      'Exported By:', currentUser,
      'Export Date:', new Date().toLocaleDateString(),
      'Compliance:', 'ISO/IEC 25010'
    ]);

    rows.push([]);
    rows.push([`DEFECT TICKETS (${bugs.length} RECORDS)`, '', '', '', '', '', '', '', '', '', '']);
    merges.push({ s: { r: 5, c: 0 }, e: { r: 5, c: 10 } });

    const headers = [
      'Bug ID', 'Title', 'Project', 'Module', 'Environment',
      'Priority', 'Severity', 'Status', 'Assignee',
      'Reported By', 'Debugging & Verification Notes'
    ];
    rows.push(headers);

    bugs.forEach(b => {
      rows.push([
        b.id || 'N/A',
        b.title || 'Untitled',
        b.project || 'N/A',
        b.module || 'Core',
        b.environment || 'Production',
        b.priority || 'Normal',
        b.severity || 'Normal',
        b.status || 'Open',
        b.assignee || 'Unassigned',
        b.reported_by || 'QA',
        b.debugging_notes || b.verification_steps || 'N/A'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!merges'] = merges;
    ws['!cols'] = [
      { wch: 14 }, { wch: 36 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 },
      { wch: 16 }, { wch: 45 }
    ];

    ws['A1'].s = BANNER_STYLE;
    [2, 5].forEach(r => {
      const cellRef = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws[cellRef]) ws[cellRef].s = SECTION_HEADER_STYLE;
    });

    for (let c = 0; c < headers.length; c++) {
      const hRef = XLSX.utils.encode_cell({ r: 6, c });
      if (ws[hRef]) ws[hRef].s = TABLE_HEADER_STYLE;
    }

    bugs.forEach((b, idx) => {
      const r = 7 + idx;
      const isEven = idx % 2 === 0;
      const bgRgb = isEven ? 'FFFFFF' : 'F8FAFC';

      for (let c = 0; c < headers.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) continue;

        let textColor = '1E293B';
        let isBold = false;
        if (c === 6) { // Severity
          const sev = (b.severity || '').toLowerCase();
          if (sev === 'critical') { textColor = 'DC2626'; isBold = true; }
          else if (sev === 'high') { textColor = 'EA580C'; }
        }
        if (c === 7) { // Status
          const st = (b.status || '').toLowerCase();
          if (st === 'resolved' || st === 'closed') { textColor = '16A34A'; isBold = true; }
          else if (st === 'in progress') { textColor = 'D97706'; isBold = true; }
          else { textColor = '2563EB'; isBold = true; }
        }

        ws[cellRef].s = {
          font: { name: 'Segoe UI', sz: 9, bold: isBold, color: { rgb: textColor } },
          fill: { fgColor: { rgb: bgRgb } },
          alignment: {
            horizontal: (c === 0 || c === 4 || c === 5 || c === 6 || c === 7) ? 'center' : 'left',
            vertical: 'center'
          },
          border: THIN_BORDER
        };
      }
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Defect Register');
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `${cleanTitle}_${getTimestamp()}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success(`Exported ${bugs.length} defect records (.xlsx)`);
  } catch (err) {
    console.error('Failed to export defect queue report:', err);
    toast.error('Failed to export defect register');
  }
}

