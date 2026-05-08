'use client';

import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { ReactNode, useEffect } from 'react';

const MODE_KEY = 'sublinks-theme-mode';

function isDarkHour(): boolean {
    const hour = new Date().getHours();
    return hour >= 19 || hour < 7;
}

function AutoThemeEffect() {
    const { setTheme } = useTheme();

    useEffect(() => {
        const mode = localStorage.getItem(MODE_KEY) ?? 'auto';

        // First visit: default to auto
        if (!localStorage.getItem(MODE_KEY)) {
            localStorage.setItem(MODE_KEY, 'auto');
        }

        if (mode === 'auto') {
            setTheme(isDarkHour() ? 'dark' : 'light');

            const interval = setInterval(() => {
                if (localStorage.getItem(MODE_KEY) === 'auto') {
                    setTheme(isDarkHour() ? 'dark' : 'light');
                }
            }, 60_000);

            return () => clearInterval(interval);
        } else if (mode === 'system') {
            setTheme('system');
        }
        // 'light' and 'dark' are handled by next-themes storageKey directly
    }, [setTheme]);

    return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme="light"
            storageKey="theme"
            enableSystem
            disableTransitionOnChange
        >
            <AutoThemeEffect />
            {children}
        </NextThemesProvider>
    );
}

export function getThemeMode(): string {
    if (typeof window === 'undefined') return 'auto';
    return localStorage.getItem(MODE_KEY) ?? 'auto';
}

export function setThemeMode(mode: 'light' | 'dark' | 'auto') {
    localStorage.setItem(MODE_KEY, mode);
}
