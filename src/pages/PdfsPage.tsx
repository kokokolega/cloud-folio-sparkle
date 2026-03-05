import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FileGrid } from "@/components/files/FileGrid";

export default function PdfsPage() {
  return (
    <DashboardLayout>
      <h2 className="text-xl font-semibold text-foreground mb-6">PDFs</h2>
      <FileGrid searchQuery="" typeFilter="pdf" />
    </DashboardLayout>
  );
}
