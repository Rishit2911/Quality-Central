/**
 * Default Project Portfolio for Quality Central Module
 * Strictly the 6 Core Phygitron360 Enterprise Modules:
 * 1. Talent Central
 * 2. Learning Central
 * 3. Assessment Central
 * 4. Employee Central
 * 5. Quality Central
 * 6. LexAI
 *
 * Team Lead for ALL projects: Bhupesh
 * Developers:
 *  - Talent Central, Learning Central, Assessment Central, Employee Central: Sriraj, Priyanshu, Akshit
 *  - Quality Central: Rishit, Vidhi
 *  - LexAI: Rishit, Vidhi, Akshit
 * QA Team:
 *  - Quality Central: Sriraj, Akshit
 *  - Talent, Learning, Assessment, Employee Central: Vidhi
 *  - LexAI: Sriraj, Vidhi
 */

export const INITIAL_SAMPLE_PROJECTS = [
  {
    id: 'proj-tc-01',
    name: 'Talent Central',
    prefix: '#TC',
    severity: 'Normal',
    health_rate: 96,
    status: 'Active',
    open_bugs: 2,
    in_progress_bugs: 1,
    resolved_bugs: 14,
    active_bugs: 3,
    critical_bugs: 0,
    high_bugs: 0,
    normal_bugs: 3,
    lead: 'Bhupesh',
    developers: ['Sriraj', 'Priyanshu', 'Akshit'],
    qa: ['Vidhi'],
    description: 'Talent acquisition pipeline, ATS resume parser, candidate interview orchestration, and hiring workflows.',
    created_at: '15 Jan 2026'
  },
  {
    id: 'proj-lc-02',
    name: 'Learning Central',
    prefix: '#LC',
    severity: 'Normal',
    health_rate: 97,
    status: 'Active',
    open_bugs: 1,
    in_progress_bugs: 2,
    resolved_bugs: 16,
    active_bugs: 3,
    critical_bugs: 0,
    high_bugs: 1,
    normal_bugs: 2,
    lead: 'Bhupesh',
    developers: ['Sriraj', 'Priyanshu', 'Akshit'],
    qa: ['Vidhi'],
    description: 'Enterprise LMS learning tracks, skill matrices, compliance assessments, and interactive training modules.',
    created_at: '20 Jan 2026'
  },
  {
    id: 'proj-ac-03',
    name: 'Assessment Central',
    prefix: '#AC',
    severity: 'High',
    health_rate: 92,
    status: 'Active',
    open_bugs: 3,
    in_progress_bugs: 2,
    resolved_bugs: 11,
    active_bugs: 5,
    critical_bugs: 0,
    high_bugs: 2,
    normal_bugs: 3,
    lead: 'Bhupesh',
    developers: ['Sriraj', 'Priyanshu', 'Akshit'],
    qa: ['Vidhi'],
    description: 'Online testing framework, proctoring controls, candidate score evaluation, and automated skill grading.',
    created_at: '25 Jan 2026'
  },
  {
    id: 'proj-ec-04',
    name: 'Employee Central',
    prefix: '#EC',
    severity: 'Normal',
    health_rate: 95,
    status: 'Active',
    open_bugs: 2,
    in_progress_bugs: 1,
    resolved_bugs: 22,
    active_bugs: 3,
    critical_bugs: 0,
    high_bugs: 1,
    normal_bugs: 2,
    lead: 'Bhupesh',
    developers: ['Sriraj', 'Priyanshu', 'Akshit'],
    qa: ['Vidhi'],
    description: 'Core employee directory, attendance tracking, organizational hierarchy, payroll, and profile self-service.',
    created_at: '12 Jan 2026'
  },
  {
    id: 'proj-qc-05',
    name: 'Quality Central',
    prefix: '#QC',
    severity: 'Normal',
    health_rate: 99,
    status: 'Active',
    open_bugs: 1,
    in_progress_bugs: 1,
    resolved_bugs: 19,
    active_bugs: 2,
    critical_bugs: 0,
    high_bugs: 0,
    normal_bugs: 2,
    lead: 'Bhupesh',
    developers: ['Rishit', 'Vidhi'],
    qa: ['Sriraj', 'Akshit'],
    description: 'Automated test suite orchestration, defect lifecycle tracking, SLA monitor, and engineering quality assurance.',
    created_at: '02 Feb 2026'
  },
  {
    id: 'proj-lex-06',
    name: 'LexAI',
    prefix: '#LEX',
    severity: 'Critical',
    health_rate: 86,
    status: 'Active',
    open_bugs: 4,
    in_progress_bugs: 3,
    resolved_bugs: 15,
    active_bugs: 7,
    critical_bugs: 1,
    high_bugs: 2,
    normal_bugs: 4,
    lead: 'Bhupesh',
    developers: ['Rishit', 'Vidhi', 'Akshit'],
    qa: ['Sriraj', 'Vidhi'],
    description: 'Generative legal AI assistant, neural document summarization, contract review, and compliance intelligence.',
    created_at: '08 Feb 2026'
  }
];

/**
 * Helper to get the canonical bug ID prefix for any given project
 */
export function getBugPrefixForProject(projectNameOrPrefix, projectsList = INITIAL_SAMPLE_PROJECTS) {
  if (!projectNameOrPrefix) return 'QC';
  const clean = (typeof projectNameOrPrefix === 'string' ? projectNameOrPrefix : projectNameOrPrefix.name || '').toLowerCase().trim();

  if (clean.includes('talent') || clean === 'tc' || clean === '#tc') return 'TC';
  if (clean.includes('learning') || clean === 'lc' || clean === '#lc') return 'LC';
  if (clean.includes('assessment') || clean === 'ac' || clean === '#ac') return 'AC';
  if (clean.includes('employee') || clean === 'ec' || clean === '#ec') return 'EC';
  if (clean.includes('quality') || clean === 'qc' || clean === '#qc') return 'QC';
  if (clean.includes('lex')) return 'LEX';

  if (Array.isArray(projectsList)) {
    const matched = projectsList.find(p => 
      p.name?.toLowerCase() === clean || 
      p.prefix?.toLowerCase() === clean ||
      clean.includes(p.name?.toLowerCase()) ||
      p.name?.toLowerCase().includes(clean)
    );
    if (matched?.prefix) {
      const raw = matched.prefix.replace('#', '').trim().toUpperCase();
      return raw.split('-')[0] || raw;
    }
  }

  return 'QC';
}

/**
 * Helper to get developer options strictly for a given project name or prefix
 */
export function getDevelopersForProject(projectNameOrPrefix, projectsList = INITIAL_SAMPLE_PROJECTS) {
  if (!projectNameOrPrefix || projectNameOrPrefix === 'all') {
    return ['Bhupesh', 'Rishit', 'Vidhi', 'Priyanshu', 'Sriraj', 'Akshit'];
  }

  const clean = projectNameOrPrefix.toLowerCase().trim();
  const matched = projectsList.find(p => 
    p.name.toLowerCase() === clean || 
    p.prefix.toLowerCase() === clean ||
    clean.includes(p.name.toLowerCase()) ||
    p.name.toLowerCase().includes(clean)
  );

  if (matched && Array.isArray(matched.developers) && matched.developers.length > 0) {
    return matched.developers;
  }

  // Exact team assignment rules as requested:
  // - Quality Central: Rishit, Vidhi
  // - Talent Central, Learning Central, Assessment Central, Employee Central: Sriraj, Priyanshu, Akshit
  // - LexAI: Rishit, Vidhi, Akshit
  if (clean.includes('quality')) return ['Rishit', 'Vidhi'];
  if (clean.includes('talent') || clean.includes('learning') || clean.includes('employee') || clean.includes('assessment')) {
    return ['Sriraj', 'Priyanshu', 'Akshit'];
  }
  if (clean.includes('lex')) return ['Rishit', 'Vidhi', 'Akshit'];

  return ['Rishit', 'Vidhi', 'Priyanshu', 'Sriraj', 'Akshit'];
}
