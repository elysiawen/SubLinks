'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ToastProvider';
import { SubmitButton } from '@/components/SubmitButton';
import UaFilterForm from '@/components/UaFilterForm';
import { UaFilterConfig } from '@/lib/database/interface';

export default function UaFilterPanel({ initialConfig, config }: { initialConfig?: any; config: any }) {
    const t = useTranslations('admin.settingsPanels.uaFilter');
    const { success, error } = useToast();
    const [currentConfig, setCurrentConfig] = useState<UaFilterConfig>(initialConfig || {
        enabled: false,
        mode: 'blacklist',
        rules: []
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const formData = new FormData();

            // Preserve other config fields
            formData.append('logRetentionDays', config.logRetentionDays?.toString() || '30');
            formData.append('maxUserSubscriptions', config.maxUserSubscriptions?.toString() || '10');
            formData.append('upstreamUserAgent', config.upstreamUserAgent || '');
            formData.append('customBackgroundUrl', config.customBackgroundUrl || '');
            formData.append('announcement', config.announcement || '');

            // Add UA filter config
            formData.append('uaFilter', JSON.stringify(currentConfig));

            const { updateGlobalConfig } = await import('../actions');
            await updateGlobalConfig(formData);
            success(t('saved'));
        } catch (e) {
            error(t('saveFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">🛡️</span> {t('heading')}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
                {t('description')}
            </p>
            <div>
                <UaFilterForm
                    value={currentConfig}
                    onChange={setCurrentConfig}
                />

                {/* Save Button */}
                <div className="pt-6">
                    <SubmitButton
                        onClick={handleSave}
                        isLoading={isSaving}
                        text={t('save')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                    />
                </div>
            </div>
        </div>
    );
}
