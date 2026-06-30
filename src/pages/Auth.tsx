import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGuestMode } from "@/hooks/useGuestMode";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Loader2, ArrowRight, Sparkles, FileText, Brain, Code2, Eye, EyeOff, Zap, Shield, ChevronLeft, Play } from "lucide-react";
import { OltridLogo } from "@/components/OltridLogo";

const features = [
  { icon: Brain, label: "AI Assistant", desc: "Chat with powerful AI models" },
  { icon: FileText, label: "Smart Notes", desc: "Rich notes with AI editing" },
  { icon: Code2, label: "Codrix IDE", desc: "Code editor with AI generation" },
];

export default function Auth() {
  const { session, loading } = useAuth();
  const { startGuestSession } = useGuestMode();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mobileStep, setMobileStep] = useState(0);

  const handleSwipeDragEnd = useCallback((_: any, info: PanInfo) => {
    if (mobileStep === 0 && info.offset.x < -60) {
      setMobileStep(1);
    } else if (mobileStep === 1 && info.offset.x > 60) {
      setMobileStep(0);
    }
  }, [mobileStep]);

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
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Account created! Signing you in…");
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


  // Mobile step-wise layout
  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col bg-background overflow-hidden relative">
        <AnimatePresence mode="wait">
          {mobileStep === 0 ? (
            /* ── Step 0: Welcome / Intro ── */
            <motion.div
              key="welcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="min-h-screen flex flex-col relative"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={handleSwipeDragEnd}
            >
              {/* Dark gradient hero background */}
              <div className="flex-1 relative bg-foreground overflow-hidden flex flex-col justify-end px-6 pb-8 pt-16">
                {/* Animated gradient orbs on dark bg */}
                <motion.div
                  className="absolute w-[350px] h-[350px] rounded-full bg-primary-foreground/[0.06] blur-[100px]"
                  animate={{ x: ["-20%", "20%", "-20%"], y: ["-10%", "15%", "-10%"] }}
                  transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
                  style={{ top: "5%", right: "-15%" }}
                />
                <motion.div
                  className="absolute w-[280px] h-[280px] rounded-full bg-primary-foreground/[0.04] blur-[80px]"
                  animate={{ x: ["10%", "-15%", "10%"], y: ["5%", "-10%", "5%"] }}
                  transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
                  style={{ top: "30%", left: "-10%" }}
                />

                {/* Logo */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="absolute top-12 left-6 flex items-center gap-2.5"
                >
                  <OltridLogo className="h-8 w-8 brightness-200" />
                  <span className="text-lg font-semibold text-primary-foreground/90">Oltrid</span>
                </motion.div>

                {/* Hero text */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                >
                  <h1 className="text-[2.5rem] font-bold text-primary-foreground leading-[1.1] tracking-tight mb-4">
                    Your AI
                    <br />
                    Workspace for
                    <br />
                    Everything
                  </h1>
                  <p className="text-primary-foreground/50 text-sm max-w-[260px]">
                    Notes, files, code, and AI — all in one powerful workspace.
                  </p>
                </motion.div>

                {/* Feature chips */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex flex-wrap gap-2 mt-6"
                >
                  {[
                    { icon: <Brain className="h-3 w-3" />, text: "AI Assistant" },
                    { icon: <FileText className="h-3 w-3" />, text: "Smart Notes" },
                    { icon: <Code2 className="h-3 w-3" />, text: "Codrix IDE" },
                    { icon: <Shield className="h-3 w-3" />, text: "Secure" },
                  ].map((f, i) => (
                    <motion.span
                      key={f.text}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + i * 0.06 }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-foreground/10 border border-primary-foreground/10 text-primary-foreground/70 text-[11px]"
                    >
                      {f.icon}
                      {f.text}
                    </motion.span>
                  ))}
                </motion.div>
              </div>

              {/* Bottom nav bar */}
              <div className="bg-foreground px-6 pb-8 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      whileTap={{ scale: 0.9 }}
                      className="h-12 w-12 rounded-full bg-primary-foreground/10 flex items-center justify-center"
                    >
                      <ChevronLeft className="h-5 w-5 text-primary-foreground/50" />
                    </motion.div>
                    <motion.div
                      whileTap={{ scale: 0.9 }}
                      className="h-14 w-14 rounded-full bg-primary-foreground flex items-center justify-center shadow-lg shadow-primary-foreground/20"
                      onClick={() => setMobileStep(1)}
                    >
                      <Play className="h-5 w-5 text-foreground ml-0.5" />
                    </motion.div>
                  </div>
                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setMobileStep(1)}
                    className="flex items-center gap-2 px-5 py-3 rounded-full bg-primary-foreground/10 cursor-pointer"
                  >
                    <span className="text-primary-foreground/80 text-sm font-medium">Start</span>
                    <ArrowRight className="h-4 w-4 text-primary-foreground/60" />
                  </motion.div>
                </div>

                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2 mt-5">
                  <div className="h-1.5 w-6 rounded-full bg-primary-foreground/80" />
                  <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground/20" />
                </div>
              </div>
            </motion.div>
          ) : (
            /* ── Step 1: Login Form ── */
            <motion.div
              key="login-form"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="min-h-screen flex flex-col relative"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={handleSwipeDragEnd}
            >
              {/* Top bar with back + brand */}
              <div className="flex items-center justify-between px-5 pt-12 pb-4">
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setMobileStep(0)}
                  className="h-10 w-10 rounded-xl bg-secondary/60 flex items-center justify-center"
                >
                  <ChevronLeft className="h-5 w-5 text-foreground" />
                </motion.button>
                <div className="flex items-center gap-2">
                  <OltridLogo className="h-7 w-7" />
                  <span className="text-base font-semibold text-foreground tracking-tight">Oltrid</span>
                </div>
                <div className="w-10" />
              </div>

              {/* Form card */}
              <div className="flex-1 px-6 pt-4 pb-6 flex flex-col">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-card rounded-3xl border border-border/50 shadow-[0_4px_24px_-4px_hsl(0_0%_0%/0.08)] p-6 flex-1 flex flex-col"
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={mode}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <h2 className="text-xl font-bold text-foreground text-center mb-1">
                        {mode === "login" ? "Welcome to\nOltrid, login now!" : "Reset your\npassword"}
                      </h2>
                      <p className="text-muted-foreground text-xs text-center mb-6">
                        {mode === "login" ? "Sign in to access your workspace" : "We'll send you a reset link"}
                      </p>
                    </motion.div>
                  </AnimatePresence>

                  <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-foreground mb-1.5 block">Email</label>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          autoComplete="email"
                          className="h-12 rounded-xl bg-secondary/30 border-border/60 text-sm placeholder:text-muted-foreground/40"
                        />
                      </div>

                      <AnimatePresence mode="wait">
                        {mode !== "forgot" && (
                          <motion.div
                            key="pw"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <label className="text-xs font-medium text-foreground mb-1.5 block">Password</label>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                autoComplete="current-password"
                                className="h-12 rounded-xl bg-secondary/30 border-border/60 text-sm placeholder:text-muted-foreground/40 pr-11"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {mode === "login" && (
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => setMode("forgot")}
                            className="text-xs text-primary font-medium"
                          >
                            Forgot password?
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-auto space-y-3 pt-4">
                      <motion.div whileTap={{ scale: 0.97 }}>
                        <Button
                          type="submit"
                          disabled={submitting}
                          className="w-full h-13 rounded-2xl text-base font-semibold"
                        >
                          {submitting ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            mode === "login" ? "Login" : "Send reset link"
                          )}
                        </Button>
                      </motion.div>

                      {mode === "forgot" && (
                        <button
                          type="button"
                          onClick={() => setMode("login")}
                          className="w-full text-center text-sm text-foreground font-medium mt-2"
                        >
                          Back to sign in
                        </button>
                      )}
                    </div>
                  </form>
                </motion.div>

                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2 mt-5">
                  <div className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
                  <div className="h-1.5 w-6 rounded-full bg-foreground/80" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Desktop layout (existing)
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
             From ideas to execution - manage notes, files, code, and diagrams with AI.
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

          {/* Mode switching */}
          <div className="mt-8 text-center text-sm text-muted-foreground">
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
