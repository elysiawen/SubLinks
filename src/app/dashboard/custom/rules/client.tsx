'use client';

import { useState, useMemo } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { saveRuleSet, deleteRuleSet, type ConfigSet } from '@/lib/config-actions';
import Modal from '@/components/Modal';
import RuleEditor from '@/components/RuleEditor';
import { useRouter } from 'next/navigation';

interface ProxyGroup {
    name: string;
    type: string;
    source: string;
}

interface RulesClientProps {
    rules: ConfigSet[];
    proxyGroups: ProxyGroup[];
}

export default function RulesClient({ rules: initialRules, proxyGroups }: RulesClientProps) {
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const router = useRouter();
    const [rules, setRules] = useState(initialRules);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<ConfigSet | null>(null);
    const [ruleName, setRuleName] = useState('');
    const [ruleContent, setRuleContent] = useState('');
    const [loading, setLoading] = useState(false);



    const handleCreate = () => {
        setEditingRule(null);
        setRuleName('');
        setRuleContent('');
        setIsModalOpen(true);
    };

    const handleEdit = (rule: ConfigSet) => {
        setEditingRule(rule);
        setRuleName(rule.name);
        setRuleContent(rule.content);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!ruleName.trim()) {
            error('请输入规则名称');
            return;
        }

        if (!ruleContent.trim()) {
            error('请输入规则内容');
            return;
        }

        setLoading(true);
        try {
            await saveRuleSet(editingRule?.id || null, ruleName, ruleContent);
            success(editingRule ? '规则已更新' : '规则已创建');
            setIsModalOpen(false);
            // Refresh the page to get updated data
            window.location.reload();
        } catch (err) {
            error('保存失败: ' + (err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (rule: ConfigSet) => {
        const confirmed = await confirm(
            `确定要删除规则 "${rule.name}" 吗？此操作不可撤销。`
        );

        if (!confirmed) return;

        try {
            await deleteRuleSet(rule.id);
            success('规则已删除');
            router.refresh();
        } catch (err) {
            error('删除失败: ' + (err as Error).message);
        }
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };



    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">自定义规则</h1>
                    <p className="text-sm text-gray-500 mt-1">管理您的分流规则配置</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                    <span>➕</span>
                    <span>新建规则</span>
                </button>
            </div>

            {/* Rules List */}
            {rules.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center border border-gray-200 shadow-sm">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                        📝
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">暂无自定义规则</h3>
                    <p className="text-gray-500 mb-6">创建您的第一个分流规则配置</p>
                    <button
                        onClick={handleCreate}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow font-medium"
                    >
                        立即创建
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rules.map((rule) => (
                        <div
                            key={rule.id}
                            className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group flex flex-col overflow-hidden"
                        >
                            <div className="p-4 border-b border-gray-50 bg-gray-50/30 flex items-start justify-between">
                                <div className="flex-1 min-w-0 pr-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-base font-semibold text-gray-800 truncate" title={rule.name}>
                                            {rule.name}
                                        </h3>
                                        {rule.isGlobal && (
                                            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-medium rounded border border-purple-200 shrink-0">
                                                🌐 全局
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <div className="text-xs text-gray-400 flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {formatDate(rule.updatedAt)}
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
                                    onClick={() => handleEdit(rule)}
                                    disabled={rule.isGlobal}
                                    title={rule.isGlobal ? '全局配置不可编辑' : ''}
                                    className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${rule.isGlobal
                                        ? 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600 hover:shadow-sm'
                                        }`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    编辑
                                </button>
                                <button
                                    onClick={() => handleDelete(rule)}
                                    disabled={rule.isGlobal}
                                    title={rule.isGlobal ? '全局配置不可删除' : ''}
                                    className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${rule.isGlobal
                                        ? 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-red-300 hover:text-red-600 hover:shadow-sm'
                                        }`}
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
            )}



            {/* Edit/Create Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingRule ? '编辑规则' : '新建规则'}
                maxWidth="max-w-4xl"
            >
                <div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                规则名称
                            </label>
                            <input
                                type="text"
                                value={ruleName}
                                onChange={(e) => setRuleName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="例如: 我的分流规则"
                            />
                        </div>

                        <div>
                            <RuleEditor
                                value={ruleContent}
                                onChange={setRuleContent}
                                proxyGroups={proxyGroups}
                            />
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-200 flex justify-end gap-3 mt-4">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="px-6 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            disabled={loading}
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? '保存中...' : '保存'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
