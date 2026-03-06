import { Outlet } from 'react-router-dom';

import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';

import { AiNotConfiguredBanner } from '@/components/common/AiNotConfiguredBanner';
import { EmailVerificationBanner } from '@/components/common/EmailVerificationBanner';
import { ErrorBoundary, PageErrorFallback } from '@/components/common/ErrorBoundary';
import { MaintenanceBanner } from '@/components/common/MaintenanceBanner';
import { DndProvider } from '@/components/dnd/DndProvider';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

export function AppShell() {
  return (
    <SidebarProvider defaultOpen>
      <DndProvider>
        <AppSidebar />
        <SidebarInset>
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
