import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

import useIdleTimeout from '../hooks/useIdleTimeout';
import toast from 'react-hot-toast';

// Session idle timeout: 30 minutes of inactivity
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/auth/check', {
        credentials: 'include',
      });

      const data = await res.json();

      if (data.authenticated) {
        setUser(data.user);
      }
    } catch (e) {
      console.error('Failed to refresh user matrix', e);
    }
  };

  const login = (userData) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      console.error('Logout request failed', e);
    } finally {
      setUser(null);
      window.location.href = '/';
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/check', {
          credentials: 'include',
        });

        const data = await res.json();

        if (data.authenticated) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (e) {
        console.error('Auth check failed');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // ── Idle Timeout ────────────────────────────────────────────────────────────
  // Log the user out automatically after IDLE_TIMEOUT_MS of inactivity.
  const handleIdle = useCallback(async () => {
    if (!user) return; // already logged out
    toast.error('Your session has expired due to inactivity. Please log in again.', {
      duration: 6000,
      id: 'session-expired',
    });
    await logout();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useIdleTimeout(handleIdle, IDLE_TIMEOUT_MS, !!user);

  const hasRole = (roles) => {
    if (!user) return false;

    const rawRoles = (user.roles || [user.role]).map((r) =>
      r ? r.toLowerCase() : ''
    );

    const userRoles = rawRoles.map((r) => {
      if (['admin', 'administrator'].includes(r)) {
        return 'org_admin';
      }

      if (
        ['hr', 'management', 'hr_manager', 'team_lead'].includes(r)
      ) {
        return 'manager';
      }

      return r;
    });

    if (
      userRoles.includes('super_admin') ||
      userRoles.includes('superadmin')
    ) {
      return true;
    }

    if (Array.isArray(roles)) {
      const allowedRoles = roles.map((r) => r.toLowerCase());

      return allowedRoles.some((role) =>
        userRoles.includes(role)
      );
    }

    return userRoles.includes(roles.toLowerCase());
  };

  const hasPermission = (permissionKey) => {
    if (!user) return false;

    // STRICT MODULE CONTRACT CHECK
    if (
      permissionKey?.startsWith('module.') &&
      permissionKey?.endsWith('.access')
    ) {
      const mn = permissionKey.split('.')[1];

      // Quality Central is a core cross-organization QA module
      if (mn === 'quality') {
        return true;
      }

      const enabled = (user.modules_enabled || []).map((m) =>
        String(m).toLowerCase()
      );

      if (!enabled.includes(mn.toLowerCase())) {
        return false;
      }
    }

    const roles = (user.roles || [user.role]).map(
      (r) => r?.toLowerCase?.() || ''
    );

    // SUPER ADMIN BYPASS
    if (
      roles.includes('super_admin') ||
      roles.includes('superadmin')
    ) {
      return true;
    }

    const perms = user.permissions;

    // ARRAY FORMAT
    if (Array.isArray(perms)) {
      return perms.some((p) => {
        if (typeof p === 'string') {
          return p === permissionKey;
        }

        if (typeof p === 'object') {
          return (
            p.key === permissionKey ||
            p.name === permissionKey ||
            p.permission === permissionKey
          );
        }

        return false;
      });
    }

    // OBJECT FORMAT
    if (typeof perms === 'object' && perms !== null) {
      return (
        perms[permissionKey] === true ||
        perms[permissionKey] === 1 ||
        perms[permissionKey] === 'true'
      );
    }

    return false;
  };

  // Check if user is authenticated
  const isAuthenticated = !!user && !loading;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        login,
        logout,
        hasRole,
        hasPermission,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return context;
};