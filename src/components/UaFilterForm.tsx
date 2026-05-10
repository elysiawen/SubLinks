'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ToastProvider';
import { UaFilterConfig, UaRule } from '@/lib/database/interface';

interface UaFilterFormProps {
    value?: UaFilterConfig;
    onChange: (newValue: UaFilterConfig) => void;
}

export default function UaFilterForm({ value, onChange }: UaFilterFormProps) {
    const t = useTranslations('common.uaFilter');
    const tPresets = useTranslations('common.uaPresets');
    const { success, error } = useToast();

    // Internal state to manage form fields
    const [enabled, setEnabled] = useState(value?.enabled || false);
    const [mode, setMode] = useState<'blacklist' | 'whitelist'>(value?.mode || 'blacklist');
    const [rules, setRules] = useState<UaRule[]>(value?.rules || []);

    // UA Testing state
    const [testUa, setTestUa] = useState('');
    const [testResult, setTestResult] = useState<boolean | null>(null);

    // Presets
    const [presets, setPresets] = useState<any>(null);

    // Sync state with props when props change externally
    useEffect(() => {
        if (value) {
            setEnabled(value.enabled);
            setMode(value.mode);
            setRules(value.rules);
        }
    }, [value]);

    // Notify parent of changes
    useEffect(() => {
        onChange({
            enabled,
            mode,
            rules
        });
    }, [enabled, mode, rules]);

    // Load presets
    useEffect(() => {
        import('@/lib/ua-filter').then(module => {
            setPresets(module.UA_PRESETS);
        });
    }, []);

    const addRule = () => {
        setRules([...rules, { pattern: '', matchType: 'contains', description: '' }]);
    };

    const removeRule = (index: number) => {
        setRules(rules.filter((_, i) => i !== index));
    };

    const updateRule = (index: number, field: keyof UaRule, val: string) => {
        const newRules = [...rules];
        newRules[index] = { ...newRules[index], [field]: val };
        setRules(newRules);
    };

    const addPreset = (presetKey: string) => {
        if (!presets || !presets[presetKey]) return;
        const preset = presets[presetKey];
        // Check if already exists
        if (rules.some(r => r.pattern === preset.pattern && r.matchType === preset.matchType)) {
            error(t('ruleExists'));
            return;
        }
        // Translate the description key
        const translatedPreset = { ...preset, description: tPresets(presetKey) };
        setRules([...rules, translatedPreset]);
        success(t('presetAdded', { name: tPresets(presetKey) }));
    };

    const testUaFilter = async () => {
        if (!testUa.trim()) {
            error(t('enterUA'));
            return;
        }

        try {
            const { checkUaFilter } = await import('@/lib/ua-filter');
            const filterConfig = { mode, rules, enabled: true }; // Force enabled for testing
            const result = checkUaFilter(testUa, filterConfig);
            setTestResult(result);
        } catch (e) {
            error(t('testFailed'));
        }
    };

    return (
        <div className="space-y-6">
            {/* Enable Toggle */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <label className="text-sm font-medium text-text-secondary">{t('enableLabel')}</label>
                    <p className="text-xs text-text-tertiary mt-1">{t('enableDesc')}</p>
                </div>
                <button
                    type="button"
                    onClick={() => setEnabled(!enabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-accent-button' : 'bg-border-strong'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            {enabled && (
                <>
                    {/* Mode Selection */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">{t('modeLabel')}</label>
                        <select
                            value={mode}
                            onChange={(e) => setMode(e.target.value as 'blacklist' | 'whitelist')}
                            className="block w-full rounded-md border-border-input shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border bg-card text-text-primary"
                        >
                            <option value="blacklist">{t('blacklistMode')}</option>
                            <option value="whitelist">{t('whitelistMode')}</option>
                        </select>
                        <p className="text-xs text-text-tertiary mt-1">
                            {mode === 'blacklist' ? t('blacklistDesc') : t('whitelistDesc')}
                        </p>
                    </div>

                    {/* Preset Quick Add */}
                    {presets && (
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">{t('quickAddPresets')}</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <button type="button" onClick={() => addPreset('clash')} className="px-3 py-2 text-sm bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/25 transition border border-blue-200 dark:border-blue-800">
                                    ✅ Clash
                                </button>
                                <button type="button" onClick={() => addPreset('shadowrocket')} className="px-3 py-2 text-sm bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/25 transition border border-blue-200 dark:border-blue-800">
                                    ✅ Shadowrocket
                                </button>
                                <button type="button" onClick={() => addPreset('quantumult')} className="px-3 py-2 text-sm bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/25 transition border border-blue-200 dark:border-blue-800">
                                    ✅ Quantumult X
                                </button>
                                <button type="button" onClick={() => addPreset('surge')} className="px-3 py-2 text-sm bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/25 transition border border-blue-200 dark:border-blue-800">
                                    ✅ Surge
                                </button>
                                <button type="button" onClick={() => addPreset('chrome')} className="px-3 py-2 text-sm bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-500/25 transition border border-green-200 dark:border-green-800">
                                    🌐 Chrome
                                </button>
                                <button type="button" onClick={() => addPreset('firefox')} className="px-3 py-2 text-sm bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-500/25 transition border border-green-200 dark:border-green-800">
                                    🌐 Firefox
                                </button>
                                <button type="button" onClick={() => addPreset('curl')} className="px-3 py-2 text-sm bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/25 transition border border-red-200 dark:border-red-800">
                                    🚫 cURL
                                </button>
                                <button type="button" onClick={() => addPreset('pythonRequests')} className="px-3 py-2 text-sm bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/25 transition border border-red-200 dark:border-red-800">
                                    🚫 Python
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Rules List */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-text-secondary">{t('customRules', { count: rules.length })}</label>
                            <button
                                type="button"
                                onClick={addRule}
                                className="px-3 py-1 text-sm bg-accent-button text-white rounded-lg hover:bg-accent-button-hover transition"
                            >
                                {t('addRule')}
                            </button>
                        </div>

                        {rules.length === 0 ? (
                            <div className="text-center py-8 text-text-quaternary border-2 border-dashed border-border-strong rounded-lg">
                                {t('noRules')}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {rules.map((rule, index) => (
                                    <div key={index} className="flex flex-col sm:flex-row gap-2 items-start p-3 bg-muted rounded-lg border border-border">
                                        <div className="flex-1 space-y-2 w-full">
                                            <input
                                                type="text"
                                                value={rule.pattern}
                                                onChange={(e) => updateRule(index, 'pattern', e.target.value)}
                                                placeholder={t('patternPlaceholder')}
                                                className="block w-full rounded-md border-border-input shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border bg-card text-text-primary"
                                            />
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <select
                                                    value={rule.matchType}
                                                    onChange={(e) => updateRule(index, 'matchType', e.target.value as any)}
                                                    className="block w-full sm:w-40 rounded-md border-border-input shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border bg-card text-text-primary"
                                                >
                                                    <option value="contains">{t('contains')}</option>
                                                    <option value="startsWith">{t('startsWith')}</option>
                                                    <option value="endsWith">{t('endsWith')}</option>
                                                    <option value="exact">{t('exact')}</option>
                                                    <option value="regex">{t('regex')}</option>
                                                </select>
                                                <input
                                                    type="text"
                                                    value={rule.description || ''}
                                                    onChange={(e) => updateRule(index, 'description', e.target.value)}
                                                    placeholder={t('descriptionPlaceholder')}
                                                    className="block flex-1 rounded-md border-border-input shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border bg-card text-text-primary"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeRule(index)}
                                            className="w-full sm:w-auto px-3 py-2 bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/25 transition text-sm border border-red-100 dark:border-red-800 mt-2 sm:mt-0"
                                        >
                                            {t('delete')}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* UA Testing Tool */}
                    <div className="border-t pt-4">
                        <label className="block text-sm font-medium text-text-secondary mb-2">{t('testUA')}</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={testUa}
                                onChange={(e) => {
                                    setTestUa(e.target.value);
                                    setTestResult(null);
                                }}
                                placeholder={t('testUaPlaceholder')}
                                className="block flex-1 rounded-md border-border-input shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border bg-card text-text-primary"
                            />
                            <button
                                type="button"
                                onClick={testUaFilter}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
                            >
                                {t('test')}
                            </button>
                        </div>
                        {testResult !== null && (
                            <div className={`mt-2 p-3 rounded-lg ${testResult ? 'bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400'}`}>
                                {testResult ? t('allowed') : t('blocked')}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
