import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { ShieldAlert } from "lucide-react";

interface IdleWarningDialogProps {
  open: boolean;
  secondsLeft: number;
  onDismiss: () => void;
}

export function IdleWarningDialog({ open, secondsLeft, onDismiss }: IdleWarningDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-sm rounded-2xl">
        <AlertDialogHeader className="items-center text-center">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <AlertDialogTitle>Session Timeout</AlertDialogTitle>
          <AlertDialogDescription>
            You'll be logged out in <span className="font-bold text-foreground">{secondsLeft}s</span> due to inactivity. Move your mouse or press any key to stay active.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="justify-center">
          <AlertDialogAction onClick={onDismiss} className="rounded-xl">
            I'm still here
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
