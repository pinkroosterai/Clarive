import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { DndProvider } from "@/components/dnd/DndProvider";
import { EmailVerificationBanner } from "@/components/common/EmailVerificationBanner";
import { MaintenanceBanner } from "@/components/common/MaintenanceBanner";
import { ErrorBoundary, PageErrorFallback } from "@/components/common/ErrorBoundary";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";

export function AppShell() {
  return (
    <SidebarProvider defaultOpen>
      <DndProvider>
        <AppSidebar />
        <SidebarInset>
          <TopBar />
          <MaintenanceBanner />
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
