'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useErrors } from '@/lib/use-errors';
import { createUser, deleteUser, updateUserStatus, updateUser, updateUserMaxSubscriptions, adminUploadAvatar, adminDeleteAvatar, resetUser2FA, adminGetUserPasskeys, adminDeletePasskey } from './actions';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { SubmitButton } from '@/components/SubmitButton';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';
import Search from '@/components/Search';
import AvatarCropper from '@/components/AvatarCropper';

export default function AdminUsersClient({
    users,
    total,
    currentPage,
    itemsPerPage,
    globalMaxSubs
}: {
    users: any[],
    total: number,
    currentPage: number,
    itemsPerPage: number,
    globalMaxSubs: number
}) {
    const t = useTranslations('admin.users');
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const tError = useErrors();
    const [loading, setLoading] = useState(false);
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [editingRules, setEditingRules] = useState<{ username: string, rules: string } | null>(null);
    const [editingUser, setEditingUser] = useState<{ id: string, username: string, newUsername: string, newPassword: string, nickname: string, useGlobalLimit: boolean, customLimit: number, avatar?: string, totpEnabled: boolean } | null>(null);

    // Passkey State
    const [userPasskeys, setUserPasskeys] = useState<any[]>([]);
    const [loadingPasskeys, setLoadingPasskeys] = useState(false);

    // Avatar State
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [showCropper, setShowCropper] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);

    const handleCreateUser = async (formData: FormData) => {
        setLoading(true);
        const res = await createUser(formData);
        setLoading(false);
        if (res?.error) {
            error(tError(res.error));
        } else {
            success(t('userCreated'));
            // No need to reset form - modal will close
        }
    };

    // Passkey Management
    useEffect(() => {
        if (editingUser?.id) {
            setLoadingPasskeys(true);
            adminGetUserPasskeys(editingUser.id).then(res => {
                if (res.success) {
                    setUserPasskeys(res.passkeys || []);
                } else {
                    error(res.error ? tError(res.error) : t('getPasskeysFailed'));
                }
                setLoadingPasskeys(false);
            });
        } else {
            setUserPasskeys([]);
        }
    }, [editingUser?.id]);

    const handleDeletePasskey = async (passkeyId: string) => {
        if (!editingUser) return;
        if (await confirm(t('confirmDeletePasskey'), { confirmColor: 'red' })) {
            const res = await adminDeletePasskey(passkeyId, editingUser.id);
            if (res.success) {
                // Remove from local state
                setUserPasskeys(prev => prev.filter(pk => pk.id !== passkeyId));
                success(t('passkeyDeleted'));
            } else {
                error(res.error ? tError(res.error) : t('deleteFailed'));
            }
        }
    };

    // Handle Avatar File Selection
    const handleAdminAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            error(t('fileTooLarge'));
            return;
        }

        if (!file.type.startsWith('image/')) {
            error(t('imageOnly'));
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            setAvatarPreview(e.target?.result as string);
            setShowCropper(true);
        };
        reader.readAsDataURL(file);

        // Reset input
        e.target.value = '';
    };

    // Handle Avatar Upload
    const handleAdminAvatarUpload = async (croppedImage: Blob) => {
        if (!editingUser) return;
        setAvatarUploading(true);
        setShowCropper(false);

        try {
            const formData = new FormData();
            formData.append('username', editingUser.username);
            formData.append('avatar', croppedImage, 'avatar.webp');

            const result = await adminUploadAvatar(formData);

            if (result.error) {
                error(tError(result.error));
            } else {
                setEditingUser({ ...editingUser, avatar: result.avatarUrl });
                success(t('avatarUploaded'));
            }
        } catch (err) {
            error(t('uploadFailed'));
        } finally {
            setAvatarUploading(false);
            setAvatarPreview(null);
        }
    };

    // Handle Avatar Delete
    const handleAdminAvatarDelete = async () => {
        if (!editingUser) return;
        if (await confirm(t('confirmDeleteAvatar'), { confirmColor: 'red' })) {
            setAvatarUploading(true);
            try {
                const result = await adminDeleteAvatar(editingUser.username);
                if (result.error) {
                    error(tError(result.error));
                } else {
                    setEditingUser({ ...editingUser, avatar: undefined });
                    success(t('avatarDeleted'));
                }
            } catch (err) {
                error(t('deleteAvatarFailed'));
            } finally {
                setAvatarUploading(false);
            }
        }
    };

    const handleUpdateUser = async () => {
        if (!editingUser) return;

        setLoading(true);

        // Update user info
        const res = await updateUser(
            editingUser.username,
            editingUser.newUsername,
            editingUser.newPassword || undefined,
            editingUser.nickname || undefined
        );

        // Update subscription limit
        const maxSubs = editingUser.useGlobalLimit ? null : editingUser.customLimit;
        await updateUserMaxSubscriptions(editingUser.username, maxSubs);

        setLoading(false);

        if (res?.error) {
            error(tError(res.error));
        } else {
            setEditingUser(null);
            success(t('userUpdated'));
        }
    };



    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                    👥 {t('title')}
                    <span className="text-sm font-normal text-text-tertiary bg-muted px-2 py-1 rounded-full">{total}</span>
                </h2>
                <button
                    onClick={() => setIsAddingUser(true)}
                    className="bg-accent-button text-white px-4 py-2 rounded-lg hover:bg-accent-button-hover transition-colors flex items-center gap-2 shadow-sm font-medium text-sm"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {t('addUser')}
                </button>
            </div>

            {/* Create User Modal */}
            <Modal
                isOpen={isAddingUser}
                onClose={() => setIsAddingUser(false)}
                title={t('addUser')}
            >
                <form
                    action={async (formData) => {
                        await handleCreateUser(formData);
                        setIsAddingUser(false);
                    }}
                    className="space-y-4"
                >
                    <div>
                        <label className="block text-sm font-semibold text-text-secondary mb-2">{t('username')}</label>
                        <input
                            name="username"
                            className="w-full border border-border-input rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder={t('usernamePlaceholder')}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-text-secondary mb-2">{t('nickname')}</label>
                        <input
                            name="nickname"
                            className="w-full border border-border-input rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder={t('nicknamePlaceholder')}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-text-secondary mb-2">{t('password')}</label>
                        <input
                            name="password"
                            type="password"
                            className="w-full border border-border-input rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder={t('passwordPlaceholder')}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-text-secondary mb-2">{t('role')}</label>
                        <select
                            name="role"
                            className="w-full border border-border-input rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-card"
                        >
                            <option value="user">{t('roleUser')}</option>
                            <option value="admin">{t('roleAdmin')}</option>
                        </select>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <SubmitButton
                            text={t('confirmCreate')}
                            className="flex-1"
                        />
                        <button
                            type="button"
                            onClick={() => setIsAddingUser(false)}
                            className="px-4 py-2 border border-border-input text-text-secondary rounded-lg hover:bg-muted transition-colors font-medium"
                        >
                            {t('cancel')}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* User List */}
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="p-3 sm:p-4 border-b border-border">
                    <Search placeholder={t('searchPlaceholder')} />
                </div>


                {/* Desktop Table View */}
                <div className="hidden md:block w-full overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead>
                            <tr className="bg-surface">
                                <th className="px-6 py-3 text-left text-xs font-semibold text-text-primary uppercase tracking-wider rounded-l-lg">{t('tableUser')}</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-text-primary uppercase tracking-wider">{t('tableSecurity')}</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-text-primary uppercase tracking-wider">{t('tableStatus')}</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-text-primary uppercase tracking-wider">{t('tableSubLimit')}</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-text-primary uppercase tracking-wider rounded-r-lg">{t('tableActions')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border">
                            {users.map((user) => (
                                <tr key={user.username} className="hover:bg-muted transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-border-strong flex items-center justify-center text-text-tertiary text-xs font-semibold overflow-hidden flex-shrink-0">
                                                {user.avatar ? (
                                                    <img src={user.avatar} alt={t('avatar')} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span>{user.username.slice(0, 2).toUpperCase()}</span>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-text-primary font-medium">{user.username}</span>
                                                    <span className={`px-1.5 py-0.5 inline-flex text-[10px] font-medium rounded border ${user.role === 'admin' ? 'bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' : 'bg-muted text-text-secondary border-border-strong'}`}>
                                                        {user.role === 'admin' ? t('roleAdmin') : t('roleUser')}
                                                    </span>
                                                </div>
                                                {user.nickname ? (
                                                    <span className="text-xs text-text-tertiary">{user.nickname}</span>
                                                ) : (
                                                    <span className="text-xs text-text-quaternary italic">{t('noNickname')}</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-tertiary">
                                        <div className="flex flex-col gap-1 items-start">
                                            {user.totpEnabled && (
                                                <span className="px-2 py-0.5 bg-accent text-accent-foreground text-[10px] font-bold rounded border border-blue-100 uppercase tracking-tighter" title={t('totpEnabled')}>
                                                    2FA
                                                </span>
                                            )}
                                            {user.passkeyCount > 0 && (
                                                <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-[10px] font-bold rounded border border-purple-100 dark:border-purple-800 uppercase tracking-tighter" title={t('passkeyCount', { count: user.passkeyCount })}>
                                                    KEY
                                                </span>
                                            )}
                                            {!user.totpEnabled && user.passkeyCount === 0 && (
                                                <span className="text-text-quaternary text-xs pl-1">-</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-tertiary">
                                        <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${user.status === 'active' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                                            {user.status === 'active' ? t('statusActive') : t('statusDisabled')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                                        {user.maxSubscriptions === null
                                            ? t('followGlobal', { count: globalMaxSubs })
                                            : t('customLimit', { count: user.maxSubscriptions })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-3">
                                        <button
                                            onClick={() => setEditingUser({
                                                id: user.id,
                                                username: user.username,
                                                newUsername: user.username,
                                                newPassword: '',
                                                nickname: user.nickname || '',
                                                useGlobalLimit: user.maxSubscriptions === null,
                                                customLimit: user.maxSubscriptions || globalMaxSubs,
                                                avatar: user.avatar,
                                                totpEnabled: user.totpEnabled
                                            })}
                                            className="text-accent-foreground hover:text-blue-800 font-medium transition-colors"
                                        >
                                            {t('edit')}
                                        </button>

                                        <button
                                            onClick={async () => {
                                                const newStatus = user.status === 'active' ? 'suspended' : 'active';
                                                const action = newStatus === 'active' ? t('enable') : t('disable');
                                                if (await confirm(t('confirmToggle', { action, username: user.username }))) {
                                                    await updateUserStatus(user.username, newStatus);
                                                    success(t('userToggled', { action, username: user.username }));
                                                }
                                            }}
                                            className={`${user.status === 'active' ? 'text-orange-500 hover:text-orange-700' : 'text-green-600 hover:text-green-800'} font-medium transition-colors`}
                                        >
                                            {user.status === 'active' ? t('disable') : t('enable')}
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (await confirm(t('confirmDelete', { username: user.username }), { confirmColor: 'red', confirmText: t('confirmDeleteText') })) {
                                                    await deleteUser(user.username);
                                                    success(t('userDeleted', { username: user.username }));
                                                }
                                            }}
                                            className="text-red-500 hover:text-red-700 font-medium transition-colors"
                                        >
                                            {t('delete')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-border">
                    {users.map((user) => (
                        <div key={user.username} className="p-4 hover:bg-muted transition-colors">
                            <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-border-strong flex items-center justify-center text-text-tertiary text-sm font-semibold overflow-hidden flex-shrink-0">
                                            {user.avatar ? (
                                                <img src={user.avatar} alt={t('avatar')} className="w-full h-full object-cover" />
                                            ) : (
                                                <span>{user.username.slice(0, 2).toUpperCase()}</span>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-2">
                                                <span className="font-medium text-text-primary">{user.username}</span>
                                                {user.nickname && (
                                                    <span className="ml-1 text-sm text-text-tertiary">({user.nickname})</span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-green-100 text-green-800 border border-green-200'}`}>
                                                    {user.role === 'admin' ? t('roleAdmin') : t('roleUser')}
                                                </span>
                                                <div className="flex items-center gap-1 border-l border-border-strong pl-2">
                                                    {user.totpEnabled && (
                                                        <span className="px-2 py-0.5 bg-accent text-accent-foreground text-[10px] font-bold rounded border border-blue-100 uppercase tracking-tighter">
                                                            2FA
                                                        </span>
                                                    )}
                                                    {user.passkeyCount > 0 && (
                                                        <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-[10px] font-bold rounded border border-purple-100 dark:border-purple-800 uppercase tracking-tighter">
                                                            KEY
                                                        </span>
                                                    )}
                                                    {!user.totpEnabled && user.passkeyCount === 0 && (
                                                        <span className="text-xs text-text-quaternary">{t('noSecurity')}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className={`px-2.5 py-0.5 inline-flex font-medium rounded-full ${user.status === 'active' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                                                    {user.status === 'active' ? t('statusActive') : t('statusDisabled')}
                                                </span>
                                                <span className="text-text-quaternary">|</span>
                                                <span className="text-text-secondary">
                                                    {t('subCount', { count: user.maxSubscriptions === null ? `${globalMaxSubs}${t('globalSuffix')}` : user.maxSubscriptions })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-2">
                                    <button
                                        onClick={() => setEditingUser({
                                            id: user.id,
                                            username: user.username,
                                            newUsername: user.username,
                                            newPassword: '',
                                            nickname: user.nickname || '',
                                            useGlobalLimit: user.maxSubscriptions === null,
                                            customLimit: user.maxSubscriptions || globalMaxSubs,
                                            avatar: user.avatar,
                                            totpEnabled: user.totpEnabled
                                        })}
                                        className="flex-1 min-w-[80px] text-accent-foreground hover:text-blue-800 font-medium transition-colors text-sm py-2 px-3 border border-blue-200 rounded-lg hover:bg-accent text-center"
                                    >
                                        {t('edit')}
                                    </button>

                                    <button
                                        onClick={async () => {
                                            const newStatus = user.status === 'active' ? 'suspended' : 'active';
                                            const action = newStatus === 'active' ? t('enable') : t('disable');
                                            if (await confirm(t('confirmToggle', { action, username: user.username }))) {
                                                await updateUserStatus(user.username, newStatus);
                                                success(t('userToggled', { action, username: user.username }));
                                            }
                                        }}
                                        className={`flex-1 min-w-[80px] font-medium transition-colors text-sm py-2 px-3 border rounded-lg text-center ${user.status === 'active' ? 'text-orange-500 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-500/15' : 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-500/15'}`}
                                    >
                                        {user.status === 'active' ? t('disable') : t('enable')}
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (await confirm(t('confirmDelete', { username: user.username }), { confirmColor: 'red', confirmText: t('confirmDeleteText') })) {
                                                await deleteUser(user.username);
                                                success(t('userDeleted', { username: user.username }));
                                            }
                                        }}
                                        className="flex-1 min-w-[80px] text-red-500 hover:text-red-700 font-medium transition-colors text-sm py-2 px-3 border border-red-200 rounded-lg hover:bg-red-50 text-center"
                                    >
                                        {t('delete')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Edit User Modal */}
            <Modal
                isOpen={!!editingUser}
                onClose={() => setEditingUser(null)}
                title={t('editUser')}
            >
                {editingUser && (
                    <div className="space-y-4">
                        {/* Avatar Manager */}
                        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg border border-border">
                            <div className="relative w-16 h-16 rounded-full overflow-hidden bg-card border border-border-strong shadow-sm shrink-0">
                                {editingUser.avatar ? (
                                    <img src={editingUser.avatar} alt={t('avatar')} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-text-quaternary text-xl font-bold bg-muted">
                                        {editingUser.username.slice(0, 2).toUpperCase()}
                                    </div>
                                )}
                                {avatarUploading && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-text-primary mb-1">{editingUser.username}</h3>
                                <div className="flex items-center gap-3">
                                    <label className={`inline-flex items-center px-3 py-1.5 bg-card border border-border-input rounded-md shadow-sm text-xs font-medium text-text-secondary hover:bg-muted cursor-pointer transition-colors ${avatarUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        {editingUser.avatar ? t('changeAvatar') : t('uploadAvatar')}
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleAdminAvatarSelect}
                                            disabled={avatarUploading}
                                        />
                                    </label>
                                    {editingUser.avatar && (
                                        <button
                                            type="button"
                                            onClick={handleAdminAvatarDelete}
                                            disabled={avatarUploading}
                                            className="text-xs font-medium text-red-600 hover:text-red-800 transition-colors"
                                        >
                                            {t('delete')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>


                        <div>
                            <label className="block text-sm font-semibold text-text-secondary mb-2">{t('nickname')}</label>
                            <input
                                type="text"
                                className="w-full border border-border-input rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={editingUser.nickname}
                                onChange={e => editingUser && setEditingUser({ ...editingUser, nickname: e.target.value })}
                                placeholder={t('nicknamePlaceholder')}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-text-secondary mb-2">{t('newPassword')}</label>
                            <input
                                type="password"
                                className="w-full border border-border-input rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={editingUser.newPassword}
                                onChange={e => editingUser && setEditingUser({ ...editingUser, newPassword: e.target.value })}
                                placeholder={t('newPasswordPlaceholder')}
                            />
                        </div>

                        <div className="border-t border-border-strong pt-4">
                            <label className="block text-sm font-semibold text-text-secondary mb-3">{t('passkeys')}</label>
                            {loadingPasskeys ? (
                                <div className="text-center py-4 text-text-tertiary text-sm">{t('loading')}</div>
                            ) : userPasskeys.length > 0 ? (
                                <div className="space-y-2">
                                    {userPasskeys.map((passkey: any) => (
                                        <div key={passkey.id} className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg">
                                            <div>
                                                <div className="text-sm font-medium text-text-primary flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                                    </svg>
                                                    {passkey.name || t('unnamedKey')}
                                                </div>
                                                <div className="text-xs text-text-tertiary mt-0.5">
                                                    {t('createdAt', { date: new Date(passkey.createdAt).toLocaleDateString() })}
                                                    {passkey.lastUsed ? t('lastUsed', { date: new Date(passkey.lastUsed).toLocaleDateString() }) : ''}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleDeletePasskey(passkey.id)}
                                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                                                title={t('deleteKey')}
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 bg-muted rounded-lg border border-border border-dashed">
                                    <span className="text-sm text-text-tertiary">{t('noPasskeys')}</span>
                                </div>
                            )}
                        </div>
                        <div className="border-t border-border-strong pt-4">
                            <label className="block text-sm font-semibold text-text-secondary mb-3">{t('securityOptions')}</label>
                            {editingUser.totpEnabled ? (
                                <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-900/50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                                        <div>
                                            <div className="text-sm font-medium text-orange-800 dark:text-orange-300">{t('totpEnabledTitle')}</div>
                                            <div className="text-xs text-orange-600">{t('totpResetHint')}</div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (await confirm(t('confirmReset2FA', { username: editingUser.username }), { confirmColor: 'red', confirmText: t('confirmReset') })) {
                                                const res = await resetUser2FA(editingUser.username);
                                                if (res.error) error(tError(res.error));
                                                else {
                                                    success(t('twoFAReset'));
                                                    setEditingUser({ ...editingUser, totpEnabled: false });
                                                }
                                            }
                                        }}
                                        className="px-3 py-1.5 bg-card border border-orange-200 text-orange-600 rounded-md text-xs font-bold hover:bg-orange-100 transition-colors shadow-sm"
                                    >
                                        {t('reset2FA')}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 p-3 bg-muted border border-border rounded-lg text-text-tertiary text-sm">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                    {t('totpDisabled')}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-border-strong pt-4">
                            <label className="block text-sm font-semibold text-text-secondary mb-3">{t('subLimit')}</label>
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 p-3 border border-border-strong rounded-lg cursor-pointer hover:bg-muted transition-colors">
                                    <input
                                        type="radio"
                                        checked={editingUser.useGlobalLimit}
                                        onChange={() => editingUser && setEditingUser({ ...editingUser, useGlobalLimit: true })}
                                        className="w-4 h-4 text-accent-foreground"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-text-primary">{t('useGlobalLimit')}</div>
                                        <div className="text-xs text-text-tertiary">{t('globalLimitDesc', { count: globalMaxSubs })}</div>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 p-3 border border-border-strong rounded-lg cursor-pointer hover:bg-muted transition-colors">
                                    <input
                                        type="radio"
                                        checked={!editingUser.useGlobalLimit}
                                        onChange={() => editingUser && setEditingUser({ ...editingUser, useGlobalLimit: false })}
                                        className="w-4 h-4 text-accent-foreground"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-text-primary">{t('customSubLimit')}</div>
                                        {!editingUser.useGlobalLimit && (
                                            <input
                                                type="number"
                                                min="0"
                                                value={editingUser.customLimit}
                                                onChange={e => editingUser && setEditingUser({ ...editingUser, customLimit: parseInt(e.target.value) || 0 })}
                                                className="mt-2 w-full border border-border-input rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                                placeholder={t('customSubPlaceholder')}
                                                onClick={e => e.stopPropagation()}
                                            />
                                        )}
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <SubmitButton
                                onClick={handleUpdateUser}
                                isLoading={loading}
                                text={t('save')}
                                className="flex-1"
                            />
                            <button
                                onClick={() => setEditingUser(null)}
                                className="px-4 py-2 border border-border-input text-text-secondary rounded-lg hover:bg-muted transition-colors font-medium"
                            >
                                {t('cancel')}
                            </button>
                        </div>
                    </div>
                )
                }
            </Modal >

            <Pagination
                total={total}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
            />

            {
                showCropper && avatarPreview && (
                    <AvatarCropper
                        image={avatarPreview}
                        onCropComplete={handleAdminAvatarUpload}
                        onCancel={() => {
                            setShowCropper(false);
                            setAvatarPreview(null);
                        }}
                    />
                )
            }
        </div >
    );
}
