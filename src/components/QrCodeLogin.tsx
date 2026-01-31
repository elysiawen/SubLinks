
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { generateQrToken, checkQrStatus } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';

export default function QrCodeLogin() {
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

            // Generate QR Image Data URL
            // Format: sublinks://login?token=...
            // Or just the token? The requirement says "Phone scans code". 
            // Usually simpler to put a URL-like scheme or just the token JSON?
            // "sublinks://auth/qr?token=xxx" allows app to open via deeplink if camera supports it.
            // But user said "Phone scans code", implies in-app scanner?
            // Let's use a standard JSON or deep link format. 
            // Plan didn't specify format.
            // Let's use a JSON object `{ "type": "sublinks-login", "token": "..." }` or just the token string.
            // For flexibility, `sublinks://login/${token}` is nice.
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

