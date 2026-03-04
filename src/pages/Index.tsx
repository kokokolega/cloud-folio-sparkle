import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FileGrid } from "@/components/files/FileGrid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Files, Image, FileText, Plus, X } from "lucide-react";
import { UploadDialog } from "@/components/upload/UploadDialog";
import { AnimatePresence, motion } from "framer-motion";

export default function Index() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "pdf">("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  return (
    <DashboardLayout searchQuery={searchQuery} onSearchChange={setSearchQuery} hideUpload>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground">All Files</h2>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-36 rounded-xl h-9 text-sm border-0 bg-secondary/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="size">Size</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)} className="mb-6">
        <TabsList className="bg-secondary/40 rounded-xl">
          <TabsTrigger value="all" className="gap-1.5 rounded-lg text-[13px]">
            <Files className="h-3.5 w-3.5" /> All
          </TabsTrigger>
          <TabsTrigger value="image" className="gap-1.5 rounded-lg text-[13px]">
            <Image className="h-3.5 w-3.5" /> Images
          </TabsTrigger>
          <TabsTrigger value="pdf" className="gap-1.5 rounded-lg text-[13px]">
            <FileText className="h-3.5 w-3.5" /> PDFs
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <FileGrid searchQuery={searchQuery} sortBy={sortBy} typeFilter={typeFilter === "all" ? undefined : typeFilter} />

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        <AnimatePresence>
          {fabOpen && (
            <>
              <motion.button
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                transition={{ duration: 0.15, delay: 0.05 }}
                onClick={() => { setUploadOpen(true); setFabOpen(false); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border shadow-lg text-[13px] font-medium text-foreground hover:bg-accent transition-colors"
              >
                <Image className="h-4 w-4 text-primary" /> Images
              </motion.button>
              <motion.button
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                onClick={() => { setUploadOpen(true); setFabOpen(false); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border shadow-lg text-[13px] font-medium text-foreground hover:bg-accent transition-colors"
              >
                <FileText className="h-4 w-4 text-primary" /> PDFs
              </motion.button>
            </>
          )}
        </AnimatePresence>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setFabOpen(!fabOpen)}
          className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:bg-primary/90 transition-colors"
        >
          <motion.div
            animate={{ rotate: fabOpen ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {fabOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
          </motion.div>
        </motion.button>
      </div>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </DashboardLayout>
  );
}
