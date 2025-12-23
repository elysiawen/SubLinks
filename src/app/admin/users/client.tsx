'use client';

import { useState } from 'react';
import { createUser, deleteUser, updateUserStatus, updateUser } from '../actions';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import Modal from '@/components/Modal';

export default function AdminUsersClient({ users }: { users: any[] }) {
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const [loading, setLoading] = useState(false);
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [editingRules, setEditingRules] = useState<{ username: string, rules: string } | null>(null);
    const [editingUser, setEditingUser] = useState<{ username: string, newUsername: string, newPassword: string } | null>(null);

    const handleCreateUser = async (formData: FormData) => {
        setLoading(true);
        const res = await createUser(formData);
        setLoading(false);
        if (res?.error) {
            error(res.error);
        } else {
            success('用户创建成功');
            (document.getElementById('createUserForm') as HTMLFormElement).reset();
        }
    };

    const handleUpdateUser = async () => {
        if (!editingUser) return;

        setLoading(true);
        const res = await updateUser(
            editingUser.username,
            editingUser.newUsername,
            editingUser.newPassword || undefined
        );
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
                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{users.length}</span>
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
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium shadow-sm"
                        >
                            {loading ? '创建中...' : '确认创建'}
                        </button>
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
                <div className="p-4 md:p-6 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800">用户列表 ({users.length})</h3>
                </div>
                <div className="w-full overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider rounded-l-lg">用户名</th>
                                <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">角色</th>
                                <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
                                <th className="px-4 md:px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider rounded-r-lg">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {users.map((user) => (
                                <tr key={user.username} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.username}</td>
                                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-green-100 text-green-800 border border-green-200'}`}>
                                            {user.role === 'admin' ? '管理员' : '用户'}
                                        </span>
                                    </td>
                                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${user.status === 'active' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                                            {user.status === 'active' ? '正常' : '已停用'}
                                        </span>
                                    </td>
                                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-right space-x-3">
                                        <button
                                            onClick={() => setEditingUser({ username: user.username, newUsername: user.username, newPassword: '' })}
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
            </div>

            {/* Edit User Modal */}
            <Modal
                isOpen={!!editingUser}
                onClose={() => setEditingUser(null)}
                title="编辑用户"
            >
                {editingUser && (
                    <div className="space-y-4">
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
                            <label className="block text-sm font-semibold text-gray-700 mb-2">新密码</label>
                            <input
                                type="password"
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={editingUser.newPassword}
                                onChange={e => setEditingUser({ ...editingUser, newPassword: e.target.value })}
                                placeholder="留空则不修改密码"
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={handleUpdateUser}
                                disabled={loading}
                                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium shadow-sm"
                            >
                                {loading ? '保存中...' : '确认保存'}
                            </button>
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
        </div>
    );
}
