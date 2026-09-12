import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Live cloud sync.
 *
 * Subscribes to database changes for the signed-in user's workspace so anything
 * created on one device (browser, Android, iOS) appears on the others instantly
 * without a manual refresh. React Query caches are invalidated on each change.
 */

const TABLE_QUERY_KEYS: Record<string, string[]> = {
  notes: ["notes", "offline-notes", "note-folders", "trash"],
  folders: ["folders", "note-folders", "files"],
  files: ["files", "images", "pdfs", "trash"],
  tasks: ["tasks"],
  groups: ["groups"],
  group_members: ["groups", "group-members"],
  whiteboards: ["whiteboards"],
  alarms: ["alarms"],
};

export function useCloudSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`workspace-sync-${user.id}`);

    Object.keys(TABLE_QUERY_KEYS).forEach((table) => {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        () => {
          TABLE_QUERY_KEYS[table].forEach((key) =>
            queryClient.invalidateQueries({ queryKey: [key] }),
          );
        },
      );
    });

    channel.subscribe();

    // Coming back to the app (phone unlock, tab focus) refetches everything so
    // changes made while the device slept are picked up immediately.
    const refetchAll = () => {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries();
      }
    };
    document.addEventListener("visibilitychange", refetchAll);
    window.addEventListener("online", refetchAll);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", refetchAll);
      window.removeEventListener("online", refetchAll);
    };
  }, [user, queryClient]);
}
