import { NextRequest, NextResponse } from 'next/server';

const FETCH_TIMEOUT = 5000;
const USER_AGENT = 'Mozilla/5.0 (compatible; SubLinks/1.0)';

function isValidDomain(domain: string): boolean {
    if (domain.length > 253 || domain.length < 1) return false;
    // Reject IP addresses
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) return false;
    // Reject localhost and internal hostnames
    if (domain === 'localhost' || domain.endsWith('.local') || domain.endsWith('.internal')) return false;
    // Must look like a domain
    return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(domain);
}

async function tryFetchFavicon(url: string): Promise<Response | null> {
    try {
        const res = await fetch(url, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT),
            headers: { 'User-Agent': USER_AGENT },
            redirect: 'follow',
        });
        if (res.ok) {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.startsWith('image/') || url.endsWith('.ico')) {
                return res;
            }
        }
    } catch {
        // ignore
    }
    return null;
}

export async function GET(request: NextRequest) {
    const domain = request.nextUrl.searchParams.get('domain');

    if (!domain || !isValidDomain(domain)) {
        return new NextResponse(null, { status: 404 });
    }

    // Try direct favicon.ico
    const direct = await tryFetchFavicon(`https://${domain}/favicon.ico`);
    if (direct) {
        const buffer = await direct.arrayBuffer();
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': direct.headers.get('content-type') || 'image/x-icon',
                'Cache-Control': 'public, max-age=86400',
            },
        });
    }

    // Fallback: Google favicon service
    const google = await tryFetchFavicon(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`);
    if (google) {
        const buffer = await google.arrayBuffer();
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': google.headers.get('content-type') || 'image/png',
                'Cache-Control': 'public, max-age=86400',
            },
        });
    }

    return new NextResponse(null, { status: 404 });
}
