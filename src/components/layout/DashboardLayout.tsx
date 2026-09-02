import { useCallback } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { IdleWarningDialog } from "@/components/IdleWarningDialog";
import { AlarmManager } from "@/components/alarms/AlarmManager";
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
          <div className="flex items-center h-12 px-3 border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-30 md:hidden">
            <SidebarTrigger className="h-10 w-10" />
          </div>
          <main className={noPadding ? "flex-1 h-[calc(100vh-48px)] md:h-screen" : "flex-1 p-4 md:p-6 overflow-auto"}>
            {children}
          </main>
        </div>
      </div>
      <IdleWarningDialog open={showWarning} secondsLeft={secondsLeft} onDismiss={dismissWarning} />
      <AlarmManager />
    </SidebarProvider>
  );
}
