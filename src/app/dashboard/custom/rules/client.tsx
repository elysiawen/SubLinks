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
                <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                    <div className="text-6xl mb-4">📝</div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">暂无自定义规则</h3>
                    <p className="text-gray-500 mb-6">创建您的第一个分流规则配置</p>
                    <button
                        onClick={handleCreate}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        立即创建
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rules.map((rule) => (
                        <div
                            key={rule.id}
                            className="bg-white rounded-xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-semibold text-gray-800 truncate">
                                            {rule.name}
                                        </h3>
                                        {rule.isGlobal && (
                                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded border border-purple-200 shrink-0">
                                                🌐 全局
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        更新于 {formatDate(rule.updatedAt)}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
                                <pre className="text-xs text-gray-700 whitespace-pre-wrap break-all">
                                    {rule.content.substring(0, 200)}
                                    {rule.content.length > 200 && '...'}
                                </pre>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleEdit(rule)}
                                    disabled={rule.isGlobal}
                                    className={`flex-1 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${rule.isGlobal
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                        }`}
                                    title={rule.isGlobal ? '全局配置不可编辑' : ''}
                                >
                                    编辑
                                </button>
                                <button
                                    onClick={() => handleDelete(rule)}
                                    disabled={rule.isGlobal}
                                    className={`flex-1 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${rule.isGlobal
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-red-50 text-red-600 hover:bg-red-100'
                                        }`}
                                    title={rule.isGlobal ? '全局配置不可删除' : ''}
                                >
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
