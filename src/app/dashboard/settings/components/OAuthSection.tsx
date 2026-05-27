'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';

interface ProviderInfo {
    id: string;
    name: string;
    type: string;
    icon?: string;
    bound: boolean;
}

interface BindingInfo {
    id: string;
    providerId: string;
    providerName: string;
    providerType: string;
    providerIcon?: string;
    providerUsername?: string;
    providerAvatar?: string;
    createdAt: number;
}

function GoogleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
    );
}

function GitHubIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
    );
}

function LinkIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 7h3a5 5 0 010 10h-3m-6 0H6a5 5 0 010-10h3"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
    );
}

function getProviderIcon(type: string, className = 'w-5 h-5') {
    switch (type) {
        case 'google': return <GoogleIcon className={className} />;
        case 'github': return <GitHubIcon className={className} />;
        default: return <LinkIcon className={className} />;
    }
}

function getProviderBg(type: string) {
    switch (type) {
        case 'google': return 'bg-white border border-gray-200 dark:border-gray-600';
        case 'github': return 'bg-gray-900 dark:bg-gray-700';
        default: return 'bg-muted border border-border';
    }
}

export default function OAuthSection() {
    const t = useTranslations('dashboard.settings.oauth');
    const { success, error } = useToast();
    const { confirm } = useConfirm();

    const [bindings, setBindings] = useState<BindingInfo[]>([]);
    const [available, setAvailable] = useState<ProviderInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [bindingProvider, setBindingProvider] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const boundToastShown = useRef(false);

    useEffect(() => {
        loadData();

        if (!boundToastShown.current && searchParams.get('bound') === '1') {
            boundToastShown.current = true;
            success(t('bindSuccess'));
            const url = new URL(window.location.href);
            url.searchParams.delete('bound');
            window.history.replaceState({}, '', url.pathname + url.search);
        }
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const { getUserOAuthBindings, getAvailableOAuthProviders } = await import('@/lib/oauth-actions');
            const [bindingsResult, availableResult] = await Promise.all([
                getUserOAuthBindings(),
                getAvailableOAuthProviders()
            ]);

            if (bindingsResult.bindings) setBindings(bindingsResult.bindings as BindingInfo[]);
            if (availableResult.providers) setAvailable(availableResult.providers);
        } catch (err) {
            console.error('Failed to load OAuth data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleBind = async (providerId: string) => {
        setBindingProvider(providerId);
        try {
            const { getOAuthAuthorizeUrl } = await import('@/lib/oauth-actions');
            const result = await getOAuthAuthorizeUrl(providerId, true);
            if (result.error) {
                error(result.error);
                setBindingProvider(null);
                return;
            }
            if (result.url) {
                window.location.href = result.url;
            }
        } catch {
            error(t('bindFailed'));
            setBindingProvider(null);
        }
    };

    const handleUnbind = async (bindingId: string, providerName: string) => {
        if (!await confirm(t('confirmUnbind', { provider: providerName }), { confirmColor: 'red' })) return;

        const { unbindOAuth } = await import('@/lib/oauth-actions');
        const result = await unbindOAuth(bindingId);
        if (result.error) {
            error(result.error);
        } else {
            success(t('unbindSuccess'));
            loadData();
        }
    };

    const unboundProviders = available.filter(p => !p.bound);
    const hasContent = bindings.length > 0 || unboundProviders.length > 0;

    if (loading) {
        return (
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-border">
                    <h2 className="text-lg font-bold text-text-primary">{t('title')}</h2>
                    <p className="text-sm text-text-tertiary mt-1">{t('description')}</p>
                </div>
                <div className="p-4 sm:p-6">
                    <div className="animate-pulse space-y-3">
                        <div className="h-16 bg-muted rounded-lg"></div>
                        <div className="h-16 bg-muted rounded-lg"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-border">
                <h2 className="text-lg font-bold text-text-primary">{t('title')}</h2>
                <p className="text-sm text-text-tertiary mt-1">{t('description')}</p>
            </div>
            <div className="p-4 sm:p-6 space-y-6">
                {/* Bound accounts */}
                {bindings.length > 0 && (
                    <div className="space-y-2">
                        {bindings.map(binding => (
                            <div
                                key={binding.id}
                                className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:border-border-strong transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    {binding.providerAvatar ? (
                                        <img src={binding.providerAvatar} alt="" className="w-10 h-10 rounded-full" />
                                    ) : (
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getProviderBg(binding.providerType)}`}>
                                            {getProviderIcon(binding.providerType, 'w-5 h-5')}
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-sm font-medium text-text-primary">{binding.providerName}</p>
                                        {binding.providerUsername && (
                                            <p className="text-xs text-text-tertiary mt-0.5">@{binding.providerUsername}</p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleUnbind(binding.id, binding.providerName)}
                                    className="opacity-0 group-hover:opacity-100 text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                >
                                    {t('unbind')}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Available providers to bind */}
                {unboundProviders.length > 0 && (
                    <div>
                        {bindings.length > 0 && (
                            <p className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">{t('availableProviders')}</p>
                        )}
                        <div className="space-y-2">
                            {unboundProviders.map(provider => (
                                <button
                                    key={provider.id}
                                    onClick={() => handleBind(provider.id)}
                                    disabled={bindingProvider !== null}
                                    className="w-full flex items-center justify-between p-4 rounded-lg border border-dashed border-border hover:border-solid hover:border-border-strong hover:bg-muted/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getProviderBg(provider.type)}`}>
                                            {getProviderIcon(provider.type, 'w-5 h-5')}
                                        </div>
                                        <span className="text-sm font-medium text-text-primary">
                                            {t('bindProvider', { provider: provider.name })}
                                        </span>
                                    </div>
                                    {bindingProvider === provider.id ? (
                                        <svg className="animate-spin h-4 w-4 text-text-tertiary" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4 text-text-tertiary group-hover:text-text-secondary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                        </svg>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!hasContent && (
                    <div className="text-center py-8">
                        <svg className="w-10 h-10 text-text-tertiary/30 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7h3a5 5 0 010 10h-3m-6 0H6a5 5 0 010-10h3"/>
                            <line x1="8" y1="12" x2="16" y2="12"/>
                        </svg>
                        <p className="text-sm text-text-tertiary">{t('noProvidersAvailable')}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
