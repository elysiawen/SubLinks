'use client';

import React from 'react';
import { SubmitButton } from '@/components/SubmitButton';
import { useToast } from '@/components/ToastProvider';

export default function AppearanceSettingsPanel({ config }: { config: any }) {
    const { success } = useToast();

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">🎨</span> 外观设置
            </h3>
            <form action={async (formData) => {

                formData.append('upstreamSources', JSON.stringify(config.upstreamSources || []));
                formData.append('logRetentionDays', config.logRetentionDays?.toString() || '30');
                formData.append('maxUserSubscriptions', config.maxUserSubscriptions?.toString() || '0');
                formData.append('upstreamUserAgent', config.upstreamUserAgent || '');

                const { updateGlobalConfig } = await import('../actions');
                await updateGlobalConfig(formData);
                success('外观设置已保存');
            }} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">首页背景图片 URL</label>
                    <div className="flex flex-col space-y-2">
                        <input
                            type="text"
                            name="customBackgroundUrl"
                            defaultValue={config.customBackgroundUrl || ''}
                            placeholder="https://example.com/background.jpg"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                        />
                        <p className="text-sm text-gray-500">
                            自定义首页背景图片。留空则使用默认渐变背景。支持 JPG、PNG、WebP 等格式。
                        </p>
                    </div>
                </div>

                <div className="pt-2">
                    <SubmitButton text="保存设置" />
                </div>
            </form>
        </div>
    );
}
