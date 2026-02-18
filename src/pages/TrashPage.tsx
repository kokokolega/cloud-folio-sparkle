import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FileGrid } from "@/components/files/FileGrid";

export default function TrashPage() {
  const [searchQuery, setSearchQuery] = useState("");
  return (
    <DashboardLayout searchQuery={searchQuery} onSearchChange={setSearchQuery}>
      <h2 className="text-xl font-semibold text-foreground mb-6">Trash</h2>
      <FileGrid searchQuery={searchQuery} showDeleted />
    </DashboardLayout>
  );
}
