"use client";
import { ChannelSidebar } from "@/components/layout/ChannelSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import dynamic from "next/dynamic";
const VoiceChannel = dynamic(() => import("@/components/chat/VoiceChannel").then(m => m.VoiceChannel), { ssr: false });
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";

export default function ChannelPage() {
    const params = useParams();
    const serverId = params?.server as string;
    const channelId = params?.channel as string;
    const [channelType, setChannelType] = useState<'text' | 'voice' | null>(null);
    const [channelName, setChannelName] = useState("");

    useEffect(() => {
        if(!channelId) return;
        
        const fetchChannel = async () => {
            try {
                const { data, error } = await supabase.from('channels').select('*').eq('id', channelId).single();
                if(data && !error) {
                    setChannelType(data.type);
                    setChannelName(data.name);
                    return;
                }
            } catch {}
            const local = JSON.parse(localStorage.getItem("dc_local_channels") || "{}");
            const list = local[serverId] || [];
            const ch = list.find((x: any) => x.id === channelId);
            if (ch) {
                setChannelType(ch.type);
                setChannelName(ch.name);
            }
        };
        fetchChannel();
    }, [channelId]);

    return (
        <div className="flex w-full h-full">
            <ChannelSidebar serverId={serverId} />
            {channelType === 'text' && <ChatArea channelId={channelId} channelName={channelName} />}
            {channelType === 'voice' && <VoiceChannel channelId={channelId} channelName={channelName} />}
            {!channelType && <div className="flex-1 bg-dc-bg-primary"></div>}
        </div>
    );
}
