'use client';

import React, { useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { SubmitButton } from '@/components/SubmitButton';
import dynamic from 'next/dynamic';
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import { commands } from '@uiw/react-md-editor';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

const createColorCommand = (name: string, color: string, label: string) => ({
    name: `color-${name}`,
    keyCommand: `color-${name}`,
    buttonProps: { 'aria-label': label, title: label },
    icon: <span style={{ color: color, fontWeight: 'bold' }}>●</span>,
    execute: (state: any, api: any) => {
        let modifyText = `<span style="color: ${color}">${state.selectedText}</span>`;
        if (!state.selectedText) {
            modifyText = `<span style="color: ${color}">${label}</span>`;
        }
        api.replaceSelection(modifyText);
    },
});

const colorGroup = commands.group([
    createColorCommand('red', '#ef4444', '红色'),
    createColorCommand('orange', '#f97316', '橙色'),
    createColorCommand('yellow', '#eab308', '黄色'),
    createColorCommand('green', '#22c55e', '绿色'),
    createColorCommand('blue', '#3b82f6', '蓝色'),
    createColorCommand('purple', '#a855f7', '紫色'),
    createColorCommand('pink', '#ec4899', '粉色'),
    createColorCommand('black', '#000000', '黑色'),
], {
    name: 'font-colors',
    groupName: 'font-colors',
    buttonProps: { 'aria-label': '字体颜色', title: '选择字体颜色' },
    icon: <span>🎨</span>
});

function RetentionSelector({ initialValue }: { initialValue: number }) {
    const isPreset = [30, 180, 365, 0].includes(initialValue);
    const [mode, setMode] = useState<string>(isPreset ? initialValue.toString() : 'custom');

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">保留时间</label>
            <div className="space-y-3">
                <select
                    name="retentionSelect"
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border bg-white text-gray-900"
                >
                    <option value="30">30天 (推荐)</option>
                    <option value="180">半年 (180天)</option>
                    <option value="365">一年 (365天)</option>
                    <option value="0">永久保存 (不清理)</option>
                    <option value="custom">自定义天数...</option>
                </select>

                {mode === 'custom' && (
                    <div className="flex items-center space-x-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <input
                            type="number"
                            name="customDays"
                            defaultValue={isPreset ? 30 : initialValue}
                            min="1"
                            className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                            placeholder="天数"
                        />
                        <span className="text-gray-500 text-sm">天</span>
                    </div>
                )}
            </div>
            <p className="mt-2 text-sm text-gray-500">
                系统将自动清理早于指定天数的日志记录。设置的时间越短，数据库体积越小。
            </p>
        </div>
    );
}

function AnnouncementEditor({ initialValue, config }: { initialValue: string; config: any }) {
    const { success } = useToast();
    const [announcement, setAnnouncement] = useState(initialValue);

    return (
        <form action={async (formData) => {
            formData.append('uaWhitelist', (config.uaWhitelist || []).join(','));
            formData.append('upstreamSources', JSON.stringify(config.upstreamSources || []));
            formData.append('logRetentionDays', config.logRetentionDays?.toString() || '30');
            formData.append('maxUserSubscriptions', config.maxUserSubscriptions?.toString() || '0');
            formData.append('upstreamUserAgent', config.upstreamUserAgent || '');
            formData.append('customBackgroundUrl', config.customBackgroundUrl || '');

            const { updateGlobalConfig } = await import('../actions');
            await updateGlobalConfig(formData);
            success('公告栏设置已保存');
        }} className="space-y-4">

            {/* Hidden input to ensure value is always submitted */}
            <input type="hidden" name="announcement" value={announcement || ''} />

            <div className="mb-4" data-color-mode="light">
                <label className="block text-sm font-medium text-gray-700 mb-2">公告内容</label>
                <div className="border rounded-lg overflow-hidden">
                    <style>{`
                        .w-md-editor-toolbar {
                            padding: 8px !important;
                            min-height: 48px !important;
                        }
                        /* Restore simpler button styling */
                        .w-md-editor-toolbar li > button {
                            font-size: 16px !important;
                            height: 32px !important;
                            width: 32px !important;
                            min-width: 32px !important;
                            margin: 0 2px !important;
                            display: inline-flex !important;
                            align-items: center !important;
                            justify-content: center !important;
                        }
                        .w-md-editor-toolbar li > button > svg {
                            width: 18px !important;
                            height: 18px !important;
                        }
                        /* Specific fix for custom icon span */
                        .w-md-editor-toolbar li > button > span {
                            display: inline-flex !important;
                            align-items: center !important;
                            justify-content: center !important;
                            line-height: 1 !important;
                            font-size: 18px !important;
                        }
                    `}</style>
                    <MDEditor
                        value={announcement}
                        onChange={(val) => setAnnouncement(val || '')}
                        preview="edit"
                        height={300}
                        commands={[
                            ...commands.getCommands(),
                            commands.divider,
                            colorGroup
                        ]}
                        textareaProps={{
                            placeholder: '请输入公告内容（支持 Markdown 语法和颜色标签）...'
                        }}
                    />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                    支持实时预览和 Markdown 语法。点击工具栏图标可快速插入格式。
                </p>
            </div>

            <div className="pt-2">
                <SubmitButton text="保存公告" />
            </div>
        </form>
    );
}

export default function AdminSettingsClient({ config }: { config: any }) {
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const [isCleaning, setIsCleaning] = useState(false);
    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-800">全局设置</h2>

            {/* Log Retention Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">🗑️</span> 日志自动清理
                </h3>
                <form action={async (formData) => {
                    formData.append('uaWhitelist', (config.uaWhitelist || []).join(','));
                    formData.append('upstreamSources', JSON.stringify(config.upstreamSources || []));

                    // Handle custom retention
                    const retentionSelect = formData.get('retentionSelect') as string;
                    let days = retentionSelect;
                    if (retentionSelect === 'custom') {
                        days = formData.get('customDays') as string;
                    }
                    formData.set('logRetentionDays', days);

                    const { updateGlobalConfig } = await import('../actions');
                    await updateGlobalConfig(formData);
                    success('日志清理设置已保存');
                }} className="space-y-4">

                    <RetentionSelector initialValue={config.logRetentionDays || 30} />

                    <div className="pt-2 flex gap-4">
                        <SubmitButton text="保存设置" />
                        <button
                            type="button"
                            onClick={async () => {
                                if (await confirm('⚠️ 确定要立即删除系统中的所有日志吗？此操作无法撤销。', { confirmColor: 'red', confirmText: '清空日志' })) {
                                    const { clearLogs } = await import('../actions');
                                    const res = await clearLogs(0);
                                    if (res?.success) {
                                        success('所有日志已清理完成');
                                    } else {
                                        error('清理失败');
                                    }
                                }
                            }}
                            className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition"
                        >
                            立即清理
                        </button>
                    </div>
                </form>
            </div>


            {/* User Limits */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">👤</span> 用户限制
                </h3>
                <form action={async (formData) => {
                    formData.append('uaWhitelist', (config.uaWhitelist || []).join(','));
                    formData.append('upstreamSources', JSON.stringify(config.upstreamSources || []));
                    formData.append('logRetentionDays', config.logRetentionDays?.toString() || '30');

                    // Handle max subs
                    const maxSubs = formData.get('maxUserSubscriptions') as string;
                    formData.set('maxUserSubscriptions', maxSubs);

                    const { updateGlobalConfig } = await import('../actions');
                    await updateGlobalConfig(formData);
                    success('用户限制设置已保存');
                }} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">每个用户最大订阅数</label>
                        <div className="flex items-center space-x-2">
                            <input
                                type="number"
                                name="maxUserSubscriptions"
                                defaultValue={config.maxUserSubscriptions ?? 0}
                                min="0"
                                className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                            />
                            <span className="text-gray-500 text-sm">条 (0 表示不限制)</span>
                        </div>
                    </div>

                    <div className="pt-2">
                        <SubmitButton text="保存设置" />
                    </div>
                </form>
            </div>

            {/* Network Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">🌐</span> UA设置
                </h3>
                <form action={async (formData) => {
                    formData.append('uaWhitelist', (config.uaWhitelist || []).join(','));
                    formData.append('upstreamSources', JSON.stringify(config.upstreamSources || []));
                    formData.append('logRetentionDays', config.logRetentionDays?.toString() || '30');
                    formData.append('maxUserSubscriptions', config.maxUserSubscriptions?.toString() || '0');

                    // Handle UA
                    const upstreamUserAgent = formData.get('upstreamUserAgent') as string;
                    formData.set('upstreamUserAgent', upstreamUserAgent);

                    const { updateGlobalConfig } = await import('../actions');
                    await updateGlobalConfig(formData);
                    success('网络设置已保存');
                }} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">上游请求 User-Agent</label>
                        <div className="flex flex-col space-y-2">
                            <input
                                type="text"
                                name="upstreamUserAgent"
                                defaultValue={config.upstreamUserAgent || ''}
                                placeholder="Clash/Vercel-Sub-Manager"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                            />
                            <p className="text-sm text-gray-500">
                                用于获取上游订阅时使用的 User-Agent。留空则使用默认值: <code className="bg-gray-100 px-1 rounded">Clash/Vercel-Sub-Manager</code>
                            </p>
                        </div>
                    </div>

                    <div className="pt-2">
                        <SubmitButton text="保存设置" />
                    </div>
                </form>
            </div>

            {/* Appearance Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">🎨</span> 外观设置
                </h3>
                <form action={async (formData) => {
                    formData.append('uaWhitelist', (config.uaWhitelist || []).join(','));
                    formData.append('upstreamSources', JSON.stringify(config.upstreamSources || []));
                    formData.append('logRetentionDays', config.logRetentionDays?.toString() || '30');
                    formData.append('maxUserSubscriptions', config.maxUserSubscriptions?.toString() || '0');
                    formData.append('upstreamUserAgent', config.upstreamUserAgent || '');

                    const { updateGlobalConfig } = await import('../actions');
                    await updateGlobalConfig(formData);
                    success('外观设置已保存');
                }} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">首页背景图片 URL</label>
                        <div className="flex flex-col space-y-2">
                            <input
                                type="text"
                                name="customBackgroundUrl"
                                defaultValue={config.customBackgroundUrl || ''}
                                placeholder="https://example.com/background.jpg"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                            />
                            <p className="text-sm text-gray-500">
                                自定义首页背景图片。留空则使用默认渐变背景。支持 JPG、PNG、WebP 等格式。
                            </p>
                        </div>
                    </div>

                    <div className="pt-2">
                        <SubmitButton text="保存设置" />
                    </div>
                </form>
            </div>

            {/* Announcement Banner Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">📢</span> 首页公告栏
                </h3>
                <AnnouncementEditor initialValue={config.announcement || ''} config={config} />
            </div>

            {/* Session Cleanup */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">🔐</span> Session 管理
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    系统会每小时自动清理过期的 session。您也可以手动触发清理。
                </p>
                <SubmitButton
                    onClick={async () => {
                        setIsCleaning(true);
                        try {
                            const { cleanupSessions } = await import('../actions');
                            const result = await cleanupSessions();
                            if (result.count > 0) {
                                success(`已清理 ${result.count} 个过期 session`);
                            } else {
                                success('没有过期的 session');
                            }
                        } finally {
                            setIsCleaning(false);
                        }
                    }}
                    isLoading={isCleaning}
                    text="立即清理过期 Session"
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-sm"
                />
            </div>

            {/* Other settings placeholder */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 opacity-60">
                <h3 className="text-lg font-bold text-gray-800 mb-4">其他设置</h3>
                <p className="text-gray-500">上游源和缓存设置请前往 <a href="/admin/sources" className="text-blue-600 hover:underline">上游源管理</a> 页面配置。</p>
            </div>
        </div>
    );
}
