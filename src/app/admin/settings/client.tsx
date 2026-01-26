'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { SubmitButton } from '@/components/SubmitButton';
import dynamic from 'next/dynamic';
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import { commands } from '@uiw/react-md-editor';
import { S3_PRESETS, buildS3Endpoint } from '@/lib/storage/utils';
import UaFilterForm from '@/components/UaFilterForm';
import { UaFilterConfig } from '@/lib/database/interface';


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

function UaFilterEditor({ initialConfig, config }: { initialConfig?: any; config: any }) {
    const { success, error } = useToast();
    const [currentConfig, setCurrentConfig] = useState<UaFilterConfig>(initialConfig || {
        enabled: false,
        mode: 'blacklist',
        rules: []
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const formData = new FormData();

            // Preserve other config fields
            formData.append('logRetentionDays', config.logRetentionDays?.toString() || '30');
            formData.append('maxUserSubscriptions', config.maxUserSubscriptions?.toString() || '10');
            formData.append('upstreamUserAgent', config.upstreamUserAgent || '');
            formData.append('customBackgroundUrl', config.customBackgroundUrl || '');
            formData.append('announcement', config.announcement || '');

            // Add UA filter config
            formData.append('uaFilter', JSON.stringify(currentConfig));

            const { updateGlobalConfig } = await import('./actions');
            await updateGlobalConfig(formData);
            success('UA 过滤配置已保存');
        } catch (e) {
            error('保存失败');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div>
            <UaFilterForm
                value={currentConfig}
                onChange={setCurrentConfig}
            />

            {/* Save Button */}
            <div className="pt-6">
                <SubmitButton
                    onClick={handleSave}
                    isLoading={isSaving}
                    text="保存 UA 过滤配置"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                />
            </div>
        </div>
    );
}

function AnnouncementEditor({ initialValue, config }: { initialValue: string; config: any }) {
    const { success } = useToast();
    const [announcement, setAnnouncement] = useState(initialValue);

    return (
        <form action={async (formData) => {

            formData.append('upstreamSources', JSON.stringify(config.upstreamSources || []));
            formData.append('logRetentionDays', config.logRetentionDays?.toString() || '30');
            formData.append('maxUserSubscriptions', config.maxUserSubscriptions?.toString() || '0');
            formData.append('upstreamUserAgent', config.upstreamUserAgent || '');
            formData.append('customBackgroundUrl', config.customBackgroundUrl || '');

            const { updateGlobalConfig } = await import('./actions');
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
    const router = useRouter();
    const { success, error } = useToast();
    const { confirm } = useConfirm();
    const [isCleaning, setIsCleaning] = useState(false);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [storageProvider, setStorageProvider] = useState<'local' | 's3'>(config.storageProvider || 'local');
    const [s3Preset, setS3Preset] = useState(config.s3Preset || 'cloudflare-r2');
    const [s3Endpoint, setS3Endpoint] = useState(config.s3Endpoint || buildS3Endpoint(config.s3Preset || 'cloudflare-r2', config.s3AccountId, config.s3Region));



    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-800">全局设置</h2>

            {/* Log Retention Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">🗑️</span> 日志自动清理
                </h3>
                <form action={async (formData) => {

                    formData.append('upstreamSources', JSON.stringify(config.upstreamSources || []));

                    // Handle custom retention
                    const retentionSelect = formData.get('retentionSelect') as string;
                    let days = retentionSelect;
                    if (retentionSelect === 'custom') {
                        days = formData.get('customDays') as string;
                    }
                    formData.set('logRetentionDays', days);

                    const { updateGlobalConfig } = await import('./actions');
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
                                    const { clearLogs } = await import('./actions');
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

            {/* UA Filter Configuration */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">🛡️</span> UA 过滤配置
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    配置订阅 API 的 User-Agent 过滤规则。注意：微信和 QQ 已在 Middleware 层拦截，无需在此配置。
                </p>
                <UaFilterEditor initialConfig={config.uaFilter} config={config} />
            </div>


            {/* User Limits */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">👤</span> 用户限制
                </h3>
                <form action={async (formData) => {

                    formData.append('upstreamSources', JSON.stringify(config.upstreamSources || []));
                    formData.append('logRetentionDays', config.logRetentionDays?.toString() || '30');

                    // Handle max subs
                    const maxSubs = formData.get('maxUserSubscriptions') as string;
                    formData.set('maxUserSubscriptions', maxSubs);

                    const { updateGlobalConfig } = await import('./actions');
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

                    formData.append('upstreamSources', JSON.stringify(config.upstreamSources || []));
                    formData.append('logRetentionDays', config.logRetentionDays?.toString() || '30');
                    formData.append('maxUserSubscriptions', config.maxUserSubscriptions?.toString() || '0');

                    // Handle UA
                    const upstreamUserAgent = formData.get('upstreamUserAgent') as string;
                    formData.set('upstreamUserAgent', upstreamUserAgent);

                    const { updateGlobalConfig } = await import('./actions');
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

                    formData.append('upstreamSources', JSON.stringify(config.upstreamSources || []));
                    formData.append('logRetentionDays', config.logRetentionDays?.toString() || '30');
                    formData.append('maxUserSubscriptions', config.maxUserSubscriptions?.toString() || '0');
                    formData.append('upstreamUserAgent', config.upstreamUserAgent || '');

                    const { updateGlobalConfig } = await import('./actions');
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

            {/* Storage Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">💾</span> 存储设置
                </h3>
                <form data-storage-form onSubmit={async (e) => {
                    e.preventDefault();
                    setIsSaving(true);
                    const form = e.currentTarget;
                    const formData = new FormData(form);

                    // Append other config fields

                    formData.append('upstreamSources', JSON.stringify(config.upstreamSources || []));
                    formData.append('logRetentionDays', config.logRetentionDays?.toString() || '30');
                    formData.append('maxUserSubscriptions', config.maxUserSubscriptions?.toString() || '0');
                    formData.append('upstreamUserAgent', config.upstreamUserAgent || '');
                    formData.append('announcement', config.announcement || '');
                    formData.append('customBackgroundUrl', config.customBackgroundUrl || '');

                    try {
                        const { updateGlobalConfig } = await import('./actions');
                        await updateGlobalConfig(formData);
                        success('存储设置已保存');
                        router.refresh();
                    } catch (err) {
                        error('保存失败');
                    } finally {
                        setIsSaving(false);
                    }
                }} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">存储提供商</label>
                        <select
                            name="storageProvider"
                            value={storageProvider}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border bg-white text-gray-900"
                            onChange={(e) => {
                                const value = e.target.value as 'local' | 's3';
                                setStorageProvider(value);
                            }}
                        >
                            <option value="local">本地存储</option>
                            <option value="s3">S3 兼容存储</option>
                        </select>
                        <p className="mt-2 text-sm text-gray-500">
                            选择头像文件的存储位置。本地存储保存在服务器，S3 兼容存储支持 R2、Tigris、AWS S3 等。
                        </p>
                    </div>

                    {/* Local Storage Settings */}
                    <div id="local-fields" style={{ display: (storageProvider === 'local' ? 'block' : 'none') }}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">本地存储路径</label>
                        <input
                            type="text"
                            name="localStoragePath"
                            defaultValue={config.localStoragePath || '/uploads/avatars'}
                            placeholder="/uploads/avatars"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                        />
                        <p className="mt-1 text-sm text-gray-500">
                            相对于 public 目录的路径，默认为 /uploads/avatars
                        </p>
                    </div>

                    {/* S3 Compatible Storage Settings */}
                    <div id="s3-fields" style={{ display: (storageProvider === 's3' ? 'block' : 'none') }} className="space-y-4 border-t pt-4">
                        <h4 className="font-medium text-gray-800">S3 兼容存储配置</h4>

                        {/* S3 Preset Selector */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">服务预设</label>
                            <select
                                name="s3Preset"
                                defaultValue={s3Preset}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border bg-white text-gray-900"
                                onChange={(e) => {
                                    const preset = e.target.value;
                                    setS3Preset(preset);

                                    // Auto-fill endpoint based on preset
                                    // Get current values
                                    const accountIdInput = document.querySelector('input[name="s3AccountId"]') as HTMLInputElement;
                                    const regionInput = document.querySelector('input[name="s3Region"]') as HTMLInputElement;

                                    const accountId = accountIdInput?.value || config.s3AccountId;
                                    const region = S3_PRESETS[preset]?.defaultRegion || 'auto';

                                    const newEndpoint = buildS3Endpoint(preset, accountId, region);
                                    setS3Endpoint(newEndpoint);

                                    // Update endpoint input
                                    const endpointInput = document.querySelector('input[name="s3Endpoint"]') as HTMLInputElement;
                                    if (endpointInput) {
                                        endpointInput.value = newEndpoint;
                                    }

                                    // Update region input with default
                                    if (regionInput) {
                                        regionInput.value = region;
                                    }

                                    // Show/hide Account ID field
                                    const accountIdField = document.getElementById('s3-account-id-field');
                                    if (accountIdField) {
                                        accountIdField.style.display = S3_PRESETS[preset]?.needsAccountId ? 'block' : 'none';
                                    }
                                }}
                            >
                                <option value="cloudflare-r2">Cloudflare R2</option>
                                <option value="tigris">Tigris Data</option>
                                <option value="aws-s3">AWS S3</option>
                                <option value="minio">MinIO</option>
                                <option value="custom">自定义 S3</option>
                            </select>
                            <p className="mt-1 text-sm text-gray-500">
                                选择预设可自动填充 Endpoint 和默认配置
                            </p>
                        </div>

                        {/* Account ID (R2 only) */}
                        <div id="s3-account-id-field" style={{ display: (s3Preset === 'cloudflare-r2' ? 'block' : 'none') }}>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Account ID</label>
                            <input
                                type="text"
                                name="s3AccountId"
                                defaultValue={config.s3AccountId || ''}
                                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                                onChange={(e) => {
                                    if (s3Preset === 'cloudflare-r2') {
                                        const regionInput = document.querySelector('input[name="s3Region"]') as HTMLInputElement;
                                        const region = regionInput?.value || 'auto';
                                        const newEndpoint = buildS3Endpoint(s3Preset, e.target.value, region);
                                        setS3Endpoint(newEndpoint);
                                    }
                                }}
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                Cloudflare R2 的 Account ID（用于构建 Endpoint）
                            </p>
                        </div>

                        {/* Endpoint */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Endpoint</label>
                            <input
                                type="text"
                                name="s3Endpoint"
                                value={s3Endpoint}
                                onChange={(e) => setS3Endpoint(e.target.value)}
                                placeholder="https://..."
                                disabled={s3Preset !== 'custom' && s3Preset !== 'minio'}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border disabled:bg-gray-100"
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                {s3Preset === 'custom' || s3Preset === 'minio'
                                    ? '请输入完整的 S3 Endpoint URL'
                                    : '根据预设自动填充'}
                            </p>
                        </div>

                        {/* Region */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Region</label>
                            <input
                                type="text"
                                name="s3Region"
                                defaultValue={config.s3Region || S3_PRESETS[s3Preset]?.defaultRegion || 'auto'}
                                placeholder="auto"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                                onChange={(e) => {
                                    if (s3Preset === 'aws-s3') {
                                        const newEndpoint = buildS3Endpoint(s3Preset, undefined, e.target.value);
                                        setS3Endpoint(newEndpoint);
                                    }
                                }}
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                S3 区域，R2/Tigris 使用 auto，AWS S3 使用 us-east-1 等
                            </p>
                        </div>

                        {/* Access Key ID */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Access Key ID</label>
                            <input
                                type="text"
                                name="s3AccessKeyId"
                                defaultValue={config.s3AccessKeyId || ''}
                                placeholder="Access Key ID"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                            />
                        </div>

                        {/* Secret Access Key */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Secret Access Key</label>
                            <input
                                type="password"
                                name="s3SecretAccessKey"
                                defaultValue={config.s3SecretAccessKey || ''}
                                placeholder="Secret Access Key"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                            />
                        </div>

                        {/* Bucket Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Bucket Name</label>
                            <input
                                type="text"
                                name="s3BucketName"
                                defaultValue={config.s3BucketName || ''}
                                placeholder="my-bucket"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                            />
                        </div>

                        {/* Public Domain */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Public Domain</label>
                            <input
                                type="text"
                                name="s3PublicDomain"
                                defaultValue={config.s3PublicDomain || ''}
                                placeholder="https://..."
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                Bucket 的公开访问域名
                            </p>
                        </div>

                        {/* Folder Path */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">文件夹路径</label>
                            <input
                                type="text"
                                name="s3FolderPath"
                                defaultValue={config.s3FolderPath || 'avatars'}
                                placeholder="avatars"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                Bucket 中的文件夹路径，默认为 avatars
                            </p>
                        </div>
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button
                            id="test-connection-btn"
                            type="button"
                            onClick={async () => {
                                setIsTestingConnection(true);
                                try {
                                    const form = document.querySelector('form[data-storage-form]') as HTMLFormElement;
                                    if (!form) return;

                                    const formData = new FormData(form);
                                    const provider = formData.get('storageProvider') as string;

                                    if (provider === 's3') {
                                        const { testS3Connection } = await import('./actions');
                                        const result = await testS3Connection(formData);

                                        if (result.success) {
                                            success(result.message || '连接成功');
                                        } else {
                                            error(result.error || '连接失败');
                                        }
                                    }
                                } finally {
                                    setIsTestingConnection(false);
                                }
                            }}
                            disabled={isTestingConnection}
                            className={`px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium flex items-center justify-center ${isTestingConnection ? 'opacity-80 cursor-wait' : ''}`}
                            style={{ display: (storageProvider === 's3' ? 'flex' : 'none') }}
                        >
                            {isTestingConnection ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    连接中...
                                </>
                            ) : (
                                '测试连接'
                            )}
                        </button>
                        <SubmitButton text="保存设置" isLoading={isSaving} />
                    </div>
                </form>
            </div>

            {/* Announcement Banner Settings */}
            < div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6" >
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">📢</span> 首页公告栏
                </h3>
                <AnnouncementEditor initialValue={config.announcement || ''} config={config} />
            </div >

            {/* Session Cleanup */}
            < div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6" >
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
                            const { cleanupSessions } = await import('./actions');
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
            </div >

            {/* Other settings placeholder */}
            < div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 opacity-60" >
                <h3 className="text-lg font-bold text-gray-800 mb-4">其他设置</h3>
                <p className="text-gray-500">上游源和缓存设置请前往 <a href="/admin/sources" className="text-blue-600 hover:underline">上游源管理</a> 页面配置。</p>
            </div >
        </div >
    );
}
