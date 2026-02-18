import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FileGrid } from "@/components/files/FileGrid";

export default function ImagesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  return (
    <DashboardLayout searchQuery={searchQuery} onSearchChange={setSearchQuery}>
      <h2 className="text-xl font-semibold text-foreground mb-6">Images</h2>
      <FileGrid searchQuery={searchQuery} typeFilter="image" />
    </DashboardLayout>
  );
}
