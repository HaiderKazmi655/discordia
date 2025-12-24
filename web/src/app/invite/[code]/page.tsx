"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useParams, useRouter } from "next/navigation";

export default function InvitePage() {
    const { user } = useAuth();
    const params = useParams();
    const router = useRouter();
    const code = params?.code as string;
    const [server, setServer] = useState<any | null>(null);
    const [error, setError] = useState("");
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        const fetchInvite = async () => {
            try {
                const { data: inv } = await supabase.from("server_invites").select("*").eq("code", code).maybeSingle();
                if (inv) {
                    const { data: srv } = await supabase.from("servers").select("*").eq("id", inv.server_id).single();
                    if (srv) setServer(srv);
                } else {
                    const localInv = JSON.parse(localStorage.getItem("dc_local_invites") || "{}");
                    const i = localInv[code];
                    if (i) {
                        const localServers = JSON.parse(localStorage.getItem("dc_local_servers") || "[]");
                        const s = localServers.find((x: any) => x.id === i.server_id) || null;
                        setServer(s);
                    } else {
                        setError("Invalid invite");
                    }
                }
            } catch {
                setError("Failed to load invite");
            }
        };
        fetchInvite();
    }, [code]);

    const join = async () => {
        if (!user || !server) return;
        setJoining(true);
        try {
            const { data: existing } = await supabase.from("server_members").select("*").eq("server_id", server.id).eq("user_id", user.username).maybeSingle();
            if (!existing) await supabase.from("server_members").insert({ server_id: server.id, user_id: user.username });
        } catch {}
        const localServers = JSON.parse(localStorage.getItem("dc_local_servers") || "[]");
        const found = localServers.find((x: any) => x.id === server.id);
        if (!found) localServers.push(server);
        localStorage.setItem("dc_local_servers", JSON.stringify(localServers));
        router.push(`/channels/${server.id}`);
    };

    return (
        <div className="flex items-center justify-center h-screen bg-dc-bg-primary">
            <div className="bg-[#2f3136] p-6 rounded-lg w-[420px]">
                <div className="text-white text-xl font-bold mb-3">Server Invite</div>
                {error && <div className="text-red-400">{error}</div>}
                {server && (
                    <div>
                        <div className="flex items-center mb-4">
                            <div className="w-12 h-12 rounded-full bg-dc-brand text-white flex items-center justify-center overflow-hidden mr-3">
                                {server.icon_url ? <img src={server.icon_url} className="w-full h-full object-cover" /> : server.name?.slice(0,2).toUpperCase()}
                            </div>
                            <div className="text-white font-bold">{server.name}</div>
                        </div>
                        <button onClick={join} disabled={joining} className="bg-[#5865f2] text-white px-6 py-2 rounded hover:bg-[#4752c4] disabled:opacity-50">{joining ? "Joining..." : "Accept Invite"}</button>
                    </div>
                )}
            </div>
        </div>
    );
}
