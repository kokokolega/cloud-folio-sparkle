import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function JoinGroupPage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    if (!user || !inviteCode) return;

    const join = async () => {
      try {
        const { data, error } = await supabase.rpc("join_group_by_invite_code", { _invite_code: inviteCode });
        if (error) throw error;
        const row = (data as any[])?.[0];
        if (!row) {
          toast.error("Invalid invite link");
          setStatus("error");
          return;
        }
        if (row.already_member) {
          toast.info("You're already in this group");
        } else {
          toast.success(`Joined "${row.group_name}"!`);
        }
        navigate("/groups");
      } catch (e: any) {
        toast.error(e.message || "Failed to join group");
        setStatus("error");
      }
    };

    join();
  }, [user, inviteCode, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      {status === "loading" ? (
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Joining group...</p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Invalid invite link</p>
          <button onClick={() => navigate("/groups")} className="text-primary text-sm mt-2 underline">
            Go to Groups
          </button>
        </div>
      )}
    </div>
  );
}
