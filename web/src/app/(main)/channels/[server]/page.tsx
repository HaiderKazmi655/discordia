import { redirect } from 'next/navigation';
import { LocalChannelRedirect } from '@/components/util/LocalChannelRedirect';

export const dynamic = 'force-dynamic';

export default async function ServerPage({ params }: { params: { server: string } }) {
    const { server } = params;
    
    // Server-side: avoid SSR data collection issues. Client will handle redirect.

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
