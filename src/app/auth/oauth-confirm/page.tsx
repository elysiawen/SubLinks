'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ToastProvider';
import { getOAuthTempData, confirmOAuthCreateAccount } from './actions';

function OAuthConfirmContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const t = useTranslations('auth.oauthConfirm');
    const { success, error } = useToast();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [tempData, setTempData] = useState<{
        providerUsername?: string;
        providerAvatar?: string;
    } | null>(null);
    const [username, setUsername] = useState('');

    useEffect(() => {
        if (!token) {
            router.replace('/auth/login');
            return;
        }
        getOAuthTempData(token).then(data => {
            if (!data) {
                error(t('expired'));
                router.replace('/auth/login');
                return;
            }
            setTempData(data);
            setUsername(data.providerUsername || '');
            setLoading(false);
        });
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || !username.trim()) return;

        setSubmitting(true);
        const result = await confirmOAuthCreateAccount(token, username.trim());
        setSubmitting(false);

        if (result.error) {
            error(result.error);
        } else {
            success(t('accountCreated'));
            router.push('/dashboard');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-button"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="w-full max-w-md">
                <div className="bg-card rounded-2xl shadow-lg border border-border p-8">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
                        <p className="text-sm text-text-tertiary mt-2">{t('description')}</p>
                    </div>

                    {tempData?.providerAvatar && (
                        <div className="flex justify-center mb-4">
                            <img
                                src={tempData.providerAvatar}
                                alt="Avatar"
                                className="w-16 h-16 rounded-full border-2 border-border"
                            />
                        </div>
                    )}

                    {tempData?.providerUsername && (
                        <div className="text-center mb-4">
                            <span className="text-sm text-text-secondary">
                                {t('linkedAccount')}: <strong>{tempData.providerUsername}</strong>
                            </span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-text-secondary mb-2">
                                {t('chooseUsername')}
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full border border-border-input rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder={t('usernamePlaceholder')}
                                required
                                minLength={2}
                                maxLength={32}
                                pattern="[a-zA-Z0-9_-]+"
                                autoFocus
                            />
                            <p className="text-xs text-text-tertiary mt-1">{t('usernameHint')}</p>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting || !username.trim()}
                            className="w-full bg-accent-button text-white py-3 rounded-xl font-medium hover:bg-accent-button-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    {t('creating')}
                                </>
                            ) : t('createAccount')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function OAuthConfirmPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-button"></div>
            </div>
        }>
            <OAuthConfirmContent />
        </Suspense>
    );
}
