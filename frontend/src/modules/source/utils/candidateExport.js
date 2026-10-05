import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

/**
 * Format string helper for safe filenames
 */
function getFilename(format, roleTitle) {
  const safeRole = (roleTitle || 'Shortlist')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const dateStr = new Date().toISOString().slice(0, 10);
  return `Candidate_Report_${safeRole}_${dateStr}.${format}`;
}

/**
 * Build human-readable filter summary string
 */
function getFilterSummaryText(filtersSummary) {
  if (!filtersSummary) return 'Standard Filters';
  const parts = [];
  if (filtersSummary.tags && filtersSummary.tags.length > 0) {
    parts.push(`Tags: ${filtersSummary.tags.join(', ')}`);
  } else if (filtersSummary.tag) {
    parts.push(`Tag: ${filtersSummary.tag}`);
  }
  if (filtersSummary.exp_range) parts.push(`Exp: ${filtersSummary.exp_range} yrs`);
  if (filtersSummary.location) parts.push(`Location: ${filtersSummary.location}`);
  if (filtersSummary.sort_by) {
    const sortLabels = {
      required_score: 'Required Fit (High → Low)',
      preferred_score: 'Preferred Fit (High → Low)',
      newest: 'Newest Added',
      experience: 'Experience (High → Low)'
    };
    parts.push(`Sort: ${sortLabels[filtersSummary.sort_by] || filtersSummary.sort_by}`);
  }
  return parts.length > 0 ? parts.join(' | ') : 'All Candidates';
}

/**
 * Prepare flat structured row data for both Excel and CSV
 */
function prepareCandidateExportRows(candidates) {
  return candidates.map((c, idx) => {
    const reqTot = c.required_total || 0;
    const reqMat = c.required_matched || 0;
    const reqPct = c.required_score != null ? `${Math.round(c.required_score)}%` : '—';
    const reqRatio = reqTot > 0 ? `${reqMat}/${reqTot}` : '—';

    const prefTot = c.preferred_total || 0;
    const prefMat = c.preferred_matched || 0;
    const prefPct = c.preferred_score != null ? `${Math.round(c.preferred_score)}%` : '—';
    const prefRatio = prefTot > 0 ? `${prefMat}/${prefTot}` : '—';

    const tagsStr = Array.isArray(c.tags) && c.tags.length > 0 
      ? c.tags.join(', ') 
      : 'General Pool';

    const ats = c.ats_detail || {};
    const matchedSkills = (c.matched_skills || ats.matched_skills || ats.matched || []).join(', ') || '—';
    const missingSkills = (c.missing_skills || ats.missing_skills || ats.missing || []).join(', ') || '—';
    const allSkills = Array.isArray(c.skills) 
      ? c.skills.join(', ') 
      : (Array.isArray(c.structured_skills) ? c.structured_skills.map(s => s.name || s.skill_name).join(', ') : '—');

    return {
      rank: idx + 1,
      name: c.full_name || '—',
      email: c.email || '—',
      phone: c.phone || '—',
      designation: c.current_designation || '—',
      experience_years: c.total_experience_years != null ? c.total_experience_years : '—',
      location: c.location || '—',
      status: c.status || 'New',
      tags: tagsStr,
      required_score: reqPct,
      required_ratio: reqRatio,
      preferred_score: prefPct,
      preferred_ratio: prefRatio,
      matched_skills: matchedSkills,
      missing_skills: missingSkills,
      all_skills: allSkills
    };
  });
}

/**
 * 1. Export top candidates to Excel (.xlsx)
 */
export function exportCandidatesToExcel({ candidates = [], roleTitle = '', filtersSummary = {}, companyName = 'Phygitron 360' }) {
  if (!candidates || candidates.length === 0) {
    toast.error('No candidates available to export.');
    return;
  }

  const rows = prepareCandidateExportRows(candidates);
  const filterDesc = getFilterSummaryText(filtersSummary);
  const nowStr = new Date().toLocaleString();

  // Excel layout with metadata header block
  const sheetData = [
    ['CANDIDATE SHORTLIST REPORT', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['Organization:', companyName, 'Generated:', nowStr, 'Target Role:', roleTitle || 'General Talent Pool', 'Total Candidates:', candidates.length],
    ['Active Filters:', filterDesc, '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    [], // Blank separator row
    [
      '# Rank',
      'Candidate Name',
      'Email',
      'Phone',
      'Current Designation',
      'Experience (Yrs)',
      'Location',
      'Status',
      'Tags / Pool',
      'Required Fit (%)',
      'Required Ratio',
      'Preferred Fit (%)',
      'Preferred Ratio',
      'Matched Skills',
      'Missing Skills',
      'All Skills'
    ]
  ];

  rows.forEach(r => {
    sheetData.push([
      r.rank,
      r.name,
      r.email,
      r.phone,
      r.designation,
      r.experience_years,
      r.location,
      r.status,
      r.tags,
      r.required_score,
      r.required_ratio,
      r.preferred_score,
      r.preferred_ratio,
      r.matched_skills,
      r.missing_skills,
      r.all_skills
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Auto column widths
  const colWidths = [
    { wch: 8 },  // Rank
    { wch: 24 }, // Name
    { wch: 28 }, // Email
    { wch: 16 }, // Phone
    { wch: 26 }, // Designation
    { wch: 16 }, // Exp
    { wch: 18 }, // Location
    { wch: 14 }, // Status
    { wch: 20 }, // Tags
    { wch: 16 }, // Req %
    { wch: 16 }, // Req Ratio
    { wch: 16 }, // Pref %
    { wch: 16 }, // Pref Ratio
    { wch: 35 }, // Matched Skills
    { wch: 30 }, // Missing Skills
    { wch: 35 }  // All Skills
  ];
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Top Candidates');

  const filename = getFilename('xlsx', roleTitle);
  XLSX.writeFile(wb, filename);
  toast.success(`Exported ${candidates.length} candidates to Excel (.xlsx)`);
}

/**
 * 2. Export top candidates to CSV (.csv)
 */
export function exportCandidatesToCSV({ candidates = [], roleTitle = '', filtersSummary = {}, companyName = 'Phygitron 360' }) {
  if (!candidates || candidates.length === 0) {
    toast.error('No candidates available to export.');
    return;
  }

  const rows = prepareCandidateExportRows(candidates);
  const headers = [
    '# Rank',
    'Candidate Name',
    'Email',
    'Phone',
    'Current Designation',
    'Experience (Yrs)',
    'Location',
    'Status',
    'Tags',
    'Required Fit (%)',
    'Required Ratio',
    'Preferred Fit (%)',
    'Preferred Ratio',
    'Matched Skills',
    'Missing Skills',
    'All Skills'
  ];

  const escapeCSV = (val) => {
    if (val == null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvRows = [];
  csvRows.push(headers.map(escapeCSV).join(','));

  rows.forEach(r => {
    csvRows.push([
      escapeCSV(r.rank),
      escapeCSV(r.name),
      escapeCSV(r.email),
      escapeCSV(r.phone),
      escapeCSV(r.designation),
      escapeCSV(r.experience_years),
      escapeCSV(r.location),
      escapeCSV(r.status),
      escapeCSV(r.tags),
      escapeCSV(r.required_score),
      escapeCSV(r.required_ratio),
      escapeCSV(r.preferred_score),
      escapeCSV(r.preferred_ratio),
      escapeCSV(r.matched_skills),
      escapeCSV(r.missing_skills),
      escapeCSV(r.all_skills)
    ].join(','));
  });

  // Prepend UTF-8 BOM so Excel opens special characters correctly
  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getFilename('csv', roleTitle);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);

  toast.success(`Exported ${candidates.length} candidates to CSV (.csv)`);
}

/**
 * 3. Export top candidates to Executive PDF (.pdf) via backend ReportLab
 */
export async function exportCandidatesToPDF({ candidates = [], roleTitle = '', filtersSummary = {}, companyName = 'Phygitron 360' }) {
  if (!candidates || candidates.length === 0) {
    toast.error('No candidates available to export.');
    return;
  }

  const toastId = toast.loading('Generating executive PDF report...');
  try {
    const payload = {
      candidates: candidates,
      job_role_title: roleTitle || null,
      filters_summary: filtersSummary,
      company_name: companyName
    };

    const response = await fetch('/api/source/candidates/export-report-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      credentials: 'include'
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'Failed to generate PDF');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getFilename('pdf', roleTitle);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success(`Downloaded executive PDF report!`, { id: toastId });
  } catch (err) {
    console.error('PDF Export Error:', err);
    toast.error(err.message || 'Failed to download PDF report', { id: toastId });
  }
}
