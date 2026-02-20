import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { refreshSingleUpstreamSource, refreshUpstreamCache } from '@/lib/analysis';

export const runtime = 'nodejs'; // Use nodejs runtime for streaming if needed, though edge is also fine. Nodejs is safer for DB ops.

export async function GET(req: NextRequest) {
    // Authenticate
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sourceName = searchParams.get('name'); // If present, refresh single source. Else refresh all.

    // Create a streaming response
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
                const data = JSON.stringify({ message: msg, type });
                controller.enqueue(encoder.encode(data + '\n'));
            };

            try {
                if (sourceName) {
                    // Refresh single
                    // getting URL is handled inside the caller or we look it up?
                    // refreshSingleUpstreamSource expects URL. We need to find the source first.
                    // But wait, refreshSingleUpstreamSource is exported from analysis.ts.
                    // Let's import db to look up the source.
                    // Actually, let's dynamic import db to allow "runtime: nodejs" properly if needed?
                    // No, static import is fine unless specialized.

                    // We need to fetch the source to get its URL
                    const { db } = await import('@/lib/db');
                    const source = await db.getUpstreamSource(sourceName);

                    if (!source) {
                        send(`Source "${sourceName}" not found`, 'error');
                        controller.close();
                        return;
                    }
                    if (source.type === 'static' || !source.url) {
                        send(`Source "${sourceName}" is a static source and cannot be refreshed via URL`, 'error');
                        controller.close();
                        return;
                    }

                    await refreshSingleUpstreamSource(source.name, source.url, send, {
                        reason: 'Manual Admin Refresh',
                        trigger: 'manual'
                    });
                } else {
                    // Refresh all
                    await refreshUpstreamCache(send, {
                        reason: 'Manual Admin Refresh (All)',
                        trigger: 'manual'
                    });
                }

                send('Refresh process completed.', 'success');
            } catch (error) {
                console.error('Stream refresh error:', error);
                send(`Error: ${String(error)}`, 'error');
            } finally {
                controller.close();
            }
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
