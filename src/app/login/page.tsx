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

function PasskeyLogin() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { error: toastError, info } = useToast();

    const handleLogin = async () => {
        setLoading(true);

        try {
            // 1. Get options
            const res = await generatePasskeyLoginOptions();
            if (!res.options) {
                throw new Error('无法获取登录选项');
            }

            // 2. Browser interaction
            const authResp = await startAuthentication({ optionsJSON: res.options });

            // 3. Verify
            const verifyRes = await verifyPasskeyLogin(authResp, res.flowId!);
            if (verifyRes.error) {
                throw new Error(verifyRes.error);
            }

            // Success
            router.push('/dashboard');
        } catch (err: any) {
            // Check for user cancellation or timeout
            const isNotAllowed = err.name === 'NotAllowedError' ||
                err.message?.includes('not allowed') ||
                err.message?.includes('The operation either timed out or was not allowed');

            if (isNotAllowed) {
                // User cancelled or timed out
                // Optionally show info or just ignore/reset
                // For login, maybe just clear error or show "Cancelled"
                info('用户取消了操作');
            } else if (err.message === 'Passkey not found') {
                // Known error - do not log to console
                toastError('未找到该通行密钥，请确认是否已注册或被删除');
            } else {
                console.error(err);
                toastError(err.message || '登录失败');
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
                className="w-full py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-xl hover:bg-blue-50 transition-colors font-semibold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        正在验证...
                    </>
                ) : (
                    '🔐 使用通行密钥登录'
                )}
            </button>
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

    // Function to generate new QR code
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

    // Initial load
    useEffect(() => {
        loadQrCode();
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [loadQrCode]);

    // Polling logic
    useEffect(() => {
        if (!token || (status !== 'pending' && status !== 'scanned')) return;

        pollingRef.current = setInterval(async () => {
            // Check expiry
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
                    success('登录成功');
                    router.push('/dashboard');
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
    }, [token, status, expiresAt, router, success]);

    const handleRefresh = () => {
        loadQrCode();
    };

    return (
        <div className="flex flex-col items-center justify-center space-y-4 py-4 min-h-[300px]">
            {status === 'loading' && (
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-48 h-48 bg-gray-200 rounded-lg"></div>
                    <div className="h-4 bg-gray-200 rounded w-32 mt-4"></div>
                </div>
            )}

            {(status === 'pending' || status === 'scanned') && qrUrl && (
                <div className="relative group">
                    <div className={`p-2 bg-white rounded-lg border-2 ${status === 'scanned' ? 'border-green-500' : 'border-gray-200'} transition-colors duration-300`}>
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
                            扫码成功，请在手机上确认
                        </p>
                    ) : (
                        <p className="text-gray-500 text-sm text-center mt-4">
                            请使用 SubLinks 手机端扫码登录
                        </p>
                    )}
                </div>
            )}

            {status === 'expired' && (
                <div className="text-center">
                    <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center mb-4 border-2 border-dashed border-gray-300">
                        <span className="text-gray-400 text-3xl">⚠️</span>
                    </div>
                    <p className="text-gray-600 mb-2">二维码已过期</p>
                    <button
                        onClick={handleRefresh}
                        className="text-blue-600 hover:text-blue-700 font-medium text-sm hover:underline"
                    >
                        刷新二维码
                    </button>
                </div>
            )}
            {status === 'error' && (
                <div className="text-center">
                    <div className="w-48 h-48 bg-red-50 rounded-lg flex items-center justify-center mb-4 border-2 border-red-100">
                        <span className="text-red-400 text-3xl">❌</span>
                    </div>
                    <p className="text-red-600 mb-2">生成二维码失败</p>
                    <button
                        onClick={handleRefresh}
                        className="text-blue-600 hover:text-blue-700 font-medium text-sm hover:underline"
                    >
                        重试
                    </button>
                </div>
            )}

            {status === 'rejected' && (
                <div className="text-center">
                    <div className="w-48 h-48 bg-red-50 rounded-lg flex items-center justify-center mb-4 border-2 border-red-100">
                        <span className="text-red-400 text-3xl">🚫</span>
                    </div>
                    <p className="text-red-600 mb-2">登录已拒绝</p>
                    <button
                        onClick={handleRefresh}
                        className="text-blue-600 hover:text-blue-700 font-medium text-sm hover:underline"
                    >
                        重试
                    </button>
                </div>
            )}

            {status === 'success' && (
                <div className="text-center">
                    <div className="w-48 h-48 bg-green-50 rounded-lg flex items-center justify-center mb-4 border-2 border-green-100">
                        <span className="text-green-500 text-4xl">✅</span>
                    </div>
                    <p className="text-green-600 font-bold">登录成功！</p>
                    <p className="text-gray-500 text-sm">正在跳转...</p>
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
    const { error: toastError } = useToast();

    // 2FA State
    const [show2FAModal, setShow2FAModal] = useState(false);
    const [code, setCode] = useState('');

    // Controlled inputs for username/password to persist across re-renders
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (state?.error === '2fa_required') {
            setShow2FAModal(true);
        } else if (state?.error) {
            toastError(state.error);
        }
    }, [state, toastError]);

    const handleSubmit = () => {
        // Client-side validation
        if (!username.trim() || !password.trim()) {
            toastError('请输入用户名和密码');
            return;
        }

        // Submit the form
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
                    // Client-side validation before submission
                    if (!username.trim() || !password.trim()) {
                        e.preventDefault();
                        toastError('请输入用户名和密码');
                        return;
                    }
                    // Let form submit normally
                }}
            >
                {/* Hidden field for callback URL */}
                {callbackUrl && (
                    <input type="hidden" name="callbackUrl" value={callbackUrl} />
                )}

                {/* Hidden field for 2FA code - synced with Modal input */}
                <input type="hidden" name="code" value={code} />

                <div className="space-y-4">
                    <div>
                        <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                            👤 用户名
                        </label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            // Removed required to prevent browser validation blocking 2FA modal
                            autoComplete="username"
                            className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50"
                            placeholder="请输入用户名"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                            🔑 密码
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50"
                            placeholder="请输入密码"
                        />
                    </div>
                </div>

                <div>
                    <SubmitButton
                        text="🔐 登录"
                        className="w-full py-3 rounded-xl shadow-lg shadow-blue-500/30"
                    />
                </div>
            </form>

            <Modal
                isOpen={show2FAModal}
                onClose={() => setShow2FAModal(false)}
                title="两步验证"
            >
                <div className="space-y-6">
                    <div className="text-center">
                        <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                            <span className="text-2xl">🛡️</span>
                        </div>
                        <p className="text-gray-600">
                            为了保障您的账户安全，请输入您的两步验证码
                        </p>
                    </div>

                    <div>
                        <label htmlFor="modal-code" className="block text-sm font-semibold text-gray-700 mb-2 text-center">
                            输入 6 位验证码
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
                            className="w-full text-center tracking-[0.5em] text-2xl font-mono border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            placeholder="000000"
                            maxLength={6}
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={handle2FASubmit}
                            disabled={isPending || code.length !== 6}
                            className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-lg shadow-blue-500/30 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isPending ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    验证中...
                                </>
                            ) : (
                                '验证'
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

    return (
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 flex flex-col">
            {/* Passkey Login Button (Always Visible) */}
            <div className="mb-6">
                <PasskeyLogin />

                <div className="relative mt-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">或者使用其他方式</span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-gray-100/50 rounded-xl mb-6 relative">
                <button
                    onClick={() => setLoginMethod('password')}
                    className={`flex-1 flex items-center justify-center py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${loginMethod === 'password'
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <span className="mr-2">🔑</span>
                    密码
                </button>
                <button
                    onClick={() => setLoginMethod('qr')}
                    className={`flex-1 flex items-center justify-center py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${loginMethod === 'qr'
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <span className="mr-2">📱</span>
                    扫码
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
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden animate-fade-in">
            {/* Decorative background elements */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

            <div className="max-w-md w-full relative z-10 transition-all duration-300">
                {/* Title */}
                <div className="text-center mb-8">
                    <h2 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">
                        SubLinks
                    </h2>
                    <p className="mt-3 text-gray-600 font-medium">
                        欢迎回来，请登录您的账户
                    </p>
                </div>

                {/* Login Card with Suspense */}
                <Suspense fallback={
                    <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 min-h-[300px] flex items-center justify-center">
                        <div className="text-center text-gray-500">加载中...</div>
                    </div>
                }>
                    <LoginBox />
                </Suspense>

                {/* Bottom decoration */}
                <div className="mt-8 text-center text-sm text-gray-500">
                    <p>Powered by Next.js • Secure & Fast</p>
                </div>
            </div>
        </div>
    )
}
