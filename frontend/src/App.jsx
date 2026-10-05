import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from './core/auth/AuthContext';
import { Toaster } from 'react-hot-toast';
import TooltipProvider from './core/components/TooltipProvider';
import HorizontalLoader from './core/components/HorizontalLoader';
import { P } from './core/permissions';

import Layout from './components/Layout';
import LandingPage from "./modules/landing/pages/LandingPage";
import ForgotPasswordPage from './modules/landing/pages/ForgotPasswordPage';
import ResetPasswordPage from './modules/landing/pages/ResetPasswordPage';
import OnboardPage from './modules/landing/pages/OnboardPage';

import ForceChangePasswordPage from './modules/landing/pages/ForceChangePasswordPage';

import MasterConsole from './modules/admin/pages/MasterConsole';
import OrgDashboard from './modules/admin/pages/OrgDashboard';
import SuperadminDashboard from './modules/admin/pages/SuperadminDashboard';

import SourceDashboard from './modules/source/pages/SourceDashboard';
import DeployDashboard from './modules/deploy/pages/DeployDashboard';
import VerifyDashboard from './modules/verify/pages/VerifyDashboard';
import ForgeDashboard from './modules/forge/pages/ForgeDashboard';
import TraineeDashboard from './modules/trainee/pages/TraineeDashboard';
import LexAIDashboard from './modules/lexai/pages/LexAIDashboard';
import QualityDashboard from './modules/quality/pages/QualityDashboard';

function getFirstAllowedRoute(hasPermission) {
  if (hasPermission?.('module.deploy.access')) return '/deploy';
  if (hasPermission?.('module.quality.access')) return '/quality';
  if (hasPermission?.('module.source.access')) return '/source';
  if (hasPermission?.('module.forge.access')) return '/forge';
  if (hasPermission?.('module.verify.access')) return '/verify';
  if (hasPermission?.('module.lexai.access')) return '/lexai';
  return '/';
}

function ProtectedRoute({ children, requiredPermission, requiredModule }) {
  const { user, loading, hasPermission } = useAuth();
  
  if (loading) {
    return <HorizontalLoader fullScreen label="Loading workspace..." />;
  }
  
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Force password change check
  if (user.password_must_change) {
    return <Navigate to="/force-change-password" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    const fallback = getFirstAllowedRoute(hasPermission);
    return <Navigate to={fallback} replace />;
  }

  if (requiredModule && !hasPermission(`module.${requiredModule}.access`)) {
    const fallback = getFirstAllowedRoute(hasPermission);
    return <Navigate to={fallback} replace />;
  }
  
  return children;
}

function AdminGate() {
  const { hasRole, hasPermission } = useAuth();

  // super_admin is a platform role — no seeded permission equivalent exists
  if (hasRole(['super_admin'])) {
    return <MasterConsole />;
  }

  // org_admin has admin.users.manage seeded — prefer PBAC over raw role check
  if (hasPermission(P.ADMIN_USERS_MANAGE)) {
    return <OrgDashboard />;
  }

  // Fallback for managers or others who shouldn't be in the admin workspace
  const fallback = getFirstAllowedRoute(hasPermission);
  return <Navigate to={fallback} replace />;
}

function PublicRoute({ children }) {
  const { user, loading, hasPermission } = useAuth();
  
  if (loading) {
    return <HorizontalLoader fullScreen label="Loading workspace..." />;
  }

  if (user) {
    if (user.password_must_change) {
      return <Navigate to="/force-change-password" replace />;
    }
    return <Navigate to={getFirstAllowedRoute(hasPermission)} replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <Toaster position="top-right" />

        <Routes>
          {/* Landing & Auth */}
          <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
          <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
          <Route path="/force-change-password" element={<ForceChangePasswordPage />} />
          <Route path="/onboard" element={<PublicRoute><OnboardPage /></PublicRoute>} />

          {/* Dashboards */}
          <Route 
            path="/superadmin" 
            element={
              <ProtectedRoute requiredPermission={P.MANAGE_SYSTEM}>
                <Layout><SuperadminDashboard /></Layout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <Layout><AdminGate /></Layout>
              </ProtectedRoute>
            } 
          />

          {/* ── ABOUT ROUTE REMOVED ── */}
          {/* <Route path="/about" element={<About />} /> */}

          <Route 
            path="/source" 
            element={
              <ProtectedRoute requiredModule="source">
                <Layout><SourceDashboard /></Layout>
              </ProtectedRoute>
            } 
          />


          <Route 
            path="/verify" 
            element={
              <ProtectedRoute requiredModule="verify">
                <Layout><VerifyDashboard /></Layout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/forge" 
            element={
              <ProtectedRoute requiredModule="forge">
                <Layout><ForgeDashboard /></Layout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/deploy" 
            element={
              <ProtectedRoute requiredModule="deploy">
                <Layout><DeployDashboard /></Layout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/quality" 
            element={
              <ProtectedRoute requiredModule="quality">
                <Layout><QualityDashboard /></Layout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/quality/dashboard" 
            element={
              <ProtectedRoute requiredModule="quality">
                <Navigate to="/quality?tab=dashboard" replace />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/quality/projects" 
            element={
              <ProtectedRoute requiredModule="quality">
                <Navigate to="/quality?tab=projects" replace />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/bugs" 
            element={
              <ProtectedRoute requiredModule="quality">
                <Navigate to="/quality?tab=bugs" replace />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/quality/bugs" 
            element={
              <ProtectedRoute requiredModule="quality">
                <Navigate to="/quality?tab=bugs" replace />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/lexai" 
            element={
              <ProtectedRoute requiredModule="lexai">
                <Layout><LexAIDashboard /></Layout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/trainee" 
            element={
              <ProtectedRoute>
                <TraineeDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Fallbacks */}
          <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  );
}