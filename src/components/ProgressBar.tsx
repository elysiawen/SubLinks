'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function ProgressBar() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [progress, setProgress] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Reset and hide when route changes (navigation complete)
        setProgress(100);
        const timer = setTimeout(() => {
            setIsVisible(false);
            setProgress(0);
        }, 300); // fade out duration
        return () => clearTimeout(timer);
    }, [pathname, searchParams]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const anchor = target.closest('a');

            if (
                anchor &&
                anchor.href &&
                anchor.href.startsWith(window.location.origin) &&
                !anchor.target &&
                !e.ctrlKey &&
                !e.metaKey &&
                !e.shiftKey &&
                !e.altKey
            ) {
                // Check if it's the same page
                const targetUrl = new URL(anchor.href);
                const currentUrl = new URL(window.location.href);
                if (targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search) {
                    return;
                }

                // Start progress
                setIsVisible(true);
                setProgress(30);
            }
        };

        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Incremental progress loop
    useEffect(() => {
        if (!isVisible || progress >= 90) return;

        const timer = setInterval(() => {
            setProgress(old => {
                if (old >= 90) {
                    clearInterval(timer);
                    return 90;
                }
                const diff = Math.random() * 10;
                return Math.min(old + diff, 90);
            });
        }, 500);

        return () => clearInterval(timer);
    }, [isVisible, progress]);

    return (
        <div
            className={`fixed top-0 left-0 z-[100] w-full h-1 bg-transparent pointer-events-none transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        >
            <div
                className="h-full bg-blue-600 transition-all duration-300 ease-out shadow-[0_0_10px_#2563eb,0_0_5px_#2563eb]"
                style={{ width: `${progress}%` }}
            />
        </div>
    );
}
