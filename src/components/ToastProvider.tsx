'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    isExiting?: boolean;
}

interface ToastContextType {
    addToast: (message: string, type: ToastType, duration?: number) => string;
    updateToast: (id: string, message: string, type: ToastType) => void;
    removeToast: (id: string) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        // Return dummy object for SSR or when used outside provider to prevent crashes
        return {
            addToast: () => '',
            updateToast: () => { },
            removeToast: () => { },
            success: () => { },
            error: () => { },
            info: () => { },
        };
    }
    return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.map(t => t.id === id ? { ...t, isExiting: true } : t));
        setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 300); // Wait for animation
    }, []);

    const addToast = useCallback((message: string, type: ToastType, duration: number = 3000) => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto remove only if duration > 0 and not Infinity
        if (duration > 0 && duration !== Infinity) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
        return id;
    }, [removeToast]);

    const updateToast = useCallback((id: string, message: string, type: ToastType) => {
        setToasts((prev) => prev.map(t => t.id === id ? { ...t, message, type } : t));
    }, []);

    const success = useCallback((message: string) => addToast(message, 'success'), [addToast]);
    const error = useCallback((message: string) => addToast(message, 'error'), [addToast]);
    const info = useCallback((message: string) => addToast(message, 'info'), [addToast]);

    return (
        <ToastContext.Provider value={{ addToast, updateToast, removeToast, success, error, info }}>
            {children}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`
                            pointer-events-auto min-w-[200px] max-w-sm px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 transform transition-all duration-300
                            ${toast.isExiting ? 'translate-x-full opacity-0' : 'animate-slide-in-right'}
                            ${toast.type === 'success' ? 'bg-white border-green-100 text-green-800' : ''}
                            ${toast.type === 'error' ? 'bg-white border-red-100 text-red-800' : ''}
                            ${toast.type === 'info' ? 'bg-white border-blue-100 text-blue-800' : ''}
                        `}
                    >
                        <span className="text-xl">
                            {toast.type === 'success' && '✅'}
                            {toast.type === 'error' && '❌'}
                            {toast.type === 'info' && 'ℹ️'}
                        </span>
                        <p className="text-sm font-medium">{toast.message}</p>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
