'use client';

import React from 'react';
import { SubmitButton } from '@/components/SubmitButton';
import { useToast } from '@/components/ToastProvider';

export default function NetworkSettingsPanel({ config }: { config: any }) {
    const { success } = useToast();

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">🌐</span> UA设置
            </h3>
            <form action={async (formData) => {

                formData.append('upstreamSources', JSON.stringify(config.upstreamSources || []));
                formData.append('logRetentionDays', config.logRetentionDays?.toString() || '30');
                formData.append('maxUserSubscriptions', config.maxUserSubscriptions?.toString() || '0');

                // Handle UA
                const upstreamUserAgent = formData.get('upstreamUserAgent') as string;
                formData.set('upstreamUserAgent', upstreamUserAgent);

                const { updateGlobalConfig } = await import('../actions');
                await updateGlobalConfig(formData);
                success('网络设置已保存');
            }} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">上游请求 User-Agent</label>
                    <div className="flex flex-col space-y-2">
                        <input
                            type="text"
                            name="upstreamUserAgent"
                            defaultValue={config.upstreamUserAgent || ''}
                            placeholder="Clash/Vercel-Sub-Manager"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                        />
                        <p className="text-sm text-gray-500">
                            用于获取上游订阅时使用的 User-Agent。留空则使用默认值: <code className="bg-gray-100 px-1 rounded">Clash/Vercel-Sub-Manager</code>
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
