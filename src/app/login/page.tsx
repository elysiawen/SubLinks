'use client'

import { useActionState, Suspense, useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { login } from '@/lib/actions';
import Modal from '@/components/Modal';
import QrCodeLogin from '@/components/QrCodeLogin';

import { SubmitButton } from '@/components/SubmitButton';

function PasswordLogin() {
    const [state, formAction, isPending] = useActionState(login, null);
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl');
    const formRef = useRef<HTMLFormElement>(null);

    // 2FA State
    const [show2FAModal, setShow2FAModal] = useState(false);
    const [code, setCode] = useState('');

    // Controlled inputs for username/password to persist across re-renders
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    // Local validation error
    const [localError, setLocalError] = useState<string | null>(null);

    useEffect(() => {
        if (state?.error === '2fa_required') {
            setShow2FAModal(true);
        }
    }, [state]);

    const handleSubmit = () => {
        setLocalError(null);

        // Client-side validation
        if (!username.trim() || !password.trim()) {
            setLocalError('请输入用户名和密码');
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
                        setLocalError('请输入用户名和密码');
                        return;
                    }
                    setLocalError(null);
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

                {(localError || (state?.error && state.error !== '2fa_required')) && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-shake">
                        <span>⚠️</span>
                        <span>{localError || state?.error}</span>
                    </div>
                )}

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

                    {state?.error && state.error !== '2fa_required' && (
                        <div className="bg-red-50 text-red-600 text-sm py-2 px-3 rounded-lg text-center animate-shake">
                            {state.error}
                        </div>
                    )}

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
                    密码登录
                </button>
                <button
                    onClick={() => setLoginMethod('qr')}
                    className={`flex-1 flex items-center justify-center py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${loginMethod === 'qr'
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <span className="mr-2">📱</span>
                    扫码登录
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
