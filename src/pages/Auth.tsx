import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGuestMode } from "@/hooks/useGuestMode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, Sparkles } from "lucide-react";
import { OltridLogo } from "@/components/OltridLogo";

export default function Auth() {
  const { session, loading } = useAuth();
  const { startGuestSession } = useGuestMode();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created! Check your email to verify.");
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
    <div className="min-h-screen flex bg-background">
      {/* Left branding panel - hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden bg-secondary/30">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-foreground/[0.02] blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-foreground/[0.03] blur-3xl" />
        </div>
        <div className="relative z-10 max-w-md px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <OltridLogo className="h-12 w-12 mb-8" />
            <h1 className="text-4xl font-semibold text-foreground tracking-tight leading-tight mb-4">
              Your AI workspace for everything.
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              Notes, files, code, diagrams, presentations — all powered by AI. Think it. Create it. Organize it.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right auth panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
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
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-2xl font-semibold text-foreground tracking-tight mb-1">
                {mode === "login" && "Welcome back"}
                {mode === "signup" && "Create an account"}
                {mode === "forgot" && "Reset password"}
              </h2>
              <p className="text-muted-foreground text-sm mb-8">
                {mode === "login" && "Sign in to continue to Oltrid"}
                {mode === "signup" && "Start using Oltrid for free"}
                {mode === "forgot" && "Enter your email to receive a reset link"}
              </p>
            </motion.div>
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11 rounded-xl bg-secondary/50 border border-border text-sm placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent"
              />
            </div>

            <AnimatePresence mode="wait">
              {mode !== "forgot" && (
                <motion.div
                  key="password"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className="h-11 rounded-xl bg-secondary/50 border border-border text-sm placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent"
                  />
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

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-xl text-sm font-medium transition-all duration-200"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  {mode === "login" && "Continue"}
                  {mode === "signup" && "Create account"}
                  {mode === "forgot" && "Send reset link"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              )}
            </Button>
          </form>

          {/* Divider + Guest */}
          <div className="mt-6">
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
              className="w-full h-11 rounded-xl text-sm gap-2 border-border hover:bg-secondary/50 transition-all duration-200"
            >
              <Sparkles className="h-4 w-4" />
              Try as Guest
            </Button>
          </div>

          {/* Mode switching */}
          <div className="mt-8 text-center text-sm text-muted-foreground">
            {mode === "login" && (
              <p>
                Don't have an account?{" "}
                <button onClick={() => setMode("signup")} className="text-foreground font-medium hover:underline">
                  Sign up
                </button>
              </p>
            )}
            {mode === "signup" && (
              <p>
                Already have an account?{" "}
                <button onClick={() => setMode("login")} className="text-foreground font-medium hover:underline">
                  Sign in
                </button>
              </p>
            )}
            {mode === "forgot" && (
              <button onClick={() => setMode("login")} className="text-foreground font-medium hover:underline">
                Back to sign in
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
