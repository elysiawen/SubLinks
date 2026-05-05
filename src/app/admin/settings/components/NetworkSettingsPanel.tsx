'use client';

import React from 'react';
import { SubmitButton } from '@/components/SubmitButton';
import { useToast } from '@/components/ToastProvider';
import { useTranslations } from 'next-intl';

export default function NetworkSettingsPanel({ config }: { config: any }) {
    const { success } = useToast();
    const t = useTranslations('admin.settingsPanels.network');

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">🌐</span> {t('heading')}
            </h3>
            <form action={async (formData) => {
                const userAgent = (formData.get('upstreamUserAgent') as string) || '';
                const { updateNetworkSettings } = await import('../actions');
                await updateNetworkSettings(userAgent);
                success(t('saved'));
            }} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('uaLabel')}</label>
                    <div className="flex flex-col space-y-2">
                        <input
                            type="text"
                            name="upstreamUserAgent"
                            defaultValue={config.upstreamUserAgent || ''}
                            placeholder="Clash/Vercel-Sub-Manager"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                        />
                        <p className="text-sm text-gray-500">
                            {t('uaHelp')} <code className="bg-gray-100 px-1 rounded">Clash/Vercel-Sub-Manager</code>
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
