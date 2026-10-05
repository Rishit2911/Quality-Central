import React from 'react';
import { usePermissions } from '../../core/auth/usePermissions';

/**
 * Wrapper component to conditionally render UI elements based on the current user's permissions.
 * 
 * @param {string} permission - The exact permission key required (e.g. 'deploy.employees.manage')
 * @param {React.ReactNode} children - The elements to render if permission is granted
 * @param {React.ReactNode} fallback - Optional elements to render if permission is denied
 */
const HasPermission = ({ permission, children, fallback = null }) => {
    const { hasPermission } = usePermissions();

    const isGranted = Array.isArray(permission)
        ? permission.some(p => hasPermission(p))
        : hasPermission(permission);

    if (isGranted) {
        return <>{children}</>;
    }

    return fallback ? <>{fallback}</> : null;
};

export default HasPermission;
