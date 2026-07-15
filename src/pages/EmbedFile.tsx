import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function EmbedFile() {
  const { publicId } = useParams<{ publicId: string }>();

  const { data: file } = useQuery({
    queryKey: ["embed-file", publicId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_file_by_public_id", { _public_id: publicId! });
      if (error) throw error;
      return (data as any[])?.[0] ?? null;
    },
    enabled: !!publicId,
  });

  if (!file) return null;

  const { data: urlData } = supabase.storage.from("user-files").getPublicUrl(file.storage_path);
  const publicUrl = urlData?.publicUrl;

  if (file.type === "image") {
    return <img src={publicUrl} alt={file.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />;
  }

  return (
    <iframe
      src={publicUrl}
      title={file.name}
      style={{ width: "100%", height: "100vh", border: "none" }}
    />
  );
}
