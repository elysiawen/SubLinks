'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { SubmitButton } from '@/components/SubmitButton';
import { useToast } from '@/components/ToastProvider';

export default function UserLimitsPanel({ config }: { config: any }) {
    const t = useTranslations('admin.settingsPanels.userLimits');
    const { success } = useToast();

    return (
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
                <span className="mr-2">👤</span> {t('heading')}
            </h3>
            <form action={async (formData) => {
                const maxSubs = parseInt(formData.get('maxUserSubscriptions') as string) || 0;
                const { updateUserLimits } = await import('../actions');
                await updateUserLimits(maxSubs);
                success(t('saved'));
            }} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">{t('maxSubsLabel')}</label>
                    <div className="flex items-center space-x-2">
                        <input
                            type="number"
                            name="maxUserSubscriptions"
                            defaultValue={config.maxUserSubscriptions ?? 0}
                            min="0"
                            className="block w-32 rounded-md border-border-input shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                        />
                        <span className="text-text-tertiary text-sm">{t('maxSubsSuffix')}</span>
                    </div>
                </div>

                <div className="pt-2">
                    <SubmitButton text={t('save')} />
                </div>
            </form>
        </div>
    );
}
