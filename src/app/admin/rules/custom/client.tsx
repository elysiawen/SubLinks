'use client';

import { useState, useMemo } from 'react';
import { saveCustomRule, deleteCustomRule } from './actions';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import Modal from '@/components/Modal';
import RuleEditor from '@/components/RuleEditor';
import { SubmitButton } from '@/components/SubmitButton';

interface ConfigSet {
    id: string;
    name: string;
    content: string;
    updatedAt: number;
    userId?: string;
    isGlobal?: boolean;
    username?: string;
}


interface ProxyGroup {
    name: string;
    type: string;
    source: string;
}

export default function CustomRulesClient({
    customRules: initialRules,
    proxyGroups = []
}: {
    customRules: ConfigSet[],
    proxyGroups?: ProxyGroup[]
}) {
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const [rules, setRules] = useState<ConfigSet[]>(initialRules);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formName, setFormName] = useState('');
    const [formContent, setFormContent] = useState('');
    const [formIsGlobal, setFormIsGlobal] = useState(false);
    const [loading, setLoading] = useState(false);



    const openCreate = () => {
        setEditingId(null);
        setFormName('');
        setFormContent('');
        setFormIsGlobal(false);
        setIsEditing(true);
    };

    const openEdit = (rule: ConfigSet) => {
        setEditingId(rule.id);
        setFormName(rule.name);
        setFormContent(rule.content);
        setFormIsGlobal(rule.isGlobal || false);
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!formName.trim() || !formContent.trim()) {
            error('请填写完整的名称和内容');
            return;
        }

        setLoading(true);
        await saveCustomRule(editingId, formName.trim(), formContent.trim(), formIsGlobal);
        setLoading(false);
        setIsEditing(false);
        success(editingId ? '规则集更新成功' : '规则集创建成功');
        window.location.reload();
    };

    const handleDelete = async (id: string, name: string) => {
        if (!await confirm(`确定要删除自定义规则集 "${name}" 吗？`, { confirmColor: 'red' })) {
            return;
        }

        setLoading(true);
        await deleteCustomRule(id);
        setLoading(false);
        success('规则集已删除');
        window.location.reload();
    };



    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">📝 自定义规则集管理</h2>
                    <p className="text-sm text-gray-500 mt-1">创建和管理自定义分流规则配置</p>
                </div>
                <div className="flex gap-2">
                    <a
                        href="/admin/rules"
                        className="text-sm bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                        ← 返回列表
                    </a>
                    <button
                        onClick={openCreate}
                        className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        + 新建规则集
                    </button>
                </div>
            </div>

            <Modal
                isOpen={isEditing}
                onClose={() => setIsEditing(false)}
                title={editingId ? '编辑规则集' : '新建规则集'}
                maxWidth="max-w-4xl"
            >
                {isEditing && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">名称</label>
                            <input
                                type="text"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="例如：自定义广告拦截规则"
                            />
                        </div>

                        <RuleEditor
                            value={formContent}
                            onChange={setFormContent}
                            proxyGroups={proxyGroups}
                        />

                        {/* Global Config Checkbox */}
                        <div className="border-t border-gray-200 pt-4">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={formIsGlobal}
                                    onChange={(e) => setFormIsGlobal(e.target.checked)}
                                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-700 group-hover:text-purple-600 transition-colors">
                                            🌐 设为全局配置
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        全局配置对所有用户可见和可用，但只有创建者可以编辑和删除
                                    </p>
                                </div>
                            </label>
                        </div>

                        <div className="flex gap-2">
                            <SubmitButton
                                onClick={handleSave}
                                isLoading={loading}
                                text="保存"
                                className="flex-1"
                            />
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                )}
            </Modal >

            {
                rules.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center border border-gray-200 shadow-sm">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                            📝
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">暂无自定义规则集</h3>
                        <p className="text-gray-500 mb-6">点击上方按钮创建第一个分流规则配置</p>
                        <button
                            onClick={openCreate}
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow font-medium"
                        >
                            新建规则集
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {rules.map((rule) => (
                            <div key={rule.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group flex flex-col overflow-hidden">
                                <div className="p-4 border-b border-gray-50 bg-gray-50/30 flex items-start justify-between">
                                    <div className="flex-1 min-w-0 pr-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="text-base font-semibold text-gray-800 truncate" title={rule.name}>
                                                {rule.name}
                                            </h3>
                                            {rule.isGlobal && (
                                                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-medium rounded border border-purple-200 shrink-0">
                                                    全局
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <div className="text-xs text-gray-500 flex items-center gap-1.5">
                                                <span className="w-4 h-4 bg-gray-100 rounded-full flex items-center justify-center text-[10px] text-gray-500 border border-gray-200">👤</span>
                                                <span className="truncate max-w-[120px] font-medium text-gray-600" title={rule.username || '未知用户'}>{rule.username || '未知用户'}</span>
                                            </div>
                                            <div className="text-xs text-gray-400 flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {new Date(rule.updatedAt).toLocaleString('zh-CN')}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 flex-1 flex flex-col space-y-3">
                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 relative group/code">
                                        <pre className="text-[10px] leading-relaxed text-gray-600 font-mono overflow-hidden h-20 relative">
                                            {rule.content}
                                            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none"></div>
                                        </pre>
                                    </div>
                                </div>

                                <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => openEdit(rule)}
                                        className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:shadow-sm transition-all"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        编辑
                                    </button>
                                    <button
                                        onClick={() => handleDelete(rule.id, rule.name)}
                                        disabled={loading}
                                        className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 hover:shadow-sm disabled:opacity-50 transition-all"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        删除
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            }
        </div >
    );
}
