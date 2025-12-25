"use client";
import { useState, useEffect } from "react";
import { MeSidebar } from "@/components/layout/MeSidebar";
import { useAuth } from "@/context/AuthContext";
import type { User as DcUser } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function MePage() {
    const { user } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("online");
    const [addFriendInput, setAddFriendInput] = useState("");
    type FriendRequest = { id: string; from: string; to: string; status: 'pending' | 'accepted' | 'declined' };
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const [friends, setFriends] = useState<DcUser[]>([]);
    const [statusMsg, setStatusMsg] = useState("");

    // Fetch friend requests and friends
    useEffect(() => {
        if (!user) return;
        const fetchData = async () => {
             // Requests
             const { data: requests } = await supabase.from('friend_requests')
                .select('*')
                .or(`to.eq.${user.username},from.eq.${user.username}`);
             if (requests) setFriendRequests(requests);

             // Friends (Accepted)
             if (requests) {
                 const accepted = requests.filter(r => r.status === 'accepted');
                 const friendUsernames = accepted.map(r => r.from === user.username ? r.to : r.from);
                 
                 if (friendUsernames.length > 0) {
                     const { data: friendDetails } = await supabase.from('users').select('*').in('username', friendUsernames);
                     if (friendDetails) setFriends(friendDetails);
                 } else {
                     setFriends([]);
                 }
             }
        };
        fetchData();
        
        // Realtime subscription
        const channel = supabase
            .channel('friend_requests_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests', filter: `to=eq.${user.username}` }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests', filter: `from=eq.${user.username}` }, () => fetchData())
            .subscribe();
        
        // Direct broadcast fallback (works even if DB write fails)
        const direct = supabase
            .channel(`friend_requests_direct:${user.username}`)
            .on('broadcast', { event: 'friend_request' }, (payload) => {
                const req = payload.payload as FriendRequest;
                setFriendRequests(prev => {
                    const exists = prev.some(r => r.id === req.id);
                    const next = exists ? prev.map(r => r.id === req.id ? req : r) : [req, ...prev];
                    return next;
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(direct);
        };
    }, [user, activeTab]);

    const sendFriendRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        const input = addFriendInput.trim();
        if(!user || !input) return;
        setStatusMsg("");
        
        const normalized = input.replace(/^@/, "").toLowerCase();
        let targetUser: DcUser | null = null;
        const { data: byUsername } = await supabase.from('users')
            .select('*')
            .eq('username', normalized)
            .maybeSingle();
        if (byUsername) {
            targetUser = byUsername;
        } else {
            const { data: byDisplay } = await supabase.from('users')
                .select('*')
                .ilike('displayName', `%${input}%`)
                .limit(1);
            if (byDisplay && byDisplay.length > 0) {
                targetUser = byDisplay[0];
            } else {
                try {
                    const usersMap = JSON.parse(localStorage.getItem("dc_users") || "{}");
                    const localUser = usersMap[normalized];
                    if (localUser) targetUser = localUser;
                } catch {}
            }
        }

        if (!targetUser) {
            setStatusMsg("User not found. Check spelling!");
            return;
        }
        
        if (targetUser.username === user.username) {
            setStatusMsg("You cannot add yourself.");
            return;
        }

        // Check if request already exists
        const { data: existing } = await supabase.from('friend_requests')
            .select('*')
            .or(`and(from.eq.${user.username},to.eq.${targetUser.username}),and(from.eq.${targetUser.username},to.eq.${user.username})`)
            .maybeSingle();

        if (existing) {
             if (existing.status === 'accepted') {
                 setStatusMsg("You are already friends!");
             } else if (existing.status === 'pending') {
                 setStatusMsg("Friend request already pending.");
             }
             return;
        }

        const newId = crypto.randomUUID();
        const { error } = await supabase.from('friend_requests').insert({
            id: newId,
            from: user.username,
            to: targetUser.username,
            status: 'pending'
        });

        if (error) {
            // Fallback: realtime broadcast + local cache
            try {
                await supabase.channel(`friend_requests_direct:${targetUser.username}`).send({
                    type: 'broadcast',
                    event: 'friend_request',
                    payload: { id: newId, from: user.username, to: targetUser.username, status: 'pending' }
                });
                // Cache locally for current user
                const local = JSON.parse(localStorage.getItem("dc_friend_requests") || "[]");
                local.unshift({ id: newId, from: user.username, to: targetUser.username, status: 'pending' });
                localStorage.setItem("dc_friend_requests", JSON.stringify(local));
                setFriendRequests(prev => [{ id: newId, from: user.username, to: targetUser.username, status: 'pending' }, ...prev]);
                setStatusMsg(`Friend request sent to ${targetUser.displayName || targetUser.username}!`);
                setAddFriendInput("");
            } catch {
                setStatusMsg("Error sending request.");
            }
        } else {
            setStatusMsg(`Friend request sent to ${targetUser.displayName || targetUser.username}!`);
            setAddFriendInput("");
        }
    };

    const handleRequest = async (id: string, status: 'accepted' | 'declined') => {
        const req = friendRequests.find(r => r.id === id);
        await supabase.from('friend_requests').update({ status }).eq('id', id);
        // Broadcast fallback to notify other user
        if (req) {
            const other = req.from === user?.username ? req.to : req.from;
            try {
                await supabase.channel(`friend_requests_direct:${other}`).send({
                    type: 'broadcast',
                    event: 'friend_request',
                    payload: { ...req, status }
                });
            } catch {}
        }
        // Refresh
        const { data } = await supabase.from('friend_requests').select('*').or(`to.eq.${user?.username},from.eq.${user?.username}`);
        if(data) setFriendRequests(data);
    };

    const startDM = async (friendUsername: string) => {
        if (!user) return;
        // Check if DM exists
        const { data: existingDMs } = await supabase.from('dms')
            .select('id')
            .or(`and(pair_a.eq.${user.username},pair_b.eq.${friendUsername}),and(pair_a.eq.${friendUsername},pair_b.eq.${user.username})`)
            .maybeSingle();
            
        if (existingDMs) {
            router.push(`/channels/me/${existingDMs.id}`);
            return;
        }
        
        // Create new DM
        const { data: newDM } = await supabase.from('dms').insert({
            pair_a: user.username,
            pair_b: friendUsername,
            user: user.username
        }).select().single();
        
        if (newDM) {
            router.push(`/channels/me/${newDM.id}`);
        }
    };

    return (
        <div className="flex w-full h-full">
            <MeSidebar />
            <div className="flex-1 bg-dc-bg-primary flex flex-col min-w-0">
                 {/* Top Bar */}
                 <div className="h-12 shadow-sm flex items-center px-4 border-b border-dc-bg-tertiary shrink-0">
                     <div className="flex items-center text-dc-text-muted font-bold mr-4">
                         <span className="mr-2 text-xl">👋</span>
                         Friends
                     </div>
                     <div className="h-6 w-[1px] bg-dc-bg-modifier mx-2"></div>
                     <div className="flex items-center space-x-4 ml-2 overflow-x-auto scrollbar-none">
                         <button onClick={() => setActiveTab('online')} className={`${activeTab === 'online' ? 'text-white bg-dc-bg-modifier' : 'text-dc-text-muted hover:bg-dc-bg-modifier hover:text-dc-text-normal'} px-2 py-0.5 rounded whitespace-nowrap`}>Online</button>
                         <button onClick={() => setActiveTab('all')} className={`${activeTab === 'all' ? 'text-white bg-dc-bg-modifier' : 'text-dc-text-muted hover:bg-dc-bg-modifier hover:text-dc-text-normal'} px-2 py-0.5 rounded whitespace-nowrap`}>All</button>
                         <button onClick={() => setActiveTab('pending')} className={`${activeTab === 'pending' ? 'text-white bg-dc-bg-modifier' : 'text-dc-text-muted hover:bg-dc-bg-modifier hover:text-dc-text-normal'} px-2 py-0.5 rounded whitespace-nowrap`}>Pending</button>
                         <button onClick={() => setActiveTab('add_friend')} className={`${activeTab === 'add_friend' ? 'text-green-500 bg-transparent' : 'text-white bg-dc-green'} px-2 py-0.5 rounded hover:opacity-80 whitespace-nowrap transition-colors`}>Add Friend</button>
                     </div>
                 </div>
                 
                 {/* Content */}
                 <div className="flex-1 p-4 flex flex-col">
                     {activeTab === 'add_friend' ? (
                         <div className="max-w-2xl w-full">
                             <h2 className="text-white font-bold mb-2 uppercase text-sm">Add Friend</h2>
                             <p className="text-dc-text-muted text-xs mb-4">You can add a friend with their username or display name.</p>
                             <form onSubmit={sendFriendRequest} className="relative">
                                 <input 
                                     className="w-full bg-dc-bg-tertiary p-3 rounded-lg text-white outline-none border border-black focus:border-blue-500 transition-colors placeholder-dc-text-muted/50"
                                     placeholder="You can add a friend with their username."
                                     value={addFriendInput}
                                     onChange={e => setAddFriendInput(e.target.value)}
                                 />
                                 <button type="submit" className="absolute right-2 top-2 bg-dc-brand text-white px-4 py-1 rounded text-sm hover:bg-indigo-600 transition-colors disabled:opacity-50" disabled={!addFriendInput.trim()}>
                                     Send Friend Request
                                 </button>
                             </form>
                             {statusMsg && <p className={`mt-2 text-sm ${statusMsg.includes('sent') ? 'text-green-500' : 'text-red-500'}`}>{statusMsg}</p>}
                         </div>
                     ) : (
                         <div className="flex-1 flex flex-col text-dc-text-muted">
                             {activeTab === 'pending' && (
                                 <div className="w-full">
                                     <h2 className="uppercase text-xs font-bold mb-4">Pending Requests — {friendRequests.filter(r => r.status === 'pending').length}</h2>
                                     {friendRequests.filter(r => r.status === 'pending').map(req => (
                                         <div key={req.id} className="flex justify-between items-center p-3 hover:bg-dc-bg-modifier rounded mb-2 border-t border-dc-bg-modifier/50 group">
                                             <div className="flex items-center">
                                                 <div className="w-8 h-8 rounded-full bg-dc-brand flex items-center justify-center text-white mr-3 text-sm">
                                                     {req.from === user?.username ? req.to[0] : req.from[0]}
                                                 </div>
                                                 <div>
                                                     <div className="text-white font-bold">{req.from === user?.username ? req.to : req.from}</div>
                                                     <div className="text-xs opacity-70">{req.from === user?.username ? 'Outgoing Friend Request' : 'Incoming Friend Request'}</div>
                                                 </div>
                                             </div>
                                             {req.from !== user?.username && (
                                                <div className="flex space-x-2">
                                                    <button onClick={() => handleRequest(req.id, 'accepted')} className="w-8 h-8 rounded-full bg-dc-bg-tertiary hover:bg-green-500 text-white flex items-center justify-center transition-colors">✓</button>
                                                    <button onClick={() => req.id && handleRequest(req.id, 'declined')} className="w-8 h-8 rounded-full bg-dc-bg-tertiary hover:bg-red-500 text-white flex items-center justify-center transition-colors">×</button>
                                                </div>
                                             )}
                                         </div>
                                     ))}
                                 </div>
                             )}
                             
                             {(activeTab === 'all' || activeTab === 'online') && (
                                 <div className="w-full">
                                      <h2 className="uppercase text-xs font-bold mb-4">Friends — {friends.length}</h2>
                                      {friends.map(f => (
                                          <div key={f.username} className="flex justify-between items-center p-3 hover:bg-dc-bg-modifier rounded mb-2 border-t border-dc-bg-modifier/50 group cursor-pointer" onClick={() => startDM(f.username)}>
                                              <div className="flex items-center">
                                                  <div className="w-8 h-8 rounded-full bg-dc-brand flex items-center justify-center text-white mr-3 text-sm">
                                                      {f.displayName?.[0] || f.username[0]}
                                                  </div>
                                                  <div>
                                                      <div className="text-white font-bold">{f.displayName}</div>
                                                      <div className="text-xs opacity-70">@{f.username}</div>
                                                  </div>
                                              </div>
                                              <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                   <button className="w-8 h-8 rounded-full bg-dc-bg-tertiary hover:bg-dc-text-normal text-dc-text-muted flex items-center justify-center transition-colors" title="Message" onClick={(e) => { e.stopPropagation(); startDM(f.username); }}>💬</button>
                                                   <button className="w-8 h-8 rounded-full bg-dc-bg-tertiary hover:bg-dc-text-normal text-dc-text-muted flex items-center justify-center transition-colors" title="Voice Call" onClick={(e) => { e.stopPropagation(); startDM(f.username); }}>📞</button>
                                                   <button className="w-8 h-8 rounded-full bg-dc-bg-tertiary hover:bg-dc-text-normal text-dc-text-muted flex items-center justify-center transition-colors" title="More">⋮</button>
                                              </div>
                                          </div>
                                      ))}
                                      {friends.length === 0 && (
                                          <div className="text-center mt-10">
                                              <div className="w-40 h-40 bg-dc-bg-secondary rounded-full mx-auto flex items-center justify-center text-4xl grayscale opacity-50 mb-6">
                                                  👾
                                              </div>
                                              <p className="text-dc-text-muted">Wumpus is waiting for friends. Add some!</p>
                                          </div>
                                      )}
                                 </div>
                             )}
                         </div>
                     )}
                 </div>
            </div>
        </div>
    )
}
