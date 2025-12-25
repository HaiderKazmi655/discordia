"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const LocalChannelRedirect = ({ serverId }: { serverId: string }) => {
  const router = useRouter();
  useEffect(() => {
    const run = async () => {
      try {
        const { data, error } = await supabase
          .from("channels")
          .select("id")
          .eq("server_id", serverId)
          .order("created_at", { ascending: true })
          .limit(1);
        if (!error && data && data.length > 0) {
          router.replace(`/channels/${serverId}/${data[0].id}`);
          return;
        }
      } catch {}
      try {
        const local = JSON.parse(localStorage.getItem("dc_local_channels") || "{}");
        const list = local[serverId] || [];
        if (list.length > 0) {
          router.replace(`/channels/${serverId}/${list[0].id}`);
        }
      } catch {}
    };
    run();
  }, [serverId, router]);
  return null;
};
