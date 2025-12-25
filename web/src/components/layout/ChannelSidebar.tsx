"use client";
import { UserArea } from "./UserArea";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ServerSettingsModal } from "@/components/modals/ServerSettingsModal";
import { CreateChannelModal } from "@/components/modals/CreateChannelModal";

export const ChannelSidebar = ({ serverId }: { serverId: string }) => {
  const [channels, setChannels] = useState<any[]>([]);
  const [serverName, setServerName] = useState("Server");
  const pathname = usePathname();
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);

  useEffect(() => {
      const fetchChannels = async () => {
          // Fetch Server Details
          try {
              const { data: server, error: sErr } = await supabase.from('servers').select('name').eq('id', serverId).maybeSingle();
              if (server && !sErr) {
                  setServerName(server.name);
                  try {
                      const localServers = JSON.parse(localStorage.getItem("dc_local_servers") || "[]");
                      const idx = localServers.findIndex((x: any) => x.id === serverId);
                      const merged = { ...(localServers[idx] || { id: serverId }), name: server.name };
                      if (idx >= 0) localServers[idx] = merged; else localServers.push(merged);
                      localStorage.setItem("dc_local_servers", JSON.stringify(localServers));
                  } catch {}
              } else {
                  const localServers = JSON.parse(localStorage.getItem("dc_local_servers") || "[]");
                  const s = localServers.find((x: any) => x.id === serverId);
                  if (s) setServerName(s.name);
              }
          } catch {
              const localServers = JSON.parse(localStorage.getItem("dc_local_servers") || "[]");
              const s = localServers.find((x: any) => x.id === serverId);
              if (s) setServerName(s.name);
          }

          // Fetch Channels
          try {
              const { data, error } = await supabase
                  .from('channels')
                  .select('*')
                  .eq('server_id', serverId)
                  .order('created_at', { ascending: true });
              if (!error && Array.isArray(data) && data.length > 0) {
                  setChannels(data);
                  try {
                      const local = JSON.parse(localStorage.getItem("dc_local_channels") || "{}");
                      local[serverId] = data;
                      localStorage.setItem("dc_local_channels", JSON.stringify(local));
                  } catch {}
              } else {
                  const local = JSON.parse(localStorage.getItem("dc_local_channels") || "{}");
                  setChannels(local[serverId] || []);
              }
          } catch {
              const local = JSON.parse(localStorage.getItem("dc_local_channels") || "{}");
              const list = local[serverId] || [];
              if (list.length === 0) {
                  const def = { id: crypto.randomUUID(), server_id: serverId, name: "general", type: "text", created_at: Date.now() };
                  local[serverId] = [def];
                  localStorage.setItem("dc_local_channels", JSON.stringify(local));
                  setChannels(local[serverId]);
              } else {
                  setChannels(list);
              }
          }
      };
      fetchChannels();
  }, [serverId]);

  const createChannel = async () => {
      const name = prompt("Enter channel name:");
      if (!name) return;
      
      const typeInput = prompt("Enter type (text/voice):", "text");
      const type = (typeInput?.toLowerCase() === 'voice') ? 'voice' : 'text';

      try {
          const { data, error } = await supabase.from('channels').insert({
              server_id: serverId,
              name: name.toLowerCase().replace(/\s+/g, '-'), // Discord style
              type: type
          }).select().single();
          if (data && !error) {
              setChannels([...channels, data]);
              return;
          }
      } catch {}

      const local = JSON.parse(localStorage.getItem("dc_local_channels") || "{}");
      const ch = { id: crypto.randomUUID(), server_id: serverId, name: name.toLowerCase().replace(/\s+/g, '-'), type, created_at: Date.now() };
      local[serverId] = [...(local[serverId] || []), ch];
      localStorage.setItem("dc_local_channels", JSON.stringify(local));
      setChannels(local[serverId]);
  };

  return (
    <div className="w-60 bg-dc-bg-secondary flex flex-col shrink-0">
        {/* Server Header */}
        <div className="h-12 flex items-center px-4 shadow-sm shrink-0 border-b border-dc-bg-tertiary font-bold text-white transition-colors">
            <button onClick={() => setShowServerSettings(true)} className="flex items-center hover:text-dc-text-normal">
              <span className="mr-2">🛠️</span>
              {serverName}
            </button>
            <button onClick={() => setShowCreateChannel(true)} className="ml-auto text-xl hover:text-dc-text-normal text-dc-text-muted" title="Create Channel">+</button>
        </div>
        
        {/* Channels */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {channels.map(ch => {
                const isActive = pathname?.includes(ch.id);
                return (
                    <Link href={`/channels/${serverId}/${ch.id}`} key={ch.id} className={`flex items-center px-2 py-1.5 rounded cursor-pointer group ${isActive ? 'bg-dc-bg-modifier text-white' : 'text-dc-text-muted hover:bg-dc-bg-modifier hover:text-dc-text-normal'}`}>
                        <span className="text-xl mr-1.5 text-dc-text-muted">{ch.type==='voice' ? '🔊' : '#'}</span>
                        <span className="font-medium truncate">{ch.name}</span>
                    </Link>
                );
            })}
        </div>
        
        <UserArea />
        {showServerSettings && <ServerSettingsModal serverId={serverId} onClose={() => setShowServerSettings(false)} />}
        {showCreateChannel && <CreateChannelModal serverId={serverId} onClose={() => setShowCreateChannel(false)} onCreated={(ch) => setChannels([...channels, ch])} />}
    </div>
  )
}
