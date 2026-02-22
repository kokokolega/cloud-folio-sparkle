import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useBackgroundTheme, BgTheme } from "@/hooks/useBackgroundTheme";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Moon, Sun, LogOut, Palette, Check } from "lucide-react";

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
  const { bgTheme, setBgTheme } = useBackgroundTheme();
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <DashboardLayout searchQuery={searchQuery} onSearchChange={setSearchQuery}>
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
                  bgTheme === t.id
                    ? "border-primary shadow-md shadow-primary/10"
                    : "border-border hover:border-muted-foreground/30"
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
          </div>
        </div>

        <Button
          variant="destructive"
          onClick={() => signOut()}
          className="rounded-xl"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>
    </DashboardLayout>
  );
}
