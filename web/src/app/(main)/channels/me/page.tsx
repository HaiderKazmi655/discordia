"use client";

import { useState, useEffect } from "react";
import { MeSidebar } from "@/components/layout/MeSidebar";
import { useAuth } from "@/context/AuthContext";
import type { User as DcUser } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type FriendRequest = {
  id: string;
  from: string;
  to: string;
  status: "pending" | "accepted" | "declined";
};

export default function MePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("online");
  const [addFriendInput, setAddFriendInput] = useState("");
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<DcUser[]>([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [hasNewRequest, setHasNewRequest] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());

  // =========================
  // FETCH DATA
  // =========================
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Friend requests
      const { data: requests } = await supabase
        .from("friend_requests")
        .select("*")
        .or(`to.eq.${user.username},from.eq.${user.username}`);

      if (!requests) return;

      setFriendRequests(requests);

      const incoming = requests.filter(
        r => r.to === user.username && r.status === "pending"
      );
      setHasNewRequest(incoming.length > 0);

      // Blocked users
      const { data: blocked } = await supabase
        .from("blocked_users")
        .select("blocked")
        .eq("blocker", user.username);

      const blockedSet = new Set(blocked?.map(b => b.blocked));
      setBlockedUsers(blockedSet);

      // Friends
      const accepted = requests.filter(r => r.status === "accepted");
      const friendUsernames = accepted
        .map(r => (r.from === user.username ? r.to : r.from))
        .filter(u => !blockedSet.has(u));

      if (friendUsernames.length === 0) {
        setFriends([]);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("username, display_name")
        .in("username", friendUsernames);

     if (profiles) {
  setFriends(
    profiles.map(p => ({
      username: p.username,
      displayName: p.display_name ?? p.username,
    })) as DcUser[]
  );
}

    };

    fetchData();

    const channel = supabase
      .channel("friends_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests" },
        fetchData
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // =========================
  // SEND FRIEND REQUEST
  // =========================
  const sendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setStatusMsg("");
    const input = addFriendInput.trim().replace(/^@/, "");
    if (!input) return;

    const { data: targetUser } = await supabase
      .from("profiles")
      .select("username, display_name")
      .ilike("username", input)
      .single();

    if (!targetUser) {
      setStatusMsg("User not found. Check spelling!");
      return;
    }

    if (targetUser.username === user.username) {
      setStatusMsg("You cannot add yourself.");
      return;
    }

    const { data: blocked } = await supabase
      .from("blocked_users")
      .select("id")
      .or(
        `and(blocker.eq.${user.username},blocked.eq.${targetUser.username}),
         and(blocker.eq.${targetUser.username},blocked.eq.${user.username})`
      )
      .maybeSingle();

    if (blocked) {
      setStatusMsg("You cannot interact with this user.");
      return;
    }

    const { data: existing } = await supabase
      .from("friend_requests")
      .select("*")
      .or(
        `and(from.eq.${user.username},to.eq.${targetUser.username}),
         and(from.eq.${targetUser.username},to.eq.${user.username})`
      )
      .maybeSingle();

    if (existing) {
      setStatusMsg(
        existing.status === "accepted"
          ? "You are already friends!"
          : "Friend request already pending."
      );
      return;
    }

    await supabase.from("friend_requests").insert({
      id: crypto.randomUUID(),
      from: user.username,
      to: targetUser.username,
      status: "pending",
    });

    setStatusMsg(
      `Friend request sent to ${targetUser.display_name || targetUser.username}!`
    );
    setAddFriendInput("");
  };

  // =========================
  // ACCEPT / DECLINE
  // =========================
  const handleRequest = async (
    id: string,
    status: "accepted" | "declined"
  ) => {
    await supabase.from("friend_requests").update({ status }).eq("id", id);
  };

  // =========================
  // BLOCK USER
  // =========================
  const blockUser = async (blockedUsername: string) => {
    if (!user) return;

    await supabase.from("blocked_users").insert({
      blocker: user.username,
      blocked: blockedUsername,
    });

    await supabase
      .from("friend_requests")
      .delete()
      .or(
        `and(from.eq.${user.username},to.eq.${blockedUsername}),
         and(from.eq.${blockedUsername},to.eq.${user.username})`
      );

    setFriends(prev => prev.filter(f => f.username !== blockedUsername));
    setStatusMsg(`Blocked ${blockedUsername}`);
  };

  // =========================
  // START DM
  // =========================
  const startDM = async (friendUsername: string) => {
    if (!user) return;

    const { data: existing } = await supabase
      .from("dms")
      .select("id")
      .or(
        `and(pair_a.eq.${user.username},pair_b.eq.${friendUsername}),
         and(pair_a.eq.${friendUsername},pair_b.eq.${user.username})`
      )
      .maybeSingle();

    if (existing) {
      router.push(`/channels/me/${existing.id}`);
      return;
    }

    const { data: newDM } = await supabase
      .from("dms")
      .insert({
        pair_a: user.username,
        pair_b: friendUsername,
      })
      .select()
      .single();

    if (newDM) {
      router.push(`/channels/me/${newDM.id}`);
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="flex w-full h-full">
      <MeSidebar />

      <div className="flex-1 bg-dc-bg-primary flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="h-12 flex items-center px-4 border-b border-dc-bg-tertiary">
          <div className="flex items-center gap-2 font-bold text-dc-text-muted">
            Friends
            {hasNewRequest && (
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </div>

          <div className="ml-4 space-x-2">
            {["online", "all", "pending", "add_friend"].map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === "pending") setHasNewRequest(false);
                }}
                className={`px-2 py-1 rounded ${
                  activeTab === tab
                    ? "bg-dc-bg-modifier text-white"
                    : "text-dc-text-muted hover:bg-dc-bg-modifier"
                }`}
              >
                {tab.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4">
          {activeTab === "add_friend" ? (
            <form onSubmit={sendFriendRequest} className="max-w-xl">
              <input
                value={addFriendInput}
                onChange={e => setAddFriendInput(e.target.value)}
                placeholder="Enter username"
                className="w-full p-3 rounded bg-dc-bg-secondary text-white"
              />
              <button className="mt-2 bg-dc-brand px-4 py-2 rounded text-white">
                Send Friend Request
              </button>
              {statusMsg && (
                <p className="mt-2 text-sm text-red-400">{statusMsg}</p>
              )}
            </form>
          ) : (
            <div>
              <h2 className="mb-4 text-xs uppercase">
                Friends — {friends.length}
              </h2>

              {friends.map(f => (
                <div
                  key={f.username}
                  className="flex justify-between p-3 hover:bg-dc-bg-modifier rounded"
                >
                  <div onClick={() => startDM(f.username)}>
                    <strong>{f.displayName || f.username}</strong>
                    <div className="text-xs">@{f.username}</div>
                  </div>

                  <button
                    onClick={() => blockUser(f.username)}
                    className="text-red-400 hover:text-red-600"
                    title="Block user"
                  >
                    🚫
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
