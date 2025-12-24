(() => {
  const state = { client: null };
  async function fetchEnv(){
    try {
      const res = await fetch('/api/env');
      if(!res.ok) return null;
      const j = await res.json();
      if(j.supabaseUrl && j.supabaseAnonKey) return j;
      return null;
    } catch { return null; }
  }
  async function init(){
    const env = await fetchEnv();
    if(!env) { window.dcSupabase = null; return null; }
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    state.client = createClient(env.supabaseUrl, env.supabaseAnonKey);
    window.dcSupabase = state.client;
    window.dcSupabaseConnected = true;
    return state.client;
  }
  window.initSupabase = init;

  // Users table helpers
  async function supaUsers(){ const c = await init(); if(!c) return null; return c; }
  async function supabaseGetUsers(){ const c = await supaUsers(); if(!c) return null; const { data, error } = await c.from('users').select('username, displayName, passwordHash, salt, avatar, online'); if(error) return null; const map = {}; (data||[]).forEach(u=>{ map[u.username.toLowerCase()] = u; }); return map; }
  async function supabaseUpsertUser(user){ const c = await supaUsers(); if(!c) return false; const payload = { username:user.username, displayName:user.displayName, passwordHash:user.passwordHash, salt:user.salt, avatar:user.avatar||null, online: !!user.online };
    const { error } = await c.from('users').upsert(payload, { onConflict: 'username' }); return !error; }
  async function supabaseFindUser(identifier){ const c = await supaUsers(); if(!c) return null; const v = identifier.trim().toLowerCase(); const { data } = await c.from('users').select('username, displayName, passwordHash, salt, avatar, online').or(`username.ilike.${v},displayName.ilike.${v}`); if(data && data.length>0){
    const exact = data.find(u=>u.username.toLowerCase()===v);
    return exact || data[0];
  }
  return null; }

  // Friend requests helpers
  async function supabaseSendFriendRequest(from, to){ const c = await supaUsers(); if(!c) return { ok:false, reason:'Cloud not connected' }; if(from===to) return { ok:false, reason:'Cannot add yourself' }; const { data:existing } = await c.from('friend_requests').select('id,status').or(`and(from.eq.${from},to.eq.${to}),and(from.eq.${to},to.eq.${from})`).limit(1);
    if(existing && existing.length>0){ const er = existing[0]; if(er.status==='pending') return { ok:false, reason:'Already pending' }; if(er.status==='accepted') return { ok:false, reason:'Already friends' }; }
    const { error } = await c.from('friend_requests').insert({ from, to, status:'pending', created_at: new Date().toISOString() });
    if(error) return { ok:false, reason:'Error sending' };
    return { ok:true };
  }
  async function supabaseGetIncoming(user){ const c = await supaUsers(); if(!c) return []; const { data } = await c.from('friend_requests').select('id,from,to,status').eq('to', user).eq('status','pending'); return data||[]; }
  async function supabaseGetOutgoing(user){ const c = await supaUsers(); if(!c) return []; const { data } = await c.from('friend_requests').select('id,from,to,status').eq('from', user).eq('status','pending'); return data||[]; }
  async function supabaseAcceptRequest(id){ const c = await supaUsers(); if(!c) return false; const { error } = await c.from('friend_requests').update({ status:'accepted' }).eq('id', id); return !error; }
  async function supabaseDeclineRequest(id){ const c = await supaUsers(); if(!c) return false; const { error } = await c.from('friend_requests').update({ status:'declined' }).eq('id', id); return !error; }
  async function supabaseGetFriends(user){ const c = await supaUsers(); if(!c) return []; const { data } = await c.from('friend_requests').select('id,from,to,status').eq('status','accepted').or(`from.eq.${user},to.eq.${user}`); const ids = []; (data||[]).forEach(r=>{ ids.push(r.from===user ? r.to : r.from); }); return ids; }

  window.supabaseGetUsers = supabaseGetUsers;
  window.supabaseUpsertUser = supabaseUpsertUser;
  window.supabaseFindUser = supabaseFindUser;
  window.supabaseSendFriendRequest = supabaseSendFriendRequest;
  window.supabaseGetIncoming = supabaseGetIncoming;
  window.supabaseGetOutgoing = supabaseGetOutgoing;
  window.supabaseAcceptRequest = supabaseAcceptRequest;
  window.supabaseDeclineRequest = supabaseDeclineRequest;
  window.supabaseGetFriends = supabaseGetFriends;

  async function supabaseSubscribeFriendRequests(cb){ const c = await supaUsers(); if(!c) return null; const ch = c.channel('fr_changes').on('postgres_changes', { event:'*', schema:'public', table:'friend_requests' }, () => { if(cb) cb(); }).subscribe(); return ch; }
  async function supabaseSubscribeDMs(cb){ const c = await supaUsers(); if(!c) return null; const ch = c.channel('dm_changes').on('postgres_changes', { event:'*', schema:'public', table:'dms' }, () => { if(cb) cb(); }).subscribe(); return ch; }
  window.supabaseSubscribeFriendRequests = supabaseSubscribeFriendRequests;
  window.supabaseSubscribeDMs = supabaseSubscribeDMs;
})();
