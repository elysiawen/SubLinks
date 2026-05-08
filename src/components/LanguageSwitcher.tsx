'use client';

import { useLocale } from 'next-intl';
import { useState, useRef, useEffect } from 'react';
import { LOCALES } from '@/i18n/locales';

export function LanguageSwitcher({ className }: { className?: string }) {
    const locale = useLocale();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const current = LOCALES.find(l => l.code === locale) ?? LOCALES[0];

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const switchLocale = (code: string) => {
        document.cookie = `NEXT_LOCALE=${code};path=/;max-age=${365 * 24 * 60 * 60};SameSite=Lax`;
        window.location.reload();
    };

    return (
        <div ref={ref} className={`relative ${className ?? ''}`}>
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-muted rounded-lg transition-colors"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3c2.5 2.8 3.9 6.3 3.9 9s-1.4 6.2-3.9 9c-2.5-2.8-3.9-6.3-3.9-9s1.4-6.2 3.9-9z" />
                </svg>
                <span>{current.flag} {current.label}</span>
                <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div className="absolute bottom-full left-0 mb-1 w-40 bg-card rounded-xl shadow-lg border border-border-strong py-1 z-[100] animate-fade-in">
                    {LOCALES.map(l => (
                        <button
                            key={l.code}
                            onClick={() => { setOpen(false); switchLocale(l.code); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${locale === l.code
                                ? 'text-accent-foreground bg-accent font-medium'
                                : 'text-text-secondary hover:bg-muted'
                                }`}
                        >
                            <span className="text-base">{l.flag}</span>
                            <span>{l.label}</span>
                            {locale === l.code && (
                                <svg className="w-4 h-4 ml-auto text-accent-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
