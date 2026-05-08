'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Clock, Monitor } from 'lucide-react';

const MODE_KEY = 'sublinks-theme-mode';

function isDarkHour(): boolean {
    const hour = new Date().getHours();
    return hour >= 19 || hour < 7;
}

export function ThemeToggle() {
    const { setTheme } = useTheme();
    const [mode, setMode] = useState<string>('auto');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        setMode(localStorage.getItem(MODE_KEY) ?? 'auto');
    }, []);

    if (!mounted) {
        return <div className="w-9 h-9" />;
    }

    const cycleMode = () => {
        const order = ['light', 'dark', 'auto', 'system'];
        const idx = order.indexOf(mode);
        const next = order[(idx + 1) % order.length];

        localStorage.setItem(MODE_KEY, next);
        setMode(next);

        if (next === 'auto') {
            setTheme(isDarkHour() ? 'dark' : 'light');
        } else if (next === 'system') {
            setTheme('system');
        } else {
            setTheme(next);
        }
    };

    const icon = mode === 'light'
        ? <Sun className="w-4 h-4" />
        : mode === 'dark'
            ? <Moon className="w-4 h-4" />
            : mode === 'auto'
                ? <Clock className="w-4 h-4" />
                : <Monitor className="w-4 h-4" />;

    const label = mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : mode === 'auto' ? 'Auto' : 'System';

    return (
        <button
            onClick={cycleMode}
            className="flex items-center justify-center w-9 h-9 text-text-tertiary hover:text-text-secondary hover:bg-muted rounded-lg transition-colors"
            title={label}
        >
            {icon}
        </button>
    );
}
