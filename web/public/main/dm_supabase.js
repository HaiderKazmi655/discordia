(function(){
  async function ensureClient(){
    const client = await (window.initSupabase ? window.initSupabase() : null);
    return client || null;
  }
  function pair(a,b){ const [x,y] = [a,b].sort(); return { a:x, b:y }; }
  async function remoteLoadDM(a,b){ const c = await ensureClient(); if(!c) return null; const p = pair(a,b); const { data, error } = await c.from('dms').select('*').or(`and(pair_a.eq.${p.a},pair_b.eq.${p.b}),and(pair_a.eq.${p.b},pair_b.eq.${p.a})`).order('time', { ascending: true }); if(error) return []; return (data||[]).map(r=>({ user: r.user, text: r.text, time: r.time })); }
  async function remoteSendDM(a,b,msg){ const c = await ensureClient(); if(!c) return false; const p = pair(a,b); const row = { pair_a: p.a, pair_b: p.b, user: msg.user, text: msg.text, time: msg.time }; const { error } = await c.from('dms').insert(row); return !error; }
  window.remoteLoadDM = remoteLoadDM;
  window.remoteSendDM = remoteSendDM;
})();

