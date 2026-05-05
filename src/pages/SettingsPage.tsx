import { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useBackgroundTheme, BgTheme } from "@/hooks/useBackgroundTheme";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Moon, Sun, LogOut, Palette, Check, ImagePlus, Loader2, Trash2, ShieldAlert, User, Camera, Pencil, Files, Users, Code2, CalendarDays, Layers } from "lucide-react";
import { toast } from "sonner";
import { useSidebarFeatures } from "@/hooks/useSidebarFeatures";

const BG_THEMES: { id: BgTheme; name: string; description: string; preview: string }[] = [
  { id: "none", name: "None", description: "Clean solid background", preview: "bg-muted/40" },
  { id: "aurora", name: "Aurora", description: "Flowing color blobs", preview: "bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/20" },
  { id: "particles", name: "Particles", description: "Floating dots", preview: "bg-muted/60" },
  { id: "waves", name: "Waves", description: "Gentle wave motion", preview: "bg-gradient-to-t from-primary/15 to-transparent" },
  { id: "gradient-mesh", name: "Gradient Mesh", description: "Soft color blend", preview: "bg-gradient-to-br from-primary/10 via-transparent to-accent/10" },
  { id: "starfield", name: "Starfield", description: "Twinkling stars", preview: "bg-muted/80" },
  { id: "rain", name: "Rain", description: "Falling rain streaks", preview: "bg-gradient-to-b from-primary/10 to-muted/60" },
  { id: "matrix", name: "Matrix", description: "Cascading code rain", preview: "bg-gradient-to-b from-primary/15 to-muted/80" },
  { id: "fireflies", name: "Fireflies", description: "Glowing warm lights", preview: "bg-muted/50" },
  { id: "reading-warm", name: "Reading Warm", description: "Warm reading light", preview: "bg-gradient-to-b from-orange-100/30 to-amber-50/20 dark:from-orange-900/10 dark:to-amber-900/5" },
  { id: "reading-cool", name: "Reading Cool", description: "Cool reading light", preview: "bg-gradient-to-b from-blue-100/30 to-slate-50/20 dark:from-blue-900/10 dark:to-slate-900/5" },
];

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { bgTheme, setBgTheme, customImageUrl, setCustomImageUrl } = useBackgroundTheme();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Fetch profile
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name);
  }, [profile]);

  // Update display name
  const updateName = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("profiles").update({ display_name: name }).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setEditingName(false);
      toast.success("Name updated!");
    },
  });

  // Upload avatar
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2MB"); return; }
    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("user-files").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("user-files").getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("user_id", user.id);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile picture updated!");
    } catch (err: any) { toast.error(err.message || "Upload failed"); }
    finally { setAvatarUploading(false); if (avatarInputRef.current) avatarInputRef.current.value = ""; }
  };

  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(() => {
    const stored = localStorage.getItem("oltrid-auto-logout");
    return stored !== "false";
  });

  useEffect(() => {
    localStorage.setItem("oltrid-auto-logout", autoLogoutEnabled ? "true" : "false");
  }, [autoLogoutEnabled]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/bg-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("background-images").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("background-images").getPublicUrl(path);
      setCustomImageUrl(urlData.publicUrl);
      setBgTheme("custom-image");
      toast.success("Background image set!");
    } catch (err: any) { toast.error(err.message || "Upload failed"); } finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const removeCustomImage = () => {
    setCustomImageUrl(null);
    if (bgTheme === "custom-image") setBgTheme("none");
    toast.success("Custom image removed");
  };

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto">
        <h1 className="text-xl font-semibold text-foreground mb-6">Settings</h1>

        <div className="space-y-4">
          {/* Profile */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative">
                <Avatar className="h-16 w-16 border-2 border-border">
                  {profile?.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt="Profile" />
                  ) : null}
                  <AvatarFallback className="bg-secondary text-lg">
                    {profile?.display_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                  disabled={avatarUploading}
                >
                  {avatarUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>
              <div className="flex-1 min-w-0">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      className="h-8 text-sm rounded-lg"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && displayName.trim() && updateName.mutate(displayName.trim())}
                    />
                    <Button size="sm" className="h-8 rounded-lg text-xs" onClick={() => displayName.trim() && updateName.mutate(displayName.trim())} disabled={updateName.isPending}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs" onClick={() => { setEditingName(false); setDisplayName(profile?.display_name || ""); }}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {profile?.display_name || "Set your name"}
                    </p>
                    <button onClick={() => setEditingName(true)} className="text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Appearance */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === "dark" ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <Label className="text-sm font-medium">Appearance</Label>
                  <p className="text-[11px] text-muted-foreground">{theme === "dark" ? "Dark mode" : "Light mode"}</p>
                </div>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
            </div>
          </div>

          {/* Auto Logout */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">Auto Logout</Label>
                  <p className="text-[11px] text-muted-foreground">Sign out after 1 min inactivity</p>
                </div>
              </div>
              <Switch checked={autoLogoutEnabled} onCheckedChange={setAutoLogoutEnabled} />
            </div>
          </div>

          {/* Background Theme */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <div>
                <h3 className="text-sm font-medium text-foreground">Background Theme</h3>
                <p className="text-[11px] text-muted-foreground">Choose an animated background</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BG_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setBgTheme(t.id)}
                  className={`relative rounded-xl border p-2.5 text-left transition-all hover:scale-[1.02] ${
                    bgTheme === t.id ? "border-foreground/30 bg-secondary/50" : "border-border hover:border-foreground/15"
                  }`}
                >
                  <div className={`h-10 rounded-lg mb-1.5 ${t.preview}`} />
                  <p className="text-[11px] font-medium text-foreground">{t.name}</p>
                  {bgTheme === t.id && (
                    <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-foreground flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-background" />
                    </div>
                  )}
                </button>
              ))}
              <button
                onClick={() => { if (customImageUrl) setBgTheme("custom-image"); else fileInputRef.current?.click(); }}
                className={`relative rounded-xl border p-2.5 text-left transition-all hover:scale-[1.02] ${
                  bgTheme === "custom-image" ? "border-foreground/30 bg-secondary/50" : "border-border hover:border-foreground/15"
                }`}
              >
                <div className="h-10 rounded-lg mb-1.5 overflow-hidden flex items-center justify-center bg-muted/30">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : customImageUrl ? <img src={customImageUrl} alt="Custom bg" className="w-full h-full object-cover rounded-lg" /> : <ImagePlus className="h-4 w-4 text-muted-foreground" />}
                </div>
                <p className="text-[11px] font-medium text-foreground">{customImageUrl ? "Your Image" : "Upload"}</p>
                {bgTheme === "custom-image" && (
                  <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-foreground flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-background" />
                  </div>
                )}
              </button>
            </div>

            {customImageUrl && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-xs rounded-lg" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ImagePlus className="h-3 w-3 mr-1" />} Change
                </Button>
                <Button size="sm" variant="ghost" className="text-xs rounded-lg text-destructive hover:text-destructive" onClick={removeCustomImage}>
                  <Trash2 className="h-3 w-3 mr-1" /> Remove
                </Button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </div>

          {/* Sign out */}
          <Button variant="outline" onClick={() => signOut()} className="w-full rounded-xl gap-2 text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/5">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
