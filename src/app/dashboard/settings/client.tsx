'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changePassword, deleteOwnAccount, updateNickname, uploadAvatar, deleteAvatar } from '@/lib/user-actions';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { SubmitButton } from '@/components/SubmitButton';
import Modal from '@/components/Modal';
import AvatarCropper from '@/components/AvatarCropper';

interface SettingsClientProps {
    username: string;
    role: string;
    nickname?: string;
    avatar?: string;
}

export default function SettingsClient({ username, role, nickname: initialNickname, avatar: initialAvatar }: SettingsClientProps) {
    const router = useRouter();
    const { success, error } = useToast();
    const { confirm } = useConfirm();

    // Nickname State
    const [nickname, setNickname] = useState(initialNickname || '');
    const [nicknameLoading, setNicknameLoading] = useState(false);

    // Avatar State
    const [avatar, setAvatar] = useState(initialAvatar);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [showCropper, setShowCropper] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);

    // Password State
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);

    // Delete Account State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [verifyPassword, setVerifyPassword] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Handle Nickname Update
    const handleUpdateNickname = async () => {
        setNicknameLoading(true);
        const result = await updateNickname(nickname);
        setNicknameLoading(false);

        if (result.error) {
            error(result.error);
        } else {
            success('昵称更新成功');
            router.refresh();
        }
    };

    // Handle Avatar File Selection
    const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
            error('文件大小不能超过 10MB');
            return;
        }

        // Check file type
        if (!file.type.startsWith('image/')) {
            error('只支持图片文件');
            return;
        }

        // Create preview URL
        const reader = new FileReader();
        reader.onload = (e) => {
            setAvatarPreview(e.target?.result as string);
            setShowCropper(true);
        };
        reader.readAsDataURL(file);

        // Reset input value to allow selecting same file again
        e.target.value = '';
    };

    // Handle Avatar Upload (after cropping)
    const handleAvatarUpload = async (croppedImage: Blob) => {
        setAvatarUploading(true);
        setShowCropper(false);

        try {
            const formData = new FormData();
            formData.append('avatar', croppedImage, 'avatar.webp');

            const result = await uploadAvatar(formData);

            if (result.error) {
                error(result.error);
            } else {
                setAvatar(result.avatarUrl);
                success('头像上传成功');
                router.refresh();
            }
        } catch (err) {
            error('上传失败，请稍后重试');
        } finally {
            setAvatarUploading(false);
            setAvatarPreview(null);
        }
    };

    // Handle Avatar Delete
    const handleAvatarDelete = async () => {
        if (!avatar) return;

        if (await confirm('确定要删除头像吗？')) {
            setAvatarUploading(true);

            try {
                const result = await deleteAvatar();

                if (result.error) {
                    error(result.error);
                } else {
                    setAvatar(undefined);
                    success('头像已删除');
                    router.refresh();
                }
            } catch (err) {
                error('删除失败，请稍后重试');
            } finally {
                setAvatarUploading(false);
            }
        }
    };

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
            // Wait a moment for user to see the success message
            setTimeout(() => {
                router.push('/login');
            }, 1500);
        }
    };

    // Handle Delete Account
    const handleDeleteAccount = async () => {
        if (!verifyPassword) {
            error('请输入密码以验证身份');
            return;
        }

        // Close password verification modal first
        setIsDeleteModalOpen(false);

        // Step 2: Double Confirmation
        if (await confirm('警告：此操作不可逆！您的所有订阅、配置和日志数据将被永久删除。确定要继续吗？', {
            confirmText: '确认注销',
            confirmColor: 'red'
        })) {
            // Step 3: Triple Confirmation (as requested "再三确认", though confirm dialog is step 2. 
            // We can add one more strict check or just rely on the confirm dialog which is quite explicit.)
            // Let's rely on the confirm dialog being the "Second" confirmation after the "First" password entry step.
            // Actually, let's make it super clear.

            setDeleteLoading(true);
            const result = await deleteOwnAccount(verifyPassword);

            if (result?.error) {
                setDeleteLoading(false);
                error(result.error);
                // Re-open modal if failed? Maybe just let user retry.
            } else {
                success('账户已注销');
                router.push('/login');
            }
        } else {
            setDeleteLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">账户设置</h1>
                <p className="text-sm text-gray-500 mt-1">管理您的个人资料和安全设置</p>
            </div>

            {/* Profile Section - Nickname */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        👤 个人资料
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">设置您的显示昵称</p>
                </div>
                <div className="p-6 space-y-4 max-w-lg">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">用户名</label>
                        <input
                            type="text"
                            value={username}
                            disabled
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500 mt-1">用户名用于登录，无法修改</p>
                    </div>

                    {/* Avatar Upload */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">头像</label>
                        <div className="flex items-center gap-4">
                            {/* Avatar Preview */}
                            <div className="relative">
                                <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200">
                                    {avatar ? (
                                        <img src={avatar} alt="头像" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
                                            👤
                                        </div>
                                    )}
                                </div>
                                {avatarUploading && (
                                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                        <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                    </div>
                                )}
                            </div>

                            {/* Upload/Delete Buttons */}
                            <div className="flex-1 space-y-2">
                                <input
                                    type="file"
                                    id="avatar-upload"
                                    accept="image/*"
                                    onChange={handleAvatarFileSelect}
                                    className="hidden"
                                    disabled={avatarUploading}
                                />
                                <label
                                    htmlFor="avatar-upload"
                                    className={`inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer text-sm font-medium ${avatarUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {avatar ? '更换头像' : '上传头像'}
                                </label>
                                {avatar && (
                                    <button
                                        onClick={handleAvatarDelete}
                                        disabled={avatarUploading}
                                        className="ml-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        删除头像
                                    </button>
                                )}
                                <p className="text-xs text-gray-500">支持 JPG、PNG、WebP 格式，最大 10MB</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">昵称（可选）</label>
                        <input
                            type="text"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="设置您的显示昵称"
                            maxLength={50}
                        />
                        <p className="text-xs text-gray-500 mt-1">昵称将在界面中显示，留空则显示用户名</p>
                    </div>
                    <div className="pt-2">
                        <SubmitButton
                            text="保存昵称"
                            onClick={handleUpdateNickname}
                            isLoading={nicknameLoading}
                            className="w-full sm:w-auto"
                        />
                    </div>
                </div>
            </div>

            {/* Change Password Section */}
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

            {/* Danger Zone */}
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
            </div>

            {/* Verification Modal for Delete */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="身份验证"
            >
                <div className="space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
                        <span className="text-2xl">🛡️</span>
                        <div>
                            <h4 className="font-bold text-yellow-800">安全验证</h4>
                            <p className="text-sm text-yellow-700 mt-1">
                                为了保障您的账户安全，在注销账户前我们需要验证您的登录密码。
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">输入密码</label>
                        <input
                            type="password"
                            autoFocus
                            value={verifyPassword}
                            onChange={(e) => setVerifyPassword(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                            placeholder="请输入您的当前密码"
                        />
                    </div>

                    <div className="flex gap-2 pt-4">
                        <button
                            onClick={handleDeleteAccount}
                            disabled={!verifyPassword}
                            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            下一步
                        </button>
                        <button
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                        >
                            取消
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Avatar Cropper */}
            {showCropper && avatarPreview && (
                <AvatarCropper
                    image={avatarPreview}
                    onCropComplete={handleAvatarUpload}
                    onCancel={() => {
                        setShowCropper(false);
                        setAvatarPreview(null);
                    }}
                />
            )}
        </div>
    );
}
