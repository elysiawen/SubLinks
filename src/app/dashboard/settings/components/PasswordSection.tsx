'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changePassword } from '@/lib/user-actions';
import { useToast } from '@/components/ToastProvider';
import { SubmitButton } from '@/components/SubmitButton';
import { useTranslations } from 'next-intl';
import { useErrors } from '@/lib/use-errors';

export default function PasswordSection() {
    const router = useRouter();
    const { success, error } = useToast();
    const t = useTranslations('dashboard');
    const tError = useErrors();

    // Password State
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);

    // Handle Password Change
    const handleChangePassword = async () => {
        if (!oldPassword || !newPassword || !confirmPassword) {
            error(t('settings.password.fillAll'));
            return;
        }

        if (newPassword !== confirmPassword) {
            error(t('settings.password.mismatch'));
            return;
        }

        if (newPassword.length < 4) {
            error(t('settings.password.tooShort'));
            return;
        }

        setPasswordLoading(true);
        const result = await changePassword(oldPassword, newPassword);
        setPasswordLoading(false);

        if (result.error) {
            error(tError(result.error));
        } else {
            success(t('settings.password.success'));
            setTimeout(() => {
                router.push('/auth/login');
            }, 1500);
        }
    };

    return (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="p-6 border-b border-border">
                <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    {t('settings.password.heading')}
                </h2>
                <p className="text-sm text-text-tertiary mt-1">{t('settings.password.description')}</p>
            </div>
            <div className="p-6 space-y-4 max-w-lg">
                <div>
                    <label className="block text-sm font-semibold text-text-secondary mb-2">{t('settings.password.current')}</label>
                    <input
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="w-full border border-border-input rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder={t('settings.password.currentPlaceholder')}
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-text-secondary mb-2">{t('settings.password.new')}</label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full border border-border-input rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder={t('settings.password.newPlaceholder')}
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-text-secondary mb-2">{t('settings.password.confirm')}</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full border border-border-input rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder={t('settings.password.confirmPlaceholder')}
                    />
                </div>
                <div className="pt-2">
                    <SubmitButton
                        text={t('settings.password.save')}
                        onClick={handleChangePassword}
                        isLoading={passwordLoading}
                        className="w-full sm:w-auto"
                    />
                </div>
            </div>
        </div>
    );
}
