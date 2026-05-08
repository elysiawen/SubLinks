'use client';

import React from 'react';
import { SubmitButton } from '@/components/SubmitButton';
import { useToast } from '@/components/ToastProvider';
import { useTranslations } from 'next-intl';

export default function AppearanceSettingsPanel({ config }: { config: any }) {
    const { success } = useToast();
    const t = useTranslations('admin.settingsPanels.appearance');

    return (
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
                <span className="mr-2">🎨</span> {t('heading')}
            </h3>
            <form action={async (formData) => {
                const bgUrl = (formData.get('customBackgroundUrl') as string) || '';
                const { updateAppearance } = await import('../actions');
                await updateAppearance(bgUrl);
                success(t('saved'));
            }} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">{t('bgUrlLabel')}</label>
                    <div className="flex flex-col space-y-2">
                        <input
                            type="text"
                            name="customBackgroundUrl"
                            defaultValue={config.customBackgroundUrl || ''}
                            placeholder="https://example.com/background.jpg"
                            className="block w-full rounded-md border-border-input shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                        />
                        <p className="text-sm text-text-tertiary">
                            {t('bgUrlHelp')}
                        </p>
                    </div>
                </div>

                <div className="pt-2">
                    <SubmitButton text={t('save')} />
                </div>
            </form>
        </div>
    );
}
