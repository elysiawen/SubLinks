'use client';

import { useState, useEffect } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { useRouter } from 'next/navigation';
import { generatePasskeyRegistrationOptions, verifyPasskeyRegistration, getPasskeys, deletePasskey } from '@/lib/passkey-actions';
import { PasskeyCredentials } from '@/lib/database/interface';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import Modal from '@/components/Modal';
import { SubmitButton } from '@/components/SubmitButton';

export default function PasskeySection() {
    const [passkeys, setPasskeys] = useState<PasskeyCredentials[]>([]);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { success, error: toastError, info } = useToast();
    const { confirm } = useConfirm();

    // Add Name Modal State
    const [showNameModal, setShowNameModal] = useState(false);
    const [passkeyName, setPasskeyName] = useState('');

    useEffect(() => {
        loadPasskeys();
    }, []);

    const loadPasskeys = async () => {
        try {
            const keys = await getPasskeys();
            setPasskeys(keys);
        } catch (err) {
            console.error('Failed to load passkeys', err);
        }
    };

    const startAddFlow = () => {
        setPasskeyName(`Passkey (${new Date().toLocaleDateString()})`);
        setShowNameModal(true);
    };

    const handleAddPasskey = async () => {
        // Close modal and start loading
        setShowNameModal(false);
        setLoading(true);

        try {
            // 1. Get options from server
            const res = await generatePasskeyRegistrationOptions();
            if (res.error || !res.options) {
                throw new Error(res.error || 'Failed to generate registration options');
            }

            // 2. Browser interaction
            const attResp = await startRegistration({ optionsJSON: res.options });

            // 3. Verify with server
            const verifyRes = await verifyPasskeyRegistration(attResp, passkeyName);
            if (verifyRes.error) {
                throw new Error(verifyRes.error);
            }

            // Reload list
            await loadPasskeys();
            success('通行密钥添加成功');
            router.refresh(); // Refresh server components if any
        } catch (err: any) {
            // Check for user cancellation or timeout
            const isNotAllowed = err.name === 'NotAllowedError' ||
                err.message?.includes('not allowed') ||
                err.message?.includes('The operation either timed out or was not allowed');

            if (isNotAllowed) {
                // User cancelled or timed out - valid flow, show info
                info('用户取消了操作');
            } else {
                // Actual error - log and show error toast
                console.error(err);
                toastError(err.message || '添加通行密钥失败');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!await confirm('确定要删除这个通行密钥吗？此操作无法撤销。', { title: '删除通行密钥', confirmColor: 'red', confirmText: '删除' })) return;

        try {
            const res = await deletePasskey(id);
            if (res.error) {
                toastError(res.error);
                return;
            }
            await loadPasskeys();
            success('删除成功');
        } catch (err) {
            console.error(err);
            toastError('删除失败');
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    🔑 通行密钥 (Passkeys)
                </h2>
                <p className="text-sm text-gray-500 mt-1">使用指纹、面容 ID 或安全密钥登录</p>
            </div>

            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-800">已保存的密钥</h3>
                    <button
                        onClick={startAddFlow}
                        disabled={loading}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? '处理中...' : (
                            <>
                                <span>➕</span>
                                添加通行密钥
                            </>
                        )}
                    </button>
                </div>

                <div className="space-y-3">
                    {passkeys.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
                            还没有添加通行密钥
                        </div>
                    ) : (
                        passkeys.map(key => (
                            <div key={key.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-xl shadow-sm border border-gray-100">
                                        🔑
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-800">{key.name || '未命名密钥'}</div>
                                        <div className="text-xs text-gray-500 flex items-center gap-2">
                                            <span>创建于 {new Date(key.createdAt).toLocaleDateString()}</span>
                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                            <span>上次使用 {new Date(key.lastUsed).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(key.id)}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="删除"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 6h18"></path>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Name Input Modal */}
            <Modal
                isOpen={showNameModal}
                onClose={() => setShowNameModal(false)}
                title="添加通行密钥"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">密钥名称</label>
                        <input
                            type="text"
                            autoFocus
                            value={passkeyName}
                            onChange={(e) => setPasskeyName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && passkeyName.trim()) {
                                    handleAddPasskey();
                                }
                            }}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="例如：Windows Hello, Identify key..."
                        />
                        <p className="text-xs text-gray-500 mt-1">给这个密钥起个名字，方便日后管理</p>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <SubmitButton
                            onClick={handleAddPasskey}
                            disabled={!passkeyName.trim()}
                            text="继续"
                            className="w-full"
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}
