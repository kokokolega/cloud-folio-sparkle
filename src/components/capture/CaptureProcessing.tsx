import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { STEP_LABELS, type CaptureStep } from "@/lib/smartCapture/pipeline";

const ORDER: CaptureStep[] = ["reading", "detecting", "workspace", "organizing", "saving"];

interface Props {
  open: boolean;
  step: CaptureStep | null;
  current: number;
  total: number;
}

export function CaptureProcessing({ open, step, current, total }: Props) {
  const activeIndex = step ? ORDER.indexOf(step) : -1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-background/70 backdrop-blur-xl px-4"
        >
          <motion.div
            initial={{ scale: 0.94, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="glass-card w-full max-w-sm rounded-3xl p-6 sm:p-7"
          >
            <div className="flex items-center gap-3 mb-5">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Organizing your capture</p>
                <p className="text-[11px] text-muted-foreground">
                  {total > 1 ? `Item ${current} of ${total}` : "Running locally on your device"}
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {ORDER.map((s, i) => {
                const done = activeIndex > i || step === "done";
                const active = activeIndex === i;
                return (
                  <motion.div
                    key={s}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: done || active ? 1 : 0.4, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        done
                          ? "border-primary bg-primary text-primary-foreground"
                          : active
                          ? "border-primary text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {done ? (
                        <Check className="h-3 w-3" />
                      ) : active ? (
                        <motion.span
                          animate={{ scale: [0.6, 1, 0.6] }}
                          transition={{ repeat: Infinity, duration: 1.2 }}
                          className="h-1.5 w-1.5 rounded-full bg-primary"
                        />
                      ) : null}
                    </span>
                    <span className={`text-[13px] ${active ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {STEP_LABELS[s]}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-secondary">
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: `${((activeIndex + 1) / ORDER.length) * 100}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
