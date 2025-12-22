'use client'

import { useActionState } from 'react';
import { login } from '@/lib/actions';

function SubmitButton() {
    return (
        <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-lg shadow-blue-500/30 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
        >
            🔐 登录
        </button>
    );
}

export default function LoginPage() {
    const [state, formAction] = useActionState(login, null)

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

            <div className="max-w-md w-full relative z-10">
                {/* Title */}
                <div className="text-center mb-8">
                    <h2 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">
                        SubLinks
                    </h2>
                    <p className="mt-3 text-gray-600 font-medium">
                        欢迎回来，请登录您的账户
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8">
                    <form className="space-y-6" action={formAction}>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                                    👤 用户名
                                </label>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
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
                                    required
                                    className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50"
                                    placeholder="请输入密码"
                                />
                            </div>
                        </div>

                        {state?.error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-shake">
                                <span>⚠️</span>
                                <span>{state.error}</span>
                            </div>
                        )}

                        <div>
                            <SubmitButton />
                        </div>
                    </form>
                </div>

                {/* Bottom decoration */}
                <div className="mt-8 text-center text-sm text-gray-500">
                    <p>Powered by Next.js • Secure & Fast</p>
                </div>
            </div>
        </div>
    )
}
