import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { UploadDialog } from "@/components/upload/UploadDialog";

interface DashboardLayoutProps {
  children: React.ReactNode;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function DashboardLayout({ children, searchQuery, onSearchChange }: DashboardLayoutProps) {
  const [uploadOpen, setUploadOpen] = useState(false);

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
          <main className="flex-1 p-4 md:p-6 animate-fade-in">
            {children}
          </main>
        </div>
      </div>
      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </SidebarProvider>
  );
}
