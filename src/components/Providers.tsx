'use client';

import { ToastProvider } from './ToastProvider';
import { ConfirmProvider } from './ConfirmProvider';
import { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';

export function Providers({ children, locale, messages, timeZone }: { children: ReactNode; locale: string; messages: Record<string, any>; timeZone?: string }) {
    return (
        <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
            <ToastProvider>
                <ConfirmProvider>
                    {children}
                </ConfirmProvider>
            </ToastProvider>
        </NextIntlClientProvider>
    );
}
