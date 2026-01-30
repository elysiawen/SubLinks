'use client';

import React from 'react';
import { SubmitButton } from '@/components/SubmitButton';
import { useToast } from '@/components/ToastProvider';

export default function UserLimitsPanel({ config }: { config: any }) {
    const { success } = useToast();

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">👤</span> 用户限制
            </h3>
            <form action={async (formData) => {

                formData.append('upstreamSources', JSON.stringify(config.upstreamSources || []));
                formData.append('logRetentionDays', config.logRetentionDays?.toString() || '30');

                // Handle max subs
                const maxSubs = formData.get('maxUserSubscriptions') as string;
                formData.set('maxUserSubscriptions', maxSubs);

                const { updateGlobalConfig } = await import('../actions');
                await updateGlobalConfig(formData);
                success('用户限制设置已保存');
            }} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">每个用户最大订阅数</label>
                    <div className="flex items-center space-x-2">
                        <input
                            type="number"
                            name="maxUserSubscriptions"
                            defaultValue={config.maxUserSubscriptions ?? 0}
                            min="0"
                            className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                        />
                        <span className="text-gray-500 text-sm">条 (0 表示不限制)</span>
                    </div>
                </div>

                <div className="pt-2">
                    <SubmitButton text="保存设置" />
                </div>
            </form>
        </div>
    );
}
