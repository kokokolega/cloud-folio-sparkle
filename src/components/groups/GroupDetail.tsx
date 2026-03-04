import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, QrCode, Copy, StickyNote, FolderOpen, Pencil, MessageSquare, Image } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { GroupNotes } from "./GroupNotes";
import { GroupFiles } from "./GroupFiles";
import { GroupWhiteboards } from "./GroupWhiteboards";
import { GroupChat } from "./GroupChat";

interface GroupDetailProps {
  groupId: string;
  onBack: () => void;
}

export function GroupDetail({ groupId, onBack }: GroupDetailProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [qrOpen, setQrOpen] = useState(false);

  const { data: group } = useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["group-members", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("*, profiles:user_id(email)")
        .eq("group_id", groupId);
      if (error) throw error;
      return data;
    },
  });

  const joinUrl = group ? `${window.location.origin}/join/${group.invite_code}` : "";

  const copyInvite = () => {
    if (group) {
      navigator.clipboard.writeText(group.invite_code);
      toast.success("Invite code copied!");
    }
  };

  return (
    <DashboardLayout searchQuery={searchQuery} onSearchChange={setSearchQuery}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 rounded-lg">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold text-foreground">{group?.name || "Group"}</h2>
            {group?.description && (
              <p className="text-xs text-muted-foreground">{group.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyInvite} className="rounded-xl gap-2">
            <Copy className="h-3.5 w-3.5" /> Copy Code
          </Button>
          <Button variant="outline" size="sm" onClick={() => setQrOpen(true)} className="rounded-xl gap-2">
            <QrCode className="h-3.5 w-3.5" /> QR Code
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground mb-4">
        {members.length} member{members.length !== 1 && "s"}
      </div>

      <Tabs defaultValue="notes" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="notes" className="gap-1.5">
            <StickyNote className="h-3.5 w-3.5" /> Notes
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-1.5">
            <Image className="h-3.5 w-3.5" /> Files
          </TabsTrigger>
          <TabsTrigger value="whiteboards" className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Whiteboards
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes">
          <GroupNotes groupId={groupId} searchQuery={searchQuery} />
        </TabsContent>
        <TabsContent value="files">
          <GroupFiles groupId={groupId} searchQuery={searchQuery} />
        </TabsContent>
        <TabsContent value="whiteboards">
          <GroupWhiteboards groupId={groupId} />
        </TabsContent>
        <TabsContent value="chat">
          <GroupChat groupId={groupId} />
        </TabsContent>
      </Tabs>

      {/* QR Dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>Invite to {group?.name}</DialogTitle>
            <DialogDescription>Scan QR code or use invite code to join</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-xl">
              <QRCodeSVG value={joinUrl} size={200} />
            </div>
            <p className="text-xs text-muted-foreground">Scan to join this group</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-3 py-1.5 rounded-lg font-mono">
                {group?.invite_code}
              </code>
              <Button size="sm" variant="outline" onClick={copyInvite} className="rounded-lg">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
