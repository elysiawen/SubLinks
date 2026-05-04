'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';

export default function LogCleanupPanel({ initialDays }: { initialDays: number }) {
    const t = useTranslations('admin.settingsPanels.logCleanup');
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const [isCleaning, setIsCleaning] = useState(false);

    // Retention Days State
    const isPreset = [30, 180, 365, 0].includes(initialDays);
    const [mode, setMode] = useState<string>(isPreset ? initialDays.toString() : 'custom');
    const [customDays, setCustomDays] = useState(isPreset ? 30 : initialDays);

    // Log Types State
    const [logTypes, setLogTypes] = useState({
        api: true,
        web: true,
        system: true
    });

    const getDays = () => {
        if (mode === 'custom') return customDays;
        return parseInt(mode);
    };

    const handleCleanup = async () => {
        const days = getDays();
        const types = Object.entries(logTypes).filter(([_, checked]) => checked).map(([key]) => key);

        if (types.length === 0) {
            error(t('selectTypeError'));
            return;
        }

        if (days < 0) {
            error(t('invalidDaysError'));
            return;
        }

        if (await confirm(t('confirmMsg', { days: days === 0 ? t('confirmDaysNone') : t('confirmDays', { days }), types: types.join(', ') }), { confirmColor: 'red', confirmText: t('confirmButton') })) {
            setIsCleaning(true);
            try {
                const { clearLogs } = await import('../actions');
                const res = await clearLogs(days, types);
                if (res?.success) {
                    success(t('cleanedSuccess'));
                } else {
                    error(t('cleanFailed'));
                }
            } finally {
                setIsCleaning(false);
            }
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">🗑️</span> {t('heading')}
            </h3>

            <div className="space-y-6">
                {/* Retention Days Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('retentionLabel')}</label>
                    <div className="flex items-center gap-4">
                        <select
                            value={mode}
                            onChange={(e) => setMode(e.target.value)}
                            className="block w-48 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border bg-white text-gray-900"
                        >
                            <option value="30">{t('preset30')}</option>
                            <option value="180">{t('preset180')}</option>
                            <option value="365">{t('preset365')}</option>
                            <option value="0">{t('presetAll')}</option>
                            <option value="custom">{t('customDays')}</option>
                        </select>

                        {mode === 'custom' && (
                            <div className="flex items-center space-x-2 animate-in fade-in slide-in-from-left-2 duration-200">
                                <input
                                    type="number"
                                    value={customDays}
                                    onChange={(e) => setCustomDays(parseInt(e.target.value) || 0)}
                                    min="0"
                                    className="block w-24 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                                    placeholder={t('daysPlaceholder')}
                                />
                                <span className="text-gray-500 text-sm">{t('daysSuffix')}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Log Types Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('scopeLabel')}</label>
                    <div className="flex items-center flex-wrap gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <label className="inline-flex items-center space-x-2 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition">
                            <input
                                type="checkbox"
                                checked={logTypes.api}
                                onChange={(e) => setLogTypes(prev => ({ ...prev, api: e.target.checked }))}
                                className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 h-4 w-4"
                            />
                            <span className="text-sm font-medium text-gray-700">{t('apiLogs')}</span>
                        </label>

                        <label className="inline-flex items-center space-x-2 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition">
                            <input
                                type="checkbox"
                                checked={logTypes.web}
                                onChange={(e) => setLogTypes(prev => ({ ...prev, web: e.target.checked }))}
                                className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 h-4 w-4"
                            />
                            <span className="text-sm font-medium text-gray-700">{t('webLogs')}</span>
                        </label>

                        <label className="inline-flex items-center space-x-2 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition">
                            <input
                                type="checkbox"
                                checked={logTypes.system}
                                onChange={(e) => setLogTypes(prev => ({ ...prev, system: e.target.checked }))}
                                className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 h-4 w-4"
                            />
                            <span className="text-sm font-medium text-gray-700">{t('systemLogs')}</span>
                        </label>

                        <div className="flex-1"></div>

                        <button
                            type="button"
                            onClick={handleCleanup}
                            disabled={isCleaning}
                            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm font-medium"
                        >
                            {isCleaning ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {t('cleaning')}
                                </>
                            ) : (
                                <>
                                    <span className="mr-2">🧹</span>
                                    {getDays() === 0 ? t('clearAll') : t('executeClean')}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <p className="text-sm text-gray-500">
                    💡 {t('helpText', { days: getDays() })}
                </p>
            </div>
        </div>
    );
}
