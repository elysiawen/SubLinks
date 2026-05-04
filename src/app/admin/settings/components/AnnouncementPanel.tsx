'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { SubmitButton } from '@/components/SubmitButton';
import { useToast } from '@/components/ToastProvider';
import { useTranslations } from 'next-intl';
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

export default function AnnouncementPanel({ initialValue, config }: { initialValue: string; config: any }) {
    const { success } = useToast();
    const t = useTranslations('admin.settingsPanels.announcement');
    const [announcement, setAnnouncement] = useState(initialValue);

    const colorGroup = commands.group([
        createColorCommand('red', '#ef4444', t('colorRed')),
        createColorCommand('orange', '#f97316', t('colorOrange')),
        createColorCommand('yellow', '#eab308', t('colorYellow')),
        createColorCommand('green', '#22c55e', t('colorGreen')),
        createColorCommand('blue', '#3b82f6', t('colorBlue')),
        createColorCommand('purple', '#a855f7', t('colorPurple')),
        createColorCommand('pink', '#ec4899', t('colorPink')),
        createColorCommand('black', '#000000', t('colorBlack')),
    ], {
        name: 'font-colors',
        groupName: 'font-colors',
        buttonProps: { 'aria-label': t('fontColor'), title: t('selectFontColor') },
        icon: <span>🎨</span>
    });

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6" >
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">📢</span> {t('heading')}
            </h3>
            <form action={async (formData) => {

                formData.append('upstreamSources', JSON.stringify(config.upstreamSources || []));
                formData.append('logRetentionDays', config.logRetentionDays?.toString() || '30');
                formData.append('maxUserSubscriptions', config.maxUserSubscriptions?.toString() || '0');
                formData.append('upstreamUserAgent', config.upstreamUserAgent || '');
                formData.append('customBackgroundUrl', config.customBackgroundUrl || '');

                const { updateGlobalConfig } = await import('../actions');
                await updateGlobalConfig(formData);
                success(t('saved'));
            }} className="space-y-4">

                {/* Hidden input to ensure value is always submitted */}
                <input type="hidden" name="announcement" value={announcement || ''} />

                <div className="mb-4" data-color-mode="light">
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('label')}</label>
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
                                placeholder: t('placeholder')
                            }}
                        />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                        {t('help')}
                    </p>
                </div>

                <div className="pt-2">
                    <SubmitButton text={t('save')} />
                </div>
            </form>
        </div>
    );
}
