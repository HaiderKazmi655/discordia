import { redirect } from 'next/navigation';
import { LocalChannelRedirect } from '@/components/util/LocalChannelRedirect';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function ServerPage({ params }: { params: { server: string } }) {
    const { server } = params;
    
    // Server-side: try to redirect to first channel if available
    try {
        const { data, error } = await supabase
            .from('channels')
            .select('id')
            .eq('server_id', server)
            .order('created_at', { ascending: true })
            .limit(1);
        if (!error && data && data.length > 0) {
            redirect(`/channels/${server}/${data[0].id}`);
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
