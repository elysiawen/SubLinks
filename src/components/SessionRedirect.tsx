'use client';

import { useEffect } from 'react';

export default function SessionRedirect() {
    useEffect(() => {
        window.location.href = '/auth/logout';
    }, []);

    return null;
}
