"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export const CreateChannelModal = ({ serverId, onClose, onCreated }: { serverId: string; onClose: () => void; onCreated: (channel: any) => void }) => {
    const [name, setName] = useState("");
    const [type, setType] = useState<"text" | "voice">("text");
    const [saving, setSaving] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        try {
            const { data, error } = await supabase.from("channels").insert({
                server_id: serverId,
                name: name.trim().toLowerCase().replace(/\s+/g, "-"),
                type
            }).select().single();
            if (data && !error) {
                onCreated(data);
                onClose();
                setSaving(false);
                return;
            }
        } catch {}
        const ch = { id: crypto.randomUUID(), server_id: serverId, name: name.trim().toLowerCase().replace(/\s+/g, "-"), type, created_at: Date.now() };
        onCreated(ch);
        const local = JSON.parse(localStorage.getItem("dc_local_channels") || "{}");
        local[serverId] = [...(local[serverId] || []), ch];
        localStorage.setItem("dc_local_channels", JSON.stringify(local));
        setSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-[#2f3136] w-[420px] rounded-lg shadow-xl overflow-hidden">
                <div className="px-6 py-4 text-lg font-bold text-[#060607] dark:text-white">Create Channel</div>
                <form onSubmit={submit} className="px-6 pb-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-dc-text-muted uppercase mb-2">Channel Name</label>
                        <input className="w-full bg-[#e3e5e8] dark:bg-[#202225] p-2.5 rounded text-[#2e3338] dark:text-dc-text-normal outline-none focus:ring-2 focus:ring-blue-400" value={name} onChange={e => setName(e.target.value)} placeholder="general" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-dc-text-muted uppercase mb-2">Type</label>
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setType("text")} className={`px-3 py-1.5 rounded ${type === "text" ? "bg-[#5865f2] text-white" : "bg-[#e3e5e8] dark:bg-[#202225] text-[#2e3338] dark:text-dc-text-normal"}`}>Text</button>
                            <button type="button" onClick={() => setType("voice")} className={`px-3 py-1.5 rounded ${type === "voice" ? "bg-[#5865f2] text-white" : "bg-[#e3e5e8] dark:bg-[#202225] text-[#2e3338] dark:text-dc-text-normal"}`}>Voice</button>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded text-dc-text-muted hover:text-white">Cancel</button>
                        <button type="submit" disabled={!name.trim() || saving} className="ml-2 bg-[#5865f2] text-white px-6 py-2 rounded hover:bg-[#4752c4] disabled:opacity-50">{saving ? "Creating..." : "Create"}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
