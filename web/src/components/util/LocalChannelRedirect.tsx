"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const LocalChannelRedirect = ({ serverId }: { serverId: string }) => {
  const router = useRouter();
  useEffect(() => {
    try {
      const local = JSON.parse(localStorage.getItem("dc_local_channels") || "{}");
      const list = local[serverId] || [];
      if (list.length > 0) {
        router.replace(`/channels/${serverId}/${list[0].id}`);
      }
    } catch {}
  }, [serverId, router]);
  return null;
};
