'use client';

import { useState, useMemo, useEffect } from 'react';
import { createSubscription, deleteSubscription, updateSubscription } from '@/lib/sub-actions';
import { changePassword } from '@/lib/user-actions';
import { ConfigSet } from '@/lib/config-actions';
import yaml from 'js-yaml';

interface Sub {
    token: string;
    name: string;
    customRules: string;
    groupId?: string;
    ruleId?: string;
    selectedSources?: string[];
}

interface ConfigSets {
    groups: ConfigSet[];
    rules: ConfigSet[];
}

export default function DashboardClient({ initialSubs, username, baseUrl, configSets, defaultGroups = [], availableSources = [] }: { initialSubs: Sub[], username: string, baseUrl: string, configSets: ConfigSets, defaultGroups: string[], availableSources: { name: string; url: string }[] }) {
    const [subs, setSubs] = useState<Sub[]>(initialSubs);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSub, setEditingSub] = useState<Sub | null>(null);

    // Password change modal state
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Form State
    const [formName, setFormName] = useState('');
    const [formRules, setFormRules] = useState('');
    const [formGroupId, setFormGroupId] = useState('default');
    const [formRuleId, setFormRuleId] = useState('default');
    const [formSelectedSources, setFormSelectedSources] = useState<string[]>([]);

    // Calculate Dynamic Policies based on selected Group Config
    const availablePolicies = useMemo(() => {
        const basePolicies = ['Proxy', 'DIRECT', 'REJECT', 'Auto', 'Global'];
        let extraGroups: string[] = [];

        if (formGroupId === 'default') {
            extraGroups = defaultGroups;
        } else {
            console.log('Configs:', configSets.groups);
            const selectedSet = configSets.groups.find(g => g.id === formGroupId);
            console.log('Selected Set:', selectedSet);
            if (selectedSet) {
                try {
                    const doc = yaml.load(selectedSet.content) as any;
                    console.log('Parsed Doc:', doc);
                    if (Array.isArray(doc)) {
                        extraGroups = doc.map((g: any) => g.name);
                    } else if (doc && typeof doc === 'object') {
                        // Handle potential single object or dictionary format
                        if (doc['proxy-groups'] && Array.isArray(doc['proxy-groups'])) {
                            extraGroups = doc['proxy-groups'].map((g: any) => g.name);
                        } else if (doc.name) {
                            // Handle single group
                            extraGroups = [doc.name];
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse custom group set:', e);
                }
            }
        }

        // Deduplicate and filter
        const all = [...basePolicies, ...extraGroups];
        console.log('Calculated Policies:', all);
        return Array.from(new Set(all));
    }, [formGroupId, configSets.groups, defaultGroups]);

    const refresh = async () => {
        window.location.reload();
    };

    const handleSubmit = async () => {
        setLoading(true);
        let result;
        if (editingSub) {
            result = await updateSubscription(editingSub.token, formName, formRules, formGroupId, formRuleId, formSelectedSources);
        } else {
            result = await createSubscription(formName, formRules, formGroupId, formRuleId, formSelectedSources);
        }
        setLoading(false);

        // Check for errors
        if (result && result.error) {
            alert(result.error);
            return;
        }

        closeModal();
        refresh();
    };

    const handleDelete = async (token: string) => {
        if (confirm('确定删除此订阅?')) {
            await deleteSubscription(token);
            refresh();
        }
    }

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
        return rules.map(r => `${r.type},${r.value},${r.policy}`).join('\n');
    };

    // GUI State
    const [guiRules, setGuiRules] = useState<{ type: string, value: string, policy: string, id: string }[]>([]);
    const [newRuleType, setNewRuleType] = useState('DOMAIN-SUFFIX');
    const [newRuleValue, setNewRuleValue] = useState('');
    const [newRulePolicy, setNewRulePolicy] = useState('Proxy');

    // Reset newRulePolicy if it's no longer valid when groups change
    useEffect(() => {
        if (!availablePolicies.includes(newRulePolicy)) {
            setNewRulePolicy('Proxy');
        }
    }, [availablePolicies, newRulePolicy]);

    // Sync Text to GUI when opening modal or switching modes
    const syncTextToGui = (text: string) => {
        setGuiRules(parseRules(text));
    };

    // Sync GUI to Text when changing rules
    const updateGuiRules = (newRules: typeof guiRules) => {
        setGuiRules(newRules);
        setFormRules(stringifyRules(newRules));
    };

    const addRule = () => {
        if (!newRuleValue && newRuleType !== 'MATCH') return; // MATCH type doesn't require a value
        const newRule = { type: newRuleType, value: newRuleValue, policy: newRulePolicy, id: Math.random().toString(36).substr(2, 9) };
        const updated = [...guiRules, newRule];
        updateGuiRules(updated);
        setNewRuleValue('');
    };

    const removeRule = (id: string) => {
        const updated = guiRules.filter(r => r.id !== id);
        updateGuiRules(updated);
    };

    const RuleTypes = [
        'DOMAIN-SUFFIX',
        'DOMAIN-KEYWORD',
        'DOMAIN',
        'IP-CIDR',
        'IP-CIDR6',
        'GEOIP',
        'MATCH'
    ];

    const openCreate = () => {
        setEditingSub(null);
        setFormName('');
        setFormRules('');
        setFormGroupId('default');
        setFormRuleId('default');
        setFormSelectedSources(availableSources.map(s => s.name)); // Default: select all
        setRuleMode('simple');
        setGuiRules([]);
        setIsModalOpen(true);
    }

    const openEdit = (sub: Sub) => {
        setEditingSub(sub);
        setFormName(sub.name);
        setFormRules(sub.customRules);
        setFormGroupId(sub.groupId || 'default');
        setFormRuleId(sub.ruleId || 'default');
        setFormSelectedSources(sub.selectedSources || availableSources.map(s => s.name));
        setRuleMode('simple');
        syncTextToGui(sub.customRules);
        setIsModalOpen(true);
    }

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingSub(null);
    }

    const handleChangePassword = async () => {
        if (!oldPassword || !newPassword || !confirmPassword) {
            alert('请填写所有字段');
            return;
        }

        if (newPassword !== confirmPassword) {
            alert('两次输入的新密码不一致');
            return;
        }

        if (newPassword.length < 4) {
            alert('新密码至少需要4个字符');
            return;
        }

        setLoading(true);
        const result = await changePassword(oldPassword, newPassword);
        setLoading(false);

        if (result.error) {
            alert(`❌ ${result.error}`);
        } else {
            alert('✅ 密码修改成功！');
            setIsPasswordModalOpen(false);
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 font-sans">
            <div className="max-w-4xl mx-auto space-y-6">
                <header className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight">用户中心</h1>
                    <div className="flex items-center gap-4">
                        <span className="font-medium text-gray-600">{username}</span>
                        <button
                            onClick={() => setIsPasswordModalOpen(true)}
                            className="text-xs text-blue-600 border border-blue-200 px-3 py-1.5 rounded-full hover:bg-blue-50 transition-colors"
                        >
                            修改密码
                        </button>
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
                                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                            {sub.name}
                                            {sub.groupId && sub.groupId !== 'default' && <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700 border border-purple-200">Custom Group</span>}
                                            {sub.ruleId && sub.ruleId !== 'default' && <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700 border border-indigo-200">Custom Rules</span>}
                                        </h3>
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
                                        <span className="font-semibold text-gray-400">追加规则:</span> {sub.customRules.length > 50 ? sub.customRules.substring(0, 50) + '...' : sub.customRules}
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
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 transform transition-all scale-100 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
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

                            {/* Upstream Source Selection */}
                            {availableSources.length > 0 && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">选择上游源</label>
                                    <div className="border border-gray-200 rounded-lg p-3 space-y-2 max-h-32 overflow-y-auto bg-gray-50">
                                        {availableSources.map(source => (
                                            <label key={source.name} className="flex items-center gap-2 cursor-pointer hover:bg-white px-2 py-1 rounded transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={formSelectedSources.includes(source.name)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFormSelectedSources([...formSelectedSources, source.name]);
                                                        } else {
                                                            setFormSelectedSources(formSelectedSources.filter(s => s !== source.name));
                                                        }
                                                    }}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">{source.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">选择要使用的上游节点源,未选择则使用全部</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">策略组配置</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
                                        value={formGroupId}
                                        onChange={e => setFormGroupId(e.target.value)}
                                    >
                                        <option value="default">默认 (跟随上游)</option>
                                        {configSets.groups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">分流规则配置</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
                                        value={formRuleId}
                                        onChange={e => setFormRuleId(e.target.value)}
                                    >
                                        <option value="default">默认 (跟随上游)</option>
                                        {configSets.rules.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>


                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-semibold text-gray-700">追加自定义规则</label>
                                    <div className="bg-gray-100 p-0.5 rounded-lg flex text-xs">
                                        <button
                                            onClick={() => {
                                                setRuleMode('simple');
                                                syncTextToGui(formRules);
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
                                    <div className="relative">
                                        <textarea
                                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 font-mono text-xs h-48 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                                            value={formRules}
                                            onChange={e => setFormRules(e.target.value)}
                                            placeholder={`- DOMAIN-SUFFIX,google.com,Proxy`}
                                        />
                                        <div className="absolute bottom-2 right-3 text-[10px] text-gray-400 pointer-events-none bg-white/80 px-1 rounded">
                                            Raw Edit Mode
                                        </div>
                                    </div>
                                ) : (
                                    <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                                        {/* Add Form */}
                                        <div className="p-3 bg-white border-b border-gray-100 flex gap-2 items-center">
                                            <select
                                                className="w-32 shrink-0 text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-blue-500"
                                                value={newRuleType}
                                                onChange={e => setNewRuleType(e.target.value)}
                                            >
                                                {RuleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>

                                            <input
                                                className="flex-1 min-w-0 text-xs border border-gray-200 rounded px-3 py-1.5 outline-none focus:border-blue-500"
                                                placeholder={newRuleType === 'MATCH' ? '无需填写' : 'google.com'}
                                                value={newRuleValue}
                                                onChange={e => setNewRuleValue(e.target.value)}
                                                disabled={newRuleType === 'MATCH'}
                                            />

                                            <select
                                                className="w-28 shrink-0 text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-blue-500"
                                                value={newRulePolicy}
                                                onChange={e => setNewRulePolicy(e.target.value)}
                                            >
                                                {availablePolicies.map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>

                                            <button
                                                onClick={addRule}
                                                className="shrink-0 bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                            </button>
                                        </div>

                                        {/* Rule List */}
                                        <div className="h-40 overflow-y-auto p-2 space-y-2">
                                            {guiRules.map((rule, idx) => (
                                                <div key={rule.id} className="flex items-center justify-between text-xs bg-white p-2 rounded shadow-sm border border-gray-100 group">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <span className="font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{rule.type}</span>
                                                        <span className="font-mono text-gray-700 truncate">{rule.value || '*'}</span>
                                                        <span className="text-gray-300">→</span>
                                                        <span className="text-blue-600 font-medium">{rule.policy}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => removeRule(rule.id)}
                                                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            ))}
                                            {guiRules.length === 0 && (
                                                <div className="text-center text-gray-400 text-xs py-8 italic">
                                                    添加几条自定义规则...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
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

            {/* Password Change Modal */}
            {isPasswordModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">修改密码</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">原密码</label>
                                <input
                                    type="password"
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="请输入原密码"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">新密码</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="至少4个字符"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">确认新密码</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="再次输入新密码"
                                />
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setIsPasswordModalOpen(false);
                                    setOldPassword('');
                                    setNewPassword('');
                                    setConfirmPassword('');
                                }}
                                className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleChangePassword}
                                disabled={loading}
                                className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 transition-all"
                            >
                                {loading ? '修改中...' : '确认修改'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
