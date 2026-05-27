'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import ProviderIcon from '@/components/ProviderIcon';

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
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden ${getProviderBg(binding.providerType)}`}>
                                            <ProviderIcon type={binding.providerType} icon={binding.providerIcon} className="w-5 h-5" />
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
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden ${getProviderBg(provider.type)}`}>
                                            <ProviderIcon type={provider.type} icon={provider.icon} className="w-5 h-5" />
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
