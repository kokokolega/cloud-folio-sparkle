import { useState, useCallback } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { UploadDialog } from "@/components/upload/UploadDialog";
import { IdleWarningDialog } from "@/components/IdleWarningDialog";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { useAuth } from "@/hooks/useAuth";

interface DashboardLayoutProps {
  children: React.ReactNode;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function DashboardLayout({ children, searchQuery, onSearchChange }: DashboardLayoutProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const { session, signOut } = useAuth();

  // Read auto-logout preference from localStorage
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
          <TopBar
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            onUploadClick={() => setUploadOpen(true)}
          />
          <main className="flex-1 p-5 md:p-8 animate-fade-in">
            {children}
          </main>
        </div>
      </div>
      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <IdleWarningDialog open={showWarning} secondsLeft={secondsLeft} onDismiss={dismissWarning} />
    </SidebarProvider>
  );
}
