import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { DuplicateInfo } from "@/lib/smartCapture/pipeline";

const publicUrl = (p: string) => supabase.storage.from("user-files").getPublicUrl(p).data.publicUrl;

interface Props {
  duplicate: DuplicateInfo | null;
  onKeepBoth: () => void;
  onReplace: () => void;
  onOpenExisting: () => void;
  onDismiss: () => void;
}

export function DuplicateDialog({ duplicate, onKeepBoth, onReplace, onOpenExisting, onDismiss }: Props) {
  return (
    <AlertDialog open={!!duplicate} onOpenChange={(v) => !v && onDismiss()}>
      <AlertDialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl glass-card border-0">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base">Already exists</AlertDialogTitle>
          <AlertDialogDescription className="text-[13px]">
            This looks like a duplicate of <span className="font-medium text-foreground">{duplicate?.existing.title}</span>{" "}
            ({Math.round((duplicate?.score ?? 0) * 100)}% match).
          </AlertDialogDescription>
        </AlertDialogHeader>
        {duplicate && (
          <img
            src={publicUrl(duplicate.existing.storage_path)}
            alt={duplicate.existing.title}
            className="max-h-40 w-full rounded-xl object-contain bg-muted/40"
          />
        )}
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" className="rounded-xl text-xs h-9" onClick={onOpenExisting}>
            Open existing
          </Button>
          <Button variant="outline" className="rounded-xl text-xs h-9" onClick={onReplace}>
            Replace
          </Button>
          <Button className="rounded-xl text-xs h-9" onClick={onKeepBoth}>
            Keep both
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
