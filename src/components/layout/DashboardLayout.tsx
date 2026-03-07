import { useState, useCallback } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { IdleWarningDialog } from "@/components/IdleWarningDialog";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { useAuth } from "@/hooks/useAuth";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
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
          <main className="flex-1 p-5 md:p-8 animate-fade-in">
            {children}
          </main>
        </div>
      </div>
      <IdleWarningDialog open={showWarning} secondsLeft={secondsLeft} onDismiss={dismissWarning} />
    </SidebarProvider>
  );
}
