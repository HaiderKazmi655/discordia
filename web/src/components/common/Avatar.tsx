"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Avatar({ username, displayName, size = 40 }: { username: string; displayName?: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const { data } = await supabase.from("users").select("avatar").eq("username", username).maybeSingle();
        if (mounted && data?.avatar) {
          setUrl(data.avatar);
          return;
        }
      } catch {}
      try {
        const usersMap = JSON.parse(localStorage.getItem("dc_users") || "{}");
        const u = usersMap[username];
        if (mounted && u?.avatar) setUrl(u.avatar);
      } catch {}
    };
    run();
    return () => {
      mounted = false;
    };
  }, [username]);
  const initial = (displayName || username || "?")[0]?.toUpperCase() || "?";
  return url ? (
    <img src={url} alt={displayName || username} style={{ width: size, height: size }} className="rounded-full object-cover" />
  ) : (
    <div style={{ width: size, height: size }} className="rounded-full bg-dc-brand text-white flex items-center justify-center">
      {initial}
    </div>
  );
}
