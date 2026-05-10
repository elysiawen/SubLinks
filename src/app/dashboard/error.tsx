'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clearSession } from '@/lib/actions';

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const router = useRouter();

    useEffect(() => {
        console.error('[Dashboard Error Boundary]', error.message);

        const isAuthError = [
            'SESSION_EXPIRED',
            'unauthorized',
            'Unauthorized',
            'notLoggedIn',
        ].some(e => error.message.includes(e));

        if (isAuthError) {
            clearSession()
                .catch(() => {})
                .finally(() => {
                    window.location.href = '/auth/login?revoked=1';
                });
            return;
        }
    }, [error, router]);

    return (
        <div className="flex items-center justify-center min-h-[60vh] p-6">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-500/15 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-xl font-semibold text-text-primary mb-2">Something went wrong</h3>
                    <p className="text-text-secondary text-sm">An unexpected error occurred. Please try again.</p>
                </div>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={() => reset()}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-sm"
                    >
                        Try Again
                    </button>
                    <button
                        onClick={() => window.location.href = '/auth/login'}
                        className="px-6 py-2.5 bg-card text-text-secondary border border-border-strong rounded-xl hover:bg-muted transition-colors font-medium"
                    >
                        Re-login
                    </button>
                </div>
            </div>
        </div>
    );
}
