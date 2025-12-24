"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import dynamic from "next/dynamic";
const Avatar = dynamic(() => import("@/components/common/Avatar"), { ssr: false });

export const ChatArea = ({ channelId, channelName, headerActions }: { channelId: string, channelName?: string, headerActions?: React.ReactNode }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [showPlusMenu, setShowPlusMenu] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Fetch initial messages
        const fetchMessages = async () => {
            try {
                const { data } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('channel_id', channelId)
                    .order('created_at', { ascending: true });
                const local = JSON.parse(localStorage.getItem("dc_local_messages") || "{}");
                const localList = (local[channelId] || []);
                const combined = [...(data || []), ...localList].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                setMessages(combined);
            } catch {
                const local = JSON.parse(localStorage.getItem("dc_local_messages") || "{}");
                setMessages(local[channelId] || []);
            }
        };
        fetchMessages();

        // Subscribe to real-time changes
        const channel = supabase
            .channel(`chat:${channelId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` }, (payload) => {
                 setMessages(prev => [...prev, payload.new]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [channelId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        if((!input.trim() && !file) || !user) return;
        
        const text = input.trim();
        setInput(""); // Optimistic clear
        const ts = new Date().toISOString();
        let attachmentUrl: string | null = null;
        if (file) {
            const path = `${channelId}/${Date.now()}_${file.name}`;
            try {
                const { error: upErr } = await supabase.storage.from("message-files").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: true });
                if (!upErr) {
                    const { data: pub } = await supabase.storage.from("message-files").getPublicUrl(path);
                    attachmentUrl = pub?.publicUrl || null;
                } else {
                    const reader = new FileReader();
                    attachmentUrl = await new Promise<string>((resolve) => {
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(file);
                    });
                }
            } catch {
                const reader = new FileReader();
                attachmentUrl = await new Promise<string>((resolve) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                });
            }
        }
        setFile(null);
        const contentWithAttachment = attachmentUrl ? `${text}${text ? "\n" : ""}${attachmentUrl}` : text;

        try {
            const { data: inserted } = await supabase.from('messages').insert({
                channel_id: channelId,
                user_id: user.username,
                username: user.displayName,
                content: contentWithAttachment,
                created_at: ts
            }).select().single();
            if (inserted) {
                setMessages(prev => [...prev, inserted]);
            } else {
                throw new Error("no-insert");
            }
        } catch {
            const local = JSON.parse(localStorage.getItem("dc_local_messages") || "{}");
            const msg = { id: crypto.randomUUID(), channel_id: channelId, user_id: user.username, username: user.displayName, content: contentWithAttachment, created_at: ts };
            local[channelId] = [...(local[channelId] || []), msg];
            localStorage.setItem("dc_local_messages", JSON.stringify(local));
            setMessages(prev => [...prev, msg]);
        }
    };

    return (
        <div className="flex-1 bg-dc-bg-primary flex flex-col min-w-0">
            {/* Header */}
            <div className="h-12 shadow-sm flex items-center px-4 border-b border-dc-bg-tertiary shrink-0 justify-between">
                <div className="flex items-center">
                    <span className="text-2xl text-dc-text-muted mr-2">#</span>
                    <span className="font-bold text-white">{channelName || channelId}</span>
                </div>
                {headerActions}
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="text-dc-text-muted mt-4">Welcome to #{channelName || channelId}! Be the first to say hello.</div>
                )}
                {messages.map(m => (
                    <div key={m.id} className="flex group hover:bg-dc-bg-secondary/30 -mx-4 px-4 py-1">
                        <div className="mr-4 mt-0.5 shrink-0">
                            <Avatar username={m.user_id} displayName={m.username} size={40} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-baseline space-x-2">
                                <span className="font-medium text-white hover:underline cursor-pointer">{m.username || "Unknown"}</span>
                                <span className="text-xs text-dc-text-muted">{new Date(m.created_at).toLocaleTimeString()}</span>
                            </div>
                            <div className="text-dc-text-normal whitespace-pre-wrap break-words">
                                {m.content?.split(/\s+/).map((tok: string, i: number) => {
                                    const isUrl = /^https?:\/\//.test(tok) || tok.startsWith("data:");
                                    const isImg = isUrl && (tok.startsWith("data:image") || /\.(png|jpg|jpeg|gif|webp)$/i.test(tok));
                                    if (isImg) {
                                        return <img key={i} src={tok} className="max-w-[260px] rounded mt-2" />;
                                    }
                                    if (isUrl) {
                                        return <a key={i} href={tok} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline break-all">{tok}</a>;
                                    }
                                    return <span key={i}>{tok} </span>;
                                })}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
            
            {/* Input */}
            <div className="p-4 shrink-0 relative">
                <form onSubmit={send} className="bg-dc-bg-modifier rounded-lg px-4 py-2.5 flex items-center relative">
                    <button
                        type="button"
                        onClick={() => setShowPlusMenu(v => !v)}
                        className="w-8 h-8 rounded-full bg-[#40444b] text-white flex items-center justify-center mr-3 hover:bg-[#4f545c]"
                        aria-label="Open actions"
                        title="Add"
                    >
                        +
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={e => {
                            setFile(e.target.files?.[0] || null);
                            setShowPlusMenu(false);
                        }}
                    />
                    <input 
                        className="flex-1 bg-transparent text-dc-text-normal outline-none placeholder-dc-text-muted"
                        placeholder={`Message #${channelName || channelId}`}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                    />
                    <button type="submit" disabled={!input.trim() && !file} className="ml-3 bg-[#5865f2] text-white px-3 py-1.5 rounded hover:bg-[#4752c4] disabled:opacity-50">Send</button>
                </form>
                {showPlusMenu && (
                    <div className="absolute bottom-16 left-6 bg-[#2f3136] border border-[#202225] rounded-md shadow-lg w-56 z-50">
                        <button
                            className="w-full text-left px-3 py-2 text-white hover:bg-[#40444b]"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            Attach File
                        </button>
                        <button
                            className="w-full text-left px-3 py-2 text-white hover:bg-[#40444b]"
                            onClick={() => setShowEmojiPicker(v => !v)}
                        >
                            Insert Emoji
                        </button>
                    </div>
                )}
                {showEmojiPicker && (
                    <div className="absolute bottom-36 left-6 bg-[#2f3136] border border-[#202225] rounded-md shadow-lg p-2 z-50">
                        <div className="grid grid-cols-8 gap-2">
                            {["😀","😁","😂","😊","😍","😎","🤔","😢","👍","👏","🔥","🎉","❤️","🙌","🤝","✅"].map(e => (
                                <button
                                    key={e}
                                    className="text-xl hover:bg-[#40444b] rounded px-1"
                                    type="button"
                                    onClick={() => {
                                        setInput(prev => prev + e);
                                        setShowEmojiPicker(false);
                                        setShowPlusMenu(false);
                                    }}
                                >
                                    {e}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
