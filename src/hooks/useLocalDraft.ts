import { useCallback, useEffect, useRef, useState } from "react";
import { clearDraft, readDraft, writeDraft } from "@/lib/localDraft";

/**
 * Local-first state: the value lives in localStorage from the first keystroke,
 * survives refreshes, and is only reconciled with the cloud copy when the cloud
 * copy is newer.
 */
export function useLocalDraft<T>(key: string | null, initial: T, remoteUpdatedAt?: string | number) {
  const draftKey = key ?? "";
  const [value, setValue] = useState<T>(() => {
    if (!draftKey) return initial;
    const draft = readDraft<T>(draftKey);
    if (!draft) return initial;
    const remote = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0;
    return draft.updatedAt >= remote ? draft.value : initial;
  });

  const skipFirst = useRef(true);

  useEffect(() => {
    if (!draftKey) return;
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    writeDraft(draftKey, value);
  }, [draftKey, value]);

  const discard = useCallback(() => {
    if (draftKey) clearDraft(draftKey);
  }, [draftKey]);

  return [value, setValue, discard] as const;
}
