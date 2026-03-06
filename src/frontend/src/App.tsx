import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

import ProtectedRoute from "@/components/common/ProtectedRoute";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { queryClient } from "@/lib/queryClient";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getSystemStatus } from "@/services/api/superService";
import { getSetupStatus } from "@/services/api/authService";

// Eagerly loaded (always needed)
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import LibraryPage from "@/pages/LibraryPage";
import EntryEditorPage from "@/pages/EntryEditorPage";

// Lazy loaded (less frequently visited)
const NewEntryPage = lazy(() => import("@/pages/NewEntryPage"));
const WizardPage = lazy(() => import("@/pages/WizardPage"));
const EnhanceWizardPage = lazy(() => import("@/pages/EnhanceWizardPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const TrashPage = lazy(() => import("@/pages/TrashPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const VerifyEmailPage = lazy(() => import("@/pages/VerifyEmailPage"));
const AcceptInvitationPage = lazy(() => import("@/pages/AcceptInvitationPage"));
const GoogleCallbackPage = lazy(() => import("@/pages/GoogleCallbackPage"));
const TermsPage = lazy(() => import("@/pages/TermsPage"));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));
const WorkspaceSelectorPage = lazy(() => import("@/pages/WorkspaceSelectorPage"));
const SuperDashboardPage = lazy(() => import("@/pages/SuperDashboardPage"));
import MaintenancePage from "@/pages/MaintenancePage";
const HelpPage = lazy(() => import("@/pages/HelpPage"));
const SetupPage = lazy(() => import("@/pages/SetupPage"));
import SuperRoute from "@/components/common/SuperRoute";
import { useAuthStore } from "@/store/authStore";

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
  }, [location.pathname]);

  if (setupComplete === null) {
    return <LoadingSpinner />;
  }

  if (!setupComplete && location.pathname !== "/setup") {
    return <Navigate to="/setup" replace />;
  }

  if (setupComplete && location.pathname === "/setup") {
    return <Navigate to="/login" replace />;
  }

  // Redirect /register to /login when registration is disabled
  if (!allowRegistration && location.pathname === "/register") {
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
      .then((s) => { if (s.maintenance) setMaintenanceMode(true); })
      .catch(() => {});
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

              {/* Super admin routes */}
              <Route element={<SuperRoute />}>
                <Route path="/super" element={<SuperDashboardPage />} />
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
                <Route path="/entry/:entryId" element={<EntryEditorPage />} />
                <Route path="/entry/:entryId/version/:version" element={<EntryEditorPage />} />
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
