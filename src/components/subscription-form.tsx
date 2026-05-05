'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ConfigSet } from '@/lib/config-actions';
import yaml from 'js-yaml';
import { SubmitButton } from '@/components/SubmitButton';
import { useToast } from '@/components/ToastProvider';
import Modal from '@/components/Modal';
import RuleEditor from '@/components/RuleEditor';
import { getGroupDependencies } from '@/lib/group-dependencies';

export interface SubscriptionFormProps {
    initialData?: {
        name: string;
        remark?: string;
        enabled: boolean;
        groupId: string;
        ruleId: string;
        customRules: string;
        selectedSources: string[];
    };
    configSets: {
        groups: ConfigSet[];
        rules: ConfigSet[];
    };
    defaultGroups?: { name: string; source: string }[];
    availableSources: {
        name: string;
        url?: string;
        isDefault?: boolean;
        enabled?: boolean;
        status?: 'pending' | 'success' | 'failure';
        lastUpdated?: number
    }[];
    onSubmit: (data: any) => Promise<void>;
    onCancel: () => void;
    isAdmin?: boolean;
    submitLabel?: string;
    proxySourceMap?: Record<string, string>;
}

export default function SubscriptionForm({
    initialData,
    configSets,
    defaultGroups = [],
    availableSources = [],
    onSubmit,
    onCancel,
    isAdmin = false,
    submitLabel,
    proxySourceMap = {}
}: SubscriptionFormProps) {
    const t = useTranslations('common.subscriptionForm');
    const { error } = useToast();
    const [loading, setLoading] = useState(false);

    const displaySubmitLabel = submitLabel || t('save');

    // Form State
    const [name, setName] = useState(initialData?.name || initialData?.remark || '');
    const [enabled, setEnabled] = useState(initialData?.enabled ?? true);

    const [groupId, setGroupId] = useState(initialData?.groupId || 'default');
    const [ruleId, setRuleId] = useState(initialData?.ruleId || 'default');
    const [customRules, setCustomRules] = useState(initialData?.customRules || '');
    const [selectedSources, setSelectedSources] = useState<string[]>(initialData?.selectedSources || []);

    // Set default sources if creating new and list is empty
    useEffect(() => {
        if (!initialData && selectedSources.length === 0 && availableSources.length > 0) {
            const defaultSources = availableSources
                .filter(s => s.isDefault === true && s.enabled !== false)
                .map(s => s.name);
            setSelectedSources(defaultSources);
        }
    }, [initialData, availableSources]);

    const [showAdvanced, setShowAdvanced] = useState(false);

    // Source Dependency Warning State
    const [showDependencyWarning, setShowDependencyWarning] = useState(false);
    const [missingSources, setMissingSources] = useState<string[]>([]);

    // Confirm adding missing sources and proceed with save
    const confirmAddMissingSources = async () => {
        const newSelectedSources = [...selectedSources, ...missingSources];
        setSelectedSources(newSelectedSources);
        setShowDependencyWarning(false);
        setMissingSources([]);

        setLoading(true);
        try {
            await onSubmit({
                name,
                remark: name,
                enabled,
                groupId,
                ruleId,
                customRules,
                selectedSources: newSelectedSources
            });
        } finally {
            setLoading(false);
        }
    };

    const closeDependencyWarning = () => {
        setShowDependencyWarning(false);
        setMissingSources([]);
    };

    const declineAddMissingSources = async () => {
        setShowDependencyWarning(false);
        setMissingSources([]);

        setLoading(true);
        try {
            await onSubmit({
                name,
                remark: name,
                enabled,
                groupId,
                ruleId,
                customRules,
                selectedSources
            });
        } finally {
            setLoading(false);
        }
    };

    // Calculate available policies for the rule editor
    const availablePolicies = useMemo(() => {
        const basePolicies = ['Proxy', 'DIRECT', 'REJECT', 'Auto', 'Global'];
        let extraGroups: string[] = [];

        if (groupId === 'default') {
            if (selectedSources.length === 0) {
                extraGroups = defaultGroups.map(g => g.name);
            } else {
                extraGroups = defaultGroups.filter(g => selectedSources.includes(g.source)).map(g => g.name);
            }
        } else {
            const selectedSet = configSets.groups.find(g => g.id === groupId);
            if (selectedSet) {
                try {
                    const doc = yaml.load(selectedSet.content) as any;
                    if (Array.isArray(doc)) {
                        extraGroups = doc.map((g: any) => String(g.name)).filter(Boolean);
                    } else if (doc && typeof doc === 'object') {
                        if (doc['proxy-groups'] && Array.isArray(doc['proxy-groups'])) {
                            extraGroups = doc['proxy-groups'].map((g: any) => String(g.name)).filter(Boolean);
                        } else if (doc.name) {
                            extraGroups = [String(doc.name)];
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse custom group set:', e);
                }
            }
        }

        const all = [...basePolicies, ...extraGroups];
        return Array.from(new Set(all));
    }, [groupId, configSets.groups, defaultGroups, selectedSources]);

    const handleSubmit = async () => {
        if (selectedSources.length === 0) {
            error(t('selectAtLeastOneSource'));
            return;
        }

        // Check for missing dependencies if a custom group is selected
        if (groupId !== 'default') {
            const selectedSet = configSets.groups.find(g => g.id === groupId);
            if (selectedSet) {
                const dependencies = getGroupDependencies(selectedSet.content, {
                    proxySourceMap,
                    availableSources
                });
                const missing = dependencies.filter(dep => !selectedSources.includes(dep));

                if (missing.length > 0) {
                    setMissingSources(missing);
                    setShowDependencyWarning(true);
                    return;
                }
            }
        }

        setLoading(true);
        try {
            await onSubmit({
                name,
                remark: name,
                enabled,
                groupId,
                ruleId,
                customRules,
                selectedSources
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-5">
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('remarkLabel')}</label>
                <input
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('remarkPlaceholder')}
                />
            </div>

            {/* Upstream Source Selection */}
            {availableSources.length > 0 && (
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t('selectSource')}</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
                        {availableSources.map(source => {
                            const isSelected = selectedSources.includes(source.name);
                            const isDisabled = source.enabled === false;

                            return (
                                <div
                                    key={source.name}
                                    onClick={() => {
                                        if (isDisabled) return;
                                        if (isSelected) {
                                            setSelectedSources(selectedSources.filter(s => s !== source.name));
                                        } else {
                                            setSelectedSources([...selectedSources, source.name]);
                                        }
                                    }}
                                    className={`
                                        relative flex items-center p-3 rounded-xl border transition-all cursor-pointer select-none group
                                        ${isDisabled
                                            ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed grayscale'
                                            : isSelected
                                                ? 'bg-blue-50 border-blue-500 shadow-sm ring-1 ring-blue-500'
                                                : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                                        }
                                    `}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`font-medium text-sm truncate ${isDisabled ? 'text-gray-500' : 'text-gray-900'}`}>{source.name}</span>
                                            {isDisabled && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-200 text-gray-500 font-medium">{t('disabled')}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`flex h-2 w-2 rounded-full ${source.status === 'success' ? 'bg-green-500' : source.status === 'failure' ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
                                            <span className="text-xs text-gray-500">
                                                {source.status === 'success' ? t('normal') : source.status === 'failure' ? t('failure') : t('waiting')}
                                            </span>
                                            {source.lastUpdated && source.lastUpdated > 0 && (
                                                <span className="text-[10px] text-gray-400">
                                                    {new Date(source.lastUpdated).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className={`
                                        w-5 h-5 rounded-full border flex items-center justify-center transition-colors ml-3 shrink-0
                                        ${isSelected
                                            ? 'bg-blue-500 border-blue-500 text-white'
                                            : 'border-gray-300 bg-white group-hover:border-blue-400'
                                        }
                                        ${isDisabled ? 'bg-gray-100 border-gray-200' : ''}
                                    `}>
                                        {isSelected && (
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t('selectSourceHint')}
                    </p>
                </div>
            )}

            {/* Admin: Explicit Enabled Toggle */}
            {isAdmin && (
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={enabled}
                            onChange={e => setEnabled(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">{t('enableSubscription')}</span>
                    </label>
                </div>
            )}

            {/* Advanced Settings - Collapsible */}
            <div className="border-t border-gray-200 pt-4">
                <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">{t('advancedConfig')}</span>
                        <span className="text-xs text-gray-500">{t('advancedConfigDesc')}</span>
                    </div>
                    <svg
                        className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''
                            }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {showAdvanced && (
                    <div className="mt-4 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('groupConfig')}</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                                    value={groupId}
                                    onChange={e => setGroupId(e.target.value)}
                                >
                                    <option value="default">{t('defaultFollowUpstream')}</option>
                                    {configSets.groups.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('ruleConfig')}</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                                    value={ruleId}
                                    onChange={e => setRuleId(e.target.value)}
                                >
                                    <option value="default">{t('defaultFollowUpstream')}</option>
                                    {configSets.rules.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <RuleEditor
                            value={customRules}
                            onChange={setCustomRules}
                            availablePolicies={availablePolicies}
                        />
                    </div>
                )}
            </div>

            <div className="flex gap-3 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 border border-gray-200"
                >
                    {t('cancel')}
                </button>
                <SubmitButton
                    onClick={handleSubmit}
                    isLoading={loading}
                    text={displaySubmitLabel}
                    className="flex-1 px-5 py-2.5 rounded-xl shadow-lg shadow-blue-600/20"
                />
            </div>

            {/* Source Dependency Warning Modal */}
            <Modal
                isOpen={showDependencyWarning}
                onClose={closeDependencyWarning}
                title={
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <span>{t('dependencyDetected')}</span>
                    </div>
                }
                maxWidth="max-w-md"
            >
                <p className="text-sm text-gray-500 mb-4">{t('dependencyDesc')}</p>

                <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
                    <div>
                        <span className="text-xs text-gray-500 font-medium">{t('missingSourcesLabel')}</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {missingSources.map(source => (
                                <span key={source} className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-lg border border-amber-200">
                                    {source}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div>
                        <span className="text-xs text-gray-500 font-medium">{t('selectedSourcesLabel')}</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {selectedSources.length > 0 ? selectedSources.map(source => (
                                <span key={source} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg border border-blue-200">
                                    {source}
                                </span>
                            )) : (
                                <span className="text-xs text-gray-400">{t('none')}</span>
                            )}
                        </div>
                    </div>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                    {t('dependencyQuestion')}
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={declineAddMissingSources}
                        className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        {t('noContinue')}
                    </button>
                    <button
                        onClick={confirmAddMissingSources}
                        className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        {t('yesSelectAll')}
                    </button>
                </div>
            </Modal>
        </div>
    );
}
