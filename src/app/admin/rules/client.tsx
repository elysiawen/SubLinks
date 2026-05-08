'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/Modal';
import { Search } from 'lucide-react';
import StaticSourceEditor from '../sources/StaticSourceEditor';

export default function AdminRulesClient({
    rulesBySource,
    totalCount,
    customSets,
    sourceTypes = {}
}: {
    rulesBySource: Record<string, string[]>,
    totalCount: number,
    customSets: any[],
    sourceTypes?: Record<string, string>
}) {
    const t = useTranslations('admin.rules');
    const [selectedSource, setSelectedSource] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingSource, setEditingSource] = useState<string | null>(null);

    const sources = Object.keys(rulesBySource).sort();
    const selectedRules = selectedSource ? rulesBySource[selectedSource] : [];

    // Filter rules based on search query
    const filteredRules = useMemo(() => {
        if (!searchQuery.trim()) return selectedRules;
        const query = searchQuery.toLowerCase();
        return selectedRules.filter(rule => rule.toLowerCase().includes(query));
    }, [selectedRules, searchQuery]);

    // Reset search when modal closes
    const handleCloseModal = () => {
        setSelectedSource(null);
        setSearchQuery('');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                    ⚡ {t('title')}
                    <span className="text-sm font-normal text-text-tertiary bg-muted px-2 py-1 rounded-full">{totalCount}</span>
                </h2>
                <a
                    href="/admin/rules/custom"
                    className="text-sm bg-accent text-accent-foreground px-4 py-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/25 transition-colors font-medium"
                >
                    📝 {t('manageCustom')}
                </a>
            </div>

            {customSets.length > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/40 rounded-xl shadow-sm border border-purple-100 dark:border-purple-900/50 p-4">
                    <h3 className="text-sm font-semibold text-text-secondary mb-2">📚 {t('customRuleSets')}</h3>
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
                    {t('noRules')}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sources.map(source => {
                    const rules = rulesBySource[source];

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
                                    <span className="text-text-secondary">{t('ruleCount')}</span>
                                    <span className="font-semibold text-orange-600">{rules.length}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedSource(source)}
                                    className={`bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 px-4 py-2 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-500/25 transition-colors font-medium text-sm ${sourceTypes[source] === 'static' ? 'flex-1' : 'w-full'}`}
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
                                {t('detailCount', { filtered: filteredRules.length, total: selectedRules.length })}
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
                                className="bg-card border border-border-input text-text-primary text-sm rounded-lg focus:ring-accent focus:border-accent block w-full pl-10 p-2.5 shadow-sm"
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

                        {/* Rules List */}
                        <div className="overflow-auto max-h-[60vh]">
                            {filteredRules.length > 0 ? (
                                <div className="bg-muted rounded-lg p-4 font-mono text-xs space-y-1">
                                    {filteredRules.map((rule, idx) => (
                                        <div key={idx} className="text-text-secondary hover:bg-muted px-2 py-1 rounded transition-colors">
                                            <span className="text-text-quaternary mr-2">{selectedRules.indexOf(rule) + 1}.</span>
                                            {rule}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-text-quaternary">
                                    {searchQuery ? t('noMatch') : t('noRulesModal')}
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
                        // Trigger refresh if needed
                    }}
                    defaultTab="rules"
                />
            )}
        </div>
    );
}
