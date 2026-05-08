'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
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
    const t = useTranslations('admin.settings');
    const { success } = useToast();
    const [isCleaning, setIsCleaning] = useState(false);

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-text-primary">{t('title')}</h2>

            {/* Log Retention Settings */}
            <LogCleanupPanel initialDays={config.logRetentionDays || 30} />

            {/* UA Filter Configuration */}
            <UaFilterPanel initialConfig={config.uaFilter} />

            {/* User Limits */}
            <UserLimitsPanel config={config} />

            {/* Network Settings */}
            <NetworkSettingsPanel config={config} />

            {/* Appearance Settings */}
            <AppearanceSettingsPanel config={config} />

            {/* Storage Settings */}
            <StorageSettingsPanel config={config} />

            {/* Announcement Banner Settings */}
            <AnnouncementPanel initialValue={config.announcement || ''} />

            {/* Session Cleanup */}
            < div className="bg-card rounded-xl shadow-sm border border-border p-6" >
                <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
                    <span className="mr-2">🔐</span> {t('sessionManagement')}
                </h3>
                <p className="text-sm text-text-secondary mb-4">
                    {t('sessionDesc')}
                </p>
                <SubmitButton
                    onClick={async () => {
                        setIsCleaning(true);
                        try {
                            const { cleanupSessions } = await import('./actions');
                            const result = await cleanupSessions();
                            if (result.count > 0) {
                                success(t('sessionsCleaned', { count: result.count }));
                            } else {
                                success(t('noExpiredSessions'));
                            }
                        } finally {
                            setIsCleaning(false);
                        }
                    }}
                    isLoading={isCleaning}
                    text={t('cleanupSession')}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-sm"
                />
            </div >

            {/* Other settings placeholder */}
            < div className="bg-card rounded-xl shadow-sm border border-border p-6 opacity-60" >
                <h3 className="text-lg font-bold text-text-primary mb-4">{t('otherSettings')}</h3>
                <p className="text-text-tertiary">{t.rich('otherSettingsDesc', { link: (chunks) => <a href="/admin/sources" className="text-accent-foreground hover:underline">{chunks}</a> })}</p>
            </div >
        </div >
    );
}
