'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { saveCustomGroup, deleteCustomGroup } from './actions';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import Modal from '@/components/Modal';
import { SubmitButton } from '@/components/SubmitButton';
import GroupEditor from '@/components/GroupEditor';
import { useRouter } from 'next/navigation';
import { getGroupDependencies } from '@/lib/group-dependencies';

interface ConfigSet {
    id: string;
    name: string;
    content: string;
    updatedAt: number;
    userId?: string;
    isGlobal?: boolean;
    username?: string;
}

interface ProxyItem {
    id: string;
    name: string;
    type: string;
    source: string;
}

export default function CustomGroupsClient({
    customGroups: initialGroups,
    initialProxies
}: {
    customGroups: ConfigSet[],
    initialProxies: ProxyItem[]
}) {
    const t = useTranslations('admin.customGroups');
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const router = useRouter();
    const [groups, setGroups] = useState<ConfigSet[]>(initialGroups);
    useEffect(() => { setGroups(initialGroups); }, [initialGroups]);
    const [proxies] = useState<ProxyItem[]>(initialProxies);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formName, setFormName] = useState('');
    const [formContent, setFormContent] = useState('');
    const [formIsGlobal, setFormIsGlobal] = useState(false);
    const [loading, setLoading] = useState(false);

    const openCreate = () => {
        setEditingId(null);
        setFormName('');
        setFormContent('');
        setFormIsGlobal(false);
        setIsEditing(true);
    };

    const openEdit = (group: ConfigSet) => {
        setEditingId(group.id);
        setFormName(group.name);
        setFormContent(group.content);
        setFormIsGlobal(group.isGlobal || false);
        setIsEditing(true);
    };



    const handleSave = async () => {
        if (!formName.trim() || !formContent.trim()) {
            error(t('nameRequired'));
            return;
        }

        setLoading(true);
        await saveCustomGroup(editingId, formName.trim(), formContent.trim(), formIsGlobal);
        setLoading(false);
        setIsEditing(false);
        success(editingId ? t('groupUpdated') : t('groupCreated'));
        router.refresh();
    };

    const handleDelete = async (id: string, name: string) => {
        if (!await confirm(t('confirmDelete', { name }), { confirmColor: 'red' })) {
            return;
        }

        setLoading(true);
        await deleteCustomGroup(id);
        setLoading(false);
        success(t('groupDeleted'));
        router.refresh();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-text-primary">📝 {t('title')}</h2>
                    <p className="text-sm text-text-tertiary mt-1">{t('subtitle')}</p>
                </div>
                <div className="flex gap-2">
                    <a
                        href="/admin/groups"
                        className="text-sm bg-muted text-text-secondary px-4 py-2 rounded-lg hover:bg-border-strong transition-colors font-medium"
                    >
                        ← {t('backToList')}
                    </a>
                    <button
                        onClick={openCreate}
                        className="text-sm bg-accent-button text-white px-4 py-2 rounded-lg hover:bg-accent-button-hover transition-colors font-medium"
                    >
                        {t('createNew')}
                    </button>
                </div>
            </div>



            {/* Create/Edit Group Modal */}
            <Modal
                isOpen={isEditing}
                onClose={() => setIsEditing(false)}
                title={editingId ? t('editGroup') : t('createGroup')}
                maxWidth="max-w-4xl"
            >
                <div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-text-secondary mb-2">{t('configName')}</label>
                            <input
                                type="text"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                className="w-full border border-border-input rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder={t('configNamePlaceholder')}
                            />
                        </div>

                        <div>
                            <div>
                                <GroupEditor
                                    value={formContent}
                                    onChange={setFormContent}
                                    proxies={proxies}
                                />
                            </div>

                            {/* Global Config Checkbox */}
                            <div className="border-t border-border-strong pt-4">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={formIsGlobal}
                                        onChange={(e) => setFormIsGlobal(e.target.checked)}
                                        className="w-4 h-4 text-purple-600 border-border-input rounded focus:ring-purple-500"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-text-secondary group-hover:text-purple-600 transition-colors">
                                                🌐 {t('globalConfig')}
                                            </span>
                                        </div>
                                        <p className="text-xs text-text-tertiary mt-0.5">
                                            {t('globalConfigDesc')}
                                        </p>
                                    </div>
                                </label>
                            </div>

                            <div className="flex gap-2">
                                <SubmitButton
                                    onClick={handleSave}
                                    isLoading={loading}
                                    text={t('save')}
                                    className="flex-1"
                                />
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="px-4 py-2 border border-border-input rounded-lg hover:bg-muted transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>

            {groups.length === 0 ? (
                <div className="bg-card rounded-xl p-12 text-center border border-border-strong shadow-sm">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                        📋
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary mb-2">{t('noGroups')}</h3>
                    <p className="text-text-tertiary mb-6">{t('noGroupsHint')}</p>
                    <button
                        onClick={openCreate}
                        className="px-6 py-2.5 bg-accent-button text-white rounded-lg hover:bg-accent-button-hover transition-colors shadow-sm hover:shadow font-medium"
                    >
                        {t('createFirst')}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groups.map((group) => {
                        const dependencies = getGroupDependencies(group.content, { availableProxies: proxies });
                        return (
                            <div key={group.id} className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all group flex flex-col overflow-hidden">
                                <div className="p-4 border-b border-muted bg-muted/30 flex items-start justify-between">
                                    <div className="flex-1 min-w-0 pr-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="text-base font-semibold text-text-primary truncate" title={group.name}>
                                                {group.name}
                                            </h3>
                                            {group.isGlobal && (
                                                <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[10px] font-medium rounded border border-purple-200 dark:border-purple-800 shrink-0">
                                                    {t('global')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <div className="text-xs text-text-tertiary flex items-center gap-1.5">
                                                <span className="w-4 h-4 bg-muted rounded-full flex items-center justify-center text-[10px] text-text-tertiary border border-border-strong">👤</span>
                                                <span className="truncate max-w-[120px] font-medium text-text-secondary" title={group.username || t('unknownUser')}>{group.username || t('unknownUser')}</span>
                                            </div>
                                            <div className="text-xs text-text-quaternary flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5 text-text-quaternary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {new Date(group.updatedAt).toLocaleString('zh-CN')}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 flex-1 flex flex-col space-y-3">
                                    <div className="bg-muted rounded-lg p-3 border border-border relative group/code">
                                        <pre className="text-[10px] leading-relaxed text-text-secondary font-mono overflow-hidden h-20 relative">
                                            {group.content}
                                            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-muted to-transparent pointer-events-none"></div>
                                        </pre>
                                    </div>

                                    {dependencies.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {dependencies.map(source => (
                                                <span key={source} className="text-[10px] px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-100 dark:border-indigo-800 truncate max-w-[150px]" title={source}>
                                                    {source}
                                                </span>
                                            ))}
                                            {dependencies.length > 3 && (
                                                <span className="text-[10px] px-1.5 py-0.5 text-text-quaternary">+ {dependencies.length - 3}</span>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="pt-1 text-[10px] text-text-quaternary italic">
                                            {t('noDependencies')}
                                        </div>
                                    )}
                                </div>

                                <div className="px-4 py-3 bg-muted/50 border-t border-border grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => openEdit(group)}
                                        className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-card border border-border-strong text-text-secondary hover:border-blue-300 hover:text-accent-foreground hover:shadow-sm transition-all"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        {t('edit')}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(group.id, group.name)}
                                        disabled={loading}
                                        className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-card border border-border-strong text-text-secondary hover:border-red-300 hover:text-red-600 hover:shadow-sm disabled:opacity-50 transition-all"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        {t('delete')}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
