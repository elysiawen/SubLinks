'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateNickname, uploadAvatar, deleteAvatar } from '@/lib/user-actions';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { SubmitButton } from '@/components/SubmitButton';
import AvatarCropper from '@/components/AvatarCropper';
import { useTranslations } from 'next-intl';
import { useErrors } from '@/lib/use-errors';

interface ProfileSectionProps {
    username: string;
    initialNickname: string;
    initialAvatar?: string;
}

export default function ProfileSection({ username, initialNickname, initialAvatar }: ProfileSectionProps) {
    const router = useRouter();
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const t = useTranslations('dashboard');
    const tError = useErrors();

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
            success(t('settings.profile.nicknameUpdated'));
            router.refresh();
        }
    };

    // Handle Avatar File Selection
    const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
            error(t('settings.profile.fileTooLarge'));
            return;
        }

        // Check file type
        if (!file.type.startsWith('image/')) {
            error(t('settings.profile.imageOnly'));
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
                error(tError(result.error));
            } else {
                setAvatar(result.avatarUrl);
                success(t('settings.profile.avatarUploaded'));
                router.refresh();
            }
        } catch (err) {
            error(t('settings.profile.uploadFailed'));
        } finally {
            setAvatarUploading(false);
            setAvatarPreview(null);
        }
    };

    // Handle Avatar Delete
    const handleAvatarDelete = async () => {
        if (!avatar) return;

        if (await confirm(t('settings.profile.deleteAvatarConfirm'), { confirmColor: 'red' })) {
            setAvatarUploading(true);

            try {
                const result = await deleteAvatar();

                if (result.error) {
                    error(tError(result.error));
                } else {
                    setAvatar(undefined);
                    success(t('settings.profile.avatarDeleted'));
                    router.refresh();
                }
            } catch (err) {
                error(t('settings.profile.deleteFailed'));
            } finally {
                setAvatarUploading(false);
            }
        }
    };

    return (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="p-6 border-b border-border">
                <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    {t('settings.profile.heading')}
                </h2>
                <p className="text-sm text-text-tertiary mt-1">{t('settings.profile.description')}</p>
            </div>
            <div className="p-6 space-y-4 max-w-lg">
                <div>
                    <label className="block text-sm font-semibold text-text-secondary mb-2">{t('settings.profile.username')}</label>
                    <input
                        type="text"
                        value={username}
                        disabled
                        className="w-full border border-border-input rounded-lg px-4 py-2 bg-muted text-text-tertiary cursor-not-allowed"
                    />
                    <p className="text-xs text-text-tertiary mt-1">{t('settings.profile.usernameHelp')}</p>
                </div>

                {/* Avatar Upload */}
                <div>
                    <label className="block text-sm font-semibold text-text-secondary mb-3">{t('settings.profile.avatar')}</label>
                    <div className="flex items-center gap-4">
                        {/* Avatar Preview */}
                        <div className="relative">
                            <div className="w-20 h-20 rounded-full overflow-hidden bg-muted border-2 border-border-strong">
                                {avatar ? (
                                    <img src={avatar} alt={t('settings.profile.avatarAlt')} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-text-quaternary text-2xl">
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
                                className={`inline-block px-4 py-2 bg-accent-button text-white rounded-lg hover:bg-accent-button-hover transition-colors cursor-pointer text-sm font-medium ${avatarUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {avatar ? t('settings.profile.changeAvatar') : t('settings.profile.uploadAvatar')}
                            </label>
                            {avatar && (
                                <button
                                    onClick={handleAvatarDelete}
                                    disabled={avatarUploading}
                                    className="ml-2 px-4 py-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {t('settings.profile.deleteAvatar')}
                                </button>
                            )}
                            <p className="text-xs text-text-tertiary">{t('settings.profile.avatarHelp')}</p>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-text-secondary mb-2">{t('settings.profile.nickname')}</label>
                    <input
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        className="w-full border border-border-input rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder={t('settings.profile.nicknamePlaceholder')}
                        maxLength={50}
                    />
                    <p className="text-xs text-text-tertiary mt-1">{t('settings.profile.nicknameHelp')}</p>
                </div>
                <div className="pt-2">
                    <SubmitButton
                        text={t('settings.profile.saveNickname')}
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
