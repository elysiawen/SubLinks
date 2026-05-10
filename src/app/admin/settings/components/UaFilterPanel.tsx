'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ToastProvider';
import { SubmitButton } from '@/components/SubmitButton';
import UaFilterForm from '@/components/UaFilterForm';
import { UaFilterConfig } from '@/lib/database/interface';

export default function UaFilterPanel({ initialConfig }: { initialConfig?: any }) {
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
            const { updateUaFilter } = await import('../actions');
            await updateUaFilter(currentConfig);
            success(t('saved'));
        } catch (e) {
            error(t('saveFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
                <span className="mr-2">🛡️</span> {t('heading')}
            </h3>
            <p className="text-sm text-text-secondary mb-4">
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
                        className="px-4 py-2 bg-accent-button text-white rounded-lg hover:bg-accent-button-hover transition-colors font-medium shadow-sm"
                    />
                </div>
            </div>
        </div>
    );
}
