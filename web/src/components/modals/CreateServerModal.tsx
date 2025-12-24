"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export const CreateServerModal = ({ onClose }: { onClose: () => void }) => {
    const { user } = useAuth();
    const router = useRouter();
    const [name, setName] = useState("");
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [iconPreview, setIconPreview] = useState<string>("");
    const [loading, setLoading] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !user) return;
        setLoading(true);

        // Ensure user exists
        await supabase.from('users').upsert({
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar || null,
            online: true
        }, { onConflict: 'username' });
        // Create Server (without icon first)
        const sid = crypto.randomUUID();
        const { data: server, error: serverError } = await supabase
            .from('servers')
            .insert({ 
                id: sid,
                name, 
                owner_id: user.username,
                icon_url: null
            })
            .select()
            .single();

        if (serverError || !server) {
            const localServers = JSON.parse(localStorage.getItem("dc_local_servers") || "[]");
            const localChannels = JSON.parse(localStorage.getItem("dc_local_channels") || "{}");
            const newServer = { id: sid, name, owner_id: user.username, icon_url: iconPreview || null, created_at: Date.now() };
            localStorage.setItem("dc_local_servers", JSON.stringify([...localServers, newServer]));
            const defChannel = { id: crypto.randomUUID(), server_id: sid, name: "general", type: "text", created_at: Date.now() };
            localChannels[sid] = [...(localChannels[sid] || []), defChannel];
            localStorage.setItem("dc_local_channels", JSON.stringify(localChannels));
            setLoading(false);
            onClose();
            window.location.href = `/channels/${sid}/${defChannel.id}`;
            return;
        }

        // 2. Upload Icon (if provided)
        if (iconFile) {
            const ext = iconFile.name.split('.').pop()?.toLowerCase() || 'png';
            const path = `${server.id}.${ext}`;
            const { error: upErr } = await supabase.storage.from('server-icons').upload(path, iconFile, {
                contentType: iconFile.type || 'image/png',
                upsert: true
            });
            if (!upErr) {
                const { data: pub } = await supabase.storage.from('server-icons').getPublicUrl(path);
                const publicUrl = pub?.publicUrl;
                if (publicUrl) {
                    await supabase.from('servers').update({ icon_url: publicUrl }).eq('id', server.id);
                }
            } else {
                const dataUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = () => reject(new Error('read error'));
                    reader.readAsDataURL(iconFile);
                });
                await supabase.from('servers').update({ icon_url: dataUrl }).eq('id', server.id);
            }
        }

        // 3. Add Member
        await supabase.from('server_members').insert({
            id: crypto.randomUUID(),
            server_id: server.id,
            user_id: user.username
        });

        // 4. Create Default Channel
        const cid = crypto.randomUUID();
        const { data: channel } = await supabase.from('channels').insert({
            id: cid,
            server_id: server.id,
            name: 'general',
            type: 'text'
        }).select().single();

        setLoading(false);
        onClose();
        
        // Reload or redirect
        window.location.href = `/channels/${server.id}/${channel?.id}`;
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-[#36393f] w-[440px] rounded-lg shadow-xl overflow-hidden animate-fade-in-up">
                <div className="p-6 text-center">
                    <h2 className="text-2xl font-bold text-[#060607] dark:text-white mb-2">Customize Your Server</h2>
                    <p className="text-dc-text-muted text-sm px-4">
                        Give your new server a personality with a name and an icon. You can always change it later.
                    </p>
                    
                    <form onSubmit={handleCreate} className="mt-6 text-left">
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-dc-text-muted uppercase mb-2">Server Icon</label>
                            <input 
                                type="file"
                                accept="image/*"
                                className="w-full bg-[#e3e5e8] dark:bg-[#202225] p-2.5 rounded text-[#2e3338] dark:text-dc-text-normal outline-none"
                                onChange={e => {
                                    const f = e.target.files?.[0] || null;
                                    setIconFile(f);
                                    setIconPreview(f ? URL.createObjectURL(f) : "");
                                }}
                            />
                            {iconPreview && (
                                <div className="mt-3 flex items-center justify-center">
                                    <img src={iconPreview} alt="Preview" className="w-16 h-16 rounded-full object-cover border border-dc-bg-modifier" />
                                </div>
                            )}
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-dc-text-muted uppercase mb-2">Server Name</label>
                            <input 
                                className="w-full bg-[#e3e5e8] dark:bg-[#202225] p-2.5 rounded text-[#2e3338] dark:text-dc-text-normal outline-none focus:ring-2 focus:ring-blue-400"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder={`${user?.displayName}'s Server`}
                                required
                            />
                        </div>
                        
                        <div className="text-xs text-dc-text-muted">
                            By creating a server, you agree to Discord's <a href="#" className="text-blue-500 hover:underline">Community Guidelines</a>.
                        </div>
                    </form>
                </div>
                
                <div className="bg-[#f2f3f5] dark:bg-[#2f3136] p-4 flex justify-between items-center">
                    <button onClick={onClose} className="text-[#060607] dark:text-white text-sm font-medium hover:underline px-4">Back</button>
                    <button onClick={handleCreate} disabled={!name.trim() || loading} className="bg-[#5865f2] text-white px-8 py-2.5 rounded font-medium hover:bg-[#4752c4] transition-colors disabled:opacity-50">
                        {loading ? "Creating..." : "Create"}
                    </button>
                </div>
            </div>
        </div>
    );
};
