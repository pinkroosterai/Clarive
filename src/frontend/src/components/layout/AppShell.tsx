import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';

import { AiNotConfiguredBanner } from '@/components/common/AiNotConfiguredBanner';
import { EmailVerificationBanner } from '@/components/common/EmailVerificationBanner';
import { ErrorBoundary, PageErrorFallback } from '@/components/common/ErrorBoundary';
import { MaintenanceBanner } from '@/components/common/MaintenanceBanner';
import { DndProvider } from '@/components/dnd/DndProvider';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { useSetupStatus } from '@/hooks/useSetupStatus';
import { useAuthStore } from '@/store/authStore';

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAuthStore((s) => s.currentUser);
  const { data: setupStatus } = useSetupStatus();

  useEffect(() => {
    if (
      setupStatus?.requiresSetup &&
      currentUser?.isSuperUser &&
      location.pathname !== '/setup-wizard' &&
      !sessionStorage.getItem('cl_setup_wizard_dismissed')
    ) {
      navigate('/setup-wizard', { replace: true });
    }
  }, [setupStatus, currentUser, navigate, location.pathname]);

  return (
    <SidebarProvider defaultOpen={false}>
      <DndProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0 max-h-svh overflow-hidden">
          <TopBar />
          <MaintenanceBanner />
          <AiNotConfiguredBanner />
          <EmailVerificationBanner />
          <div className="flex-1 overflow-auto p-4 animate-page-enter">
            <ErrorBoundary fallback={PageErrorFallback}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </SidebarInset>
        <OnboardingTour />
      </DndProvider>
    </SidebarProvider>
  );
}
