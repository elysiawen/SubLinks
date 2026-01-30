'use client';

import React, { useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import { SubmitButton } from '@/components/SubmitButton';
import UaFilterForm from '@/components/UaFilterForm';
import { UaFilterConfig } from '@/lib/database/interface';

export default function UaFilterPanel({ initialConfig, config }: { initialConfig?: any; config: any }) {
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
            success('UA 过滤配置已保存');
        } catch (e) {
            error('保存失败');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">🛡️</span> UA 过滤配置
            </h3>
            <p className="text-sm text-gray-600 mb-4">
                配置订阅 API 的 User-Agent 过滤规则。注意：微信和 QQ 已在 Middleware 层拦截，无需在此配置。
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
                        text="保存 UA 过滤配置"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                    />
                </div>
            </div>
        </div>
    );
}
