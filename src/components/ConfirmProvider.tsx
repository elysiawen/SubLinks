'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';

interface ConfirmOptions {
    title?: string;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: 'blue' | 'red';
    onConfirm?: () => Promise<void>;
}

interface ConfirmContextType {
    confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [config, setConfig] = useState<{ message: string, options: ConfirmOptions }>({ message: '', options: {} });
    const resolveRef = useRef<(value: boolean) => void>(null);

    const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
        setConfig({ message, options });
        setIsOpen(true);
        setIsLoading(false);
        return new Promise<boolean>((resolve) => {
            // @ts-ignore
            resolveRef.current = resolve;
        });
    }, []);

    const handleConfirm = async () => {
        if (config.options.onConfirm) {
            setIsLoading(true);
            try {
                await config.options.onConfirm();
                if (resolveRef.current) {
                    resolveRef.current(true);
                }
                setIsOpen(false);
            } catch (error) {
                console.error('Confirm action failed:', error);
            } finally {
                setIsLoading(false);
            }
        } else {
            if (resolveRef.current) {
                resolveRef.current(true);
            }
            setIsOpen(false);
        }
    };

    const handleCancel = () => {
        if (resolveRef.current) {
            resolveRef.current(false);
        }
        setIsOpen(false);
    };

    const { message, options } = config;
    const title = options.title || '确认操作';
    const confirmText = options.confirmText || '确定';
    const cancelText = options.cancelText || '取消';
    const isDestructive = options.confirmColor === 'red' || (!options.confirmColor && message.includes('删除'));

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 transform transition-all animate-zoom-in">
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                            <p className="mt-2 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                                {message}
                            </p>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={handleCancel}
                                disabled={isLoading}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={isLoading}
                                className={`px-4 py-2 text-sm font-medium text-white rounded-xl shadow-lg transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-wait flex items-center gap-2 ${isDestructive
                                    ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30'
                                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'
                                    }`}
                            >
                                {isLoading && (
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                )}
                                {isLoading ? '处理中...' : confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}