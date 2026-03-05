import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Users, Loader2, LogIn, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { GroupDetail } from "@/components/groups/GroupDetail";

export default function GroupsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups", user?.id],
    queryFn: async () => {
      const { data: memberships, error: mErr } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id);
      if (mErr) throw mErr;
      if (!memberships.length) return [];
      const groupIds = memberships.map((m: any) => m.group_id);
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .in("id", groupIds)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const { data, error } = await supabase
        .from("groups")
        .insert({ name, description, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      await supabase.from("group_members").insert({
        group_id: data.id,
        user_id: user!.id,
        role: "admin",
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
      setActiveGroup(data.id);
      toast.success("Group created!");
    },
  });

  const joinMutation = useMutation({
    mutationFn: async (code: string) => {
      const { data: group, error: gErr } = await supabase
        .from("groups")
        .select("id, name")
        .eq("invite_code", code.trim())
        .single();
      if (gErr || !group) throw new Error("Invalid invite code");
      const { error } = await supabase.from("group_members").insert({
        group_id: group.id,
        user_id: user!.id,
        role: "member",
      });
      if (error) {
        if (error.code === "23505") throw new Error("You're already in this group");
        throw error;
      }
      return group;
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setJoinOpen(false);
      setInviteCode("");
      setActiveGroup(group.id);
      toast.success(`Joined "${group.name}"!`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group deleted");
    },
  });

  const filtered = groups.filter((g: any) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (activeGroup) {
    return <GroupDetail groupId={activeGroup} onBack={() => setActiveGroup(null)} />;
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6 gap-3">
        <h2 className="text-xl font-semibold text-foreground shrink-0">Groups</h2>
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search groups…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 rounded-lg bg-muted/60 border-0 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => setJoinOpen(true)} className="rounded-xl gap-2">
            <LogIn className="h-4 w-4" /> Join
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="rounded-xl gap-2">
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Users className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No groups yet</p>
          <p className="text-muted-foreground/70 text-xs mt-1">Create a group or join with an invite code</p>
          <div className="flex gap-2 justify-center mt-4">
            <Button variant="outline" className="rounded-xl" onClick={() => setJoinOpen(true)}>Join Group</Button>
            <Button className="rounded-xl" onClick={() => setCreateOpen(true)}>Create Group</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((group: any) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card p-4 cursor-pointer hover:border-primary/30 transition-colors group"
                onClick={() => setActiveGroup(group.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-foreground text-sm">{group.name}</h3>
                    {group.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{group.description}</p>
                    )}
                  </div>
                  {group.created_by === user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(group.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(group.created_at).toLocaleDateString()}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
            <DialogDescription>Create a new collaborative workspace</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Group name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate({ name: newName.trim(), description: newDesc.trim() })} disabled={!newName.trim() || createMutation.isPending} className="rounded-xl">
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Join Group</DialogTitle>
            <DialogDescription>Enter the invite code or scan a QR code</DialogDescription>
          </DialogHeader>
          <Input placeholder="Paste invite code here" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && inviteCode.trim() && joinMutation.mutate(inviteCode)} />
          <DialogFooter>
            <Button onClick={() => joinMutation.mutate(inviteCode)} disabled={!inviteCode.trim() || joinMutation.isPending} className="rounded-xl">
              {joinMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Join
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
