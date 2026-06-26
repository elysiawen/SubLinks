'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { SubmitButton } from '@/components/SubmitButton';
import ProviderIcon from '@/components/ProviderIcon';
import { getClientBaseUrl } from '@/lib/utils';
import { parseIconConfig } from '@/lib/oauth-icon';
import type { OAuthProvider } from '@/lib/database/interface';

interface Props {
    allowAutoCreate?: boolean; // deprecated, kept for backward compat
}

function IconPreview({ type, icon, authorizationUrl, size = 'w-9 h-9' }: { type: string; icon?: string; authorizationUrl?: string; size?: string }) {
    return (
        <div className={`${size} rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${getProviderBg(type)}`}>
            <ProviderIcon type={type} icon={icon} authorizationUrl={authorizationUrl} className="w-5 h-5" />
        </div>
    );
}

function getProviderBg(type: string) {
    if (type === 'google') return 'bg-white border border-gray-200 dark:border-gray-600';
    if (type === 'github') return 'bg-gray-900 text-white dark:bg-gray-700';
    return 'bg-muted border border-border';
}

export default function OAuthSettingsPanel({ allowAutoCreate }: Props) {
    const t = useTranslations('admin.settingsPanels.oauth');
    const { success, error } = useToast();
    const { confirm } = useConfirm();

    const [providers, setProviders] = useState<OAuthProvider[]>([]);
    const [editing, setEditing] = useState<Partial<OAuthProvider> | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [iconMode, setIconMode] = useState<'default' | 'auto' | 'custom'>('default');
    const [iconUrl, setIconUrl] = useState('');

    useEffect(() => { loadProviders(); }, []);

    const loadProviders = async () => {
        const { getAllOAuthProviders } = await import('@/lib/oauth-actions');
        setProviders(await getAllOAuthProviders());
    };

    const handleSave = async () => {
        if (!editing) return;
        if (!editing.clientId || !editing.clientSecret) { error(t('clientIdSecretRequired')); return; }
        if (editing.type === 'custom' && (!editing.authorizationUrl || !editing.tokenUrl || !editing.userInfoUrl)) { error(t('customUrlsRequired')); return; }

        setSaving(true);
        const iconConfig = iconMode === 'default' ? { mode: 'default' as const }
            : iconMode === 'auto' ? { mode: 'auto' as const }
            : { mode: 'custom' as const, url: iconUrl };
        const { saveOAuthProvider } = await import('../actions');
        const result = await saveOAuthProvider(editing.id || null, {
            name: editing.name || '', type: editing.type || 'custom', icon: JSON.stringify(iconConfig),
            clientId: editing.clientId, clientSecret: editing.clientSecret,
            authorizationUrl: editing.authorizationUrl, tokenUrl: editing.tokenUrl, userInfoUrl: editing.userInfoUrl,
            scope: editing.scope, enabled: editing.enabled ?? true, forceConsent: editing.forceConsent ?? true,
            allowAutoCreate: editing.allowAutoCreate ?? false
        });
        setSaving(false);

        if (result.success) { success(t('saved')); setEditing(null); setIsAdding(false); loadProviders(); }
        else { error(t('saveFailed')); }
    };

    const handleDelete = async (id: string, name: string) => {
        if (await confirm(t('confirmDelete', { name }), { confirmColor: 'red' })) {
            const { deleteOAuthProvider } = await import('../actions');
            await deleteOAuthProvider(id);
            success(t('deleted'));
            loadProviders();
        }
    };

    const handleToggleEnabled = async (p: OAuthProvider) => {
        const { saveOAuthProvider } = await import('../actions');
        await saveOAuthProvider(p.id, { name: p.name, type: p.type, icon: p.icon, clientId: p.clientId, clientSecret: p.clientSecret, authorizationUrl: p.authorizationUrl, tokenUrl: p.tokenUrl, userInfoUrl: p.userInfoUrl, scope: p.scope, enabled: !p.enabled, forceConsent: p.forceConsent, allowAutoCreate: p.allowAutoCreate });
        loadProviders();
    };

    const startAdd = () => { setEditing({ type: 'custom', name: '', scope: '', enabled: true, forceConsent: true, allowAutoCreate: false } as Partial<OAuthProvider>); setIsAdding(true); setIconMode('default'); setIconUrl(''); };

    const startEdit = (p: OAuthProvider) => {
        setEditing(p); setIsAdding(false);
        const config = parseIconConfig(p.icon);
        setIconMode(config.mode);
        setIconUrl(config.url || '');
    };

    const handleTypeChange = (newType: string) => {
        if (!editing) return;
        const tpl: Record<string, { name: string; scope: string }> = { google: { name: 'Google', scope: 'openid email profile' }, github: { name: 'GitHub', scope: 'read:user user:email' }, custom: { name: '', scope: '' } };
        const t2 = tpl[newType] || tpl.custom;
        setEditing({ ...editing, type: newType as any, name: isAdding ? t2.name : editing.name, scope: isAdding ? t2.scope : editing.scope });
    };

    const callbackUrl = `${getClientBaseUrl()}/api/oauth/callback`;

    return (
        <div className="bg-card rounded-xl shadow-sm border border-border p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">🔐 {t('heading')}</h3>

            {/* Callback URL */}
            <div className="mb-4">
                <p className="text-sm font-medium text-text-secondary mb-2">{t('callbackUrl')}</p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 overflow-hidden min-w-0">
                        <p className="text-sm text-text-primary break-all sm:truncate">{callbackUrl}</p>
                    </div>
                    <button
                        onClick={async () => { await navigator.clipboard.writeText(callbackUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                        className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary hover:bg-muted transition-colors"
                    >
                        {copied ? (
                            <>
                                <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                {t('copied')}
                            </>
                        ) : (
                            <>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                {t('copy')}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Provider list */}
            <div className="mb-4">
                <p className="text-sm font-medium text-text-secondary mb-2">{t('providerList')}</p>
                {providers.length === 0 && !editing && (
                    <p className="text-sm text-text-tertiary py-4 text-center">{t('noProviders')}</p>
                )}
                <div className="space-y-2">
                    {providers.map(p => (
                        <div key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border ${p.enabled ? 'bg-card border-border' : 'bg-muted/30 border-border/50 opacity-70'}`}>
                            <IconPreview type={p.type} icon={p.icon} authorizationUrl={p.authorizationUrl} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-text-primary truncate">{p.name}</p>
                                <div className="flex items-center gap-1.5">
                                    <p className="text-xs text-text-tertiary">{p.enabled ? t('enabled') : t('disabled')}</p>
                                    {p.allowAutoCreate && (
                                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400">Auto</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => handleToggleEnabled(p)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${p.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${p.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                                </button>
                                <button onClick={() => startEdit(p)} className="p-2 text-text-tertiary hover:text-text-primary rounded-md hover:bg-muted transition-colors">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                </button>
                                <button onClick={() => handleDelete(p.id, p.name)} className="p-2 text-text-tertiary hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add button */}
            {!editing && (
                <button onClick={startAdd} className="w-full py-2.5 rounded-lg border border-dashed border-border text-sm text-text-secondary hover:bg-muted/50 transition-colors">
                    + {t('addProvider')}
                </button>
            )}

            {/* Edit form */}
            {editing && (
                <div className="border border-border rounded-lg mt-4">
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 overflow-hidden ${getProviderBg(editing.type || 'custom')}`}>
                                <ProviderIcon type={editing.type || 'custom'} icon={editing.icon} authorizationUrl={editing.authorizationUrl} className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-semibold text-text-primary truncate">{isAdding ? t('addProvider') : t('editProvider')}</span>
                        </div>
                        <button onClick={() => { setEditing(null); setIsAdding(false); }} className="p-1 text-text-tertiary hover:text-text-primary shrink-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>

                    <div className="p-4 space-y-3">
                        <div>
                            <label className="block text-sm text-text-secondary mb-1">{t('name')}</label>
                            <input type="text" value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} className="w-full border border-border-input rounded px-3 py-2 text-sm bg-card text-text-primary" placeholder="Google" />
                        </div>
                        <div>
                            <label className="block text-sm text-text-secondary mb-1">{t('type')}</label>
                            <select value={editing.type || 'custom'} onChange={e => handleTypeChange(e.target.value)} disabled={!isAdding} className="w-full border border-border-input rounded px-3 py-2 text-sm bg-card text-text-primary disabled:opacity-50">
                                <option value="google">Google</option>
                                <option value="github">GitHub</option>
                                <option value="custom">{t('customType')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-text-secondary mb-1">{t('iconMode')}</label>
                            <div className="flex items-center gap-4 mb-2">
                                {(['default', 'auto', 'custom'] as const).map(mode => (
                                    <label key={mode} className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="iconMode"
                                            value={mode}
                                            checked={iconMode === mode}
                                            onChange={() => setIconMode(mode)}
                                            className="accent-accent-button"
                                        />
                                        <span className="text-sm text-text-secondary">{t(`iconMode${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}</span>
                                    </label>
                                ))}
                            </div>
                            {iconMode === 'auto' && (
                                <p className="text-xs text-text-tertiary">{t('iconAutoHint')}</p>
                            )}
                            {iconMode === 'custom' && (
                                <input
                                    type="text"
                                    value={iconUrl}
                                    onChange={e => setIconUrl(e.target.value)}
                                    className="w-full border border-border-input rounded px-3 py-2 text-sm bg-card text-text-primary"
                                    placeholder={t('iconUrlPlaceholder')}
                                />
                            )}
                            {iconMode !== 'default' && (
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs text-text-tertiary">{t('iconPreview')}:</span>
                                    <IconPreview
                                        type={editing.type || 'custom'}
                                        icon={JSON.stringify(iconMode === 'auto' ? { mode: 'auto' } : { mode: 'custom', url: iconUrl })}
                                        authorizationUrl={editing.authorizationUrl}
                                        size="w-7 h-7"
                                    />
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm text-text-secondary mb-1">Client ID</label>
                            <input type="text" value={editing.clientId || ''} onChange={e => setEditing({ ...editing, clientId: e.target.value })} className="w-full border border-border-input rounded px-3 py-2 text-sm bg-card text-text-primary" />
                        </div>
                        <div>
                            <label className="block text-sm text-text-secondary mb-1">Client Secret</label>
                            <input type="password" value={editing.clientSecret || ''} onChange={e => setEditing({ ...editing, clientSecret: e.target.value })} className="w-full border border-border-input rounded px-3 py-2 text-sm bg-card text-text-primary" />
                        </div>
                        <div>
                            <label className="block text-sm text-text-secondary mb-1">{t('scope')}</label>
                            <input type="text" value={editing.scope || ''} onChange={e => setEditing({ ...editing, scope: e.target.value })} className="w-full border border-border-input rounded px-3 py-2 text-sm bg-card text-text-primary" placeholder="openid email profile" />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="min-w-0 mr-3">
                                <p className="text-sm font-medium text-text-primary">{t('forceConsent')}</p>
                                <p className="text-xs text-text-tertiary">{t('forceConsentDesc')}</p>
                            </div>
                            <button type="button" onClick={() => setEditing({ ...editing, forceConsent: !editing.forceConsent })} className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editing.forceConsent !== false ? 'bg-accent-button' : 'bg-border-strong'}`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editing.forceConsent !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="min-w-0 mr-3">
                                <p className="text-sm font-medium text-text-primary">{t('allowAutoCreate')}</p>
                                <p className="text-xs text-text-tertiary">{t('allowAutoCreateDesc')}</p>
                            </div>
                            <button type="button" onClick={() => setEditing({ ...editing, allowAutoCreate: !editing.allowAutoCreate })} className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editing.allowAutoCreate ? 'bg-accent-button' : 'bg-border-strong'}`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editing.allowAutoCreate ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {editing.type === 'custom' && (
                            <div className="space-y-3 pt-3 border-t border-border">
                                <p className="text-sm font-medium text-text-secondary">{t('customEndpoints')}</p>
                                <div>
                                    <label className="block text-xs text-text-tertiary mb-1">{t('authorizationUrl')}</label>
                                    <input type="text" value={editing.authorizationUrl || ''} onChange={e => setEditing({ ...editing, authorizationUrl: e.target.value })} className="w-full border border-border-input rounded px-3 py-2 text-sm bg-card text-text-primary" />
                                </div>
                                <div>
                                    <label className="block text-xs text-text-tertiary mb-1">{t('tokenUrl')}</label>
                                    <input type="text" value={editing.tokenUrl || ''} onChange={e => setEditing({ ...editing, tokenUrl: e.target.value })} className="w-full border border-border-input rounded px-3 py-2 text-sm bg-card text-text-primary" />
                                </div>
                                <div>
                                    <label className="block text-xs text-text-tertiary mb-1">{t('userInfoUrl')}</label>
                                    <input type="text" value={editing.userInfoUrl || ''} onChange={e => setEditing({ ...editing, userInfoUrl: e.target.value })} className="w-full border border-border-input rounded px-3 py-2 text-sm bg-card text-text-primary" />
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-2">
                            <button onClick={() => { setEditing(null); setIsAdding(false); }} className="flex-1 py-2 rounded text-sm border border-border text-text-secondary hover:bg-muted">{t('cancel')}</button>
                            <SubmitButton onClick={handleSave} isLoading={saving} className="flex-1 py-2 rounded text-sm bg-accent-button text-white">{saving ? t('saving') : t('save')}</SubmitButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
