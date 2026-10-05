/**
 * Quality Central Team Pool Constraint
 * Strict list of the authorized team members allowed for assignment across Quality Central.
 * Team Lead for ALL projects: Bhupesh
 * Developers & QA: Rishit, Vidhi, Priyanshu, Sriraj, Akshit
 */

export const TEAM_LEAD = {
  id: 'bhupesh',
  name: 'Bhupesh',
  role: 'Engineering Lead & Principal Architect',
  email: 'bhupesh@phygitron.com',
  initials: 'BP',
  avatarBg: '#8B5CF6'
};

export const QUALITY_CENTRAL_TEAM = [
  TEAM_LEAD,
  {
    id: 'rishit',
    name: 'Rishit',
    role: 'Lead Frontend Engineer / Principal',
    email: 'rishit@phygitron.com',
    initials: 'RS',
    avatarBg: '#6366F1'
  },
  {
    id: 'vidhi',
    name: 'Vidhi',
    role: 'QA Lead & Automation Specialist',
    email: 'vidhi@phygitron.com',
    initials: 'VD',
    avatarBg: '#EC4899'
  },
  {
    id: 'priyanshu',
    name: 'Priyanshu',
    role: 'Full Stack Engineer',
    email: 'priyanshu@phygitron.com',
    initials: 'PR',
    avatarBg: '#3B82F6'
  },
  {
    id: 'sriraj',
    name: 'Sriraj',
    role: 'Backend & Systems Engineer',
    email: 'sriraj@phygitron.com',
    initials: 'SR',
    avatarBg: '#10B981'
  },
  {
    id: 'akshit',
    name: 'Akshit',
    role: 'Security & Quality Specialist',
    email: 'akshit@phygitron.com',
    initials: 'AK',
    avatarBg: '#F59E0B'
  }
];

export const ALLOWED_TEAM_NAMES = ['Bhupesh', 'Rishit', 'Vidhi', 'Priyanshu', 'Sriraj', 'Akshit'];

export function isAllowedTeamMember(name) {
  if (!name) return false;
  return ALLOWED_TEAM_NAMES.some(n => n.toLowerCase() === name.toLowerCase());
}

export function getMemberByName(name) {
  if (!name) return TEAM_LEAD;
  const found = QUALITY_CENTRAL_TEAM.find(m => m.name.toLowerCase() === name.toLowerCase());
  if (found) return found;

  const colors = ['#6366F1', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#0EA5E9', '#14B8A6', '#F43F5E'];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const color = colors[hash % colors.length];

  const initials = name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'TM';

  return {
    id: name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    name: name,
    role: 'Engineering Specialist',
    email: `${name.toLowerCase().replace(/\s+/g, '.')}@phygitron.com`,
    initials,
    avatarBg: color
  };
}
