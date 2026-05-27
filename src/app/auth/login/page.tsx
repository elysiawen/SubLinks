'use client'

import { useActionState, Suspense, useRef, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { login, generateQrToken, checkQrStatus } from '@/lib/actions';
import Modal from '@/components/Modal';
import { useToast } from '@/components/ToastProvider';
import { startAuthentication } from '@simplewebauthn/browser';
import { generatePasskeyLoginOptions, verifyPasskeyLogin } from '@/lib/passkey-actions';
import { getEnabledOAuthProviders } from '@/lib/oauth-actions';
import QRCode from 'qrcode';
import { SubmitButton } from '@/components/SubmitButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslations } from 'next-intl';
import type { OAuthProvider } from '@/lib/database/interface';

function PasskeyLogin() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { error: toastError, info, success: toastSuccess } = useToast();
    const t = useTranslations('auth.passkey');
    const tLogin = useTranslations('auth.login');
    const tErrors = useTranslations('errors.auth');

    const handleLogin = async () => {
        setLoading(true);

        try {
            const res = await generatePasskeyLoginOptions();
            if (!res.options) {
                throw new Error(t('optionsError'));
            }

            const authResp = await startAuthentication({ optionsJSON: res.options });

            const verifyRes = await verifyPasskeyLogin(authResp, res.flowId!);
            if (verifyRes.error) {
                throw new Error(verifyRes.error);
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

function OAuthLoginButtons() {
    const [providers, setProviders] = useState<OAuthProvider[]>([]);
    const [loading, setLoading] = useState<string | null>(null);
    const t = useTranslations('auth.oauth');
    const { error: toastError } = useToast();

    useEffect(() => {
        getEnabledOAuthProviders().then(setProviders);
    }, []);

    const handleOAuthLogin = async (providerId: string) => {
        setLoading(providerId);
        try {
            const { getOAuthAuthorizeUrl } = await import('@/lib/oauth-actions');
            const result = await getOAuthAuthorizeUrl(providerId);
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

    const providerIcons: Record<string, ReactNode> = {
        google: (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
        ),
        github: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
        )
    };

    return (
        <div className="space-y-2">
            {providers.map(provider => (
                <button
                    key={provider.id}
                    onClick={() => handleOAuthLogin(provider.id)}
                    disabled={loading !== null}
                    className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-card text-accent-foreground border-2 border-border-strong hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading === provider.id ? (
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    ) : (
                        providerIcons[provider.type] || (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                        )
                    )}
                    <span className="font-medium text-sm">
                        {t('loginWith', { provider: provider.name })}
                    </span>
                </button>
            ))}
        </div>
    );
}

function QrCodeLogin() {
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
                const res = await checkQrStatus(token);

                if (res.status === 'scanned') {
                    if (status !== 'scanned') setStatus('scanned');
                } else if (res.status === 'rejected') {
                    setStatus('rejected');
                    if (pollingRef.current) clearInterval(pollingRef.current);
                } else if (res.status === 'success') {
                    setStatus('success');
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    success(tLogin('loginSuccess'));
                    const cb = new URLSearchParams(window.location.search).get('callbackUrl');
                    router.push(cb && cb.startsWith('/') ? cb : '/dashboard');
                    router.refresh();
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

function PasswordLogin() {
    const [state, formAction, isPending] = useActionState(login, null);
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl');
    const formRef = useRef<HTMLFormElement>(null);
    const { error: toastError, success: toastSuccess } = useToast();
    const router = useRouter();
    const t = useTranslations('auth');
    const tErrors = useTranslations('errors.auth');

    const [show2FAModal, setShow2FAModal] = useState(false);
    const [code, setCode] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (state?.error === '2fa_required') {
            setShow2FAModal(true);
        } else if (state?.error) {
            // state.error is now a translation key from server action
            toastError(tErrors(state.error));
        } else if (state?.success) {
            toastSuccess(t('login.loginSuccess'));
            setTimeout(() => {
                router.push(state.callbackUrl || '/dashboard');
            }, 500);
        }
    }, [state, toastError, toastSuccess, router, t, tErrors]);

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

function LoginBox() {
    const [loginMethod, setLoginMethod] = useState<'password' | 'qr'>('password');
    const searchParams = useSearchParams();
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
                <PasskeyLogin />
                <div className="mt-3">
                    <OAuthLoginButtons />
                </div>

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
                        <PasswordLogin />
                    </div>
                ) : (
                    <div className="animate-fade-in">
                        <QrCodeLogin />
                    </div>
                )}
            </div>
        </div>
    );
}

export default function LoginPage() {
    const t = useTranslations('auth.login');

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 dark:opacity-10 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-200 dark:opacity-10 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-indigo-200 dark:opacity-10 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

            <div className="max-w-md w-full relative z-10 transition-all duration-300">
                <div className="text-center mb-8">
                    <h2 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">
                        SubLinks
                    </h2>
                    <p className="mt-3 text-text-secondary font-medium">
                        {t('title')}
                    </p>
                </div>

                <Suspense fallback={
                    <div className="bg-card/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-border-strong p-8 min-h-[300px] flex items-center justify-center">
                        <div className="text-center text-text-tertiary">{t('loading')}</div>
                    </div>
                }>
                    <LoginBox />
                </Suspense>

                <div className="mt-8 flex flex-col items-center gap-3">
                    <LanguageSwitcher />
                    <p className="text-center text-sm text-text-tertiary">Powered by Next.js • Secure & Fast</p>
                </div>
            </div>
        </div>
    )
}
