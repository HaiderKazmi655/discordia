"use client";
import { useAuth } from "@/context/AuthContext";
import { UserArea } from "./UserArea";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const MeSidebar = () => {
    const { user } = useAuth();
    const pathname = usePathname();
    const [dms, setDms] = useState<any[]>([]);

    useEffect(() => {
        if (!user) return;
        const fetchDms = async () => {
            const { data } = await supabase.from('dms')
                .select('*')
                .or(`pair_a.eq.${user.username},pair_b.eq.${user.username}`)
                .order('time', { ascending: false });
            if(data) setDms(data);
        };
        fetchDms();

        // Subscribe to new DMs
        const channel = supabase
            .channel('dms_sidebar')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dms', filter: `pair_a=eq.${user.username}` }, (payload) => {
                 setDms(prev => [payload.new, ...prev]);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dms', filter: `pair_b=eq.${user.username}` }, (payload) => {
                 setDms(prev => [payload.new, ...prev]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const getFriendName = (dm: any) => dm.pair_a === user?.username ? dm.pair_b : dm.pair_a;

    return (
        <div className="w-60 bg-dc-bg-secondary flex flex-col shrink-0">
            <div className="h-12 flex items-center px-2 shadow-sm shrink-0 border-b border-dc-bg-tertiary">
                <button className="w-full bg-dc-bg-dark text-dc-text-muted text-sm text-left px-2 py-1 rounded transition-colors hover:text-dc-text-normal">
                    Find or start a conversation
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-[2px]">
                <Link href="/channels/me">
                    <div className={`flex items-center px-2 py-2.5 rounded cursor-pointer mb-4 ${pathname === '/channels/me' ? 'bg-dc-bg-modifier text-white' : 'text-dc-text-muted hover:bg-dc-bg-modifier hover:text-dc-text-normal'}`}>
                        <span className="mr-3 text-lg">👋</span>
                        <span className="font-medium">Friends</span>
                    </div>
                </Link>
                
                <div className="flex items-center justify-between text-xs font-bold text-dc-text-muted uppercase px-2 mb-2 mt-4 hover:text-dc-text-normal cursor-default group">
                    <span>Direct Messages</span>
                    <span className="cursor-pointer text-dc-text-normal opacity-0 group-hover:opacity-100">+</span>
                </div>
                
                {dms.map(dm => {
                    const friendName = getFriendName(dm);
                    const isActive = pathname === `/channels/me/${dm.id}`;
                    return (
                        <Link key={dm.id} href={`/channels/me/${dm.id}`}>
                            <div className={`flex items-center px-2 py-2 rounded cursor-pointer group ${isActive ? 'bg-dc-bg-modifier text-white' : 'text-dc-text-muted hover:bg-dc-bg-modifier hover:text-dc-text-normal'}`}>
                                <div className="w-8 h-8 rounded-full bg-dc-brand flex items-center justify-center text-white mr-3 shrink-0 text-sm">
                                    {friendName[0]}
                                </div>
                                <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                    {friendName}
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 text-dc-text-muted hover:text-white font-light px-1">
                                    ×
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
            
            <UserArea />
        </div>
    )
}
