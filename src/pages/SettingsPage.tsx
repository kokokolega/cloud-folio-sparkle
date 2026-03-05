import { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useBackgroundTheme, BgTheme } from "@/hooks/useBackgroundTheme";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Moon, Sun, LogOut, Palette, Check, ImagePlus, Loader2, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeCustomImage = () => {
    setCustomImageUrl(null);
    if (bgTheme === "custom-image") setBgTheme("none");
    toast.success("Custom image removed");
  };

  return (
    <DashboardLayout>
      <h2 className="text-xl font-semibold text-foreground mb-6">Settings</h2>

      <div className="max-w-lg space-y-6">
        <div className="glass-card p-5 space-y-4">
          <h3 className="font-medium text-foreground">Account</h3>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <Label className="text-sm font-medium">Dark Mode</Label>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-4 w-4" />
              <div>
                <Label className="text-sm font-medium">Auto Logout (1 min inactivity)</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">Automatically sign out after 1 minute of no activity</p>
              </div>
            </div>
            <Switch checked={autoLogoutEnabled} onCheckedChange={setAutoLogoutEnabled} />
          </div>
        </div>

        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Palette className="h-4 w-4" />
            <h3 className="font-medium text-foreground">Background Theme</h3>
          </div>
          <p className="text-xs text-muted-foreground">Choose an animated background for your workspace</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {BG_THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setBgTheme(t.id)}
                className={`relative rounded-xl border-2 p-3 text-left transition-all hover:scale-[1.02] ${
                  bgTheme === t.id ? "border-primary shadow-md shadow-primary/10" : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div className={`h-12 rounded-lg mb-2 ${t.preview}`} />
                <p className="text-xs font-medium text-foreground">{t.name}</p>
                <p className="text-[10px] text-muted-foreground">{t.description}</p>
                {bgTheme === t.id && (
                  <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}

            <button
              onClick={() => { if (customImageUrl) setBgTheme("custom-image"); else fileInputRef.current?.click(); }}
              className={`relative rounded-xl border-2 p-3 text-left transition-all hover:scale-[1.02] ${
                bgTheme === "custom-image" ? "border-primary shadow-md shadow-primary/10" : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <div className="h-12 rounded-lg mb-2 overflow-hidden flex items-center justify-center bg-muted/30">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : customImageUrl ? <img src={customImageUrl} alt="Custom bg" className="w-full h-full object-cover rounded-lg" /> : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
              </div>
              <p className="text-xs font-medium text-foreground">Your Image</p>
              <p className="text-[10px] text-muted-foreground">{customImageUrl ? "Custom photo" : "Upload image"}</p>
              {bgTheme === "custom-image" && (
                <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
            </button>
          </div>

          {customImageUrl && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="text-xs rounded-lg" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ImagePlus className="h-3 w-3 mr-1" />}
                Change Image
              </Button>
              <Button size="sm" variant="ghost" className="text-xs rounded-lg text-destructive hover:text-destructive" onClick={removeCustomImage}>
                <Trash2 className="h-3 w-3 mr-1" /> Remove
              </Button>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </div>

        <Button variant="destructive" onClick={() => signOut()} className="rounded-xl">
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>
    </DashboardLayout>
  );
}
