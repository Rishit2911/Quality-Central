/**
 * Real-Time Quality Central Metrics & Scope Aggregator
 * Computes reactive statistics directly from the live `bugs` array across all views.
 */

/**
 * Checks whether a bug is assigned to or owned by the given user
 */
export function isBugAssignedToUser(bug, currentUser) {
  if (!bug) return false;
  const bugAssignee = String(bug.assignee || '').toLowerCase().trim();
  const resolvedBy = String(bug.resolved_by || '').toLowerCase().trim();
  const reportedBy = String(bug.reported_by || '').toLowerCase().trim();

  const candidates = [];
  if (typeof currentUser === 'string') {
    const raw = currentUser.toLowerCase().trim();
    candidates.push(raw);
    if (raw.includes('@')) {
      candidates.push(raw.split('@')[0]);
    }
  } else if (currentUser && typeof currentUser === 'object') {
    if (currentUser.name) candidates.push(currentUser.name.toLowerCase().trim());
    if (currentUser.username) {
      const u = currentUser.username.toLowerCase().trim();
      candidates.push(u);
      if (u.includes('@')) candidates.push(u.split('@')[0]);
    }
    if (currentUser.email) {
      const e = currentUser.email.toLowerCase().trim();
      candidates.push(e);
      if (e.includes('@')) candidates.push(e.split('@')[0]);
    }
  }

  const validCandidates = candidates.filter(Boolean);
  if (validCandidates.length === 0) return true;

  // Handle special case for 'rishit'
  const isUserRishit = validCandidates.some(c => c.includes('rishit'));
  if (isUserRishit && (
    bugAssignee.includes('rishit') || 
    resolvedBy.includes('rishit')
  )) {
    return true;
  }

  return validCandidates.some(c => 
    (bugAssignee && (bugAssignee.includes(c) || c.includes(bugAssignee))) ||
    (resolvedBy && (resolvedBy.includes(c) || c.includes(resolvedBy)))
  );
}

/**
 * Checks whether a bug belongs to a given project
 */
export function doesBugMatchProject(bug, projectOrName) {
  if (!bug || !projectOrName) return false;
  const bProject = String(bug.project || '').toLowerCase().trim();
  if (!bProject) return false;

  let pName = '';
  let pPrefix = '';

  if (typeof projectOrName === 'string') {
    pName = projectOrName.toLowerCase().trim();
  } else if (typeof projectOrName === 'object') {
    pName = String(projectOrName.name || '').toLowerCase().trim();
    pPrefix = String(projectOrName.prefix || '').replace('#', '').toLowerCase().trim();
  }

  if (pName && (bProject === pName || bProject.includes(pName) || pName.includes(bProject))) {
    return true;
  }

  if (pPrefix && (bProject === pPrefix || bProject.includes(pPrefix) || pPrefix.includes(bProject))) {
    return true;
  }

  // Canonical shorthand mapping
  if (bProject.includes('talent') && (pName.includes('talent') || pPrefix === 'tc')) return true;
  if (bProject.includes('learning') && (pName.includes('learning') || pPrefix === 'lc')) return true;
  if (bProject.includes('assessment') && (pName.includes('assessment') || pPrefix === 'ac')) return true;
  if (bProject.includes('employee') && (pName.includes('employee') || pPrefix === 'ec')) return true;
  if (bProject.includes('quality') && (pName.includes('quality') || pPrefix === 'qc')) return true;
  if (bProject.includes('lex') && (pName.includes('lex') || pPrefix === 'lex')) return true;

  return false;
}

/**
 * Checks whether a bug is active (not resolved, closed, or handed off)
 */
export function isBugActive(bug, hiddenBugIds = []) {
  if (!bug) return false;
  const isResolvedOrClosed = ['resolved', 'closed'].includes((bug.status || '').toLowerCase());
  const isHandedOff = Boolean(
    bug.handed_off_to_tester || 
    bug.removed_from_dev_list || 
    (Array.isArray(hiddenBugIds) && hiddenBugIds.includes(bug.id))
  );
  return !isResolvedOrClosed && !isHandedOff;
}

/**
 * Returns active bugs needing developer action (Open and In Progress)
 */
export function getActiveBugs(bugs = [], hiddenBugIds = []) {
  if (!Array.isArray(bugs)) return [];
  return bugs.filter(b => isBugActive(b, hiddenBugIds));
}

/**
 * Filters bugs according to scope: 'personal' (Assigned to You) | 'team' (To the Team)
 */
export function getScopedBugs(bugs = [], currentUser, scope = 'personal', hiddenBugIds = []) {
  if (!Array.isArray(bugs)) return [];
  const activeBugs = getActiveBugs(bugs, hiddenBugIds);
  if (scope === 'personal') {
    return activeBugs.filter(b => isBugAssignedToUser(b, currentUser));
  }
  return activeBugs;
}

/**
 * Computes live real-time statistics directly from the bugs array for KPI cards and dashboard widgets
 */
export function computeLiveMetrics(bugs = [], currentUser, scope = 'personal', hiddenBugIds = []) {
  const allScoped = scope === 'personal'
    ? bugs.filter(b => isBugAssignedToUser(b, currentUser))
    : bugs;

  const activeBugs = getActiveBugs(bugs, hiddenBugIds);
  const activeScoped = scope === 'personal'
    ? activeBugs.filter(b => isBugAssignedToUser(b, currentUser))
    : activeBugs;

  const myCount = activeBugs.filter(b => isBugAssignedToUser(b, currentUser)).length;
  const teamCount = activeBugs.length;

  const openCount = activeScoped.filter(b => (b.status || '').toLowerCase() === 'open').length;
  const inProgCount = activeScoped.filter(b => (b.status || '').toLowerCase() === 'in progress').length;

  // Resolved count tracks all completed tickets - it is NEVER minused when a ticket is removed from active list!
  const resolvedCount = allScoped.filter(b => (b.status || '').toLowerCase() === 'resolved').length;
  const closedCount = allScoped.filter(b => (b.status || '').toLowerCase() === 'closed').length;
  const solvedCount = resolvedCount + closedCount;
  const reopenedCount = allScoped.filter(b => (b.status || '').toLowerCase() === 'reopened').length;
  const overdueCount = activeScoped.filter(b => b.overdue === true).length;

  const criticalCount = activeScoped.filter(b => (b.severity || '').toLowerCase() === 'critical').length;
  const highCount = activeScoped.filter(b => (b.severity || '').toLowerCase() === 'high').length;
  const mediumCount = activeScoped.filter(b => (b.severity || '').toLowerCase() === 'medium').length;
  const lowCount = activeScoped.filter(b => (b.severity || '').toLowerCase() === 'low').length;

  const total = activeScoped.length;
  const calcPct = (count, tot) => tot > 0 ? Math.round((count / tot) * 100) : 0;

  const statusBreakdown = [
    { name: 'Open', value: openCount, pct: calcPct(openCount, total + solvedCount), color: '#3B82F6' },
    { name: 'In Progress', value: inProgCount, pct: calcPct(inProgCount, total + solvedCount), color: '#F59E0B' },
    { name: 'Resolved', value: solvedCount, pct: calcPct(solvedCount, total + solvedCount), color: '#10B981' },
    { name: 'Reopened', value: reopenedCount, pct: calcPct(reopenedCount, total + solvedCount), color: '#EF4444' },
    { name: 'Closed', value: closedCount, pct: calcPct(closedCount, total + solvedCount), color: '#06B6D4' }
  ];

  const bugsBySeverity = [
    { severity: 'Critical', count: criticalCount, color: '#EF4444', gradientId: 'critGrad' },
    { severity: 'High', count: highCount, color: '#F97316', gradientId: 'highGrad' },
    { severity: 'Medium', count: mediumCount, color: '#3B82F6', gradientId: 'medGrad' },
    { severity: 'Low', count: lowCount, color: '#10B981', gradientId: 'lowGrad' }
  ];

  const actionItems = activeScoped
    .filter(b => ['open', 'in progress'].includes((b.status || '').toLowerCase()))
    .map(b => ({
      id: b.id,
      title: b.title,
      severity: b.severity || 'Medium',
      assignee: b.assignee || 'Unassigned',
      date: b.created_on || 'Today',
      subtitle: `${b.project || 'Project'} • ${b.module || 'General'}`,
      status: (b.severity || 'Medium').toLowerCase(),
      currentStatus: b.status || 'Open'
    }));

  return {
    scopedBugs: activeScoped,
    total,
    myBugsCount: myCount,
    teamBugsCount: teamCount,
    stats: {
      new_bugs: openCount,
      open_bugs: openCount,
      in_progress: inProgCount,
      resolved_bugs: solvedCount,
      closed_bugs: closedCount,
      solved_points: solvedCount,
      overdue_bugs: overdueCount
    },
    status_overview: {
      total: total + solvedCount,
      breakdown: statusBreakdown
    },
    bugs_by_severity: bugsBySeverity,
    action_items: actionItems,
    severity: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount
    }
  };
}

/**
 * Computes live real-time stats for a specific project based on the active bugs list
 */
export function computeProjectStats(project, allBugs = [], currentUser, scope = 'team', hiddenBugIds = []) {
  const activeBugs = getActiveBugs(allBugs, hiddenBugIds);
  const scopedActive = scope === 'personal'
    ? activeBugs.filter(b => isBugAssignedToUser(b, currentUser))
    : activeBugs;
  const scopedAll = scope === 'personal'
    ? allBugs.filter(b => isBugAssignedToUser(b, currentUser))
    : allBugs;

  const projActiveBugs = scopedActive.filter(b => doesBugMatchProject(b, project));
  const projAllBugs = scopedAll.filter(b => doesBugMatchProject(b, project));

  const open_bugs = projActiveBugs.filter(b => (b.status || '').toLowerCase() === 'open').length;
  const in_progress_bugs = projActiveBugs.filter(b => (b.status || '').toLowerCase() === 'in progress').length;
  const resolved_bugs = projAllBugs.filter(b => ['resolved', 'closed'].includes((b.status || '').toLowerCase())).length;
  const critical_bugs = projActiveBugs.filter(b => (b.severity || '').toLowerCase() === 'critical').length;
  const active_bugs = open_bugs + in_progress_bugs;

  // Dynamic health rate computation: base 100 minus active and critical defects
  const penalty = (critical_bugs * 8) + (open_bugs * 3) + (in_progress_bugs * 1.5);
  const health_rate = Math.min(100, Math.max(75, Math.round(100 - penalty)));

  return {
    ...project,
    open_bugs,
    in_progress_bugs,
    resolved_bugs,
    active_bugs,
    critical_bugs,
    health_rate,
    total_bugs: projAllBugs.length
  };
}
