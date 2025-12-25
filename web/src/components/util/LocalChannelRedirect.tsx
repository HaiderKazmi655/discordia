"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const LocalChannelRedirect = ({ serverId }: { serverId: string }) => {
  const router = useRouter();
  useEffect(() => {
    const run = async () => {
      const fetchFirstChannelId = async (): Promise<string | null> => {
        try {
          const { data, error } = await supabase
            .from("channels")
            .select("id")
            .eq("server_id", serverId)
            .order("created_at", { ascending: true })
            .limit(1);
          if (!error && data && data.length > 0) return data[0].id;
        } catch {}
        return null;
      };
      const supabaseId = await Promise.race<string | null>([
        fetchFirstChannelId(),
        new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);
      if (supabaseId) {
        router.replace(`/channels/${serverId}/${supabaseId}`);
        return;
      }
      try {
        const local = JSON.parse(localStorage.getItem("dc_local_channels") || "{}");
        const list = local[serverId] || [];
        if (list.length > 0) {
          router.replace(`/channels/${serverId}/${list[0].id}`);
          return;
        }
      } catch {}
      try {
        const def = { id: crypto.randomUUID(), server_id: serverId, name: "general", type: "text", created_at: Date.now() };
        const local = JSON.parse(localStorage.getItem("dc_local_channels") || "{}");
        local[serverId] = [...(local[serverId] || []), def];
        localStorage.setItem("dc_local_channels", JSON.stringify(local));
        router.replace(`/channels/${serverId}/${def.id}`);
      } catch {}
    };
    run();
  }, [serverId, router]);
  return null;
};
