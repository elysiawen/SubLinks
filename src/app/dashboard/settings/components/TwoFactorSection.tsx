'use client';

import { useState } from 'react';
import { setup2FA, enable2FA, disable2FA } from '@/lib/user-actions';
import { useToast } from '@/components/ToastProvider';
import { SubmitButton } from '@/components/SubmitButton';
import Modal from '@/components/Modal';
import SecurityVerificationModal from './SecurityVerificationModal';
import { useTranslations } from 'next-intl';

interface TwoFactorSectionProps {
    initialTotpEnabled: boolean;
}

export default function TwoFactorSection({ initialTotpEnabled }: TwoFactorSectionProps) {
    const { success, error } = useToast();
    const t = useTranslations('dashboard');

    // 2FA State
    const [twoFAEnabled, setTwoFAEnabled] = useState(initialTotpEnabled);
    const [show2FAModal, setShow2FAModal] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [secret, setSecret] = useState<string | null>(null);
    const [token, setToken] = useState('');
    const [twoFALoading, setTwoFALoading] = useState(false);

    // Disable 2FA Verification Modal
    const [showDisableVerify, setShowDisableVerify] = useState(false);
    const [disableLoading, setDisableLoading] = useState(false);

    // 2FA Handlers
    const handleSetup2FA = async () => {
        setTwoFALoading(true);
        const result = await setup2FA();
        setTwoFALoading(false);
        if (result.error) {
            error(result.error);
        } else {
            // Check for valid strings before setting state
            setSecret(result.secret || null);
            setQrCode(result.qrCode || null);
            setShow2FAModal(true);
        }
    };

    const handleEnable2FA = async () => {
        if (!token) {
            error(t('settings.twoFactor.enterCode'));
            return;
        }
        if (!secret) return;

        setTwoFALoading(true);
        const result = await enable2FA(secret, token);
        setTwoFALoading(false);

        if (result.error) {
            error(result.error);
        } else {
            success(t('settings.twoFactor.enabledSuccess'));
            setTwoFAEnabled(true);
            setShow2FAModal(false);
            setToken('');
            setSecret(null);
        }
    };

    const handleDisable2FAConfirm = async (password: string) => {
        setDisableLoading(true);
        const result = await disable2FA(password);
        setDisableLoading(false);

        if (result.error) {
            error(result.error);
        } else {
            success(t('settings.twoFactor.disabledSuccess'));
            setTwoFAEnabled(false);
            setShowDisableVerify(false);
        }
    };

    return (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="p-6 border-b border-border">
                <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    {t('settings.twoFactor.heading')}
                </h2>
                <p className="text-sm text-text-tertiary mt-1">{t('settings.twoFactor.description')}</p>
            </div>
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-text-primary">
                            {t('settings.twoFactor.statusLabel')}
                            <span className={`ml-2 px-2 py-1 rounded text-xs ${twoFAEnabled ? 'bg-green-100 text-green-700' : 'bg-muted text-text-tertiary'}`}>
                                {twoFAEnabled ? t('settings.twoFactor.enabled') : t('settings.twoFactor.disabled')}
                            </span>
                        </p>
                        <p className="text-xs text-text-tertiary mt-1">
                            {twoFAEnabled
                                ? t('settings.twoFactor.enabledDesc')
                                : t('settings.twoFactor.disabledDesc')}
                        </p>
                    </div>
                    <button
                        onClick={twoFAEnabled ? () => setShowDisableVerify(true) : handleSetup2FA}
                        disabled={twoFALoading}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${twoFAEnabled
                            ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900'
                            : 'bg-accent-button text-white hover:bg-accent-button-hover'
                            }`}
                    >
                        {twoFALoading ? t('settings.twoFactor.processing') : (twoFAEnabled ? t('settings.twoFactor.disable') : t('settings.twoFactor.enable'))}
                    </button>
                </div>
            </div>

            {/* 2FA Setup Modal */}
            <Modal
                isOpen={show2FAModal}
                onClose={() => setShow2FAModal(false)}
                title={t('settings.twoFactor.setupTitle')}
            >
                <div className="space-y-6">
                    <div className="text-center">
                        <p className="text-sm text-text-secondary mb-4">
                            {t('settings.twoFactor.scanQR')}
                        </p>
                        {qrCode && (
                            <div className="flex justify-center mb-4">
                                <img src={qrCode} alt="2FA QR Code" className="w-48 h-48 border border-border-strong rounded-lg" />
                            </div>
                        )}
                        {secret && (
                            <div className="flex items-center justify-center gap-2">
                                <p className="text-xs text-text-quaternary font-mono select-all">{t('settings.twoFactor.secret')} {secret}</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(secret);
                                        success(t('settings.twoFactor.secretCopied'));
                                    }}
                                    className="text-text-tertiary hover:text-text-primary transition-colors"
                                    title={t('settings.twoFactor.copySecret')}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-text-secondary mb-2">{t('settings.twoFactor.verificationCode')}</label>
                        <input
                            type="text"
                            value={token}
                            onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="w-full text-center tracking-[0.5em] text-2xl font-mono border border-border-input rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="000000"
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <SubmitButton
                            text={t('settings.twoFactor.verify')}
                            onClick={handleEnable2FA}
                            isLoading={twoFALoading}
                            className="w-full"
                            disabled={token.length !== 6}
                        />
                    </div>
                </div>
            </Modal>

            {/* Disable 2FA Verification */}
            <SecurityVerificationModal
                isOpen={showDisableVerify}
                onClose={() => setShowDisableVerify(false)}
                title={t('settings.twoFactor.disableTitle')}
                description={t('settings.twoFactor.disableDesc')}
                onConfirm={handleDisable2FAConfirm}
                confirmText={t('settings.twoFactor.disableConfirm')}
                isLoading={disableLoading}
            />
        </div>
    );
}
