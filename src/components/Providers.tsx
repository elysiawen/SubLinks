'use client';

import { ToastProvider } from './ToastProvider';
import { ConfirmProvider } from './ConfirmProvider';
import { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';

export function Providers({ children, locale, messages }: { children: ReactNode; locale: string; messages: Record<string, any> }) {
    return (
        <NextIntlClientProvider locale={locale} messages={messages}>
            <ToastProvider>
                <ConfirmProvider>
                    {children}
                </ConfirmProvider>
            </ToastProvider>
        </NextIntlClientProvider>
    );
}
