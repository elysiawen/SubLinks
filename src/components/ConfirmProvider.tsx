'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';

interface ConfirmOptions {
    title?: string;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: 'blue' | 'red';
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
    const [config, setConfig] = useState<{ message: string, options: ConfirmOptions }>({ message: '', options: {} });
    const resolveRef = useRef<(value: boolean) => void>(null);

    const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
        setConfig({ message, options });
        setIsOpen(true);
        return new Promise<boolean>((resolve) => {
            // @ts-ignore
            resolveRef.current = resolve;
        });
    }, []);

    const handleConfirm = () => {
        if (resolveRef.current) {
            resolveRef.current(true);
        }
        setIsOpen(false);
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
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={handleConfirm}
                                className={`px-4 py-2 text-sm font-medium text-white rounded-xl shadow-lg transition-all transform active:scale-95 ${isDestructive
                                    ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30'
                                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'
                                    }`}
                            >
                                {confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}