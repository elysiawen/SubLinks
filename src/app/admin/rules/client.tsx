'use client';

import { useState } from 'react';
import { ConfigSet, saveRuleSet, deleteRuleSet } from '@/lib/config-actions';

interface PageProps {
    defaultRules: string[];
    customSets: ConfigSet[];
}

interface Rule {
    id: string;
    type: string;
    value: string;
    policy: string;
}

export default function AdminRulesClient({ defaultRules, customSets }: PageProps) {
    const [editingSet, setEditingSet] = useState<ConfigSet | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    // Editor State
    const [formName, setFormName] = useState('');
    const [formContent, setFormContent] = useState('');
    const [loading, setLoading] = useState(false);

    // Mode State
    const [editorMode, setEditorMode] = useState<'simple' | 'advanced'>('simple');
    const [guiRules, setGuiRules] = useState<Rule[]>([]);

    // New Rule Form State
    const [newRuleType, setNewRuleType] = useState('DOMAIN-SUFFIX');
    const [newRuleValue, setNewRuleValue] = useState('');
    const [newRulePolicy, setNewRulePolicy] = useState('Proxy');

    // Parse Rules Text to GUI
    const parseRules = (text: string): Rule[] => {
        try {
            const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
            return lines.map(line => {
                const parts = line.replace(/^-\s*/, '').split(',').map(p => p.trim());
                return {
                    id: Math.random().toString(36).substr(2, 9),
                    type: parts[0] || '',
                    value: parts[1] || '',
                    policy: parts[2] || ''
                };
            });
        } catch (e) {
            console.error('Parse error:', e);
        }
        return [];
    };

    // Serialize GUI to Text
    const serializeRules = (rules: Rule[]): string => {
        return rules.map(r => `- ${r.type},${r.value},${r.policy}`).join('\n');
    };

    // Sync Text to GUI
    const syncTextToGui = () => {
        setGuiRules(parseRules(formContent));
    };

    // Sync GUI to Text
    const syncGuiToText = (rules: Rule[]) => {
        setGuiRules(rules);
        setFormContent(serializeRules(rules));
    };

    // Add Rule
    const addRule = () => {
        if (!newRuleType) return;
        const newRule: Rule = {
            id: Math.random().toString(36).substr(2, 9),
            type: newRuleType,
            value: newRuleValue,
            policy: newRulePolicy
        };
        const updated = [...guiRules, newRule];
        syncGuiToText(updated);
        setNewRuleValue('');
    };

    // Remove Rule
    const removeRule = (id: string) => {
        const updated = guiRules.filter(r => r.id !== id);
        syncGuiToText(updated);
    };

    const openEditor = (set?: ConfigSet) => {
        if (set) {
            setEditingSet(set);
            setFormName(set.name);
            setFormContent(set.content);
            setGuiRules(parseRules(set.content));
        } else {
            setEditingSet(null);
            setFormName('');
            setFormContent('');
            setGuiRules([]);
        }
        setEditorMode('simple');
        setIsEditorOpen(true);
    };

    const handleSave = async () => {
        if (!formName || !formContent) return alert('请填写完整');
        setLoading(true);
        await saveRuleSet(editingSet ? editingSet.id : null, formName, formContent);
        setLoading(false);
        setIsEditorOpen(false);
    };

    const parsedDefaultRules = defaultRules.map(ruleStr => {
        const parts = ruleStr.split(',');
        return {
            type: parts[0]?.trim(),
            value: parts[1]?.trim(),
            target: parts[2]?.trim(),
            noResolve: parts.includes('no-resolve')
        };
    });

    const [viewingDefault, setViewingDefault] = useState(false);
    const RuleTypes = ['DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'DOMAIN', 'IP-CIDR', 'GEOIP', 'MATCH'];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">📝 分流规则配置</h2>
                <button onClick={() => openEditor()} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm transition-colors flex items-center gap-2">
                    <span>+</span> 新建规则集
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">规则集名称</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">类型</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">最后更新</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        <tr className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="h-2.5 w-2.5 rounded-full bg-green-500 mr-2"></div>
                                    <span className="text-sm font-medium text-gray-900">默认规则 (Upstream)</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">系统默认</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Auto-Sync</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button onClick={() => setViewingDefault(true)} className="text-blue-600 hover:text-blue-900">查看详情</button>
                            </td>
                        </tr>

                        {customSets.map((set) => (
                            <tr key={set.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{set.name}</div>
                                    <div className="text-xs text-gray-400">ID: {set.id}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">自定义</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(set.updatedAt).toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                    <button onClick={() => openEditor(set)} className="text-indigo-600 hover:text-indigo-900">编辑</button>
                                    <button onClick={async () => { if (confirm(`确定删除 ${set.name}?`)) await deleteRuleSet(set.id); }} className="text-red-600 hover:text-red-900">删除</button>
                                </td>
                            </tr>
                        ))}
                        {customSets.length === 0 && (
                            <tr><td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-400 italic">暂无自定义规则集</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {viewingDefault && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-0 flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-xl font-bold text-gray-800">默认规则详情</h3>
                            <button onClick={() => setViewingDefault(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-0">
                            <table className="min-w-full divide-y divide-gray-100 table-fixed">
                                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">类型</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">匹配值</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">策略/节点</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {parsedDefaultRules.map((rule, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-2 text-sm font-medium text-blue-600 truncate">{rule.type}</td>
                                            <td className="px-6 py-2 text-sm text-gray-700 font-mono truncate" title={rule.value}>{rule.value}</td>
                                            <td className="px-6 py-2 text-sm">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">{rule.target}</span>
                                            </td>
                                        </tr>
                                    ))}
                                    {parsedDefaultRules.length === 0 && (
                                        <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-400">No default rules found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {isEditorOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-6 flex flex-col max-h-[90vh]">
                        <h3 className="text-xl font-bold mb-4">{editingSet ? '编辑规则集' : '新建规则集'}</h3>

                        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">配置名称</label>
                                <input className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" value={formName} onChange={e => setFormName(e.target.value)} placeholder="例如：去广告增强" />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-semibold text-gray-700">规则集内容</label>
                                    <div className="bg-gray-100 p-0.5 rounded-lg flex text-xs">
                                        <button onClick={() => { setEditorMode('simple'); syncTextToGui(); }} className={`px-3 py-1 rounded-md transition-all ${editorMode === 'simple' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500'}`}>简易模式</button>
                                        <button onClick={() => setEditorMode('advanced')} className={`px-3 py-1 rounded-md transition-all ${editorMode === 'advanced' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500'}`}>高级模式</button>
                                    </div>
                                </div>

                                {editorMode === 'advanced' ? (
                                    <textarea className="w-full border border-gray-300 rounded-lg px-4 py-3 font-mono text-xs h-96 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none bg-gray-50" value={formContent} onChange={e => setFormContent(e.target.value)} placeholder={`- DOMAIN-SUFFIX,google.com,Proxy\n- DOMAIN-KEYWORD,twitter,Proxy\n- GEOIP,CN,DIRECT\n- MATCH,Proxy`} />
                                ) : (
                                    <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                                        <div className="p-4 bg-white border-b border-gray-100">
                                            <div className="grid grid-cols-12 gap-3 items-end">
                                                <div className="col-span-3">
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">规则类型</label>
                                                    <select className="w-full text-sm border border-gray-200 rounded px-3 py-2 outline-none focus:border-blue-500 bg-white" value={newRuleType} onChange={e => setNewRuleType(e.target.value)}>
                                                        {RuleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                                    </select>
                                                </div>
                                                <div className="col-span-4">
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">匹配值</label>
                                                    <input className="w-full text-sm border border-gray-200 rounded px-3 py-2 outline-none focus:border-blue-500" placeholder={newRuleType === 'MATCH' ? '无需填写' : 'google.com'} value={newRuleValue} onChange={e => setNewRuleValue(e.target.value)} disabled={newRuleType === 'MATCH'} />
                                                </div>
                                                <div className="col-span-4">
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">策略</label>
                                                    <input className="w-full text-sm border border-gray-200 rounded px-3 py-2 outline-none focus:border-blue-500" placeholder="Proxy" value={newRulePolicy} onChange={e => setNewRulePolicy(e.target.value)} />
                                                </div>
                                                <div className="col-span-1">
                                                    <button onClick={addRule} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition-colors">
                                                        <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="max-h-80 overflow-y-auto p-3 space-y-2">
                                            {guiRules.map((rule) => (
                                                <div key={rule.id} className="bg-white p-2.5 rounded-lg border border-gray-200 group hover:border-blue-200 transition-colors flex items-center justify-between">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-blue-700 shrink-0">{rule.type}</span>
                                                        <span className="text-sm text-gray-700 font-mono truncate">{rule.value || '*'}</span>
                                                        <span className="text-gray-300">→</span>
                                                        <span className="text-sm text-green-600 font-medium">{rule.policy}</span>
                                                    </div>
                                                    <button onClick={() => removeRule(rule.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all ml-2">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            ))}
                                            {guiRules.length === 0 && <div className="text-center text-gray-400 text-sm py-12 italic">添加规则...</div>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <button onClick={() => setIsEditorOpen(false)} className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100">取消</button>
                            <button onClick={handleSave} disabled={loading} className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50">{loading ? '保存中...' : '保存'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
