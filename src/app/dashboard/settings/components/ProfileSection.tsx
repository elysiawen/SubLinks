'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateNickname, uploadAvatar, deleteAvatar } from '@/lib/user-actions';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { SubmitButton } from '@/components/SubmitButton';
import AvatarCropper from '@/components/AvatarCropper';

interface ProfileSectionProps {
    username: string;
    initialNickname: string;
    initialAvatar?: string;
}

export default function ProfileSection({ username, initialNickname, initialAvatar }: ProfileSectionProps) {
    const router = useRouter();
    const { success, error } = useToast();
    const { confirm } = useConfirm();

    const [nickname, setNickname] = useState(initialNickname || '');
    const [nicknameLoading, setNicknameLoading] = useState(false);

    // Avatar State
    const [avatar, setAvatar] = useState(initialAvatar);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [showCropper, setShowCropper] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);

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

    return (
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
