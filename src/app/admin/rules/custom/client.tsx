'use client';

import { useState, useMemo } from 'react';
import { saveCustomRule, deleteCustomRule } from './actions';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import Modal from '@/components/Modal';

interface ConfigSet {
    id: string;
    name: string;
    content: string;
    updatedAt: number;
}

export default function CustomRulesClient({ customRules: initialRules }: { customRules: ConfigSet[] }) {
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const [rules, setRules] = useState<ConfigSet[]>(initialRules);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formName, setFormName] = useState('');
    const [formContent, setFormContent] = useState('');
    const [loading, setLoading] = useState(false);

    // Rule Builder State
    const [ruleMode, setRuleMode] = useState<'simple' | 'advanced'>('simple');

    // Helper to parse rules from text
    const parseRules = (text: string) => {
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(line => {
                const parts = line.split(',').map(p => p.trim());
                if (parts.length >= 3) {
                    return { type: parts[0], value: parts[1], policy: parts[2], id: Math.random().toString(36).substr(2, 9) };
                }
                return null;
            })
            .filter(r => r !== null) as { type: string, value: string, policy: string, id: string }[];
    };

    // Helper to stringify rules
    const stringifyRules = (rules: { type: string, value: string, policy: string }[]) => {
        return rules.map(r => `- ${r.type},${r.value},${r.policy}`).join('\n');
    };

    // GUI State
    const [guiRules, setGuiRules] = useState<{ type: string, value: string, policy: string, id: string }[]>([]);
    const [newRuleType, setNewRuleType] = useState('DOMAIN-SUFFIX');
    const [newRuleValue, setNewRuleValue] = useState('');
    const [newRulePolicy, setNewRulePolicy] = useState('Proxy');

    // Sync Text to GUI when opening modal or switching modes
    const syncTextToGui = (text: string) => {
        setGuiRules(parseRules(text));
    };

    // Sync GUI to Text when changing rules
    const updateGuiRules = (newRules: typeof guiRules) => {
        setGuiRules(newRules);
        setFormContent(stringifyRules(newRules));
    };

    const openCreate = () => {
        setEditingId(null);
        setFormName('');
        setFormContent('');
        setRuleMode('simple');
        setGuiRules([]);
        setIsEditing(true);
    };

    const openEdit = (rule: ConfigSet) => {
        setEditingId(rule.id);
        setFormName(rule.name);
        setFormContent(rule.content);
        setRuleMode('simple');
        syncTextToGui(rule.content);
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!formName.trim() || !formContent.trim()) {
            error('请填写完整的名称和内容');
            return;
        }

        setLoading(true);
        await saveCustomRule(editingId, formName.trim(), formContent.trim());
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

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-semibold text-gray-700">规则内容</label>
                                <div className="bg-gray-100 p-0.5 rounded-lg flex text-xs">
                                    <button
                                        onClick={() => {
                                            setRuleMode('simple');
                                            syncTextToGui(formContent);
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
                                        value={formContent}
                                        onChange={(e) => setFormContent(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-sm"
                                        rows={15}
                                        placeholder={`- DOMAIN-SUFFIX,google.com,🚀 节点选择\n- DOMAIN-KEYWORD,youtube,🎬 YouTube\n- IP-CIDR,192.168.0.0/16,DIRECT`}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        YAML 格式,每行一条规则,格式: - TYPE,VALUE,POLICY
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
                                                className="col-span-3 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                                                className="col-span-5 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            />
                                            <input
                                                type="text"
                                                value={newRulePolicy}
                                                onChange={(e) => setNewRulePolicy(e.target.value)}
                                                placeholder="策略"
                                                className="col-span-3 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            />
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
                                            暂无规则,请添加
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

                        <div className="flex gap-2">
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                            >
                                {loading ? '保存中...' : '保存'}
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {rules.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">
                    暂无自定义规则集,点击上方按钮创建
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {rules.map((rule) => (
                        <div key={rule.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800">{rule.name}</h3>
                                    <p className="text-xs text-gray-400 mt-1">
                                        更新时间: {new Date(rule.updatedAt).toLocaleString('zh-CN')}
                                    </p>
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
            )}
        </div>
    );
}
