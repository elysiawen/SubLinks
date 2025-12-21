'use client';

import { useState } from 'react';
import { createSubscription, deleteSubscription, updateSubscription } from '@/lib/sub-actions';

interface Sub {
    token: string;
    name: string;
    customRules: string;
}

export default function DashboardClient({ initialSubs, username, baseUrl }: { initialSubs: Sub[], username: string, baseUrl: string }) {
    const [subs, setSubs] = useState<Sub[]>(initialSubs);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSub, setEditingSub] = useState<Sub | null>(null);

    // Form State
    const [formName, setFormName] = useState('');
    const [formRules, setFormRules] = useState('');

    const refresh = async () => {
        window.location.reload();
    };

    const handleSubmit = async () => {
        setLoading(true);
        if (editingSub) {
            await updateSubscription(editingSub.token, formName, formRules);
        } else {
            await createSubscription(formName, formRules);
        }
        setLoading(false);
        closeModal();
        refresh();
    };

    const handleDelete = async (token: string) => {
        if (confirm('确定删除此订阅?')) {
            await deleteSubscription(token);
            refresh();
        }
    }

    const openCreate = () => {
        setEditingSub(null);
        setFormName('');
        setFormRules('');
        setIsModalOpen(true);
    }

    const openEdit = (sub: Sub) => {
        setEditingSub(sub);
        setFormName(sub.name);
        setFormRules(sub.customRules);
        setIsModalOpen(true);
    }

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingSub(null);
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6 font-sans">
            <div className="max-w-4xl mx-auto space-y-6">
                <header className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight">用户中心</h1>
                    <div className="flex items-center gap-4">
                        <span className="font-medium text-gray-600">{username}</span>
                        <form action={async () => {
                            const { logout } = await import('@/lib/actions');
                            await logout();
                        }}>
                            <button className="text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-full hover:bg-red-50 transition-colors">退出</button>
                        </form>
                    </div>
                </header>

                <div className="flex justify-between items-center px-1">
                    <h2 className="text-xl font-semibold text-gray-700">我的订阅 ({subs.length})</h2>
                    <button
                        onClick={openCreate}
                        className="bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95 text-sm font-medium"
                    >
                        + 新增订阅
                    </button>
                </div>

                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-1">
                    {subs.map(sub => {
                        const link = `${baseUrl}/api/s/${sub.token}`;
                        return (
                            <div key={sub.token} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative hover:shadow-md transition-all duration-200 group">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800">{sub.name}</h3>
                                        <p className="text-xs text-gray-400 font-mono mt-1 tracking-wide">Token: {sub.token.substring(0, 8)}...</p>
                                    </div>
                                    <div className="space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEdit(sub)} className="text-blue-600 text-sm hover:underline font-medium">编辑</button>
                                        <button onClick={() => handleDelete(sub.token)} className="text-red-500 text-sm hover:underline font-medium">删除</button>
                                    </div>
                                </div>

                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center justify-between mb-4 group-hover:border-blue-100 transition-colors">
                                    <code className="text-xs text-gray-600 break-all line-clamp-1 font-mono">{link}</code>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(link);
                                            alert('复制成功');
                                        }}
                                        className="ml-3 text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-md text-gray-700 hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200 transition-all shrink-0 font-medium"
                                    >
                                        复制链接
                                    </button>
                                </div>

                                {sub.customRules && (
                                    <div className="text-xs text-gray-500">
                                        <span className="font-semibold text-gray-400">自定义规则:</span> {sub.customRules.length > 50 ? sub.customRules.substring(0, 50) + '...' : sub.customRules}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                    {subs.length === 0 && (
                        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl shadow-sm border border-dashed border-gray-200">
                            <p>暂无订阅</p>
                            <button onClick={openCreate} className="mt-2 text-blue-500 hover:underline text-sm">点击新增一个</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm transition-all duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">{editingSub ? '编辑订阅' : '新增订阅'}</h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <span className="text-2xl leading-none">&times;</span>
                            </button>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">备注名称</label>
                                <input
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    placeholder="例如：iPhone, 家里软路由"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">自定义规则</label>
                                <div className="relative">
                                    <textarea
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 font-mono text-xs h-40 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                                        value={formRules}
                                        onChange={e => setFormRules(e.target.value)}
                                        placeholder={`- DOMAIN-SUFFIX,google.com,Proxy\n- DOMAIN-KEYWORD,twitter,Proxy`}
                                    />
                                    <div className="absolute bottom-2 right-3 text-[10px] text-gray-400 pointer-events-none bg-white/80 px-1 rounded">
                                        追加到末尾
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button
                                onClick={closeModal}
                                className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/30 transform active:scale-95"
                            >
                                {loading ? '保存中...' : '保存'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
