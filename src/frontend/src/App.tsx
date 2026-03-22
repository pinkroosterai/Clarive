/* eslint-disable import/order -- @/ alias misclassified as external by eslint-plugin-import */
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
  useRouteError,
} from 'react-router-dom';

import { ErrorBoundary, PageErrorFallback } from '@/components/common/ErrorBoundary';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SuperRoute from '@/components/common/SuperRoute';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { queryClient } from '@/lib/queryClient';
import LoginPage from '@/pages/LoginPage';
import MaintenancePage from '@/pages/MaintenancePage';
import RegisterPage from '@/pages/RegisterPage';
import { getSetupStatus } from '@/services/api/authService';
import { getSystemStatus } from '@/services/api/superService';
import { useAuthStore } from '@/store/authStore';

// Route-level error boundary (scoped to individual routes)
function RouteErrorBoundary() {
  const error = useRouteError();
  return (
    <PageErrorFallback
      error={error instanceof Error ? error : new Error(String(error))}
      resetError={() => window.location.reload()}
    />
  );
}

// Helper for lazy route loading
const lazy = (importFn: () => Promise<{ default: React.ComponentType }>) =>
  () => importFn().then((m) => ({ Component: m.default }));

function SetupGuard() {
  const location = useLocation();
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [allowRegistration, setAllowRegistration] = useState(true);

  useEffect(() => {
    getSetupStatus()
      .then((s) => {
        setSetupComplete(s.isSetupComplete);
        setAllowRegistration(s.allowRegistration);
      })
      .catch(() => setSetupComplete(true)); // assume setup done on error
  }, []);

  if (setupComplete === null) {
    return <LoadingSpinner />;
  }

  if (!setupComplete && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  if (setupComplete && location.pathname === '/setup') {
    return <Navigate to="/login" replace />;
  }

  // Redirect /register to /login when registration is disabled
  if (!allowRegistration && location.pathname === '/register') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function MaintenanceGuard() {
  const maintenanceMode = useAuthStore((s) => s.maintenanceMode);
  const setMaintenanceMode = useAuthStore((s) => s.setMaintenanceMode);
  const currentUser = useAuthStore((s) => s.currentUser);

  // Check maintenance status for unauthenticated visitors (login/register pages)
  useEffect(() => {
    if (currentUser || maintenanceMode) return;
    getSystemStatus()
      .then((s) => {
        if (s.maintenance) setMaintenanceMode(true);
      })
      .catch((err) => {
        console.warn('[silentCatch] app:getSystemStatus:', err);
      });
  }, [currentUser, maintenanceMode, setMaintenanceMode]);

  if (maintenanceMode && !currentUser?.isSuperUser) {
    return <MaintenancePage />;
  }

  return <Outlet />;
}

const router = createBrowserRouter([
  {
    // Root layout: MaintenanceGuard → SetupGuard → child routes
    element: <ErrorBoundary><MaintenanceGuard /></ErrorBoundary>,
    children: [
      {
        element: <SetupGuard />,
        children: [
          // Setup route
          { path: '/setup', lazy: lazy(() => import('@/pages/SetupPage')) },

          // Public routes
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
          { path: '/forgot-password', lazy: lazy(() => import('@/pages/ForgotPasswordPage')) },
          { path: '/reset-password', lazy: lazy(() => import('@/pages/ResetPasswordPage')) },
          { path: '/verify-email', lazy: lazy(() => import('@/pages/VerifyEmailPage')) },
          { path: '/invite/accept', lazy: lazy(() => import('@/pages/AcceptInvitationPage')) },
          { path: '/auth/google/callback', lazy: lazy(() => import('@/pages/GoogleCallbackPage')) },
          { path: '/terms', lazy: lazy(() => import('@/pages/TermsPage')) },
          { path: '/privacy', lazy: lazy(() => import('@/pages/PrivacyPage')) },
          { path: '/share/:token', lazy: lazy(() => import('@/pages/PublicShareViewerPage')) },

          // Super admin routes
          {
            element: <SuperRoute />,
            errorElement: <RouteErrorBoundary />,
            children: [
              { path: '/super', lazy: lazy(() => import('@/pages/SuperDashboardPage')) },
              { path: '/setup-wizard', lazy: lazy(() => import('@/pages/SetupWizardPage')) },
            ],
          },

          // Protected routes
          {
            element: <ProtectedRoute />,
            errorElement: <RouteErrorBoundary />,
            children: [
              { path: '/', lazy: lazy(() => import('@/pages/DashboardPage')) },
              { path: '/select-workspace', lazy: lazy(() => import('@/pages/WorkspaceSelectorPage')) },
              { path: '/library', lazy: lazy(() => import('@/pages/LibraryPage')) },
              { path: '/library/folder/:folderId', lazy: lazy(() => import('@/pages/LibraryPage')) },
              { path: '/entry/new', lazy: lazy(() => import('@/pages/NewEntryPage')) },
              { path: '/entry/new/wizard', lazy: lazy(() => import('@/pages/WizardPage')) },
              { path: '/entry/:entryId/enhance', lazy: lazy(() => import('@/pages/EnhanceWizardPage')) },
              { path: '/entry/:entryId/test', lazy: lazy(() => import('@/pages/PlaygroundPage')) },
              { path: '/entry/:entryId', lazy: lazy(() => import('@/pages/EntryEditorPage')) },
              { path: '/entry/:entryId/version/:version', lazy: lazy(() => import('@/pages/EntryEditorPage')) },
              { path: '/settings', lazy: lazy(() => import('@/pages/SettingsPage')) },
              { path: '/trash', lazy: lazy(() => import('@/pages/TrashPage')) },
              { path: '/help', lazy: lazy(() => import('@/pages/HelpPage')) },
            ],
          },

          // Catch-all
          { path: '*', lazy: lazy(() => import('@/pages/NotFound')) },
        ],
      },
    ],
  },
]);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Sonner />
        <RouterProvider router={router} fallbackElement={<LoadingSpinner />} />
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
