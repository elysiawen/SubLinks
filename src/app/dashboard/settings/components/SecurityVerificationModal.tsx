'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { SubmitButton } from '@/components/SubmitButton';
import { useTranslations } from 'next-intl';

interface SecurityVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    onConfirm: (password: string) => Promise<void>;
    confirmText?: string;
    isLoading?: boolean;
}

export default function SecurityVerificationModal({
    isOpen,
    onClose,
    title,
    description,
    onConfirm,
    confirmText,
    isLoading = false
}: SecurityVerificationModalProps) {
    const t = useTranslations('dashboard');
    const [password, setPassword] = useState('');

    const handleConfirm = async () => {
        if (!password) return;
        await onConfirm(password);
        setPassword(''); // Clear password after attempt (optional, or stick if failed? usually stick if failed to allow retry, but strictly clearing is safer. Parent handles close.)
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
        >
            <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
                    <span className="text-2xl">🛡️</span>
                    <div>
                        <h4 className="font-bold text-yellow-800">{t('settings.securityModal.heading')}</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                            {description}
                        </p>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-text-secondary mb-2">{t('settings.securityModal.passwordLabel')}</label>
                    <input
                        type="password"
                        autoFocus
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border border-border-input rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                        placeholder={t('settings.securityModal.passwordPlaceholder')}
                    />
                </div>

                <div className="flex gap-2 pt-4">
                    <SubmitButton
                        onClick={handleConfirm}
                        disabled={!password}
                        isLoading={isLoading}
                        text={confirmText || 'Confirm'}
                        className="flex-1 bg-red-600 hover:bg-red-700 shadow-none py-2"
                    />
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-border-input text-text-secondary rounded-lg hover:bg-muted transition-colors font-medium"
                    >
                        {t('settings.securityModal.cancel')}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
