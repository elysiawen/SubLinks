'use client';

import ProfileSection from './components/ProfileSection';
import TwoFactorSection from './components/TwoFactorSection';
import PasswordSection from './components/PasswordSection';
import DangerZoneSection from './components/DangerZoneSection';
import PasskeySection from './components/PasskeySection';

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
    return (
        <div className="p-6 max-w-4xl mx-auto space-y-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">账户设置</h1>
                <p className="text-sm text-gray-500 mt-1">管理您的个人资料和安全设置</p>
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

            {/* Password Section */}
            <PasswordSection />

            {/* Danger Zone */}
            <DangerZoneSection role={role} />
        </div>
    );
}
