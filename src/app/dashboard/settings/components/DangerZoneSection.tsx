'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteOwnAccount } from '@/lib/user-actions';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import SecurityVerificationModal from './SecurityVerificationModal';

interface DangerZoneSectionProps {
    role: string;
}

export default function DangerZoneSection({ role }: DangerZoneSectionProps) {
    const router = useRouter();
    const { success, error } = useToast();
    const { confirm } = useConfirm();

    // Delete Account State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Handle Delete Account
    const handleDeleteAccountConfirm = async (password: string) => {
        // Step 1: Password verified (logic moved inside handle functionality after modal confirms)
        // Wait, the modal calls this logic ON CONFIRM.

        // We first need to close the password modal? 
        // Or we do the process:
        // 1. User clicks "Delete Account" -> Opens Password Modal
        // 2. User enters password, clicks "Confirm" -> Modal calls `onConfirm` with password.
        // 3. This function executes.

        // We need to implement the "Double Confirmation" flow here.
        // But `SecurityVerificationModal` is just a password prompt.
        // `client.tsx` logic: 1. Verify Password -> 2. Confirm Dialog -> 3. Execute Delete.

        // So:
        // 1. User enters password in modal.
        // 2. `onConfirm` is called with password.
        // 3. We close modal? 
        // 4. We show `confirm()` dialog.
        // 5. If confirmed, we call `deleteOwnAccount`.

        setIsDeleteModalOpen(false); // Close modal first? Or keep it open until success?
        // If we close it, how do we pass `password` to the next step? We have it in arg.

        // So logic:
        // 1. Close Modal.
        // 2. Show Confirm.
        // 3. Call API.

        setIsDeleteModalOpen(false);

        // Step 2: Double Confirmation
        if (await confirm('警告：此操作不可逆！您的所有订阅、配置和日志数据将被永久删除。确定要继续吗？', {
            confirmText: '确认注销',
            confirmColor: 'red'
        })) {
            setDeleteLoading(true);
            const result = await deleteOwnAccount(password);

            if (result?.error) {
                setDeleteLoading(false);
                error(result.error);
                // Failed. User has to start over? keeping it simple.
            } else {
                success('账户已注销');
                router.push('/login');
            }
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
            <div className="p-6 border-b border-red-50 bg-red-50/30">
                <h2 className="text-lg font-bold text-red-700 flex items-center gap-2">
                    ⚠️ 危险区域
                </h2>
                <p className="text-sm text-red-600/80 mt-1">此区域的操作不可逆，请谨慎操作</p>
            </div>
            <div className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-medium text-gray-900">注销账户</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            永久删除您的账户及其所有关联数据（订阅、配置、日志等）。
                            {role === 'admin' && <span className="block mt-1 text-red-500 font-medium">管理员账户无法直接注销。</span>}
                        </p>
                    </div>
                    <button
                        onClick={() => setIsDeleteModalOpen(true)}
                        disabled={role === 'admin' || deleteLoading}
                        className={`px-4 py-2 rounded-lg border font-medium transition-colors ${role === 'admin'
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                            : 'bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300'
                            }`}
                    >
                        注销账户
                    </button>
                </div>
            </div>

            {/* Verification Modal for Delete */}
            <SecurityVerificationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="身份验证"
                description="为了保障您的账户安全，在注销账户前我们需要验证您的登录密码。"
                onConfirm={handleDeleteAccountConfirm}
                confirmText="确认注销"
                isLoading={deleteLoading}
            />
        </div>
    );
}
