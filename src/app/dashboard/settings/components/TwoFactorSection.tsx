'use client';

import { useState } from 'react';
import { setup2FA, enable2FA, disable2FA } from '@/lib/user-actions';
import { useToast } from '@/components/ToastProvider';
import { SubmitButton } from '@/components/SubmitButton';
import Modal from '@/components/Modal';
import SecurityVerificationModal from './SecurityVerificationModal';

interface TwoFactorSectionProps {
    initialTotpEnabled: boolean;
}

export default function TwoFactorSection({ initialTotpEnabled }: TwoFactorSectionProps) {
    const { success, error } = useToast();

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
            error('请输入验证码');
            return;
        }
        if (!secret) return;

        setTwoFALoading(true);
        const result = await enable2FA(secret, token);
        setTwoFALoading(false);

        if (result.error) {
            error(result.error);
        } else {
            success('两步验证已启用');
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
            success('两步验证已关闭');
            setTwoFAEnabled(false);
            setShowDisableVerify(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    🛡️ 两步验证 (2FA)
                </h2>
                <p className="text-sm text-gray-500 mt-1">使用 Google Authenticator 或其他应用生成验证码</p>
            </div>
            <div className="p-6 space-y-4 max-w-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-gray-900">
                            当前状态:
                            <span className={`ml-2 px-2 py-1 rounded text-xs ${twoFAEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {twoFAEnabled ? '已启用' : '未启用'}
                            </span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            {twoFAEnabled
                                ? '您的账户已受到两步验证保护'
                                : '建议启用两步验证以提高账户安全性'}
                        </p>
                    </div>
                    <button
                        onClick={twoFAEnabled ? () => setShowDisableVerify(true) : handleSetup2FA}
                        disabled={twoFALoading}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${twoFAEnabled
                            ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                    >
                        {twoFALoading ? '处理中...' : (twoFAEnabled ? '关闭 2FA' : '启用 2FA')}
                    </button>
                </div>
            </div>

            {/* 2FA Setup Modal */}
            <Modal
                isOpen={show2FAModal}
                onClose={() => setShow2FAModal(false)}
                title="启用两步验证"
            >
                <div className="space-y-6">
                    <div className="text-center">
                        <p className="text-sm text-gray-600 mb-4">
                            请使用 Google Authenticator 或其他应用扫描下方二维码
                        </p>
                        {qrCode && (
                            <div className="flex justify-center mb-4">
                                <img src={qrCode} alt="2FA QR Code" className="w-48 h-48 border border-gray-200 rounded-lg" />
                            </div>
                        )}
                        {secret && (
                            <p className="text-xs text-gray-400 font-mono select-all">密钥: {secret}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">输入 6 位验证码</label>
                        <input
                            type="text"
                            value={token}
                            onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="w-full text-center tracking-[0.5em] text-2xl font-mono border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="000000"
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <SubmitButton
                            text="启用验证"
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
                title="关闭两步验证"
                description="为了保障您的账户安全，在关闭两步验证前我们需要验证您的登录密码。"
                onConfirm={handleDisable2FAConfirm}
                confirmText="确认关闭"
                isLoading={disableLoading}
            />
        </div>
    );
}
