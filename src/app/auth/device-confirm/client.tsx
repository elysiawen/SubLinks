'use client'

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ToastProvider';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { getDeviceCodeInfo, confirmDeviceAuthorization, denyDeviceAuthorization, switchAccount } from './actions';

function parseUA(ua: string) {
    if (!ua || ua === 'unknown') return { browser: 'Unknown', os: '', isMobile: false };

    let os = '';
    let isMobile = false;
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS X')) os = 'macOS';
    else if (ua.includes('Android')) { os = 'Android'; isMobile = true; }
    else if (ua.includes('iPhone') || ua.includes('iPad')) { os = 'iOS'; isMobile = true; }
    else if (ua.includes('Linux')) os = 'Linux';

    let browser = '';
    if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('Chrome/')) browser = 'Chrome';
    else if (ua.includes('Firefox/')) browser = 'Firefox';
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';

    return { browser, os, isMobile };
}

export default function DeviceConfirmClient({ deviceCode }: { deviceCode: string }) {
    const { success: toastSuccess, error: toastError } = useToast();
    const t = useTranslations('auth.deviceConfirm');
    const tDevice = useTranslations('auth.device');
    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState(false);
    const [denying, setDenying] = useState(false);
    const [done, setDone] = useState(false);
    const [denied, setDenied] = useState(false);
    const [countdown, setCountdown] = useState(5);
    const [error, setError] = useState<string | null>(null);
    const [deviceInfo, setDeviceInfo] = useState<{
        clientDeviceInfo: string | null;
        clientIp: string | null;
        clientUa: string | null;
        browserIp: string | null;
        ipMismatch: boolean;
    } | null>(null);
    const [userInfo, setUserInfo] = useState<{
        username: string;
        nickname?: string;
        avatar?: string;
    } | null>(null);

    useEffect(() => {
        if (!deviceCode) {
            setError('missingDeviceCode');
            setLoading(false);
            return;
        }
        getDeviceCodeInfo(deviceCode).then(result => {
            if (result.error) {
                setError(result.error);
            } else {
                setDeviceInfo({
                    clientDeviceInfo: result.clientDeviceInfo || null,
                    clientIp: result.clientIp || null,
                    clientUa: result.clientUa || null,
                    browserIp: result.browserIp || null,
                    ipMismatch: result.ipMismatch || false,
                });
                if (result.currentUser) {
                    setUserInfo(result.currentUser);
                }
            }
            setLoading(false);
        });
    }, [deviceCode]);

    // Auto-close after 5 seconds on success
    useEffect(() => {
        if (!done) return;
        setCountdown(5);
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    window.close();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [done]);

    const handleConfirm = async () => {
        setConfirming(true);
        const result = await confirmDeviceAuthorization(deviceCode);
        setConfirming(false);

        if (result.error) {
            toastError(result.error);
        } else {
            setDone(true);
            toastSuccess(tDevice('loginSuccess'));
        }
    };

    const handleDeny = async () => {
        setDenying(true);
        const result = await denyDeviceAuthorization(deviceCode);
        setDenying(false);

        if (result.error) {
            toastError(result.error);
        } else {
            setDenied(true);
        }
    };

    // Loading
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    // Error
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4">
                <div className="text-center">
                    <div className="text-6xl mb-4">⚠️</div>
                    <h1 className="text-2xl font-bold text-text-primary mb-2">{t('expired')}</h1>
                    <p className="text-text-secondary text-sm">{t('expiredDesc')}</p>
                </div>
            </div>
        );
    }

    // Done
    if (done) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4">
                <div className="max-w-md w-full">
                    <div className="bg-card/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-border-strong overflow-hidden">
                        <div className="bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-teal-500/10 dark:from-emerald-400/10 dark:via-green-400/5 dark:to-teal-400/10 p-10 pb-5 flex flex-col items-center min-h-[300px]">
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <div className="relative mb-6">
                                    <div className="absolute inset-0 w-20 h-20 bg-green-400/20 rounded-full animate-ping"></div>
                                    <div className="relative w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
                                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                </div>
                                <h3 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">{tDevice('loginSuccess')}</h3>
                                <p className="text-text-tertiary text-sm">{tDevice('closePage')}</p>
                                {countdown > 0 && (
                                    <p className="text-text-quaternary text-xs mt-2">{t('autoClose', { seconds: countdown })}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                <span>{tDevice('secureHint')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Denied
    if (denied) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4 animate-fade-in">
                <div className="max-w-md w-full">
                    <div className="bg-card/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-border-strong overflow-hidden">
                        <div className="bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-yellow-500/10 dark:from-orange-400/10 dark:via-amber-400/5 dark:to-yellow-400/10 p-10 pb-5 flex flex-col items-center min-h-[300px]">
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <div className="relative mb-6">
                                    <div className="relative w-20 h-20 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30 animate-zoom-in">
                                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </div>
                                </div>
                                <h3 className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-2">{t('deniedTitle')}</h3>
                                <p className="text-text-tertiary text-sm text-center">{t('deniedDesc')}</p>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                <span>{tDevice('secureHint')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Confirm page
    const uaInfo = deviceInfo?.clientUa ? parseUA(deviceInfo.clientUa) : null;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 py-12 px-4 relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 dark:opacity-10 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-200 dark:opacity-10 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-indigo-200 dark:opacity-10 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

            <div className="max-w-md w-full relative z-10">
                <div className="text-center mb-8">
                    <h2 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">
                        SubLinks
                    </h2>
                    <p className="mt-3 text-text-secondary font-medium">{t('title')}</p>
                </div>

                <div className="bg-card/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-border-strong p-8">
                    {/* IP mismatch warning */}
                    {deviceInfo?.ipMismatch && (
                        <div className="mb-6 flex items-start gap-3 px-4 py-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-xl">
                            <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                                <p className="text-sm font-bold text-red-700 dark:text-red-300">{t('ipMismatchTitle')}</p>
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                    {t('ipMismatchDesc', { clientIp: deviceInfo.clientIp || '', browserIp: deviceInfo.browserIp || '' })}
                                </p>
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-semibold">{t('ipMismatchWarning')}</p>
                            </div>
                        </div>
                    )}

                    {/* User info header */}
                    <div className="mb-6">
                        <div className="flex items-center gap-3 mb-4">
                            {/* Avatar */}
                            {userInfo?.avatar ? (
                                <img
                                    src={userInfo.avatar}
                                    alt={userInfo.nickname || userInfo.username}
                                    className="w-12 h-12 rounded-xl object-cover shadow-lg ring-2 ring-border-strong"
                                />
                            ) : (
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <span className="text-white font-bold text-lg">
                                        {(userInfo?.nickname || userInfo?.username || '?').charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-text-primary truncate">
                                    {t('signInAs', { name: userInfo?.nickname || userInfo?.username || '' })}
                                </h3>
                                <p className="text-xs text-text-tertiary">{t('requestDesc')}</p>
                            </div>
                            <button
                                onClick={async () => {
                                    await switchAccount(deviceCode);
                                }}
                                className="shrink-0 text-xs text-text-tertiary hover:text-accent-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted"
                            >
                                {t('switchAccount')}
                            </button>
                        </div>

                        <div className="space-y-3 bg-muted/30 rounded-xl p-4 border border-border">
                            {deviceInfo?.clientDeviceInfo && (
                                <div className="flex items-start gap-3">
                                    <svg className="w-4 h-4 text-text-tertiary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    <div>
                                        <p className="text-xs text-text-tertiary">{t('deviceName')}</p>
                                        <p className="text-sm text-text-primary font-medium">{deviceInfo.clientDeviceInfo}</p>
                                    </div>
                                </div>
                            )}

                            {deviceInfo?.clientIp && (
                                <div className="flex items-start gap-3">
                                    <svg className="w-4 h-4 text-text-tertiary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                    </svg>
                                    <div>
                                        <p className="text-xs text-text-tertiary">{t('ipAddress')}</p>
                                        <p className="text-sm text-text-primary font-medium font-mono">{deviceInfo.clientIp}</p>
                                    </div>
                                </div>
                            )}

                            {uaInfo && (
                                <div className="flex items-start gap-3">
                                    <svg className="w-4 h-4 text-text-tertiary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <div>
                                        <p className="text-xs text-text-tertiary">{t('platform')}</p>
                                        <p className="text-sm text-text-primary font-medium">
                                            {[uaInfo.browser, uaInfo.os, uaInfo.isMobile && t('mobile')].filter(Boolean).join(' · ')}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Warning */}
                    <div className="mb-6 flex items-start gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-300">
                        <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <span>{t('warning')}</span>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleDeny}
                            disabled={denying || confirming}
                            className="flex-1 py-3 px-4 rounded-xl border border-border-strong text-text-secondary hover:bg-muted hover:border-red-300 dark:hover:border-red-700 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.97]"
                        >
                            {denying ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    {t('denying')}
                                </>
                            ) : t('deny')}
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={confirming}
                            className="flex-1 py-3 px-4 rounded-xl bg-accent-button text-white hover:bg-accent-button-hover transition-colors font-semibold shadow-lg shadow-accent-button/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {confirming ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    {t('authorizing')}
                                </>
                            ) : t('authorize')}
                        </button>
                    </div>
                </div>

                <div className="mt-8 flex flex-col items-center gap-3">
                    <LanguageSwitcher />
                </div>
            </div>
        </div>
    );
}
