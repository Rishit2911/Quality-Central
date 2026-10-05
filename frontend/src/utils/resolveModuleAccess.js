const MODULES = {
  '/source': 'source',
  '/forge': 'forge',
  '/verify': 'verify',
  '/deploy': 'deploy',
  '/quality': 'quality',
};

const rolesFor = (user) => (user?.roles || [user?.role])
  .filter(Boolean)
  .map((role) => String(role).toLowerCase());

export const defaultRouteForUser = (user) => {
  const roles = rolesFor(user);
  if (roles.includes('super_admin')) return '/superadmin';
  if (roles.includes('org_admin') || roles.includes('admin')) return '/admin';
  if (roles.includes('manager')) return '/deploy?tab=personnel';
  if (roles.includes('candidate')) return '/source?tab=my-application';
  if (roles.includes('trainee')) return '/trainee';
  return '/deploy';
};

const tenantHasModule = (user, module) =>
  (user?.modules_enabled || []).some((enabled) =>
    String(enabled).toLowerCase() === module
  );

const hasAssignedAssessment = async () => {
  try {
    const response = await fetch('/api/verify/assignments/my-tests', {
      credentials: 'include',
    });
    if (!response.ok) return false;

    const body = await response.json();
    const assignments = Array.isArray(body?.data) ? body.data : body;
    return Array.isArray(assignments) && assignments.length > 0;
  } catch {
    return false;
  }
};

/**
 * Converts a landing-page module request into an allowed in-app route.
 * Only known internal routes are accepted; all denied requests fall back to
 * the user's normal workspace, with employees landing in Employee Central.
 */
export async function resolveModuleAccess(requestedPath, user, hasPermission) {
  const module = MODULES[requestedPath];
  if (!module) return defaultRouteForUser(user);

  const roles = rolesFor(user);
  const isEmployee = roles.includes('employee');

  // Employees never enter Talent Central from a landing card.
  if (isEmployee && module === 'source') return '/deploy';

  // Assessment Central is only an employee destination when there is an
  // actual assignment. Its tenant module must also be enabled.
  if (isEmployee && module === 'verify') {
    return tenantHasModule(user, module) && await hasAssignedAssessment()
      ? '/verify?tab=candidate'
      : '/deploy';
  }

  if (hasPermission(`module.${module}.access`)) return requestedPath;

  return isEmployee ? '/deploy' : defaultRouteForUser(user);
}
