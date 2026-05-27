'use client';

import ProfileSection from './components/ProfileSection';
import TwoFactorSection from './components/TwoFactorSection';
import PasswordSection from './components/PasswordSection';
import DangerZoneSection from './components/DangerZoneSection';
import PasskeySection from './components/PasskeySection';
import OAuthSection from './components/OAuthSection';
import { useTranslations } from 'next-intl';

interface SettingsClientProps {
    username: string;
    role: string;
    nickname?: string;
    avatar?: string;
    totpEnabled: boolean;
}

export default function SettingsClient({
    username,
    role,
    nickname,
    avatar,
    totpEnabled
}: SettingsClientProps) {
    const t = useTranslations('dashboard');
    return (
        <div className="p-6 max-w-4xl mx-auto space-y-10">
            <div>
                <h1 className="text-2xl font-bold text-text-primary">{t('settings.heading')}</h1>
                <p className="text-sm text-text-tertiary mt-1">{t('settings.description')}</p>
            </div>

            {/* Profile Section */}
            <ProfileSection
                username={username}
                initialNickname={nickname || ''}
                initialAvatar={avatar}
            />

            {/* 2FA Section */}
            <TwoFactorSection initialTotpEnabled={totpEnabled} />

            {/* Passkey Section */}
            <PasskeySection />

            {/* OAuth Section */}
            <OAuthSection />

            {/* Password Section */}
            <PasswordSection />

            {/* Danger Zone */}
            <DangerZoneSection role={role} />
        </div>
    );
}
