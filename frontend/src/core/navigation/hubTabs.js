import { MODULE_CONFIG } from "../config/modules";
import { P } from "../permissions";

export const canViewDashboardTab = (hasPermission) =>
  hasPermission?.(P.ADMIN_USERS_MANAGE) === true;

export const getHubTabs = ({ hasPermission, hasRole }) => {
  const moduleTabs = Object.entries(MODULE_CONFIG)
    .filter(([key, config]) => {
      return hasPermission?.(config.permission);
    })
    .map(([key, config]) => ({
      id: key,
      name: config.label,
      path: config.route,
    }));

  if (!canViewDashboardTab(hasPermission)) {
    return moduleTabs;
  }

  return [
    {
      id: "dashboard",
      name: "Dashboard",
      path: "/admin",
    },
    ...moduleTabs,
  ];
};
