import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGuestMode } from "@/hooks/useGuestMode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, Sparkles, FileText, Brain, Code2, Palette, Eye, EyeOff } from "lucide-react";
import { OltridLogo } from "@/components/OltridLogo";

const features = [
  { icon: Brain, label: "AI Assistant", desc: "Chat with powerful AI models" },
  { icon: FileText, label: "Smart Notes", desc: "Rich notes with AI editing" },
  { icon: Code2, label: "Codrix IDE", desc: "Code editor with AI generation" },
  { icon: Palette, label: "Whiteboards", desc: "Visual collaboration canvas" },
];

export default function Auth() {
  const { session, loading } = useAuth();
  const { startGuestSession } = useGuestMode();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
      </div>
    );
  }

  if (session) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your email for a reset link");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestAccess = () => {
    startGuestSession();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex bg-background overflow-hidden">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[55%] items-center justify-center relative bg-secondary/30">
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute w-[500px] h-[500px] rounded-full bg-primary/[0.04] blur-[100px]"
            animate={{
              x: ["-10%", "10%", "-10%"],
              y: ["-10%", "15%", "-10%"],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            style={{ top: "10%", left: "20%" }}
          />
          <motion.div
            className="absolute w-[400px] h-[400px] rounded-full bg-primary/[0.03] blur-[80px]"
            animate={{
              x: ["10%", "-15%", "10%"],
              y: ["10%", "-10%", "10%"],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
            style={{ bottom: "10%", right: "10%" }}
          />
        </div>

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative z-10 max-w-lg px-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <OltridLogo className="h-14 w-14 mb-10" />
            <h1 className="text-5xl font-semibold text-foreground tracking-tight leading-[1.1] mb-5">
              Your AI workspace
              <br />
              <span className="text-muted-foreground">for everything.</span>
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed mb-12 max-w-sm">
              Notes, files, code, diagrams — all powered by AI.
              Think it. Create it. Organize it.
            </p>
          </motion.div>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-3">
            {features.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="group relative p-4 rounded-2xl border border-border/60 bg-background/50 backdrop-blur-sm hover:bg-background/80 hover:border-border transition-all duration-300 cursor-default"
              >
                <f.icon className="h-5 w-5 text-foreground/70 mb-2.5 group-hover:text-foreground transition-colors" />
                <p className="text-sm font-medium text-foreground mb-0.5">{f.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Right auth panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 relative">
        {/* Subtle accent line */}
        <div className="absolute top-0 left-0 w-px h-full bg-border hidden lg:block" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <OltridLogo className="h-8 w-8" />
            <span className="text-lg font-semibold text-foreground">Oltrid</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="text-2xl font-semibold text-foreground tracking-tight mb-1.5">
                {mode === "login" && "Welcome back"}
                {mode === "forgot" && "Reset password"}
              </h2>
              <p className="text-muted-foreground text-sm mb-8">
                {mode === "login" && "Sign in to continue to Oltrid"}
                {mode === "forgot" && "Enter your email to receive a reset link"}
              </p>
            </motion.div>
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-12 rounded-xl bg-secondary/50 border border-border text-sm placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent transition-all duration-200"
              />
            </motion.div>

            <AnimatePresence mode="wait">
              {mode !== "forgot" && (
                <motion.div
                  key="password"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      className="h-12 rounded-xl bg-secondary/50 border border-border text-sm placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent transition-all duration-200 pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {mode === "login" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl text-sm font-medium transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    {mode === "login" && "Continue"}
                    {mode === "forgot" && "Send reset link"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </Button>
            </motion.div>
          </form>

          {/* Divider + Guest */}
          <div className="mt-7">
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-3 text-muted-foreground">or</span>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleGuestAccess}
              className="w-full h-12 rounded-xl text-sm gap-2 border-border hover:bg-secondary/50 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
            >
              <Sparkles className="h-4 w-4" />
              Try as Guest
            </Button>
          </div>

          {/* Mode switching */}
          <div className="mt-8 text-center text-sm text-muted-foreground">
            {mode === "login" && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                Don't have an account?{" "}
                <button onClick={() => setMode("signup")} className="text-foreground font-medium hover:underline underline-offset-4">
                  Sign up
                </button>
              </motion.p>
            )}
            {mode === "signup" && (
              <p>
                Already have an account?{" "}
                <button onClick={() => setMode("login")} className="text-foreground font-medium hover:underline underline-offset-4">
                  Sign in
                </button>
              </p>
            )}
            {mode === "forgot" && (
              <button onClick={() => setMode("login")} className="text-foreground font-medium hover:underline underline-offset-4">
                Back to sign in
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
