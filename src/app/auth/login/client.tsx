'use client'

import { useActionState, Suspense, useRef, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { login, generateQrToken, checkQrStatus } from '@/lib/actions';
import Modal from '@/components/Modal';
import { useToast } from '@/components/ToastProvider';
import { startAuthentication } from '@simplewebauthn/browser';
import { generatePasskeyLoginOptions, verifyPasskeyLogin } from '@/lib/passkey-actions';
import QRCode from 'qrcode';
import { SubmitButton } from '@/components/SubmitButton';
import ProviderIcon from '@/components/ProviderIcon';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslations } from 'next-intl';
import type { OAuthProvider } from '@/lib/database/interface';

function PasskeyLogin({ deviceCode }: { deviceCode?: string }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { error: toastError, info, success: toastSuccess } = useToast();
    const t = useTranslations('auth.passkey');
    const tLogin = useTranslations('auth.login');
    const tDevice = useTranslations('auth.device');
    const tErrors = useTranslations('errors.auth');

    const handleLogin = async () => {
        setLoading(true);

        try {
            const res = await generatePasskeyLoginOptions();
            if (!res.options) {
                throw new Error(t('optionsError'));
            }

            const authResp = await startAuthentication({ optionsJSON: res.options });

            const verifyRes = await verifyPasskeyLogin(authResp, res.flowId!, deviceCode);
            if (verifyRes.error) {
                throw new Error(verifyRes.error);
            }

            if ('deviceFlow' in verifyRes && verifyRes.deviceFlow) {
                setTimeout(() => {
                    router.push(`/auth/device-confirm?code=${deviceCode}`);
                }, 500);
                return;
            }

            toastSuccess(tLogin('loginSuccess'));
            const callbackUrl = new URLSearchParams(window.location.search).get('callbackUrl');
            setTimeout(() => {
                if (callbackUrl && callbackUrl.startsWith('/')) {
                    router.push(callbackUrl);
                } else {
                    router.push('/dashboard');
                }
            }, 500);
        } catch (err: any) {
            const isNotAllowed = err.name === 'NotAllowedError' ||
                err.message?.includes('not allowed') ||
                err.message?.includes('The operation either timed out or was not allowed');

            if (isNotAllowed) {
                info(t('userCancelled'));
            } else if (err.message === 'passkeyNotFound') {
                toastError(tErrors('passkeyNotFound'));
            } else if (err.message?.includes('WebAuthn')) {
                toastError(t('webauthnNotSupported'));
            } else {
                console.error(err);
                toastError(err.message || tLogin('loginFailed'));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-3 bg-card text-accent-foreground border-2 border-blue-600 rounded-xl hover:bg-accent transition-colors font-semibold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted disabled:text-text-quaternary disabled:border-border-strong"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-accent-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('verifying')}
                    </>
                ) : (
                    <>🔐 {t('loginWithPasskey')}</>
                )}
            </button>
        </div>
    );
}

function OAuthLoginButtons({ providers, deviceCode }: { providers: OAuthProvider[]; deviceCode?: string }) {
    const [loading, setLoading] = useState<string | null>(null);
    const t = useTranslations('auth.oauth');
    const { error: toastError } = useToast();

    const handleOAuthLogin = async (providerId: string) => {
        setLoading(providerId);
        try {
            const { getOAuthAuthorizeUrl } = await import('@/lib/oauth-actions');
            const result = await getOAuthAuthorizeUrl(providerId, false, deviceCode);
            if (result.error) {
                toastError(result.error);
                setLoading(null);
                return;
            }
            if (result.url) {
                window.location.href = result.url;
            }
        } catch {
            toastError(t('loginFailed'));
            setLoading(null);
        }
    };

    if (providers.length === 0) return null;

    return (
        <div className="flex items-center justify-center gap-3">
            {providers.map(provider => (
                <button
                    key={provider.id}
                    onClick={() => handleOAuthLogin(provider.id)}
                    disabled={loading !== null}
                    title={t('loginWith', { provider: provider.name })}
                    className="w-11 h-11 flex items-center justify-center rounded-xl bg-card text-accent-foreground border-2 border-border-strong hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading === provider.id ? (
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    ) : (
                        <ProviderIcon type={provider.type} icon={provider.icon} authorizationUrl={provider.authorizationUrl} className="w-5 h-5" />
                    )}
                </button>
            ))}
        </div>
    );
}

function QrCodeLogin({ deviceCode }: { deviceCode?: string }) {
    const [qrUrl, setQrUrl] = useState<string>('');
    const [status, setStatus] = useState<'loading' | 'pending' | 'scanned' | 'confirmed' | 'expired' | 'error' | 'success' | 'rejected'>('loading');
    const [token, setToken] = useState<string>('');
    const [expiresAt, setExpiresAt] = useState<number>(0);
    const router = useRouter();
    const { success, error: toastError } = useToast();
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const t = useTranslations('auth.qr');
    const tLogin = useTranslations('auth.login');

    const loadQrCode = useCallback(async () => {
        try {
            setStatus('loading');
            if (pollingRef.current) clearInterval(pollingRef.current);

            const { token, expiresAt } = await generateQrToken();
            setToken(token);
            setExpiresAt(expiresAt);

            const dataToEncode = `sublinks://login/${token}`;
            const url = await QRCode.toDataURL(dataToEncode, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });
            setQrUrl(url);
            setStatus('pending');
        } catch (err) {
            console.error('Failed to generate QR', err);
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        loadQrCode();
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [loadQrCode]);

    useEffect(() => {
        if (!token || (status !== 'pending' && status !== 'scanned')) return;

        pollingRef.current = setInterval(async () => {
            if (Date.now() > expiresAt) {
                setStatus('expired');
                if (pollingRef.current) clearInterval(pollingRef.current);
                return;
            }

            try {
                const res = await checkQrStatus(token, deviceCode);

                if (res.status === 'scanned') {
                    if (status !== 'scanned') setStatus('scanned');
                } else if (res.status === 'rejected') {
                    setStatus('rejected');
                    if (pollingRef.current) clearInterval(pollingRef.current);
                } else if (res.status === 'success') {
                    setStatus('success');
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    success(tLogin('loginSuccess'));
                    if (deviceCode) {
                        setTimeout(() => {
                            router.push(`/auth/device-confirm?code=${deviceCode}`);
                        }, 500);
                    } else {
                        const cb = new URLSearchParams(window.location.search).get('callbackUrl');
                        router.push(cb && cb.startsWith('/') ? cb : '/dashboard');
                        router.refresh();
                    }
                } else if (res.status === 'expired') {
                    setStatus('expired');
                    if (pollingRef.current) clearInterval(pollingRef.current);
                }
            } catch (err) {
                console.error('Polling error', err);
            }
        }, 2000);

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [token, status, expiresAt, router, success, tLogin]);

    const handleRefresh = () => {
        loadQrCode();
    };

    return (
        <div className="flex flex-col items-center justify-center space-y-4 py-4 min-h-[300px]">
            {status === 'loading' && (
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-48 h-48 bg-border-strong rounded-lg"></div>
                    <div className="h-4 bg-border-strong rounded w-32 mt-4"></div>
                </div>
            )}

            {(status === 'pending' || status === 'scanned') && qrUrl && (
                <div className="relative group">
                    <div className={`p-2 bg-card rounded-lg border-2 ${status === 'scanned' ? 'border-green-500' : 'border-border-strong'} transition-colors duration-300`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrUrl} alt="Login QR Code" className={`w-48 h-48 ${status === 'scanned' ? 'opacity-50' : ''}`} />

                        {status === 'scanned' && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-green-500 text-white rounded-full p-2 shadow-lg animate-bounce">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            </div>
                        )}
                    </div>
                    {status === 'scanned' ? (
                        <p className="text-green-600 font-medium text-center mt-4">
                            {t('scanned')}
                        </p>
                    ) : (
                        <p className="text-text-tertiary text-sm text-center mt-4">
                            {t('scanHint')}
                        </p>
                    )}
                </div>
            )}

            {status === 'expired' && (
                <div className="text-center">
                    <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center mb-4 border-2 border-dashed border-border-input">
                        <span className="text-text-quaternary text-3xl">⚠️</span>
                    </div>
                    <p className="text-text-secondary mb-2">{t('expired')}</p>
                    <button
                        onClick={handleRefresh}
                        className="text-accent-foreground hover:text-blue-700 font-medium text-sm hover:underline"
                    >
                        {t('refresh')}
                    </button>
                </div>
            )}
            {status === 'error' && (
                <div className="text-center">
                    <div className="w-48 h-48 bg-red-50 rounded-lg flex items-center justify-center mb-4 border-2 border-red-100">
                        <span className="text-red-400 text-3xl">❌</span>
                    </div>
                    <p className="text-red-600 mb-2">{t('generateFailed')}</p>
                    <button
                        onClick={handleRefresh}
                        className="text-accent-foreground hover:text-blue-700 font-medium text-sm hover:underline"
                    >
                        {t('retry')}
                    </button>
                </div>
            )}

            {status === 'rejected' && (
                <div className="text-center">
                    <div className="w-48 h-48 bg-red-50 rounded-lg flex items-center justify-center mb-4 border-2 border-red-100">
                        <span className="text-red-400 text-3xl">🚫</span>
                    </div>
                    <p className="text-red-600 mb-2">{t('rejected')}</p>
                    <button
                        onClick={handleRefresh}
                        className="text-accent-foreground hover:text-blue-700 font-medium text-sm hover:underline"
                    >
                        {t('retry')}
                    </button>
                </div>
            )}

            {status === 'success' && (
                <div className="text-center">
                    <div className="w-48 h-48 bg-green-50 rounded-lg flex items-center justify-center mb-4 border-2 border-green-100">
                        <span className="text-green-500 text-4xl">✅</span>
                    </div>
                    <p className="text-green-600 font-bold">{t('success')}</p>
                    <p className="text-text-tertiary text-sm">{t('redirecting')}</p>
                </div>
            )}
        </div>
    );
}

function PasswordLogin({ deviceCode }: { deviceCode?: string }) {
    const [state, formAction, isPending] = useActionState(login, null);
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl');
    const formRef = useRef<HTMLFormElement>(null);
    const { error: toastError, success: toastSuccess } = useToast();
    const router = useRouter();
    const t = useTranslations('auth');
    const tDevice = useTranslations('auth.device');
    const tErrors = useTranslations('errors.auth');

    const [show2FAModal, setShow2FAModal] = useState(false);
    const [code, setCode] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (state?.error === '2fa_required') {
            setShow2FAModal(true);
        } else if (state?.error) {
            toastError(tErrors(state.error));
        } else if (state?.success) {
            if (state.deviceFlow) {
                setTimeout(() => {
                    router.push(`/auth/device-confirm?code=${state.deviceCode || deviceCode}`);
                }, 500);
            } else {
                toastSuccess(t('login.loginSuccess'));
                setTimeout(() => {
                    router.push(state.callbackUrl || '/dashboard');
                }, 500);
            }
        }
    }, [state, toastError, toastSuccess, router, t, tDevice, tErrors]);

    const handleSubmit = () => {
        if (!username.trim() || !password.trim()) {
            toastError(t('login.enterCredentials'));
            return;
        }

        if (formRef.current) {
            formRef.current.requestSubmit();
        }
    };

    const handle2FASubmit = () => {
        if (formRef.current) {
            formRef.current.requestSubmit();
        }
    };

    return (
        <>
            <form
                ref={formRef}
                className="space-y-6 pt-2"
                action={formAction}
                onSubmit={(e) => {
                    if (!username.trim() || !password.trim()) {
                        e.preventDefault();
                        toastError(t('login.enterCredentials'));
                        return;
                    }
                }}
            >
                {callbackUrl && (
                    <input type="hidden" name="callbackUrl" value={callbackUrl} />
                )}

                <input type="hidden" name="code" value={code} />
                {deviceCode && (
                    <input type="hidden" name="deviceCode" value={deviceCode} />
                )}

                <div className="space-y-4">
                    <div>
                        <label htmlFor="username" className="block text-sm font-semibold text-text-secondary mb-2">
                            👤 {t('login.username')}
                        </label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
                            className="appearance-none relative block w-full px-4 py-3 border border-border-input placeholder-text-quaternary text-text-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-card/50"
                            placeholder={t('login.usernamePlaceholder')}
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-semibold text-text-secondary mb-2">
                            🔑 {t('login.password')}
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            className="appearance-none relative block w-full px-4 py-3 border border-border-input placeholder-text-quaternary text-text-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-card/50"
                            placeholder={t('login.passwordPlaceholder')}
                        />
                    </div>
                </div>

                <div>
                    <SubmitButton
                        text={`🔐 ${t('login.loginButton')}`}
                        className="w-full py-3 rounded-xl shadow-lg shadow-accent-button/30"
                    />
                </div>
            </form>

            <Modal
                isOpen={show2FAModal}
                onClose={() => setShow2FAModal(false)}
                title={t('twoFactor.title')}
            >
                <div className="space-y-6">
                    <div className="text-center">
                        <div className="mx-auto w-12 h-12 bg-accent rounded-full flex items-center justify-center mb-4">
                            <span className="text-2xl">🛡️</span>
                        </div>
                        <p className="text-text-secondary">
                            {t('twoFactor.description')}
                        </p>
                    </div>

                    <div>
                        <label htmlFor="modal-code" className="block text-sm font-semibold text-text-secondary mb-2 text-center">
                            {t('twoFactor.codeLabel')}
                        </label>
                        <input
                            id="modal-code"
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && code.length === 6) {
                                    handle2FASubmit();
                                }
                            }}
                            autoFocus
                            className="w-full text-center tracking-[0.5em] text-2xl font-mono border border-border-input rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            placeholder="000000"
                            maxLength={6}
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={handle2FASubmit}
                            disabled={isPending || code.length !== 6}
                            className="w-full py-3 bg-accent-button text-white rounded-xl hover:bg-accent-button-hover transition-colors font-semibold shadow-lg shadow-accent-button/30 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isPending ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {t('twoFactor.verifying')}
                                </>
                            ) : (
                                t('twoFactor.verify')
                            )}
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
}

function LoginBox({ oauthProviders }: { oauthProviders: OAuthProvider[] }) {
    const [loginMethod, setLoginMethod] = useState<'password' | 'qr'>('password');
    const searchParams = useSearchParams();
    const deviceCode = searchParams.get('deviceCode') || undefined;
    const { success: toastSuccess, error: toastError } = useToast();
    const t = useTranslations('auth.login');
    const tErrors = useTranslations('errors.auth');
    const logoutToastShown = useRef(false);
    const errorToastShown = useRef(false);

    useEffect(() => {
        const urlError = searchParams.get('error');
        if (!errorToastShown.current && urlError) {
            errorToastShown.current = true;
            toastError(tErrors(urlError));
            const url = new URL(window.location.href);
            url.searchParams.delete('error');
            window.history.replaceState({}, '', url.pathname + url.search);
        }

        if (!logoutToastShown.current && searchParams.get('logout') === '1') {
            logoutToastShown.current = true;
            toastSuccess(t('logoutSuccess'));
            const url = new URL(window.location.href);
            url.searchParams.delete('logout');
            window.history.replaceState({}, '', url.pathname + url.search);
        }
    }, []);

    return (
        <div className="bg-card/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-border-strong p-8 flex flex-col">
            <div className="mb-6">
                <PasskeyLogin deviceCode={deviceCode} />

                <div className="relative mt-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border-strong"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-card text-text-tertiary">{t('orUseOther')}</span>
                    </div>
                </div>
            </div>

            <div className="flex p-1 bg-muted/50 rounded-xl mb-6 relative">
                <button
                    onClick={() => setLoginMethod('password')}
                    className={`flex-1 flex items-center justify-center py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${loginMethod === 'password'
                        ? 'bg-card text-accent-foreground shadow-sm ring-1 ring-black/5'
                        : 'text-text-tertiary hover:text-text-secondary'
                        }`}
                >
                    <span className="mr-2">🔑</span>
                    {t('passwordTab')}
                </button>
                <button
                    onClick={() => setLoginMethod('qr')}
                    className={`flex-1 flex items-center justify-center py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${loginMethod === 'qr'
                        ? 'bg-card text-accent-foreground shadow-sm ring-1 ring-black/5'
                        : 'text-text-tertiary hover:text-text-secondary'
                        }`}
                >
                    <span className="mr-2">📱</span>
                    {t('qrTab')}
                </button>
            </div>

            <div>
                {loginMethod === 'password' ? (
                    <div className="animate-fade-in">
                        <PasswordLogin deviceCode={deviceCode} />
                    </div>
                ) : (
                    <div className="animate-fade-in">
                        <QrCodeLogin deviceCode={deviceCode} />
                    </div>
                )}
            </div>

            {oauthProviders.length > 0 && (
                <>
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border-strong"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-card text-text-tertiary">{t('thirdPartyLogin')}</span>
                        </div>
                    </div>
                    <OAuthLoginButtons providers={oauthProviders} deviceCode={deviceCode} />
                </>
            )}
        </div>
    );
}

function DeviceSubtitle({ fallback, banner }: { fallback: string; banner: string }) {
    const searchParams = useSearchParams();
    const deviceCode = searchParams.get('deviceCode');

    if (deviceCode) {
        return (
            <div className="mt-4 inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 dark:from-blue-400/10 dark:to-indigo-400/10 border border-blue-200/60 dark:border-blue-500/20 backdrop-blur-sm">
                <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                </span>
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{banner}</span>
            </div>
        );
    }

    return <p className="mt-3 text-text-secondary font-medium">{fallback}</p>;
}

export default function LoginContent({ oauthProviders }: { oauthProviders: OAuthProvider[] }) {
    const t = useTranslations('auth.login');
    const tDevice = useTranslations('auth.device');
    const searchParams = useSearchParams();
    const deviceCode = searchParams.get('deviceCode');
    const isDeviceFlow = !!deviceCode;

    return (
        <div className="min-h-screen relative overflow-hidden flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-fade-in">
            <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 dark:opacity-10 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-200 dark:opacity-10 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-indigo-200 dark:opacity-10 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

            {/* Language switcher - top right */}
            <div className="relative z-20 flex justify-end p-4">
                <LanguageSwitcher dropDown align="right" />
            </div>

            {/* Main content */}
            <div className="flex-1 flex items-center justify-center px-6 py-8">
                <div className="relative z-10 w-full max-w-[1100px] mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-32">
                    {/* Left side - Brand and features / Device auth info */}
                    <div className="hidden lg:flex flex-1 flex-col justify-center animate-slide-in-up" style={{ animationDelay: '0.1s' }}>
                        {isDeviceFlow ? (
                            /* Device flow left side */
                            <div className="mb-10">
                                <div className="inline-flex items-center gap-3 mb-8">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                                        <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                            <line x1="8" y1="21" x2="16" y2="21" />
                                            <line x1="12" y1="17" x2="12" y2="21" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400 tracking-wider uppercase">Device Authorization</span>
                                </div>
                                <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.1] tracking-tight mb-6">
                                    <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                        SubLinks
                                    </span>
                                </h1>
                                <p className="text-lg text-muted-foreground leading-relaxed max-w-md mb-8">
                                    {tDevice('description')}
                                </p>

                                <div className="space-y-4">
                                    {[
                                        { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', label: '安全授权', desc: '令牌通过加密通道传输' },
                                        { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', label: '临时会话', desc: '授权后浏览器不会保持登录' },
                                        { icon: 'M13 10V3L4 14h7v7l9-11h-7z', label: '即时生效', desc: '客户端立即获取访问令牌' },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-background/50 border border-border/50">
                                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 flex items-center justify-center flex-shrink-0">
                                                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d={item.icon} />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-semibold text-foreground mb-1">{item.label}</h3>
                                                <p className="text-xs text-muted-foreground">{item.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            /* Normal login left side */
                            <div className="mb-10">
                                <div className="inline-flex items-center gap-3 mb-8">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                                        <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400 tracking-wider uppercase">Proxy Subscription Platform</span>
                                </div>
                                <h1 className="text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight mb-6">
                                    <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                        SubLinks
                                    </span>
                                </h1>
                                <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
                                    现代化的代理订阅管理平台，轻松管理节点源、生成订阅链接、自定义路由规则
                                </p>
                            </div>
                        )}

                        {!isDeviceFlow && (
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', label: '节点源管理', desc: '支持 URL / YAML 导入' },
                                    { icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1', label: '订阅链接', desc: 'Clash / Mihomo 兼容' },
                                    { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', label: '多种认证', desc: 'Passkey / OAuth / 2FA' },
                                    { icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4', label: '自定义规则', desc: '可视化路由规则编辑' },
                                ].map((item, i) => (
                                    <div key={i} className="p-4 rounded-xl bg-background/50 border border-border/50 hover:border-border hover:bg-background/80 transition-all duration-300 group">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 flex items-center justify-center mb-3 group-hover:from-blue-500/20 group-hover:to-indigo-500/20 transition-colors duration-300">
                                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d={item.icon} />
                                            </svg>
                                        </div>
                                        <h3 className="text-sm font-semibold text-foreground mb-1">{item.label}</h3>
                                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right side - Login form */}
                    <div className="w-full max-w-[400px] animate-slide-in-up" style={{ animationDelay: '0.25s' }}>
                        {/* Mobile title - shown only on small screens */}
                        <div className="lg:hidden text-center mb-8">
                            <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">
                                SubLinks
                            </h2>
                            <Suspense fallback={<p className="mt-3 text-text-secondary font-medium">{t('title')}</p>}>
                                <DeviceSubtitle fallback={isDeviceFlow ? tDevice('description') : t('title')} banner={tDevice('banner')} />
                            </Suspense>
                        </div>

                        <Suspense fallback={
                            <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-lg shadow-black/[0.04] dark:shadow-black/20 min-h-[300px] flex items-center justify-center">
                                <div className="text-center text-text-tertiary">{t('loading')}</div>
                            </div>
                        }>
                            <LoginBox oauthProviders={oauthProviders} />
                        </Suspense>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 py-6 text-center">
                <p className="text-sm text-text-tertiary">Powered by Next.js • Secure & Fast</p>
            </div>
        </div>
    )
}
