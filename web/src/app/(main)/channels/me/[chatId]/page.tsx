"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { MeSidebar } from "@/components/layout/MeSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { VideoCall } from "@/components/chat/VideoCall";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export default function DMPage() {
    const params = useParams();
    const chatId = params?.chatId as string;
    const { user } = useAuth();
    const [friendUsername, setFriendUsername] = useState<string | null>(null);

    useEffect(() => {
        if (!user || !chatId) return;
        const fetchDM = async () => {
            const { data } = await supabase.from('dms').select('*').eq('id', chatId).single();
            if (data) {
                const friend = data.pair_a === user.username ? data.pair_b : data.pair_a;
                setFriendUsername(friend);
            }
        };
        fetchDM();
    }, [chatId, user]);

    if (!user) return null;

    return (
        <div className="flex w-full h-full">
            <MeSidebar />
            {friendUsername ? (
                <ChatArea 
                    channelId={chatId} 
                    channelName={friendUsername}
                    headerActions={<VideoCall friendUsername={friendUsername} />}
                />
            ) : (
                <div className="flex-1 bg-dc-bg-primary flex items-center justify-center text-dc-text-muted">
                    Loading DM...
                </div>
            )}
        </div>
    );
}
