'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState, useRef } from 'react';
import { Sun, Moon, Clock, Monitor } from 'lucide-react';
import { useTranslations } from 'next-intl';

const MODE_KEY = 'sublinks-theme-mode';

function isDarkHour(): boolean {
    const hour = new Date().getHours();
    return hour >= 19 || hour < 7;
}

const MODE_KEYS = ['light', 'dark', 'auto', 'system'] as const;
const MODE_ICONS: Record<string, typeof Sun> = { light: Sun, dark: Moon, auto: Clock, system: Monitor };

export function ThemeToggle() {
    const { setTheme } = useTheme();
    const t = useTranslations('common.theme');
    const [mode, setMode] = useState<string>('auto');
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
        setMode(localStorage.getItem(MODE_KEY) ?? 'auto');
    }, []);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    if (!mounted) {
        return <div className="w-9 h-9" />;
    }

    const currentKey = MODE_KEYS.includes(mode as any) ? mode : 'auto';
    const Icon = MODE_ICONS[currentKey];

    const selectMode = (next: string) => {
        localStorage.setItem(MODE_KEY, next);
        setMode(next);
        setOpen(false);

        if (next === 'auto') {
            setTheme(isDarkHour() ? 'dark' : 'light');
        } else if (next === 'system') {
            setTheme('system');
        } else {
            setTheme(next);
        }
    };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-muted rounded-lg transition-colors"
                title={t(currentKey)}
            >
                <Icon className="w-4 h-4" />
                <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div className="absolute bottom-full left-0 mb-1 w-36 bg-card rounded-xl shadow-lg border border-border-strong py-1 z-[100] animate-fade-in">
                    {MODE_KEYS.map(key => {
                        const ModeIcon = MODE_ICONS[key];
                        return (
                            <button
                                key={key}
                                onClick={() => selectMode(key)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${mode === key
                                    ? 'text-accent-foreground bg-accent font-medium'
                                    : 'text-text-secondary hover:bg-muted'
                                    }`}
                            >
                                <ModeIcon className="w-4 h-4" />
                                <span>{t(key)}</span>
                                {mode === key && (
                                    <svg className="w-4 h-4 ml-auto text-accent-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
