'use client';

import { ToastProvider } from './ToastProvider';
import { ConfirmProvider } from './ConfirmProvider';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
    return (
        <ToastProvider>
            <ConfirmProvider>
                {children}
            </ConfirmProvider>
        </ToastProvider>
    );
}
