'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changePassword } from '@/lib/user-actions';
import { useToast } from '@/components/ToastProvider';
import { SubmitButton } from '@/components/SubmitButton';

export default function PasswordSection() {
    const router = useRouter();
    const { success, error } = useToast();

    // Password State
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);

    // Handle Password Change
    const handleChangePassword = async () => {
        if (!oldPassword || !newPassword || !confirmPassword) {
            error('请填写所有字段');
            return;
        }

        if (newPassword !== confirmPassword) {
            error('两次输入的新密码不一致');
            return;
        }

        if (newPassword.length < 4) {
            error('新密码至少需要4个字符');
            return;
        }

        setPasswordLoading(true);
        const result = await changePassword(oldPassword, newPassword);
        setPasswordLoading(false);

        if (result.error) {
            error(result.error);
        } else {
            success('密码修改成功,请重新登录');
            setTimeout(() => {
                router.push('/login');
            }, 1500);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    🔐 修改密码
                </h2>
                <p className="text-sm text-gray-500 mt-1">建议定期更换密码以保障账户安全</p>
            </div>
            <div className="p-6 space-y-4 max-w-lg">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">当前密码</label>
                    <input
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="输入当前使用的密码"
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">新密码</label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="设置新密码 (最少4位)"
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">确认新密码</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="再次输入新密码"
                    />
                </div>
                <div className="pt-2">
                    <SubmitButton
                        text="保存新密码"
                        onClick={handleChangePassword}
                        isLoading={passwordLoading}
                        className="w-full sm:w-auto"
                    />
                </div>
            </div>
        </div>
    );
}
