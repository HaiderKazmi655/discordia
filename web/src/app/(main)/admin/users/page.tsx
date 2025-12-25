"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

type AdminUser = { username: string; displayName: string; avatar?: string | null; online?: boolean };

export default function AdminUsersPage() {
  const { user, loading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [onlyOnline, setOnlyOnline] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data } = await supabase.from("users").select("username, displayName, avatar, online").order("username", { ascending: true });
        if (Array.isArray(data)) setUsers(data as AdminUser[]);
      } catch {}
    };
    fetchUsers();
    const channel = supabase
      .channel("admin_users_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => fetchUsers())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      const match = !q || u.username.toLowerCase().includes(q) || (u.displayName || "").toLowerCase().includes(q);
      const onlineOk = !onlyOnline || !!u.online;
      return match && onlineOk;
    });
  }, [users, search, onlyOnline]);

  if (loading) return <div className="flex-1 w-full h-full bg-dc-bg-primary flex items-center justify-center text-white">Loading...</div>;
  if (!user) return (
    <div className="flex-1 w-full h-full bg-dc-bg-primary flex items-center justify-center text-white">
      <div className="text-center space-y-2">
        <div className="text-xl">Please login to view admin users</div>
        <Link href="/login" className="text-dc-brand underline">Go to Login</Link>
      </div>
    </div>
  );

  const onlineCount = users.filter(u => u.online).length;

  return (
    <div className="flex-1 w-full h-full bg-dc-bg-primary text-white p-6 overflow-y-auto">
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-2xl font-bold">Users</div>
            <div className="text-dc-text-muted">{onlineCount} online · {users.length} total</div>
          </div>
          <div className="flex items-center space-x-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by username or display name"
              className="bg-dc-bg-secondary text-white placeholder-white/60 px-3 py-2 rounded border border-dc-bg-modifier outline-none focus:border-blue-500"
            />
            <label className="flex items-center space-x-1 text-sm">
              <input type="checkbox" checked={onlyOnline} onChange={e => setOnlyOnline(e.target.checked)} />
              <span>Only online</span>
            </label>
            <Link href="/channels/me" className="text-sm px-3 py-2 bg-dc-bg-secondary rounded border border-dc-bg-modifier hover:bg-dc-bg-tertiary">Back</Link>
          </div>
        </div>

        <div className="bg-dc-bg-secondary rounded-lg overflow-hidden border border-dc-bg-tertiary">
          <div className="grid grid-cols-4 gap-2 px-3 py-2 text-dc-text-muted border-b border-dc-bg-tertiary text-xs uppercase">
            <div>Avatar</div>
            <div>Username</div>
            <div>Display Name</div>
            <div>Status</div>
          </div>
          {filtered.map(u => (
            <div key={u.username} className="grid grid-cols-4 gap-2 px-3 py-2 border-t border-dc-bg-tertiary items-center">
              <div className="w-8 h-8 rounded-full bg-dc-brand overflow-hidden">
                {u.avatar ? <img src={u.avatar} alt={u.displayName || u.username} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">{(u.displayName || u.username)[0]?.toUpperCase()}</div>}
              </div>
              <div className="truncate">@{u.username}</div>
              <div className="truncate">{u.displayName}</div>
              <div className={u.online ? "text-green-500" : "text-dc-text-muted"}>{u.online ? "Online" : "Offline"}</div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-dc-text-muted">No users match your filters.</div>
          )}
        </div>
      </div>
    </div>
  );
}
