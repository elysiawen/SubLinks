'use client';

import { useState } from 'react';
import { createUser, deleteUser, updateUserStatus, updateUserRules } from '../actions';

export default function AdminUsersClient({ users }: { users: any[] }) {
    const [loading, setLoading] = useState(false);
    const [editingRules, setEditingRules] = useState<{ username: string, rules: string } | null>(null);

    const handleCreateUser = async (formData: FormData) => {
        setLoading(true);
        const res = await createUser(formData);
        setLoading(false);
        if (res?.error) {
            alert(res.error);
        } else {
            (document.getElementById('createUserForm') as HTMLFormElement).reset();
        }
    };

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-800">用户管理</h2>

            {/* Create User Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-100 pb-3 mb-4">添加新用户</h3>
                <form id="createUserForm" action={handleCreateUser} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                            <input name="username" className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                            <input name="password" type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
                            <select name="role" className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white">
                                <option value="user">普通用户</option>
                                <option value="admin">管理员</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm font-medium text-sm"
                        >
                            {loading ? '创建中...' : '创建用户'}
                        </button>
                    </div>
                </form>
            </div>

            {/* User List */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-100 pb-3 mb-4">用户列表 ({users.length})</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider rounded-l-lg">用户名</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">角色</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider rounded-r-lg">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {users.map((user) => (
                                <tr key={user.username} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.username}</td>
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
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-3">
                                        <button
                                            onClick={async () => {
                                                const newStatus = user.status === 'active' ? 'suspended' : 'active';
                                                if (confirm(`确定要${newStatus === 'active' ? '启用' : '停用'}用户 ${user.username} 吗?`)) {
                                                    await updateUserStatus(user.username, newStatus);
                                                }
                                            }}
                                            className={`${user.status === 'active' ? 'text-orange-500 hover:text-orange-700' : 'text-green-600 hover:text-green-800'} font-medium transition-colors`}
                                        >
                                            {user.status === 'active' ? '停用' : '启用'}
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (confirm(`确定要删除用户 ${user.username} 吗? 此操作不可恢复。`)) {
                                                    await deleteUser(user.username);
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

            {/* Edit Rules Modal (Removed) */}
        </div>
    );
}
