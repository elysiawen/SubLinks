'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { SubmitButton } from '@/components/SubmitButton';

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
    confirmText = '确认',
    isLoading = false
}: SecurityVerificationModalProps) {
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
                        <h4 className="font-bold text-yellow-800">安全验证</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                            {description}
                        </p>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">输入密码</label>
                    <input
                        type="password"
                        autoFocus
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                        placeholder="请输入您的当前密码"
                    />
                </div>

                <div className="flex gap-2 pt-4">
                    <SubmitButton
                        onClick={handleConfirm}
                        disabled={!password}
                        isLoading={isLoading}
                        text={confirmText}
                        className="flex-1 bg-red-600 hover:bg-red-700 shadow-none py-2"
                    />
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                        取消
                    </button>
                </div>
            </div>
        </Modal>
    );
}
