'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { saveRuleSet, deleteRuleSet, type ConfigSet } from '@/lib/config-actions';
import Modal from '@/components/Modal';
import RuleEditor from '@/components/RuleEditor';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { formatDate } from '@/lib/utils';

interface ProxyGroup {
    name: string;
    type: string;
    source: string;
}

interface RulesClientProps {
    rules: ConfigSet[];
    proxyGroups: ProxyGroup[];
}

export default function RulesClient({ rules: initialRules, proxyGroups }: RulesClientProps) {
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const router = useRouter();
    const t = useTranslations('dashboard');
    const locale = useLocale();
    const [rules, setRules] = useState(initialRules);
    useEffect(() => { setRules(initialRules); }, [initialRules]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<ConfigSet | null>(null);
    const [ruleName, setRuleName] = useState('');
    const [ruleContent, setRuleContent] = useState('');
    const [loading, setLoading] = useState(false);



    const handleCreate = () => {
        setEditingRule(null);
        setRuleName('');
        setRuleContent('');
        setIsModalOpen(true);
    };

    const handleEdit = (rule: ConfigSet) => {
        setEditingRule(rule);
        setRuleName(rule.name);
        setRuleContent(rule.content);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!ruleName.trim()) {
            error(t('custom.rules.nameRequired'));
            return;
        }

        if (!ruleContent.trim()) {
            error(t('custom.rules.contentRequired'));
            return;
        }

        setLoading(true);
        try {
            await saveRuleSet(editingRule?.id || null, ruleName, ruleContent);
            success(editingRule ? t('custom.rules.updated') : t('custom.rules.created'));
            setIsModalOpen(false);
            router.refresh();
        } catch (err) {
            error(t('custom.rules.saveFailed') + (err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (rule: ConfigSet) => {
        const confirmed = await confirm(
            t('custom.rules.deleteConfirm', { name: rule.name }),
            { confirmColor: 'red' }
        );

        if (!confirmed) return;

        try {
            await deleteRuleSet(rule.id);
            success(t('custom.rules.deleted'));
            router.refresh();
        } catch (err) {
            error(t('custom.rules.deleteFailed') + (err as Error).message);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">{t('custom.rules.heading')}</h1>
                    <p className="text-sm text-text-tertiary mt-1">{t('custom.rules.description')}</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                    <span>➕</span>
                    <span>{t('custom.rules.create')}</span>
                </button>
            </div>

            {/* Rules List */}
            {rules.length === 0 ? (
                <div className="bg-card rounded-xl p-12 text-center border border-border-strong shadow-sm">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                        📝
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary mb-2">{t('custom.rules.empty')}</h3>
                    <p className="text-text-tertiary mb-6">{t('custom.rules.emptyDesc')}</p>
                    <button
                        onClick={handleCreate}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow font-medium"
                    >
                        {t('custom.rules.createNow')}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rules.map((rule) => (
                        <div
                            key={rule.id}
                            className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all group flex flex-col overflow-hidden"
                        >
                            <div className="p-4 border-b border-gray-50 bg-muted/30 flex items-start justify-between">
                                <div className="flex-1 min-w-0 pr-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-base font-semibold text-text-primary truncate" title={rule.name}>
                                            {rule.name}
                                        </h3>
                                        {rule.isGlobal && (
                                            <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[10px] font-medium rounded border border-purple-200 dark:border-purple-800 shrink-0">
                                                {t('custom.rules.global')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <div className="text-xs text-text-quaternary flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {formatDate(rule.updatedAt, locale)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 flex-1 flex flex-col space-y-3">
                                <div className="bg-muted rounded-lg p-3 border border-border relative group/code">
                                    <pre className="text-[10px] leading-relaxed text-text-secondary font-mono overflow-hidden h-20 relative">
                                        {rule.content}
                                        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-muted to-transparent pointer-events-none"></div>
                                    </pre>
                                </div>
                            </div>

                            <div className="px-4 py-3 bg-muted/50 border-t border-border grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => handleEdit(rule)}
                                    disabled={rule.isGlobal}
                                    title={rule.isGlobal ? t('custom.rules.globalCannotEdit') : ''}
                                    className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${rule.isGlobal
                                        ? 'bg-muted text-text-quaternary border-border cursor-not-allowed'
                                        : 'bg-card text-text-secondary border-border-strong hover:border-blue-300 hover:text-accent-foreground hover:shadow-sm'
                                        }`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    {t('custom.rules.edit')}
                                </button>
                                <button
                                    onClick={() => handleDelete(rule)}
                                    disabled={rule.isGlobal}
                                    title={rule.isGlobal ? t('custom.rules.globalCannotDelete') : ''}
                                    className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${rule.isGlobal
                                        ? 'bg-muted text-text-quaternary border-border cursor-not-allowed'
                                        : 'bg-card text-text-secondary border-border-strong hover:border-red-300 hover:text-red-600 hover:shadow-sm'
                                        }`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    {t('custom.rules.delete')}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}



            {/* Edit/Create Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingRule ? t('custom.rules.editTitle') : t('custom.rules.createTitle')}
                maxWidth="max-w-4xl"
            >
                <div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                {t('custom.rules.name')}
                            </label>
                            <input
                                type="text"
                                value={ruleName}
                                onChange={(e) => setRuleName(e.target.value)}
                                className="w-full px-4 py-2 border border-border-input rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder={t('custom.rules.namePlaceholder')}
                            />
                        </div>

                        <div>
                            <RuleEditor
                                value={ruleContent}
                                onChange={setRuleContent}
                                proxyGroups={proxyGroups}
                            />
                        </div>
                    </div>

                    <div className="pt-6 border-t border-border-strong flex justify-end gap-3 mt-4">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="px-6 py-2 text-text-secondary bg-muted rounded-lg hover:bg-border-strong transition-colors"
                            disabled={loading}
                        >
                            {t('custom.rules.cancel')}
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? t('custom.rules.saving') : t('custom.rules.save')}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
