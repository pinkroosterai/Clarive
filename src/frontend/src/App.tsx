import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { ErrorBoundary } from '@/components/common/ErrorBoundary';
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

// Lazy loaded pages
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const EntryEditorPage = lazy(() => import('@/pages/EntryEditorPage'));
const LibraryPage = lazy(() => import('@/pages/LibraryPage'));
const NewEntryPage = lazy(() => import('@/pages/NewEntryPage'));
const WizardPage = lazy(() => import('@/pages/WizardPage'));
const EnhanceWizardPage = lazy(() => import('@/pages/EnhanceWizardPage'));
const PlaygroundPage = lazy(() => import('@/pages/PlaygroundPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const TrashPage = lazy(() => import('@/pages/TrashPage'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmailPage'));
const AcceptInvitationPage = lazy(() => import('@/pages/AcceptInvitationPage'));
const GoogleCallbackPage = lazy(() => import('@/pages/GoogleCallbackPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const WorkspaceSelectorPage = lazy(() => import('@/pages/WorkspaceSelectorPage'));
const SuperDashboardPage = lazy(() => import('@/pages/SuperDashboardPage'));
const HelpPage = lazy(() => import('@/pages/HelpPage'));
const SetupPage = lazy(() => import('@/pages/SetupPage'));
const PublicShareViewerPage = lazy(() => import('@/pages/PublicShareViewerPage'));
const SetupWizardPage = lazy(() => import('@/pages/SetupWizardPage'));
import { useAuthStore } from '@/store/authStore';

function SetupGuard({ children }: { children: React.ReactNode }) {
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

  return <>{children}</>;
}

function MaintenanceGuard({ children }: { children: React.ReactNode }) {
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
      .catch(() => {
        // Non-critical — maintenance check is best-effort for unauthenticated visitors
      });
  }, [currentUser, maintenanceMode, setMaintenanceMode]);

  if (maintenanceMode && !currentUser?.isSuperUser) {
    return <MaintenancePage />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <MaintenanceGuard>
                <SetupGuard>
                  <Routes>
                    {/* Setup route */}
                    <Route path="/setup" element={<SetupPage />} />

                    {/* Public routes */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/verify-email" element={<VerifyEmailPage />} />
                    <Route path="/invite/accept" element={<AcceptInvitationPage />} />
                    <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/share/:token" element={<PublicShareViewerPage />} />

                    {/* Super admin routes */}
                    <Route element={<SuperRoute />}>
                      <Route path="/super" element={<SuperDashboardPage />} />
                      <Route path="/setup-wizard" element={<SetupWizardPage />} />
                    </Route>

                    {/* Protected routes */}
                    <Route element={<ProtectedRoute />}>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/select-workspace" element={<WorkspaceSelectorPage />} />
                      <Route path="/library" element={<LibraryPage />} />
                      <Route path="/library/folder/:folderId" element={<LibraryPage />} />
                      <Route path="/entry/new" element={<NewEntryPage />} />
                      <Route path="/entry/new/wizard" element={<WizardPage />} />
                      <Route path="/entry/:entryId/enhance" element={<EnhanceWizardPage />} />
                      <Route path="/entry/:entryId/test" element={<PlaygroundPage />} />
                      <Route path="/entry/:entryId" element={<EntryEditorPage />} />
                      <Route
                        path="/entry/:entryId/version/:version"
                        element={<EntryEditorPage />}
                      />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/trash" element={<TrashPage />} />
                      <Route path="/help" element={<HelpPage />} />
                    </Route>

                    {/* Catch-all */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </SetupGuard>
              </MaintenanceGuard>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
