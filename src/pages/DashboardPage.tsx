import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  StickyNote, Files, Users, MessageCircle, Brain, TrendingUp,
  Calendar, Activity, FolderOpen, Bot,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { MemoryGraph } from "@/components/dashboard/MemoryGraph";

interface Stats {
  totalNotes: number;
  totalFiles: number;
  totalGroups: number;
  totalConversations: number;
  totalMessages: number;
  totalMemories: number;
  totalFolders: number;
  totalWhiteboards: number;
  recentNotes: { date: string; count: number }[];
  recentMessages: { date: string; count: number }[];
  fileTypes: { name: string; value: number }[];
  noteColors: { name: string; value: number }[];
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--ring))",
  "hsl(var(--destructive))",
  "hsl(var(--accent-foreground))",
];

const PIE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const [notes, files, groups, convs, msgs, mems, folders, wbs] = await Promise.all([
        supabase.from("notes").select("id, created_at, color", { count: "exact" }).eq("user_id", user.id).is("deleted_at", null),
        supabase.from("files").select("id, type, created_at", { count: "exact" }).eq("user_id", user.id).is("deleted_at", null),
        supabase.from("group_members").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("ai_conversations").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("ai_messages").select("id, created_at, conversation_id").limit(500),
        supabase.from("ai_memory").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("folders").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("whiteboards").select("id", { count: "exact" }).eq("user_id", user.id),
      ]);

      // Build recent notes activity (last 7 days)
      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split("T")[0];
      });

      const notesByDate = last7.map(date => ({
        date: new Date(date).toLocaleDateString("en", { weekday: "short" }),
        count: (notes.data || []).filter(n => n.created_at.startsWith(date)).length,
      }));

      const msgsByDate = last7.map(date => ({
        date: new Date(date).toLocaleDateString("en", { weekday: "short" }),
        count: (msgs.data || []).filter(m => m.created_at.startsWith(date)).length,
      }));

      // File types distribution
      const typeMap: Record<string, number> = {};
      (files.data || []).forEach(f => {
        const cat = f.type?.startsWith("image") ? "Images" : f.type?.includes("pdf") ? "PDFs" : "Other";
        typeMap[cat] = (typeMap[cat] || 0) + 1;
      });

      // Note colors distribution
      const colorMap: Record<string, number> = {};
      (notes.data || []).forEach(n => {
        const c = n.color || "default";
        colorMap[c] = (colorMap[c] || 0) + 1;
      });

      setStats({
        totalNotes: notes.count || 0,
        totalFiles: files.count || 0,
        totalGroups: groups.count || 0,
        totalConversations: convs.count || 0,
        totalMessages: msgs.count || 0,
        totalMemories: mems.count || 0,
        totalFolders: folders.count || 0,
        totalWhiteboards: wbs.count || 0,
        recentNotes: notesByDate,
        recentMessages: msgsByDate,
        fileTypes: Object.entries(typeMap).map(([name, value]) => ({ name, value })),
        noteColors: Object.entries(colorMap).map(([name, value]) => ({ name, value })),
      });
      setLoading(false);
    };
    load();
  }, [user]);

  const statCards = stats ? [
    { icon: StickyNote, label: "Notes", value: stats.totalNotes, color: "from-amber-500/15 to-amber-500/5" },
    { icon: Files, label: "Files", value: stats.totalFiles, color: "from-blue-500/15 to-blue-500/5" },
    { icon: Users, label: "Groups", value: stats.totalGroups, color: "from-green-500/15 to-green-500/5" },
    { icon: Bot, label: "AI Chats", value: stats.totalConversations, color: "from-purple-500/15 to-purple-500/5" },
    { icon: Brain, label: "Memories", value: stats.totalMemories, color: "from-pink-500/15 to-pink-500/5" },
    { icon: FolderOpen, label: "Folders", value: stats.totalFolders, color: "from-cyan-500/15 to-cyan-500/5" },
  ] : [];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="w-6 h-6 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6" /> Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of your workspace activity</p>
        </motion.div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-2xl border border-border/50 bg-gradient-to-br ${card.color} p-4 hover:shadow-md transition-all`}
            >
              <card.icon className="h-5 w-5 text-foreground/60 mb-2" />
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Notes Activity */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border/50 bg-card p-5"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" /> Notes Created (Last 7 Days)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats?.recentNotes}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* AI Messages */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-2xl border border-border/50 bg-card p-5"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground" /> AI Messages (Last 7 Days)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats?.recentMessages}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* File Types */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-border/50 bg-card p-5"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" /> File Types Distribution
            </h3>
            {stats && stats.fileTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={stats.fileTypes} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {stats.fileTypes.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">No files yet</div>
            )}
          </motion.div>

          {/* Note Colors */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-2xl border border-border/50 bg-card p-5"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-muted-foreground" /> Note Categories
            </h3>
            {stats && stats.noteColors.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.noteColors} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {stats.noteColors.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">No notes yet</div>
            )}
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
