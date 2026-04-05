import { useState, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FileGrid } from "@/components/files/FileGrid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Files, Image, FileText, FolderOpen, Plus, Search, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UploadDialog } from "@/components/upload/UploadDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Index() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "pdf" | "folders">("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) setUploadOpen(true);
  }, []);

  const handleTabChange = (v: string) => {
    if (v === "folders") {
      navigate("/folders");
    } else {
      setTypeFilter(v as "all" | "image" | "pdf");
    }
  };

  return (
    <DashboardLayout>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={`min-h-[60vh] transition-all duration-200 ${dragOver ? "drag-over rounded-2xl" : ""}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <h1 className="text-xl font-semibold text-foreground">All Files</h1>
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search files…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 rounded-xl bg-secondary/50 border border-border text-sm"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-28 rounded-xl h-9 text-sm border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="size">Size</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setUploadOpen(true)} size="sm" className="h-9 rounded-xl gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Upload
            </Button>
          </div>
        </div>

        <Tabs value={typeFilter} onValueChange={handleTabChange} className="mb-6">
          <TabsList className="bg-secondary/50 rounded-xl border border-border">
            <TabsTrigger value="all" className="gap-1.5 rounded-lg text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Files className="h-3.5 w-3.5" /> All
            </TabsTrigger>
            <TabsTrigger value="image" className="gap-1.5 rounded-lg text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Image className="h-3.5 w-3.5" /> Images
            </TabsTrigger>
            <TabsTrigger value="pdf" className="gap-1.5 rounded-lg text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <FileText className="h-3.5 w-3.5" /> PDFs
            </TabsTrigger>
            <TabsTrigger value="folders" className="gap-1.5 rounded-lg text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <FolderOpen className="h-3.5 w-3.5" /> Folders
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <FileGrid searchQuery={searchQuery} sortBy={sortBy} typeFilter={typeFilter === "all" ? undefined : typeFilter === "folders" ? undefined : typeFilter} />
      </div>
      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </DashboardLayout>
  );
}
