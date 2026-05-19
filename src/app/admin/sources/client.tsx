'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { addUpstreamSource, deleteUpstreamSource, updateUpstreamSource, forceRefreshUpstream, refreshSingleSource, setDefaultUpstreamSource, toggleUpstreamSourceEnabled, addStaticUpstreamSource, appendNodesToStaticSource } from './actions';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import Modal from '@/components/Modal';
import { formatDistanceToNow } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import RefreshApiModal from './RefreshApiModal';
import { SubmitButton } from '@/components/SubmitButton';
import StaticSourceWizard, { StaticSourceWizardContent } from './StaticSourceWizard';
import StaticSourceEditor from './StaticSourceEditor';

interface UpstreamSource {
    name: string;
    type?: 'url' | 'static';
    url?: string;
    cacheDuration?: number;
    enabled?: boolean;
    isDefault?: boolean;
    lastUpdated?: number;
    status?: 'pending' | 'success' | 'failure';
    error?: string;
    traffic?: {
        upload: number;
        download: number;
        total: number;
        expire: number;
    };
}

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function UpstreamSourcesClient({ sources: initialSources, currentApiKey }: { sources: UpstreamSource[], currentApiKey?: string }) {
    const t = useTranslations('admin.sources');
    const locale = useLocale();
    const dateFnsLocale = locale === 'zh' ? zhCN : enUS;
    const router = useRouter();
    const { success, error, info, addToast } = useToast();
    const { confirm } = useConfirm();
    const [sources, setSources] = useState<UpstreamSource[]>(initialSources);
    useEffect(() => { setSources(initialSources); }, [initialSources]);
    const [isAdding, setIsAdding] = useState(false);
    const [editingSource, setEditingSource] = useState<UpstreamSource | null>(null);
    const [loadingSave, setLoadingSave] = useState(false);
    const [loadingSaveAndUpdate, setLoadingSaveAndUpdate] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false); // For refresh/delete operations
    const [showApiModal, setShowApiModal] = useState(false);
    const [editingStaticSource, setEditingStaticSource] = useState<string | null>(null);
    const [showRefreshModal, setShowRefreshModal] = useState(false);
    const [refreshTarget, setRefreshTarget] = useState<string | null>(null); // null = all, string = single source name
    const [refreshAndCache, setRefreshAndCache] = useState(false);

    // Stream Refresh Logic
    const handleStreamRefresh = async (sourceName?: string, shouldCache: boolean = false) => {
        addToast(
            sourceName ? t('refreshingSource', { name: sourceName }) : t('refreshingAll'),
            'info',
            5000
        );
        setLoadingAction(true);

        try {
            const params = sourceName ? `?name=${encodeURIComponent(sourceName)}` : '';
            const res = await fetch(`/api/sources/stream-refresh${params}`, {
                cache: 'no-store'
            });

            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            if (!res.body) throw new Error('ReadableStream not supported');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');

                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        addToast(data.message, data.type, 8000);
                    } catch (e) {
                        console.error('JSON parse error:', e);
                    }
                }
            }

            // If shouldCache, trigger subscription rebuild after refresh
            if (shouldCache) {
                addToast(t('cacheRebuilding'), 'info', 5000);
                try {
                    const rebuildUrl = sourceName
                        ? `/api/subscriptions/stream-rebuild?source=${encodeURIComponent(sourceName)}`
                        : '/api/subscriptions/stream-rebuild?force=true';
                    const rebuildRes = await fetch(rebuildUrl, {
                        cache: 'no-store'
                    });

                    if (rebuildRes.ok && rebuildRes.body) {
                        const rebuildReader = rebuildRes.body.getReader();
                        const rebuildDecoder = new TextDecoder();
                        let rebuildBuffer = '';

                        while (true) {
                            const { done, value } = await rebuildReader.read();
                            if (done) break;

                            rebuildBuffer += rebuildDecoder.decode(value, { stream: true });
                            const lines = rebuildBuffer.split('\n');
                            rebuildBuffer = lines.pop() || '';

                            for (const line of lines) {
                                if (!line.trim()) continue;
                                try {
                                    const data = JSON.parse(line);
                                    addToast(data.message, data.type, 8000);
                                } catch (e) {
                                    console.error('JSON parse error:', e);
                                }
                            }
                        }
                    }
                } catch (cacheErr) {
                    console.error('Subscription cache rebuild error:', cacheErr);
                    addToast(t('cacheRebuildFailed', { error: String(cacheErr) }), 'error', 10000);
                }
            }

            router.refresh();

        } catch (e) {
            console.error('Refresh error:', e);
            addToast(t('refreshFailed', { error: String(e) }), 'error', 10000);
        } finally {
            setLoadingAction(false);
        }
    };

    const openRefreshModal = (sourceName?: string) => {
        setRefreshTarget(sourceName || null);
        setRefreshAndCache(false);
        setShowRefreshModal(true);
    };

    const handleRefreshConfirm = async () => {
        const target = refreshTarget;
        const shouldCache = refreshAndCache;
        setShowRefreshModal(false);
        await handleStreamRefresh(target || undefined, shouldCache);
    };

    // Form state
    const [formName, setFormName] = useState('');
    const [formType, setFormType] = useState<'url' | 'static'>('url');
    const [formUrl, setFormUrl] = useState('');
    const [formStaticContent, setFormStaticContent] = useState('');
    const [formCacheDuration, setFormCacheDuration] = useState<string>('24');
    const [formDurationUnit, setFormDurationUnit] = useState<'hours' | 'minutes'>('hours');
    const [loadingStaticSave, setLoadingStaticSave] = useState(false);

    const resetForm = () => {
        setFormName('');
        setFormType('url');
        setFormUrl('');
        setFormStaticContent('');
        setFormCacheDuration('24');
        setFormDurationUnit('hours');
    };

    const validateForm = () => {
        if (!formName.trim()) {
            error(t('errorNameRequired'));
            return false;
        }
        if (formType === 'url') {
            if (!formUrl.trim()) {
                error(t('errorUrlRequired'));
                return false;
            }
            if (!formUrl.startsWith('http://') && !formUrl.startsWith('https://')) {
                error(t('errorUrlFormat'));
                return false;
            }
        } else {
            if (!formStaticContent.trim()) {
                error(t('errorContentRequired'));
                return false;
            }
        }
        return true;
    };

    const openEditModal = (source: UpstreamSource) => {
        setFormName(source.name);
        setFormType(source.type || 'url');
        setFormUrl(source.url || '');
        setFormStaticContent('');

        // Smart unit detection
        const duration = source.cacheDuration;
        if (duration === 0) {
            setFormCacheDuration('0');
            setFormDurationUnit('hours');
        } else {
            const effectiveDuration = duration || 24;
            if (effectiveDuration < 1 && effectiveDuration > 0) {
                setFormCacheDuration(String(Math.round(effectiveDuration * 60)));
                setFormDurationUnit('minutes');
            } else {
                setFormCacheDuration(String(effectiveDuration));
                setFormDurationUnit('hours');
            }
        }

        setEditingSource(source);
        setIsAdding(false);
    };

    const handleAdd = async (shouldRefresh = false) => {
        if (!validateForm()) return;

        if (sources.some(s => s.name === formName.trim())) {
            error(t('errorNameExists'));
            return;
        }

        if (formType === 'static') {
            // Static source: parse content and save
            setLoadingStaticSave(true);
            try {
                await addStaticUpstreamSource(
                    formName.trim(),
                    formStaticContent.trim(),
                    true // enabled
                );
                setLoadingStaticSave(false);
                resetForm();
                setIsAdding(false);
                success(t('successCreated'));
                router.refresh();
            } catch (e) {
                setLoadingStaticSave(false);
                error(t('addFailed', { error: String(e) }));
            }
            return;
        }

        // URL source: original logic
        if (shouldRefresh) {
            setLoadingSaveAndUpdate(true);
        } else {
            setLoadingSave(true);
        }

        let duration = parseFloat(formCacheDuration);
        if (isNaN(duration) || duration < 0) duration = 24;
        if (formDurationUnit === 'minutes') {
            duration = duration / 60;
        }

        await addUpstreamSource(
            formName.trim(),
            formUrl.trim(),
            duration,
            true, // enabled
            true // skipRefresh (Always skip server-side refresh, let client handle stream refresh)
        );
        const sourceName = formName.trim();

        if (shouldRefresh) {
            success(t('successSaved'));
            await handleStreamRefresh(sourceName);
        } else {
            setLoadingSave(false);
            resetForm();
            setIsAdding(false);
            success(t('successAdded'));
            router.refresh();
        }
    };

    const handleToggleEnabled = async (source: UpstreamSource) => {
        const newStatus = !(source.enabled !== false);
        // Optimistic update
        setSources(prev => prev.map(s =>
            s.name === source.name ? { ...s, enabled: newStatus } : s
        ));

        try {
            await toggleUpstreamSourceEnabled(source.name, newStatus);
            success(t('togglingSource', { action: newStatus ? t('enabled') : t('disabled'), name: source.name }));
        } catch (e) {
            // Revert on error
            setSources(prev => prev.map(s =>
                s.name === source.name ? { ...s, enabled: source.enabled } : s
            ));
            error(t('errorOperation'));
        }
    };

    const handleUpdate = async (shouldRefresh = false) => {
        if (!editingSource) return;
        if (!validateForm()) return;

        if (shouldRefresh) {
            setLoadingSaveAndUpdate(true);
        } else {
            setLoadingSave(true);
        }



        let duration = parseFloat(formCacheDuration);
        if (isNaN(duration) || duration < 0) duration = 24;
        if (formDurationUnit === 'minutes') {
            duration = duration / 60;
        }

        await updateUpstreamSource(
            editingSource.name,
            formName.trim(),
            formUrl.trim(),
            duration,
            true,
            true // skipRefresh (Always skip server-side refresh, let client handle stream refresh)
        );

        const sourceName = formName.trim();

        if (shouldRefresh) {
            // Don't close modal, keep loading
            success(t('successSaved'));
            await handleStreamRefresh(sourceName);
            // handleStreamRefresh will reload page
        } else {
            setLoadingSave(false);
            resetForm();
            setEditingSource(null);
            setIsAdding(false);
            success(t('successUpdated'));
            router.refresh();
        }
    };

    const handleDelete = async (sourceName: string) => {
        if (!await confirm(t('confirmDelete', { name: sourceName }), { confirmColor: 'red', confirmText: t('confirmDeleteText') })) {
            return;
        }

        setLoadingAction(true);
        await deleteUpstreamSource(sourceName);
        setLoadingAction(false);
        success(t('successDeleted'));
        router.refresh();
    };

    const handleForceRefresh = () => {
        openRefreshModal();
    };

    const handleRefreshSingle = (sourceName: string) => {
        openRefreshModal(sourceName);
    };

    const handleSetDefault = async (sourceName: string) => {
        setLoadingAction(true);
        try {
            const result = await setDefaultUpstreamSource(sourceName);
            setLoadingAction(false);

            if (result.success) {
                success(t('successSetDefault', { name: sourceName }));
                router.refresh();
            } else {
                error(t('errorSetDefault'));
            }
        } catch (e) {
            setLoadingAction(false);
            error(t('errorSetDefault'));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                    📡 {t('title')}
                    <span className="text-sm font-normal text-text-tertiary bg-muted px-2 py-1 rounded-full">{sources.length}</span>
                </h2>
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setShowApiModal(true)}
                        className="bg-purple-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium text-xs sm:text-sm"
                    >
                        🔗 <span className="hidden sm:inline">{t('refreshApi')}</span><span className="sm:hidden">API</span>
                    </button>
                    <button
                        onClick={handleForceRefresh}
                        disabled={loadingAction}
                        className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium text-xs sm:text-sm"
                    >
                        🔄 <span className="hidden sm:inline">{t('forceRefresh')}</span>
                    </button>
                    <button
                        onClick={() => {
                            resetForm();
                            setEditingSource(null);
                            setIsAdding(!isAdding);
                        }}
                        className="bg-accent-button text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-accent-button-hover transition-colors font-medium text-xs sm:text-sm"
                    >
                        {isAdding ? t('cancelAdd') : t('addSource')}
                    </button>
                </div>
            </div>

            {/* Add/Edit Form Modal */}
            <Modal
                isOpen={isAdding || !!editingSource}
                onClose={() => {
                    resetForm();
                    setEditingSource(null);
                    setIsAdding(false);
                }}
                title={editingSource ? t('editSource') : t('addNewSource')}
                maxWidth={formType === 'static' && isAdding ? 'max-w-2xl' : 'max-w-lg'}
            >
                {(isAdding || editingSource) && (
                    <div className="space-y-4">
                        {/* Segmented Switcher for Adding */}
                        {isAdding && !editingSource && (
                            <div className="flex justify-center mb-6">
                                <div className="relative flex p-1 bg-muted rounded-xl w-full max-w-sm">
                                    <div
                                        className={`absolute h-full top-0 w-1/2 bg-card rounded-lg shadow-sm transition-all duration-300 ease-out`}
                                        style={{
                                            left: formType === 'url' ? '4px' : '50%',
                                            width: 'calc(50% - 4px)',
                                            height: 'calc(100% - 8px)',
                                            top: '4px'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setFormType('url')}
                                        className={`relative flex-1 py-1.5 text-sm font-semibold transition-colors duration-200 ${formType === 'url' ? 'text-accent-foreground' : 'text-text-tertiary hover:text-text-secondary'}`}
                                    >
                                        🔗 {t('urlSubscription')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormType('static')}
                                        className={`relative flex-1 py-1.5 text-sm font-semibold transition-colors duration-200 ${formType === 'static' ? 'text-accent-foreground' : 'text-text-tertiary hover:text-text-secondary'}`}
                                    >
                                        📋 {t('staticContent')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Common Name field - Only for URL type since Static has its own name step or accepts it */}
                        {(editingSource || (isAdding && formType === 'url')) && (
                            <div>
                                <label className="block text-sm font-semibold text-text-secondary mb-2">{t('sourceName')}</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    className="w-full border border-border-input rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder={t('sourceNamePlaceholder')}
                                    autoFocus
                                />
                            </div>
                        )}

                        {/* Editing a static source: show type badge */}
                        {editingSource && editingSource.type === 'static' && (
                            <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 p-3 rounded-lg">
                                <span>📋</span>
                                <span>{t('staticTypeHint')}</span>
                            </div>
                        )}

                        {/* URL-type fields */}
                        <div className={formType === 'url' ? 'block space-y-4' : 'hidden'}>
                            <div>
                                <label className="block text-sm font-semibold text-text-secondary mb-2">{t('subscriptionUrl')}</label>
                                <input
                                    type="url"
                                    value={formUrl}
                                    onChange={(e) => setFormUrl(e.target.value)}
                                    className="w-full border border-border-input rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="https://..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-text-secondary mb-2">{t('cacheDuration')}</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        value={formCacheDuration}
                                        onChange={(e) => setFormCacheDuration(e.target.value)}
                                        className="flex-1 border border-border-input rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        min="0.1"
                                        step="0.1"
                                    />
                                    <select
                                        value={formDurationUnit}
                                        onChange={(e) => setFormDurationUnit(e.target.value as 'hours' | 'minutes')}
                                        className="border border-border-input rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-card"
                                    >
                                        <option value="hours">{t('hours')}</option>
                                        <option value="minutes">{t('minutes')}</option>
                                    </select>
                                </div>
                                <p className="text-xs text-text-tertiary mt-1">
                                    {t('cacheHint')}
                                    {formCacheDuration !== '0' && (
                                        <span>{t('currentDuration', { value: formCacheDuration, unit: formDurationUnit === 'minutes' ? t('minutes') : t('hours') })}</span>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Static Content Wizard Integrated directly */}
                        <div className={isAdding && !editingSource && formType === 'static' ? 'mt-2 block' : 'hidden'}>
                            <StaticSourceWizardContent
                                initialName={formName}
                                onNameChange={setFormName}
                                existingNames={sources.map(s => s.name)}
                                onSuccess={() => {
                                    setIsAdding(false);
                                    router.refresh();
                                }}
                                onCancel={() => setIsAdding(false)}
                            />
                        </div>

                        {/* Static-type editing: show append textarea */}
                        {formType === 'static' && editingSource && (
                            <div>
                                <label className="block text-sm font-semibold text-text-secondary mb-2">
                                    {t('appendNodes')}
                                </label>
                                <textarea
                                    value={formStaticContent}
                                    onChange={(e) => setFormStaticContent(e.target.value)}
                                    className="w-full border border-border-input rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-sm"
                                    rows={5}
                                    placeholder={t('appendPlaceholder')}
                                />
                            </div>
                        )}

                        {/* Action Buttons - Only for URL type or Editing */}
                        {(editingSource || (isAdding && formType === 'url')) && (
                            <div className="flex gap-2 pt-2">
                                <SubmitButton
                                    onClick={() => editingSource ? handleUpdate(false) : handleAdd(false)}
                                    isLoading={loadingSave}
                                    text={t('save')}
                                    className="flex-1"
                                />
                                <SubmitButton
                                    onClick={() => editingSource ? handleUpdate(true) : handleAdd(true)}
                                    isLoading={loadingSaveAndUpdate}
                                    text={t('saveAndUpdate')}
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                />
                                <button
                                    onClick={() => {
                                        resetForm();
                                        setEditingSource(null);
                                        setIsAdding(false);
                                    }}
                                    className="px-4 py-2 border border-border-input text-text-secondary rounded-lg hover:bg-muted transition-colors font-medium"
                                >
                                    {t('cancelAdd')}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {sources.length === 0 ? (
                <div className="bg-card rounded-xl shadow-sm border border-border p-8 text-center text-text-quaternary">
                    {t('noSources')}
                </div>
            ) : (
                <div className="space-y-4">
                    {sources.map((source, index) => (
                        <div key={index} className="bg-card rounded-xl shadow-sm border border-border-strong p-4 sm:p-6 hover:shadow-md transition-shadow overflow-hidden">
                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                                {/* Left: Source Info */}
                                <div className="flex-1 min-w-0 overflow-hidden">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap min-w-0">
                                        <h3 className="text-lg font-semibold text-text-primary truncate">{source.name}</h3>

                                        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                                            {/* Enabled Toggle */}
                                            <button
                                                onClick={() => handleToggleEnabled(source)}
                                                disabled={loadingAction}
                                                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${source.enabled !== false
                                                    ? 'bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/25'
                                                    : 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/25'
                                                    }`}
                                                title={source.enabled !== false ? t('clickToDisable') : t('clickToEnable')}
                                            >
                                                {source.enabled !== false ? `✅ ${t('enabled')}` : `⛔ ${t('disabled')}`}
                                            </button>

                                            {source.isDefault ? (
                                                <span className="bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap">
                                                    ⭐ {t('default')}
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => handleSetDefault(source.name)}
                                                    disabled={loadingAction}
                                                    className="bg-muted text-text-tertiary hover:bg-yellow-50 hover:text-yellow-600 px-2 py-0.5 rounded text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                                                    title={t('setAsDefault')}
                                                >
                                                    ☆ <span className="hidden sm:inline">{t('setAsDefault')}</span><span className="sm:hidden">⭐</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {source.type === 'static' ? (
                                        <p className="text-xs text-text-quaternary mb-2">📋 {t('staticSource')}</p>
                                    ) : (
                                        <p className="text-xs text-text-quaternary break-all mb-2">{source.url}</p>
                                    )}
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        {source.type !== 'static' && (
                                            <span className={(source.cacheDuration === 0 || Number(source.cacheDuration) === 0) ? "bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 px-2 py-1 rounded" : "bg-accent text-accent-foreground px-2 py-1 rounded"}>
                                                {(source.cacheDuration === 0 || Number(source.cacheDuration) === 0)
                                                    ? `♾️ ${t('neverExpire')}`
                                                    : `🕒 ${(source.cacheDuration ?? 24) < 1
                                                        ? `${Math.round((source.cacheDuration ?? 0) * 60)}m`
                                                        : `${source.cacheDuration ?? 24}h`}`
                                                }
                                            </span>
                                        )}

                                        {source.lastUpdated && (
                                            <span className={`px-2 py-1 rounded flex items-center gap-1 ${source.status === 'failure' ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-muted text-text-secondary'}`}>
                                                {source.status === 'failure' ? '❌' : '✅'}
                                                {formatDistanceToNow(source.lastUpdated, { addSuffix: true, locale: dateFnsLocale })}
                                            </span>
                                        )}
                                        {source.status === 'failure' && source.error && (
                                            <span className="bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 px-2 py-1 rounded" title={source.error}>
                                                ⚠️ {source.error}
                                            </span>
                                        )}
                                    </div>

                                    {source.traffic && (
                                        <div className="mt-3 bg-muted rounded-lg p-3 text-xs border border-border">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-text-tertiary font-medium">{t('trafficUsage')}</span>
                                                <span className="text-accent-foreground font-bold">
                                                    {formatBytes(source.traffic.upload + source.traffic.download)} / {formatBytes(source.traffic.total)}
                                                </span>
                                            </div>
                                            <div className="w-full bg-border-strong rounded-full h-1.5 mb-2 overflow-hidden">
                                                <div
                                                    className="bg-accent-button h-1.5 rounded-full"
                                                    style={{ width: `${Math.min(((source.traffic.upload + source.traffic.download) / source.traffic.total) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-text-tertiary">
                                                <div>
                                                    ↑ {formatBytes(source.traffic.upload)}
                                                    <span className="mx-1">|</span>
                                                    ↓ {formatBytes(source.traffic.download)}
                                                </div>
                                                <div className="text-text-quaternary sm:text-right">
                                                    {source.traffic.expire ? t('expireDate', { date: new Date(source.traffic.expire * 1000).toLocaleDateString() }) : t('noExpire')}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right: Action Buttons */}
                                <div className="flex flex-wrap md:flex-col gap-2 md:w-32 shrink-0">
                                    {source.type !== 'static' && (
                                        <button
                                            onClick={() => handleRefreshSingle(source.name)}
                                            disabled={loadingAction}
                                            className="flex-1 md:w-full bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400 px-3 py-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-500/25 disabled:opacity-50 transition-colors font-medium text-sm"
                                            title={t('refreshTitle')}
                                        >
                                            🔄 <span className="hidden sm:inline">{t('refresh')}</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => source.type === 'static' ? setEditingStaticSource(source.name) : openEditModal(source)}
                                        disabled={loadingAction}
                                        className="flex-1 md:w-full bg-accent text-accent-foreground px-3 py-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/25 disabled:opacity-50 transition-colors font-medium text-sm"
                                    >
                                        ✏️ <span className="hidden sm:inline">{source.type === 'static' ? t('manage') : t('edit')}</span>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(source.name)}
                                        disabled={loadingAction}
                                        className="flex-1 md:w-full bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/25 disabled:opacity-50 transition-colors font-medium text-sm"
                                    >
                                        🗑️ <span className="hidden sm:inline">{t('delete')}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <RefreshApiModal
                isOpen={showApiModal}
                onClose={() => setShowApiModal(false)}
                currentApiKey={currentApiKey}
                sources={sources}
                onSave={async (apiKey) => {
                    const { updateRefreshApiKey } = await import('./actions');
                    return await updateRefreshApiKey(apiKey);
                }}
            />

            {/* Refresh Confirmation Modal */}
            <Modal
                isOpen={showRefreshModal}
                onClose={() => setShowRefreshModal(false)}
                title={refreshTarget ? t('refreshSource', { name: refreshTarget }) : t('refreshAll')}
            >
                <div className="space-y-4">
                    <p className="text-sm text-text-secondary">
                        {refreshTarget
                            ? t('refreshConfirm', { name: refreshTarget })
                            : t('refreshAllConfirm')
                        }
                    </p>

                    <label className="flex items-center gap-3 p-3 border border-border-strong rounded-lg cursor-pointer hover:bg-muted transition-colors">
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={refreshAndCache}
                                onChange={(e) => setRefreshAndCache(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-10 h-5 bg-border-strong rounded-full peer-checked:bg-accent-button transition-colors"></div>
                            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-card rounded-full shadow-sm peer-checked:translate-x-5 transition-transform"></div>
                        </div>
                        <div className="flex-1">
                            <div className="font-medium text-text-primary text-sm">{t('cacheSubscriptions')}</div>
                            <div className="text-xs text-text-tertiary">{t('cacheSubscriptionsDesc')}</div>
                        </div>
                    </label>

                    {refreshAndCache && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <p className="text-xs text-yellow-800">
                                ⚠️ {t('cacheWarning')}
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={handleRefreshConfirm}
                            disabled={loadingAction}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
                        >
                            {refreshAndCache ? t('refreshAndCache') : t('startRefresh')}
                        </button>
                        <button
                            onClick={() => setShowRefreshModal(false)}
                            className="px-4 py-2 border border-border-input text-text-secondary rounded-lg hover:bg-muted transition-colors font-medium"
                        >
                            {t('cancelAdd')}
                        </button>
                    </div>
                </div>
            </Modal>


            {/* Static Source Editor */}
            {editingStaticSource && (
                <StaticSourceEditor
                    sourceName={editingStaticSource}
                    open={!!editingStaticSource}
                    onClose={() => setEditingStaticSource(null)}
                    onUpdate={() => router.refresh()}
                />
            )}
        </div>
    );
}
