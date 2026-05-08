'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/Modal';
import { Search } from 'lucide-react';
import StaticSourceEditor from '../sources/StaticSourceEditor';

export default function AdminGroupsClient({
    groupsBySource,
    totalCount,
    customSets,
    sourceTypes = {}
}: {
    groupsBySource: Record<string, any[]>,
    totalCount: number,
    customSets: any[],
    sourceTypes?: Record<string, string>
}) {
    const t = useTranslations('admin.groups');
    const [selectedSource, setSelectedSource] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingSource, setEditingSource] = useState<string | null>(null);

    const sources = Object.keys(groupsBySource).sort();
    const selectedGroups = selectedSource ? groupsBySource[selectedSource] : [];

    // Filter groups based on search query
    const filteredGroups = useMemo(() => {
        if (!searchQuery.trim()) return selectedGroups;
        const query = searchQuery.toLowerCase();
        return selectedGroups.filter(group => {
            // Search in group name, type, and proxies
            const nameMatch = group.name?.toLowerCase().includes(query);
            const typeMatch = group.type?.toLowerCase().includes(query);
            const proxiesMatch = group.proxies?.some((proxy: string) => proxy.toLowerCase().includes(query));
            return nameMatch || typeMatch || proxiesMatch;
        });
    }, [selectedGroups, searchQuery]);

    // Reset search when modal closes
    const handleCloseModal = () => {
        setSelectedSource(null);
        setSearchQuery('');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                    🎯 {t('title')}
                    <span className="text-sm font-normal text-text-tertiary bg-muted px-2 py-1 rounded-full">{totalCount}</span>
                </h2>
                <a
                    href="/admin/groups/custom"
                    className="text-sm bg-accent text-accent-foreground px-4 py-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/25 transition-colors font-medium"
                >
                    📝 {t('manageCustom')}
                </a>
            </div>

            {customSets.length > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/40 rounded-xl shadow-sm border border-purple-100 dark:border-purple-900/50 p-4">
                    <h3 className="text-sm font-semibold text-text-secondary mb-2">📚 {t('customGroupSets')}</h3>
                    <div className="flex flex-wrap gap-2">
                        {customSets.map(set => (
                            <span key={set.id} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-card text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                {set.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {sources.length === 0 && (
                <div className="bg-card rounded-xl shadow-sm border border-border p-8 text-center text-text-quaternary">
                    {t('noGroups')}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sources.map(source => {
                    const groups = groupsBySource[source];

                    return (
                        <div key={source} className="bg-card rounded-xl shadow-sm border border-border p-6 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                                    📡 {source}
                                    {sourceTypes[source] === 'static' && (
                                        <span className="text-[10px] bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                            {t('staticBadge')}
                                        </span>
                                    )}
                                </h3>
                            </div>
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-text-secondary">{t('groupCount')}</span>
                                    <span className="font-semibold text-green-600">{groups.length}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedSource(source)}
                                    className={`bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400 px-4 py-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-500/25 transition-colors font-medium text-sm ${sourceTypes[source] === 'static' ? 'flex-1' : 'w-full'}`}
                                >
                                    {t('viewDetail')}
                                </button>
                                {sourceTypes[source] === 'static' && (
                                    <button
                                        onClick={() => setEditingSource(source)}
                                        className="bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 px-4 py-2 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/25 transition-colors font-medium text-sm flex-1"
                                    >
                                        ⚙️ {t('manage')}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal */}
            <Modal
                isOpen={!!selectedSource}
                onClose={handleCloseModal}
                title={
                    selectedSource ? (
                        <div className="flex items-center gap-2">
                            <span>📡 {selectedSource}</span>
                            <span className="text-sm font-normal text-text-tertiary bg-muted px-2 py-1 rounded-full">
                                {t('detailCount', { filtered: filteredGroups.length, total: selectedGroups.length })}
                            </span>
                        </div>
                    ) : ''
                }
                maxWidth="max-w-4xl"
            >
                {selectedSource && (
                    <div className="space-y-4">
                        {/* Search Box */}
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-text-quaternary" />
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('searchPlaceholder')}
                                className="bg-card border border-border-input text-text-primary text-sm rounded-lg focus:ring-gray-500 focus:border-gray-500 block w-full pl-10 p-2.5 shadow-sm"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-quaternary hover:text-text-secondary"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Groups List */}
                        <div className="overflow-auto max-h-[60vh] space-y-4">
                            {filteredGroups.length > 0 ? (
                                filteredGroups.map((group, idx) => (
                                    <div key={idx} className="border border-border-strong rounded-lg p-4 hover:border-green-300 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-base font-semibold text-text-primary">{group.name}</h4>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-800">
                                                {group.type}
                                            </span>
                                        </div>
                                        <div className="text-sm text-text-secondary">
                                            <span className="font-medium">{t('proxyList')}</span>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {group.proxies && group.proxies.length > 0 ? (
                                                    group.proxies.map((proxy: string, i: number) => (
                                                        <span key={i} className="inline-block px-2 py-0.5 bg-muted text-text-secondary rounded text-xs">
                                                            {proxy}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-text-quaternary text-xs">{t('noProxy')}</span>
                                                )}
                                            </div>
                                        </div>
                                        {group.url && (
                                            <div className="mt-2 text-xs text-text-tertiary">
                                                <span className="font-medium">URL:</span> {group.url}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-text-quaternary">
                                    {searchQuery ? t('noMatch') : t('noGroupsModal')}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {editingSource && (
                <StaticSourceEditor
                    sourceName={editingSource}
                    open={!!editingSource}
                    onClose={() => setEditingSource(null)}
                    onUpdate={() => {
                        // Optional: trigger refresh
                    }}
                    defaultTab="groups"
                />
            )}
        </div>
    );
}
