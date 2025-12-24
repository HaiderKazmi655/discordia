import { redirect } from 'next/navigation';
import { LocalChannelRedirect } from '@/components/util/LocalChannelRedirect';

export const dynamic = 'force-dynamic';

export default async function ServerPage({ params }: { params: { server: string } }) {
    const { server } = params;
    
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) throw new Error('no-supabase-env');
        const { supabase } = await import('@/lib/supabase');
        const { data: channels, error } = await supabase
            .from('channels')
            .select('id')
            .eq('server_id', server)
            .order('created_at', { ascending: true })
            .limit(1);

        if (channels && channels.length > 0 && !error) {
            redirect(`/channels/${server}/${channels[0].id}`);
        }
    } catch {}

    return (
        <div className="flex-1 bg-dc-bg-primary flex items-center justify-center text-dc-text-muted">
            <LocalChannelRedirect serverId={server} />
            <div className="text-center">
                <p>No channels found.</p>
                <p className="text-sm">Create one from the sidebar!</p>
            </div>
        </div>
    );
}
