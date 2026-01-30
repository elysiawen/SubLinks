'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import { SubmitButton } from '@/components/SubmitButton';

// Imported Components
import LogCleanupPanel from './components/LogCleanupPanel';
import UaFilterPanel from './components/UaFilterPanel';
import AnnouncementPanel from './components/AnnouncementPanel';
import UserLimitsPanel from './components/UserLimitsPanel';
import NetworkSettingsPanel from './components/NetworkSettingsPanel';
import AppearanceSettingsPanel from './components/AppearanceSettingsPanel';
import StorageSettingsPanel from './components/StorageSettingsPanel';

export default function AdminSettingsClient({ config }: { config: any }) {
    const { success } = useToast();
    const [isCleaning, setIsCleaning] = useState(false);

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-800">全局设置</h2>

            {/* Log Retention Settings */}
            <LogCleanupPanel initialDays={config.logRetentionDays || 30} />

            {/* UA Filter Configuration */}
            <UaFilterPanel initialConfig={config.uaFilter} config={config} />

            {/* User Limits */}
            <UserLimitsPanel config={config} />

            {/* Network Settings */}
            <NetworkSettingsPanel config={config} />

            {/* Appearance Settings */}
            <AppearanceSettingsPanel config={config} />

            {/* Storage Settings */}
            <StorageSettingsPanel config={config} />

            {/* Announcement Banner Settings */}
            <AnnouncementPanel initialValue={config.announcement || ''} config={config} />

            {/* Session Cleanup */}
            < div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6" >
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">🔐</span> Session 管理
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    系统会每小时自动清理过期的 session。您也可以手动触发清理。
                </p>
                <SubmitButton
                    onClick={async () => {
                        setIsCleaning(true);
                        try {
                            const { cleanupSessions } = await import('./actions');
                            const result = await cleanupSessions();
                            if (result.count > 0) {
                                success(`已清理 ${result.count} 个过期 session`);
                            } else {
                                success('没有过期的 session');
                            }
                        } finally {
                            setIsCleaning(false);
                        }
                    }}
                    isLoading={isCleaning}
                    text="立即清理过期 Session"
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-sm"
                />
            </div >

            {/* Other settings placeholder */}
            < div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 opacity-60" >
                <h3 className="text-lg font-bold text-gray-800 mb-4">其他设置</h3>
                <p className="text-gray-500">上游源和缓存设置请前往 <a href="/admin/sources" className="text-blue-600 hover:underline">上游源管理</a> 页面配置。</p>
            </div >
        </div >
    );
}
