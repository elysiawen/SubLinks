'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ToastProvider';
import { UaFilterConfig, UaRule } from '@/lib/database/interface';

interface UaFilterFormProps {
    value?: UaFilterConfig;
    onChange: (newValue: UaFilterConfig) => void;
}

export default function UaFilterForm({ value, onChange }: UaFilterFormProps) {
    const { success, error } = useToast();

    // Internal state to manage form fields
    const [enabled, setEnabled] = useState(value?.enabled || false);
    const [mode, setMode] = useState<'blacklist' | 'whitelist'>(value?.mode || 'blacklist');
    const [rules, setRules] = useState<UaRule[]>(value?.rules || []);

    // UA Testing state
    const [testUa, setTestUa] = useState('');
    const [testResult, setTestResult] = useState<boolean | null>(null);

    // Presets
    const [presets, setPresets] = useState<any>(null);

    // Sync state with props when props change externally
    useEffect(() => {
        if (value) {
            setEnabled(value.enabled);
            setMode(value.mode);
            setRules(value.rules);
        }
    }, [value]);

    // Notify parent of changes
    useEffect(() => {
        onChange({
            enabled,
            mode,
            rules
        });
    }, [enabled, mode, rules]);

    // Load presets
    useEffect(() => {
        import('@/lib/ua-filter').then(module => {
            setPresets(module.UA_PRESETS);
        });
    }, []);

    const addRule = () => {
        setRules([...rules, { pattern: '', matchType: 'contains', description: '' }]);
    };

    const removeRule = (index: number) => {
        setRules(rules.filter((_, i) => i !== index));
    };

    const updateRule = (index: number, field: keyof UaRule, val: string) => {
        const newRules = [...rules];
        newRules[index] = { ...newRules[index], [field]: val };
        setRules(newRules);
    };

    const addPreset = (presetKey: string) => {
        if (!presets || !presets[presetKey]) return;
        const preset = presets[presetKey];
        // Check if already exists
        if (rules.some(r => r.pattern === preset.pattern && r.matchType === preset.matchType)) {
            error('该规则已存在');
            return;
        }
        setRules([...rules, { ...preset }]);
        success(`已添加预设规则: ${preset.description}`);
    };

    const testUaFilter = async () => {
        if (!testUa.trim()) {
            error('请输入 User-Agent 进行测试');
            return;
        }

        try {
            const { checkUaFilter } = await import('@/lib/ua-filter');
            const filterConfig = { mode, rules, enabled: true }; // Force enabled for testing
            const result = checkUaFilter(testUa, filterConfig);
            setTestResult(result);
        } catch (e) {
            error('测试失败');
        }
    };

    return (
        <div className="space-y-6">
            {/* Enable Toggle */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <label className="text-sm font-medium text-gray-700">启用 UA 过滤</label>
                    <p className="text-xs text-gray-500 mt-1">关闭后将不进行任何 UA 检查（Middleware 层的微信/QQ 拦截仍然生效）</p>
                </div>
                <button
                    type="button"
                    onClick={() => setEnabled(!enabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            {enabled && (
                <>
                    {/* Mode Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">过滤模式</label>
                        <select
                            value={mode}
                            onChange={(e) => setMode(e.target.value as 'blacklist' | 'whitelist')}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border bg-white text-gray-900"
                        >
                            <option value="blacklist">🚫 黑名单（拦截匹配的 UA）</option>
                            <option value="whitelist">✅ 白名单（仅允许匹配的 UA）</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            {mode === 'blacklist' ? '匹配到规则的 UA 将被拒绝访问' : '只有匹配到规则的 UA 才能访问'}
                        </p>
                    </div>

                    {/* Preset Quick Add */}
                    {presets && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">快速添加预设规则</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <button type="button" onClick={() => addPreset('clash')} className="px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition border border-blue-200">
                                    ✅ Clash
                                </button>
                                <button type="button" onClick={() => addPreset('shadowrocket')} className="px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition border border-blue-200">
                                    ✅ Shadowrocket
                                </button>
                                <button type="button" onClick={() => addPreset('quantumult')} className="px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition border border-blue-200">
                                    ✅ Quantumult X
                                </button>
                                <button type="button" onClick={() => addPreset('surge')} className="px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition border border-blue-200">
                                    ✅ Surge
                                </button>
                                <button type="button" onClick={() => addPreset('chrome')} className="px-3 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition border border-green-200">
                                    🌐 Chrome
                                </button>
                                <button type="button" onClick={() => addPreset('firefox')} className="px-3 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition border border-green-200">
                                    🌐 Firefox
                                </button>
                                <button type="button" onClick={() => addPreset('curl')} className="px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition border border-red-200">
                                    🚫 cURL
                                </button>
                                <button type="button" onClick={() => addPreset('pythonRequests')} className="px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition border border-red-200">
                                    🚫 Python
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Rules List */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">自定义规则 ({rules.length})</label>
                            <button
                                type="button"
                                onClick={addRule}
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            >
                                + 添加规则
                            </button>
                        </div>

                        {rules.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                                暂无规则，点击上方按钮添加
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {rules.map((rule, index) => (
                                    <div key={index} className="flex flex-col sm:flex-row gap-2 items-start p-3 bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="flex-1 space-y-2 w-full">
                                            <input
                                                type="text"
                                                value={rule.pattern}
                                                onChange={(e) => updateRule(index, 'pattern', e.target.value)}
                                                placeholder="匹配模式 (例如: clash, Chrome/)"
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
                                            />
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <select
                                                    value={rule.matchType}
                                                    onChange={(e) => updateRule(index, 'matchType', e.target.value as any)}
                                                    className="block w-full sm:w-40 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border bg-white text-gray-900"
                                                >
                                                    <option value="contains">包含</option>
                                                    <option value="startsWith">开头匹配</option>
                                                    <option value="endsWith">结尾匹配</option>
                                                    <option value="exact">完全匹配</option>
                                                    <option value="regex">正则表达式</option>
                                                </select>
                                                <input
                                                    type="text"
                                                    value={rule.description || ''}
                                                    onChange={(e) => updateRule(index, 'description', e.target.value)}
                                                    placeholder="描述 (可选)"
                                                    className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeRule(index)}
                                            className="w-full sm:w-auto px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm border border-red-100 mt-2 sm:mt-0"
                                        >
                                            删除
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* UA Testing Tool */}
                    <div className="border-t pt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">🧪 测试 User-Agent</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={testUa}
                                onChange={(e) => {
                                    setTestUa(e.target.value);
                                    setTestResult(null);
                                }}
                                placeholder="输入 UA 字符串进行测试 (例如: clash-verge/1.0.0)"
                                className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
                            />
                            <button
                                type="button"
                                onClick={testUaFilter}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
                            >
                                测试
                            </button>
                        </div>
                        {testResult !== null && (
                            <div className={`mt-2 p-3 rounded-lg ${testResult ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {testResult ? '✅ 允许访问' : '❌ 拒绝访问'}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
