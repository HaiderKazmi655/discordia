"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export const ServerSettingsModal = ({ serverId, onClose }: { serverId: string; onClose: () => void }) => {
    const { user } = useAuth();
    const router = useRouter();
    const [name, setName] = useState("");
    const [iconUrl, setIconUrl] = useState("");
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [iconPreview, setIconPreview] = useState<string>("");
    const [saving, setSaving] = useState(false);
    const [inviteUser, setInviteUser] = useState("");
    const [inviteMsg, setInviteMsg] = useState("");
    const [copyMsg, setCopyMsg] = useState("");
    const [friends, setFriends] = useState<any[]>([]);

    useEffect(() => {
        const fetchServer = async () => {
            const { data } = await supabase.from("servers").select("*").eq("id", serverId).single();
            if (data) {
                setName(data.name || "");
                setIconUrl(data.icon_url || "");
            }
        };
        fetchServer();
        const fetchFriends = async () => {
            const { data: fr } = await supabase.from("friend_requests").select("*").eq("status", "accepted").or(`from.eq.${user?.username},to.eq.${user?.username}`);
            if (fr && fr.length > 0) {
                const usernames = fr.map(r => r.from === user?.username ? r.to : r.from);
                const { data: fDetails } = await supabase.from("users").select("*").in("username", usernames);
                if (fDetails) setFriends(fDetails);
            }
        };
        fetchFriends();
    }, [serverId]);

    const saveServer = async () => {
        if (!user) return;
        setSaving(true);
        const payload: any = { name };
        
        // Upload icon file if provided
        if (iconFile) {
            const ext = iconFile.name.split(".").pop()?.toLowerCase() || "png";
            const path = `${serverId}.${ext}`;
            const { error: upErr } = await supabase.storage.from("server-icons").upload(path, iconFile, {
                contentType: iconFile.type || "image/png",
                upsert: true,
            });
            if (!upErr) {
                const { data: pub } = await supabase.storage.from("server-icons").getPublicUrl(path);
                if (pub?.publicUrl) {
                    payload.icon_url = pub.publicUrl;
                }
            } else {
                const dataUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = () => reject(new Error("read error"));
                    reader.readAsDataURL(iconFile);
                });
                payload.icon_url = dataUrl;
            }
        } else {
            payload.icon_url = iconUrl || null;
        }

        await supabase.from("servers").update(payload).eq("id", serverId);
        setSaving(false);
        onClose();
    };

    const invite = async () => {
        setInviteMsg("");
        const inputUid = inviteUser.trim().toLowerCase();
        if (!inputUid || !user?.username) return;
        let targetUsername: string | null = null;
        try {
            const { data } = await supabase.from("users").select("username, uid").eq("uid", inputUid).maybeSingle();
            if (data?.username) targetUsername = data.username;
        } catch {}
        if (!targetUsername) {
            try {
                const uidMap = JSON.parse(localStorage.getItem("dc_uid_map") || "{}");
                const uname = uidMap[inputUid];
                if (uname) targetUsername = uname;
            } catch {}
        }
        if (!targetUsername) {
            setInviteMsg("UID not found");
            return;
        }
        // Only send DM invite if they're friends
        const { data: fr } = await supabase
            .from("friend_requests")
            .select("*")
            .eq("status", "accepted")
            .or(`and(from.eq.${user.username},to.eq.${targetUsername}),and(from.eq.${targetUsername},to.eq.${user.username})`)
            .maybeSingle();
        if (!fr) {
            setInviteMsg("Invite only sent to friends");
            return;
        }
        // Create invite code
        let inviteUrl = "";
        try {
            const { data } = await supabase.from("server_invites").insert({ server_id: serverId, created_by: user.username }).select().single();
            const code = data?.code || "";
            inviteUrl = `${window.location.origin}/invite/${code}`;
        } catch {
            const code = crypto.randomUUID();
            const localInv = JSON.parse(localStorage.getItem("dc_local_invites") || "{}");
            localInv[code] = { server_id: serverId, created_by: user.username, created_at: Date.now() };
            localStorage.setItem("dc_local_invites", JSON.stringify(localInv));
            inviteUrl = `${window.location.origin}/invite/${code}`;
        }
        // Get or create DM channel
        const { data: existingDM } = await supabase
            .from("dms")
            .select("*")
            .or(`and(pair_a.eq.${user.username},pair_b.eq.${targetUsername}),and(pair_a.eq.${targetUsername},pair_b.eq.${user.username})`)
            .maybeSingle();
        let dmId = existingDM?.id as string | undefined;
        if (!dmId) {
            const { data: newDM } = await supabase
                .from("dms")
                .insert({ pair_a: user.username, pair_b: targetUsername, user: user.username })
                .select()
                .single();
            dmId = newDM?.id;
        }
        if (!dmId) {
            setInviteMsg("Failed to prepare DM");
            return;
        }
        // Send message with invite link
        const ts = new Date().toISOString();
        try {
            await supabase.from("messages").insert({
                channel_id: dmId,
                user_id: user.username,
                username: user.displayName,
                content: `Server invite to "${name || serverId}": ${inviteUrl}`,
                created_at: ts
            });
            setInviteMsg("Invite sent via DM");
        } catch {
            const local = JSON.parse(localStorage.getItem("dc_local_messages") || "{}");
            const msg = { id: crypto.randomUUID(), channel_id: dmId, user_id: user.username, username: user.displayName, content: `Server invite to "${name || serverId}": ${inviteUrl}`, created_at: ts };
            local[dmId] = [...(local[dmId] || []), msg];
            localStorage.setItem("dc_local_messages", JSON.stringify(local));
            setInviteMsg("Invite sent via DM");
        }
    };
    const copyInvite = async () => {
        setCopyMsg("");
        try {
            const { data } = await supabase.from("server_invites").insert({ server_id: serverId, created_by: user?.username || null }).select().single();
            const code = data?.code;
            const url = `${window.location.origin}/invite/${code}`;
            await navigator.clipboard.writeText(url);
            setCopyMsg("Invite link copied");
        } catch {
            const code = crypto.randomUUID();
            const localInv = JSON.parse(localStorage.getItem("dc_local_invites") || "{}");
            localInv[code] = { server_id: serverId, created_by: user?.username || null, created_at: Date.now() };
            localStorage.setItem("dc_local_invites", JSON.stringify(localInv));
            const url = `${window.location.origin}/invite/${code}`;
            await navigator.clipboard.writeText(url);
            setCopyMsg("Invite link copied");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-[#2f3136] w-[520px] rounded-lg shadow-xl overflow-hidden">
                <div className="px-6 py-4 flex items-center justify-between">
                    <div className="text-lg font-bold text-[#060607] dark:text-white">Server Settings</div>
                    <button onClick={onClose} className="text-dc-text-muted hover:text-white">✕</button>
                </div>
                <div className="px-6 pb-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-dc-text-muted uppercase mb-2">Server Name</label>
                        <input
                            className="w-full bg-[#e3e5e8] dark:bg-[#202225] p-2.5 rounded text-[#2e3338] dark:text-dc-text-normal outline-none focus:ring-2 focus:ring-blue-400"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My Server"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-dc-text-muted uppercase mb-2">Server Icon</label>
                        <input
                            type="file"
                            accept="image/*"
                            className="w-full bg-[#e3e5e8] dark:bg-[#202225] p-2.5 rounded text-[#2e3338] dark:text-dc-text-normal outline-none"
                            onChange={(e) => {
                                const f = e.target.files?.[0] || null;
                                setIconFile(f);
                                setIconPreview(f ? URL.createObjectURL(f) : "");
                            }}
                        />
                        {(iconPreview || iconUrl) && (
                            <div className="mt-3">
                                <img src={iconPreview || iconUrl} alt="Icon Preview" className="w-14 h-14 rounded-full object-cover border border-dc-bg-modifier" />
                            </div>
                        )}
                    </div>
                    <div className="h-[1px] bg-dc-bg-modifier" />
                    <div>
                        <label className="block text-xs font-bold text-dc-text-muted uppercase mb-2">Invite Member</label>
                        <div className="flex gap-2">
                            <input
                                className="flex-1 bg-[#e3e5e8] dark:bg-[#202225] p-2.5 rounded text-[#2e3338] dark:text-dc-text-normal outline-none focus:ring-2 focus:ring-blue-400"
                                value={inviteUser}
                                onChange={(e) => setInviteUser(e.target.value)}
                                placeholder="UID"
                            />
                            <button onClick={invite} className="bg-dc-brand text-white px-4 rounded hover:bg-indigo-600">Invite</button>
                        </div>
                        {inviteMsg && <div className="text-sm mt-1 text-dc-text-muted">{inviteMsg}</div>}
                    </div>
                    <div className="h-[1px] bg-dc-bg-modifier" />
                    <div>
                        <label className="block text-xs font-bold text-dc-text-muted uppercase mb-2">Invite Friends</label>
                        <div className="space-y-2">
                            {friends.map(f => (
                                <div key={f.username} className="flex items-center justify-between bg-[#202225] p-2 rounded">
                                    <div className="flex items-center">
                                        <div className="w-8 h-8 rounded-full bg-dc-brand text-white flex items-center justify-center mr-2">{f.displayName?.[0] || f.username[0]}</div>
                                        <div className="text-white font-bold">{f.displayName}</div>
                                    </div>
                                    <button onClick={async () => { await supabase.from("server_members").insert({ server_id: serverId, user_id: f.username }); }} className="px-3 py-1 rounded bg-[#5865f2] text-white hover:bg-[#4752c4]">Invite</button>
                                </div>
                            ))}
                            {friends.length === 0 && <div className="text-dc-text-muted text-sm">No friends yet.</div>}
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4 bg-[#f2f3f5] dark:bg-[#202225] flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 rounded text-dc-text-muted hover:text-white">Cancel</button>
                    <button
                        onClick={saveServer}
                        disabled={saving || !name.trim()}
                        className="ml-2 bg-[#5865f2] text-white px-6 py-2 rounded font-medium hover:bg-[#4752c4] disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>
                    <button onClick={copyInvite} className="ml-2 bg-[#2f3136] text-white px-6 py-2 rounded hover:bg-[#3a3d43]">Copy Invite Link</button>
                    {copyMsg && <div className="ml-3 text-sm text-dc-text-muted">{copyMsg}</div>}
                </div>
            </div>
        </div>
    );
};
