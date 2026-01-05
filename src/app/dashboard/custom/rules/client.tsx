'use client';

import { useState, useMemo } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { saveRuleSet, deleteRuleSet, type ConfigSet } from '@/lib/config-actions';
import Modal from '@/components/Modal';
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

    // Mode toggle
    const [ruleMode, setRuleMode] = useState<'simple' | 'advanced'>('simple');

    // Simple mode state
    const [guiRules, setGuiRules] = useState<{ type: string, value: string, policy: string, id: string }[]>([]);
    const [newRuleType, setNewRuleType] = useState('DOMAIN-SUFFIX');
    const [newRuleValue, setNewRuleValue] = useState('');
    const [newRulePolicy, setNewRulePolicy] = useState('Proxy');

    // Policy Selector State
    const [showPolicySelector, setShowPolicySelector] = useState(false);
    const [policySearch, setPolicySearch] = useState('');

    // Helper functions
    const parseRules = (text: string) => {
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(line => {
                const parts = line.replace(/^-\s*/, '').split(',').map(p => p.trim());
                if (parts.length >= 3) {
                    return { type: parts[0], value: parts[1], policy: parts[2], id: Math.random().toString(36).substr(2, 9) };
                }
                return null;
            })
            .filter(r => r !== null) as { type: string, value: string, policy: string, id: string }[];
    };

    const stringifyRules = (rules: { type: string, value: string, policy: string }[]) => {
        return rules.map(r => `- ${r.type},${r.value},${r.policy}`).join('\n');
    };

    const syncTextToGui = (text: string) => {
        setGuiRules(parseRules(text));
    };

    const updateGuiRules = (newRules: typeof guiRules) => {
        setGuiRules(newRules);
        setRuleContent(stringifyRules(newRules));
    };

    const groupedPolicies = useMemo(() => {
        const grouped: Record<string, ProxyGroup[]> = {};

        // Add all proxy groups
        proxyGroups.filter(p => p.name.toLowerCase().includes(policySearch.toLowerCase())).forEach(p => {
            const source = p.source === 'custom' ? '自定义组' : p.source;
            if (!grouped[source]) grouped[source] = [];
            grouped[source].push(p);
        });

        return grouped;
    }, [proxyGroups, policySearch]);

    const handleCreate = () => {
        setEditingRule(null);
        setRuleName('');
        setRuleContent('');
        setRuleMode('simple');
        setGuiRules([]);
        setIsModalOpen(true);
    };

    const handleEdit = (rule: ConfigSet) => {
        setEditingRule(rule);
        setRuleName(rule.name);
        setRuleContent(rule.content);
        setRuleMode('simple');
        syncTextToGui(rule.content);
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

    const addGuiRule = () => {
        if (!newRuleValue.trim()) {
            error('请填写规则值');
            return;
        }
        const newRule = {
            type: newRuleType,
            value: newRuleValue.trim(),
            policy: newRulePolicy,
            id: Math.random().toString(36).substr(2, 9)
        };
        updateGuiRules([...guiRules, newRule]);
        setNewRuleValue('');
    };

    const removeGuiRule = (id: string) => {
        updateGuiRules(guiRules.filter(r => r.id !== id));
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

            {/* Policy Selector Modal */}
            <Modal
                isOpen={showPolicySelector}
                onClose={() => setShowPolicySelector(false)}
                title="选择策略"
                maxWidth="max-w-2xl"
                zIndex={60}
            >
                <div className="flex flex-col h-[60vh]">
                    <div className="border-b space-y-3 shrink-0 pb-4">
                        <input
                            type="text"
                            value={policySearch}
                            onChange={(e) => setPolicySearch(e.target.value)}
                            placeholder="搜索策略..."
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div className="overflow-y-auto flex-1 py-4 space-y-6">
                        {/* Built-in Policies */}
                        <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">内置策略</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {['DIRECT', 'REJECT', 'REJECT-TINYGIF', 'NO-RESOLVE'].map(p => (
                                    <button
                                        key={p}
                                        onClick={() => {
                                            setNewRulePolicy(p);
                                            setShowPolicySelector(false);
                                        }}
                                        className="text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-gray-700 transition-all text-sm font-medium"
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Proxy Groups */}
                        {Object.entries(groupedPolicies).map(([source, groups]) => (
                            <div key={source}>
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    {source}
                                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">{groups.length}</span>
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {groups.map(g => (
                                        <button
                                            key={g.name}
                                            onClick={() => {
                                                setNewRulePolicy(g.name);
                                                setShowPolicySelector(false);
                                            }}
                                            className="text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-gray-700 transition-all text-sm truncate"
                                            title={g.name}
                                        >
                                            {g.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                        <button
                            onClick={() => setShowPolicySelector(false)}
                            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            关闭
                        </button>
                    </div>
                </div>
            </Modal>

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
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    规则内容
                                </label>
                                <div className="bg-gray-100 p-0.5 rounded-lg flex text-xs">
                                    <button
                                        onClick={() => {
                                            setRuleMode('simple');
                                            syncTextToGui(ruleContent);
                                        }}
                                        className={`px-3 py-1 rounded-md transition-all ${ruleMode === 'simple' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500'}`}
                                    >
                                        简易模式
                                    </button>
                                    <button
                                        onClick={() => setRuleMode('advanced')}
                                        className={`px-3 py-1 rounded-md transition-all ${ruleMode === 'advanced' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500'}`}
                                    >
                                        高级模式
                                    </button>
                                </div>
                            </div>

                            {ruleMode === 'advanced' ? (
                                <div>
                                    <textarea
                                        value={ruleContent}
                                        onChange={(e) => setRuleContent(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                                        rows={15}
                                        placeholder="- DOMAIN-SUFFIX,google.com,🚀 节点选择&#10;- DOMAIN-KEYWORD,youtube,🎬 YouTube&#10;- IP-CIDR,192.168.0.0/16,DIRECT&#10;- GEOIP,CN,DIRECT&#10;- MATCH,🚀 节点选择"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        YAML 格式，每行一条规则，格式: - TYPE,VALUE,POLICY
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* Add Rule Form */}
                                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                        <div className="grid grid-cols-12 gap-2">
                                            <select
                                                value={newRuleType}
                                                onChange={(e) => setNewRuleType(e.target.value)}
                                                className="col-span-3 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            >
                                                <option value="DOMAIN">DOMAIN</option>
                                                <option value="DOMAIN-SUFFIX">DOMAIN-SUFFIX</option>
                                                <option value="DOMAIN-KEYWORD">DOMAIN-KEYWORD</option>
                                                <option value="IP-CIDR">IP-CIDR</option>
                                                <option value="IP-CIDR6">IP-CIDR6</option>
                                                <option value="GEOIP">GEOIP</option>
                                                <option value="MATCH">MATCH</option>
                                            </select>
                                            <input
                                                type="text"
                                                value={newRuleValue}
                                                onChange={(e) => setNewRuleValue(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && addGuiRule()}
                                                placeholder="规则值"
                                                className="col-span-5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                            <div className="col-span-3 relative">
                                                <input
                                                    type="text"
                                                    value={newRulePolicy}
                                                    onChange={(e) => setNewRulePolicy(e.target.value)}
                                                    placeholder="策略"
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                                <button
                                                    onClick={() => {
                                                        setPolicySearch('');
                                                        setShowPolicySelector(true);
                                                    }}
                                                    className="absolute right-1 top-1 bottom-1 px-2 text-gray-400 hover:text-blue-600 transition-colors"
                                                >
                                                    🔍
                                                </button>
                                            </div>
                                            <button
                                                onClick={addGuiRule}
                                                className="col-span-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    {/* Rules List */}
                                    {guiRules.length === 0 ? (
                                        <div className="text-center text-gray-400 text-sm py-8 border border-dashed border-gray-300 rounded-lg">
                                            暂无规则，请添加
                                        </div>
                                    ) : (
                                        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-96 overflow-y-auto">
                                            {guiRules.map((rule) => (
                                                <div key={rule.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                                                    <div className="flex items-center gap-3 flex-1 font-mono text-sm">
                                                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-semibold">
                                                            {rule.type}
                                                        </span>
                                                        <span className="text-gray-700">{rule.value}</span>
                                                        <span className="text-gray-400">→</span>
                                                        <span className="text-green-600 font-medium">{rule.policy}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => removeGuiRule(rule.id)}
                                                        className="text-red-500 hover:text-red-700 text-sm px-2"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-xs text-gray-400">
                                        共 {guiRules.length} 条规则
                                    </p>
                                </div>
                            )}
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
