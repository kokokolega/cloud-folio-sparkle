import { useState, useCallback } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { IdleWarningDialog } from "@/components/IdleWarningDialog";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { useAuth } from "@/hooks/useAuth";

interface DashboardLayoutProps {
  children: React.ReactNode;
  noPadding?: boolean;
}

export function DashboardLayout({ children, noPadding }: DashboardLayoutProps) {
  const { session, signOut } = useAuth();

  const autoLogoutEnabled = typeof window !== "undefined" ? localStorage.getItem("oltrid-auto-logout") !== "false" : true;

  const handleTimeout = useCallback(() => {
    if (session) signOut();
  }, [session, signOut]);

  const { showWarning, secondsLeft, dismissWarning } = useIdleTimeout({
    timeout: 60_000,
    warningBefore: 10_000,
    onTimeout: handleTimeout,
    enabled: !!session && autoLogoutEnabled,
  });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile trigger - only visible on small screens */}
          <div className="md:hidden flex items-center h-12 px-3 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30">
            <SidebarTrigger className="h-8 w-8" />
          </div>
          <main className={noPadding ? "flex-1" : "flex-1 p-4 md:p-6"}>
            {children}
          </main>
        </div>
      </div>
      <IdleWarningDialog open={showWarning} secondsLeft={secondsLeft} onDismiss={dismissWarning} />
    </SidebarProvider>
  );
}
