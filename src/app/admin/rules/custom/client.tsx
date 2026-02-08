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
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">
                        暂无自定义规则集,点击上方按钮创建
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {rules.map((rule) => (
                            <div key={rule.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-lg font-semibold text-gray-800">{rule.name}</h3>
                                            {rule.isGlobal && (
                                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded border border-purple-200">
                                                    🌐 全局
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                            <span>👤 {rule.username || '未知用户'}</span>
                                            <span>•</span>
                                            <span>🕒 {new Date(rule.updatedAt).toLocaleString('zh-CN')}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openEdit(rule)}
                                            className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                                        >
                                            编辑
                                        </button>
                                        <button
                                            onClick={() => handleDelete(rule.id, rule.name)}
                                            disabled={loading}
                                            className="text-sm bg-red-50 text-red-600 px-3 py-1 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                                        >
                                            删除
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-words">
                                        {rule.content}
                                    </pre>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            }
        </div >
    );
}
