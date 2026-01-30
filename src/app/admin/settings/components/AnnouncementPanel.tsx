'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { SubmitButton } from '@/components/SubmitButton';
import { useToast } from '@/components/ToastProvider';
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

export default function AnnouncementPanel({ initialValue, config }: { initialValue: string; config: any }) {
    const { success } = useToast();
    const [announcement, setAnnouncement] = useState(initialValue);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6" >
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">📢</span> 首页公告栏
            </h3>
            <form action={async (formData) => {

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
        </div>
    );
}
