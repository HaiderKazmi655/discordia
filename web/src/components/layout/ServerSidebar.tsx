"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { CreateServerModal } from '@/components/modals/CreateServerModal';

export const ServerSidebar = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const fetchServers = async () => {
        try {
            const { data, error } = await supabase
                .from('server_members')
                .select('server_id, servers(*)')
                .eq('user_id', user.username);
            if (!error && Array.isArray(data) && data.length > 0) {
                const userServers = data.map((item: any) => item.servers).filter(Boolean);
                setServers(userServers);
                try {
                    localStorage.setItem("dc_local_servers", JSON.stringify(userServers));
                } catch {}
            } else {
                const localServers = JSON.parse(localStorage.getItem("dc_local_servers") || "[]");
                setServers(localServers);
            }
        } catch {
            const localServers = JSON.parse(localStorage.getItem("dc_local_servers") || "[]");
            setServers(localServers);
        }
        setLoading(false);
    };

    fetchServers();

    // Realtime subscription for new servers (optional, for now just fetch on mount)
  }, [user]);

  return (
    <div className="w-[72px] bg-dc-bg-dark flex flex-col items-center py-3 space-y-2 overflow-y-auto shrink-0 scrollbar-none">
        {/* Home/DM Button */}
        <Link href="/channels/me" className="group relative flex items-center justify-center w-full">
            <div className="absolute left-0 w-[4px] h-[8px] rounded-r-full bg-white opacity-0 group-hover:opacity-100 transition-all group-hover:h-[20px] -ml-4" />
            <div className="h-12 w-12 rounded-[24px] group-hover:rounded-[16px] transition-all bg-dc-bg-primary group-hover:bg-dc-brand flex items-center justify-center text-white overflow-hidden shadow-sm group-hover:shadow-md">
               <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                   <path d="M19.7,4.6C18.2,3.9,16.5,3.3,14.8,3c-0.2,0.4-0.4,0.8-0.6,1.2c-1.8-0.3-3.6-0.3-5.4,0C8.6,3.8,8.4,3.4,8.2,3 C6.5,3.3,4.8,3.9,3.3,4.6C0.4,9,0,13.3,1.6,17.4c2.1,1.5,4.1,2.4,6.1,3l1.1-1.5c-1-0.4-1.9-0.8-2.7-1.3c0.2-0.2,0.5-0.3,0.7-0.5 c3.9,1.8,8.1,1.8,11.9,0c0.2,0.2,0.5,0.3,0.7,0.5c-0.8,0.5-1.8,0.9-2.7,1.3l1.1,1.5c2-0.6,4-1.5,6.1-3C24.4,9.1,21.3,4.6,19.7,4.6z M8.6,13.6c-1.1,0-2-1-2-2.3c0-1.2,0.9-2.3,2-2.3c1.1,0,2,1,2,2.3C10.6,12.6,9.7,13.6,8.6,13.6z M15.4,13.6c-1.1,0-2-1-2-2.3 c0-1.2,0.9-2.3,2-2.3c1.1,0,2,1,2,2.3C17.4,12.6,16.5,13.6,15.4,13.6z"/>
               </svg>
            </div>
        </Link>
        
        <div className="h-[2px] w-8 bg-dc-bg-secondary rounded-lg mx-auto" />
        
        {/* Server List */}
        {servers.map(server => (
             <Link href={`/channels/${server.id}`} key={server.id} className="group relative flex items-center justify-center w-full" onClick={(e) => {
                 try {
                     const local = JSON.parse(localStorage.getItem("dc_local_channels") || "{}");
                     const list = local[server.id] || [];
                     if (list.length > 0) {
                         e.preventDefault();
                         router.push(`/channels/${server.id}/${list[0].id}`);
                     }
                 } catch {}
             }}>
                <div className="absolute left-0 w-[4px] h-[8px] rounded-r-full bg-white opacity-0 group-hover:opacity-100 transition-all group-hover:h-[20px]" />
                <div className="h-12 w-12 rounded-[24px] group-hover:rounded-[16px] transition-all bg-dc-bg-primary group-hover:bg-dc-brand flex itemscenter justify-center text-white cursor-pointer overflow-hidden font-bold" title={server.name}>
                    {server.icon_url ? <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" /> : server.name.substring(0, 2).toUpperCase()}
                </div>
            </Link>
        ))}
        
        {/* Add Server Button */}
        <div className="group relative flex items-center justify-center w-full">
            <button onClick={() => setShowCreateModal(true)} className="h-12 w-12 rounded-[24px] group-hover:rounded-[16px] transition-all bg-dc-bg-primary hover:bg-dc-green flex items-center justify-center text-green-500 hover:text-white cursor-pointer outline-none">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
        </div>
        
        {showCreateModal && <CreateServerModal onClose={() => setShowCreateModal(false)} />}
    </div>
  )
}
