'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { SubmitButton } from '@/components/SubmitButton';
import { getClientBaseUrl } from '@/lib/utils';
import type { OAuthProvider } from '@/lib/database/interface';

interface Props {
    allowAutoCreate: boolean;
}

function getProviderIcon(type: string) {
    if (type === 'google') {
        return (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
        );
    }
    if (type === 'github') {
        return (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
        );
    }
    return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 7h3a5 5 0 010 10h-3m-6 0H6a5 5 0 010-10h3"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
    );
}

function getProviderBg(type: string) {
    if (type === 'google') return 'bg-white border border-gray-200 dark:border-gray-600';
    if (type === 'github') return 'bg-gray-900 dark:bg-gray-700';
    return 'bg-muted border border-border';
}

export default function OAuthSettingsPanel({ allowAutoCreate }: Props) {
    const t = useTranslations('admin.settingsPanels.oauth');
    const { success, error } = useToast();
    const { confirm } = useConfirm();

    const [providers, setProviders] = useState<OAuthProvider[]>([]);
    const [editing, setEditing] = useState<Partial<OAuthProvider> | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [autoCreate, setAutoCreate] = useState(allowAutoCreate);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

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
        const { saveOAuthProvider } = await import('../actions');
        const result = await saveOAuthProvider(editing.id || null, {
            name: editing.name || '', type: editing.type || 'custom', icon: editing.icon,
            clientId: editing.clientId, clientSecret: editing.clientSecret,
            authorizationUrl: editing.authorizationUrl, tokenUrl: editing.tokenUrl, userInfoUrl: editing.userInfoUrl,
            scope: editing.scope, enabled: editing.enabled ?? true
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

    const handleToggleAutoCreate = async () => {
        const v = !autoCreate; setAutoCreate(v);
        const { updateOAuthAllowAutoCreate } = await import('../actions');
        await updateOAuthAllowAutoCreate(v); success(t('saved'));
    };

    const handleToggleEnabled = async (p: OAuthProvider) => {
        const { saveOAuthProvider } = await import('../actions');
        await saveOAuthProvider(p.id, { name: p.name, type: p.type, icon: p.icon, clientId: p.clientId, clientSecret: p.clientSecret, authorizationUrl: p.authorizationUrl, tokenUrl: p.tokenUrl, userInfoUrl: p.userInfoUrl, scope: p.scope, enabled: !p.enabled });
        loadProviders();
    };

    const startAdd = () => { setEditing({ type: 'custom', name: '', scope: '', enabled: true } as Partial<OAuthProvider>); setIsAdding(true); };

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

            {/* Auto-create */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg mb-4">
                <div className="min-w-0 mr-3">
                    <p className="text-sm font-medium text-text-primary">{t('allowAutoCreate')}</p>
                    <p className="text-xs text-text-tertiary">{t('allowAutoCreateDesc')}</p>
                </div>
                <button onClick={handleToggleAutoCreate} className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoCreate ? 'bg-accent-button' : 'bg-border-strong'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoCreate ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

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
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${getProviderBg(p.type)}`}>
                                {getProviderIcon(p.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-text-primary truncate">{p.name}</p>
                                <p className="text-xs text-text-tertiary">{p.enabled ? t('enabled') : t('disabled')}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => handleToggleEnabled(p)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${p.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${p.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                                </button>
                                <button onClick={() => { setEditing(p); setIsAdding(false); }} className="p-2 text-text-tertiary hover:text-text-primary rounded-md hover:bg-muted transition-colors">
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
                            <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${getProviderBg(editing.type || 'custom')}`}>
                                {getProviderIcon(editing.type || 'custom')}
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
