'use client';

import { useState } from 'react';
import { createUser, deleteUser, updateUserStatus, updateUser, updateUserMaxSubscriptions, adminUploadAvatar, adminDeleteAvatar } from '../actions';
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
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const [loading, setLoading] = useState(false);
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [editingRules, setEditingRules] = useState<{ username: string, rules: string } | null>(null);
    const [editingUser, setEditingUser] = useState<{ username: string, newUsername: string, newPassword: string, nickname: string, useGlobalLimit: boolean, customLimit: number, avatar?: string } | null>(null);

    // Avatar State
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [showCropper, setShowCropper] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);

    const handleCreateUser = async (formData: FormData) => {
        setLoading(true);
        const res = await createUser(formData);
        setLoading(false);
        if (res?.error) {
            error(res.error);
        } else {
            success('用户创建成功');
            // No need to reset form - modal will close
        }
    };

    // Handle Avatar File Selection
    const handleAdminAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            error('文件大小不能超过 10MB');
            return;
        }

        if (!file.type.startsWith('image/')) {
            error('只支持图片文件');
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
                error(result.error);
            } else {
                setEditingUser({ ...editingUser, avatar: result.avatarUrl });
                success('头像上传成功');
            }
        } catch (err) {
            error('上传失败，请稍后重试');
        } finally {
            setAvatarUploading(false);
            setAvatarPreview(null);
        }
    };

    // Handle Avatar Delete
    const handleAdminAvatarDelete = async () => {
        if (!editingUser) return;
        if (await confirm('确定要删除该用户的头像吗？')) {
            setAvatarUploading(true);
            try {
                const result = await adminDeleteAvatar(editingUser.username);
                if (result.error) {
                    error(result.error);
                } else {
                    setEditingUser({ ...editingUser, avatar: undefined });
                    success('头像已删除');
                }
            } catch (err) {
                error('删除失败，请稍后重试');
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
            error(res.error);
        } else {
            setEditingUser(null);
            success('用户信息已更新');
        }
    };



    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    👥 用户管理
                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{total}</span>
                </h2>
                <button
                    onClick={() => setIsAddingUser(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm font-medium text-sm"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    添加新用户
                </button>
            </div>

            {/* Create User Modal */}
            <Modal
                isOpen={isAddingUser}
                onClose={() => setIsAddingUser(false)}
                title="添加新用户"
            >
                <form
                    action={async (formData) => {
                        await handleCreateUser(formData);
                        setIsAddingUser(false);
                    }}
                    className="space-y-4"
                >
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">用户名</label>
                        <input
                            name="username"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="输入用户名"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">昵称（可选）</label>
                        <input
                            name="nickname"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="设置显示昵称"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">密码</label>
                        <input
                            name="password"
                            type="password"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="设置登录密码"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">角色</label>
                        <select
                            name="role"
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                        >
                            <option value="user">普通用户</option>
                            <option value="admin">管理员</option>
                        </select>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <SubmitButton
                            text="确认创建"
                            className="flex-1"
                        />
                        <button
                            type="button"
                            onClick={() => setIsAddingUser(false)}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                        >
                            取消
                        </button>
                    </div>
                </form>
            </Modal>

            {/* User List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-3 sm:p-4 border-b border-gray-100">
                    <Search placeholder="搜索用户名..." />
                </div>


                {/* Desktop Table View */}
                <div className="hidden md:block w-full overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider rounded-l-lg">用户名</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">昵称</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">角色</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">订阅限制</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider rounded-r-lg">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {users.map((user) => (
                                <tr key={user.username} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-semibold overflow-hidden">
                                                {user.avatar ? (
                                                    <img src={user.avatar} alt="头像" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span>{user.username.slice(0, 2).toUpperCase()}</span>
                                                )}
                                            </div>
                                            <span>{user.username}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {user.nickname ? (
                                            <span className="text-gray-900">{user.nickname}</span>
                                        ) : (
                                            <span className="text-gray-400 italic">未设置</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-green-100 text-green-800 border border-green-200'}`}>
                                            {user.role === 'admin' ? '管理员' : '用户'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${user.status === 'active' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                                            {user.status === 'active' ? '正常' : '已停用'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {user.maxSubscriptions === null
                                            ? `跟随全局 (${globalMaxSubs})`
                                            : `自定义 (${user.maxSubscriptions})`}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-3">
                                        <button
                                            onClick={() => setEditingUser({
                                                username: user.username,
                                                newUsername: user.username,
                                                newPassword: '',
                                                nickname: user.nickname || '',
                                                useGlobalLimit: user.maxSubscriptions === null,
                                                customLimit: user.maxSubscriptions || globalMaxSubs,
                                                avatar: user.avatar
                                            })}
                                            className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                        >
                                            编辑
                                        </button>
                                        <button
                                            onClick={async () => {
                                                const newStatus = user.status === 'active' ? 'suspended' : 'active';
                                                if (await confirm(`确定要${newStatus === 'active' ? '启用' : '停用'}用户 ${user.username} 吗?`)) {
                                                    await updateUserStatus(user.username, newStatus);
                                                    success(`用户 ${user.username} 已${newStatus === 'active' ? '启用' : '停用'}`);
                                                }
                                            }}
                                            className={`${user.status === 'active' ? 'text-orange-500 hover:text-orange-700' : 'text-green-600 hover:text-green-800'} font-medium transition-colors`}
                                        >
                                            {user.status === 'active' ? '停用' : '启用'}
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (await confirm(`确定要删除用户 ${user.username} 吗? 此操作不可恢复。`, { confirmColor: 'red', confirmText: '彻底删除' })) {
                                                    await deleteUser(user.username);
                                                    success(`用户 ${user.username} 已删除`);
                                                }
                                            }}
                                            className="text-red-500 hover:text-red-700 font-medium transition-colors"
                                        >
                                            删除
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-gray-100">
                    {users.map((user) => (
                        <div key={user.username} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-semibold overflow-hidden flex-shrink-0">
                                            {user.avatar ? (
                                                <img src={user.avatar} alt="头像" className="w-full h-full object-cover" />
                                            ) : (
                                                <span>{user.username.slice(0, 2).toUpperCase()}</span>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-gray-900 mb-1">
                                                {user.username}
                                                {user.nickname && (
                                                    <span className="ml-2 text-sm font-normal text-gray-600">({user.nickname})</span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-green-100 text-green-800 border border-green-200'}`}>
                                                    {user.role === 'admin' ? '管理员' : '用户'}
                                                </span>
                                                <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${user.status === 'active' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                                                    {user.status === 'active' ? '正常' : '已停用'}
                                                </span>
                                            </div>
                                            <div className="mt-2 text-xs text-gray-600">
                                                订阅限制: <span className="font-medium text-gray-900">
                                                    {user.maxSubscriptions === null ? `${globalMaxSubs} (全局)` : user.maxSubscriptions}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={() => setEditingUser({
                                            username: user.username,
                                            newUsername: user.username,
                                            newPassword: '',
                                            nickname: user.nickname || '',
                                            useGlobalLimit: user.maxSubscriptions === null,
                                            customLimit: user.maxSubscriptions || globalMaxSubs,
                                            avatar: user.avatar
                                        })}
                                        className="flex-1 text-blue-600 hover:text-blue-800 font-medium transition-colors text-sm py-2 px-3 border border-blue-200 rounded-lg hover:bg-blue-50"
                                    >
                                        编辑
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const newStatus = user.status === 'active' ? 'suspended' : 'active';
                                            if (await confirm(`确定要${newStatus === 'active' ? '启用' : '停用'}用户 ${user.username} 吗?`)) {
                                                await updateUserStatus(user.username, newStatus);
                                                success(`用户 ${user.username} 已${newStatus === 'active' ? '启用' : '停用'}`);
                                            }
                                        }}
                                        className={`flex-1 font-medium transition-colors text-sm py-2 px-3 border rounded-lg ${user.status === 'active' ? 'text-orange-500 hover:text-orange-700 border-orange-200 hover:bg-orange-50' : 'text-green-600 hover:text-green-800 border-green-200 hover:bg-green-50'}`}
                                    >
                                        {user.status === 'active' ? '停用' : '启用'}
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (await confirm(`确定要删除用户 ${user.username} 吗? 此操作不可恢复。`, { confirmColor: 'red', confirmText: '彻底删除' })) {
                                                await deleteUser(user.username);
                                                success(`用户 ${user.username} 已删除`);
                                            }
                                        }}
                                        className="flex-1 text-red-500 hover:text-red-700 font-medium transition-colors text-sm py-2 px-3 border border-red-200 rounded-lg hover:bg-red-50"
                                    >
                                        删除
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
                title="编辑用户"
            >
                {editingUser && (
                    <div className="space-y-4">
                        {/* Avatar Manager */}
                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="relative w-16 h-16 rounded-full overflow-hidden bg-white border border-gray-200 shadow-sm shrink-0">
                                {editingUser.avatar ? (
                                    <img src={editingUser.avatar} alt="头像" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl font-bold bg-gray-100">
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
                                <h3 className="text-sm font-semibold text-gray-900 mb-1">用户头像</h3>
                                <div className="flex items-center gap-3">
                                    <label className={`inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors ${avatarUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        {editingUser.avatar ? '更换头像' : '上传头像'}
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
                                            删除
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">用户名</label>
                            <input
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50"
                                value={editingUser.newUsername}
                                disabled
                                readOnly
                            />
                            <p className="text-xs text-gray-500 mt-1">用户名不可修改</p>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">昵称（可选）</label>
                            <input
                                type="text"
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={editingUser.nickname}
                                onChange={e => setEditingUser({ ...editingUser, nickname: e.target.value })}
                                placeholder="设置显示昵称"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">新密码</label>
                            <input
                                type="password"
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={editingUser.newPassword}
                                onChange={e => setEditingUser({ ...editingUser, newPassword: e.target.value })}
                                placeholder="留空则不修改密码"
                            />
                        </div>

                        <div className="border-t border-gray-200 pt-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-3">订阅限制</label>
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                    <input
                                        type="radio"
                                        checked={editingUser.useGlobalLimit}
                                        onChange={() => setEditingUser({ ...editingUser, useGlobalLimit: true })}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900">使用全局限制</div>
                                        <div className="text-xs text-gray-500">当前全局限制: {globalMaxSubs} 个订阅</div>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                    <input
                                        type="radio"
                                        checked={!editingUser.useGlobalLimit}
                                        onChange={() => setEditingUser({ ...editingUser, useGlobalLimit: false })}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900">自定义限制</div>
                                        {!editingUser.useGlobalLimit && (
                                            <input
                                                type="number"
                                                min="0"
                                                value={editingUser.customLimit}
                                                onChange={e => setEditingUser({ ...editingUser, customLimit: parseInt(e.target.value) || 0 })}
                                                className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                                placeholder="输入订阅数量"
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
                                text="确认保存"
                                className="flex-1"
                            />
                            <button
                                onClick={() => setEditingUser(null)}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            <Pagination
                total={total}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
            />

            {showCropper && avatarPreview && (
                <AvatarCropper
                    image={avatarPreview}
                    onCropComplete={handleAdminAvatarUpload}
                    onCancel={() => {
                        setShowCropper(false);
                        setAvatarPreview(null);
                    }}
                />
            )}
        </div>
    );
}
