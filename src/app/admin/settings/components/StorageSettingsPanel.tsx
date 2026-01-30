'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SubmitButton } from '@/components/SubmitButton';
import { useToast } from '@/components/ToastProvider';
import { S3_PRESETS, buildS3Endpoint } from '@/lib/storage/utils';

export default function StorageSettingsPanel({ config }: { config: any }) {
    const router = useRouter();
    const { success, error } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [storageProvider, setStorageProvider] = useState<'local' | 's3'>(config.storageProvider || 'local');
    const [s3Preset, setS3Preset] = useState(config.s3Preset || 'cloudflare-r2');
    const [s3Endpoint, setS3Endpoint] = useState(config.s3Endpoint || buildS3Endpoint(config.s3Preset || 'cloudflare-r2', config.s3AccountId, config.s3Region));

    return (
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
                    const { updateGlobalConfig } = await import('../actions');
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
                                    const { testS3Connection } = await import('../actions');
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
    );
}
