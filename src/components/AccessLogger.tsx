'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { logWebAccess } from '@/lib/log-actions';

export default function AccessLogger() {
    const pathname = usePathname();

    useEffect(() => {
        // Debounce or just log
        logWebAccess(pathname);
    }, [pathname]);

    return null;
}
