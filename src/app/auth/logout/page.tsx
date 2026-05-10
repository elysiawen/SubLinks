'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { clearSession } from '@/lib/actions';

export default function LogoutPage() {
    const t = useTranslations('auth.logout');
    const [cleared, setCleared] = useState(false);
    const [loginUrl, setLoginUrl] = useState('/auth/login');

    useEffect(() => {
        clearSession().then(() => setCleared(true));
        const params = new URLSearchParams(window.location.search);
        const callbackUrl = params.get('callbackUrl');
        if (callbackUrl && callbackUrl.startsWith('/')) {
            setLoginUrl(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
        }
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 py-12 px-4 relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 dark:opacity-10 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-200 dark:opacity-10 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-indigo-200 dark:opacity-10 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

            <div className="absolute top-4 right-4 z-20">
                <LanguageSwitcher dropDown align="right" />
            </div>

            <div className="max-w-md w-full relative z-10">
                <div className="text-center mb-8">
                    <h2 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">
                        SubLinks
                    </h2>
                </div>

                <div className="bg-card/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 text-center">
                    <div className="mb-6">
                        <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-500/15 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    </div>

                    <h3 className="text-xl font-semibold text-text-primary mb-2">
                        {t('title')}
                    </h3>
                    <p className="text-text-secondary mb-8">
                        {cleared ? t('message') : t('loggingOut')}
                    </p>

                    <Link
                        href={loginUrl}
                        className="inline-block w-full py-3 bg-accent-foreground text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-lg shadow-blue-500/30"
                    >
                        {t('backToLogin')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
