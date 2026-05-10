'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { saveGroupSet, deleteGroupSet, type ConfigSet } from '@/lib/config-actions';
import Modal from '@/components/Modal';
import GroupEditor from '@/components/GroupEditor';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { getGroupDependencies } from '@/lib/group-dependencies';
import { formatDate } from '@/lib/utils';

interface GroupsClientProps {
    groups: ConfigSet[];
    proxies: Array<{ id: string; name: string; type: string; source: string }>;
}

export default function GroupsClient({ groups: initialGroups, proxies }: GroupsClientProps) {
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const router = useRouter();
    const t = useTranslations('dashboard');
    const locale = useLocale();
    const [groups, setGroups] = useState(initialGroups);
    useEffect(() => { setGroups(initialGroups); }, [initialGroups]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<ConfigSet | null>(null);
    const [groupName, setGroupName] = useState('');
    const [groupContent, setGroupContent] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = () => {
        setEditingGroup(null);
        setGroupName('');
        setGroupContent('');
        setIsModalOpen(true);
    };

    const handleEdit = (group: ConfigSet) => {
        setEditingGroup(group);
        setGroupName(group.name);
        setGroupContent(group.content);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!groupName.trim()) {
            error(t('custom.groups.nameRequired'));
            return;
        }

        if (!groupContent.trim()) {
            error(t('custom.groups.contentRequired'));
            return;
        }


        setLoading(true);
        try {
            await saveGroupSet(editingGroup?.id || null, groupName, groupContent);
            success(editingGroup ? t('custom.groups.updated') : t('custom.groups.created'));
            setIsModalOpen(false);
            router.refresh();
        } catch (err) {
            error(t('custom.groups.saveFailed') + (err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (group: ConfigSet) => {
        const confirmed = await confirm(
            t('custom.groups.deleteConfirm', { name: group.name }),
            { confirmColor: 'red' }
        );

        if (!confirmed) return;

        try {
            await deleteGroupSet(group.id);
            success(t('custom.groups.deleted'));
            router.refresh();
        } catch (err) {
            error(t('custom.groups.deleteFailed') + (err as Error).message);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">{t('custom.groups.heading')}</h1>
                    <p className="text-sm text-text-tertiary mt-1">{t('custom.groups.description')}</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="px-4 py-2 bg-accent-button text-white rounded-lg hover:bg-accent-button-hover transition-colors flex items-center gap-2"
                >
                    <span>➕</span>
                    <span>{t('custom.groups.create')}</span>
                </button>
            </div>

            {/* Groups List */}
            {groups.length === 0 ? (
                <div className="bg-card rounded-xl p-12 text-center border border-border-strong shadow-sm">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                        📋
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary mb-2">{t('custom.groups.empty')}</h3>
                    <p className="text-text-tertiary mb-6 max-w-sm mx-auto">{t('custom.groups.emptyDesc')}</p>
                    <button
                        onClick={handleCreate}
                        className="px-6 py-2.5 bg-accent-button text-white rounded-lg hover:bg-accent-button-hover transition-colors shadow-sm hover:shadow font-medium"
                    >
                        {t('custom.groups.createNow')}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groups.map((group) => {
                        const dependencies = getGroupDependencies(group.content, { availableProxies: proxies });
                        return (
                            <div
                                key={group.id}
                                className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all group flex flex-col overflow-hidden"
                            >
                                <div className="p-4 border-b border-gray-50 bg-muted/30 flex items-start justify-between">
                                    <div className="flex-1 min-w-0 pr-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-base font-semibold text-text-primary truncate" title={group.name}>
                                                {group.name}
                                            </h3>
                                            {group.isGlobal && (
                                                <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[10px] font-medium rounded border border-purple-200 dark:border-purple-800 shrink-0">
                                                    {t('custom.groups.global')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-text-quaternary flex items-center gap-1.5">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {formatDate(group.updatedAt, locale)}
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
                                            {t('custom.groups.noDependencies')}
                                        </div>
                                    )}
                                </div>

                                <div className="px-4 py-3 bg-muted/50 border-t border-border grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => handleEdit(group)}
                                        disabled={group.isGlobal}
                                        className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${group.isGlobal
                                                ? 'bg-muted text-text-quaternary cursor-not-allowed'
                                                : 'bg-card border border-border-strong text-text-secondary hover:border-blue-300 hover:text-accent-foreground hover:shadow-sm'
                                            }`}
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        {t('custom.groups.edit')}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(group)}
                                        disabled={group.isGlobal}
                                        className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${group.isGlobal
                                                ? 'bg-muted text-text-quaternary cursor-not-allowed'
                                                : 'bg-card border border-border-strong text-text-secondary hover:border-red-300 hover:text-red-600 hover:shadow-sm'
                                            }`}
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        {t('custom.groups.delete')}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}



            {/* Edit/Create Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingGroup ? t('custom.groups.editTitle') : t('custom.groups.createTitle')}
                maxWidth="max-w-4xl"
            >
                <div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                {t('custom.groups.name')}
                            </label>
                            <input
                                type="text"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                className="w-full px-4 py-2 border border-border-input rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder={t('custom.groups.namePlaceholder')}
                            />
                        </div>

                        <div>
                            <GroupEditor
                                value={groupContent}
                                onChange={setGroupContent}
                                proxies={proxies}
                            />
                        </div>
                    </div>

                    <div className="pt-6 border-t border-border-strong flex justify-end gap-3 mt-4">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="px-6 py-2 text-text-secondary bg-muted rounded-lg hover:bg-border-strong transition-colors"
                            disabled={loading}
                        >
                            {t('custom.groups.cancel')}
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-accent-button text-white rounded-lg hover:bg-accent-button-hover transition-colors disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? t('custom.groups.saving') : t('custom.groups.save')}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
