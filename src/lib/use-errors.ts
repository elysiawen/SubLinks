'use client';

import { useTranslations } from 'next-intl';

/**
 * Shared hook for translating error/message keys returned by server actions.
 * Server actions return i18n keys like 'notLoggedIn', 'userNotFound', etc.
 * This hook translates them to the current locale, with fallback to the raw key.
 */
export function useErrors() {
    const tUser = useTranslations('errors.user');
    const tAdmin = useTranslations('errors.admin');
    const tSub = useTranslations('errors.subscription');
    const tSource = useTranslations('errors.source');
    const tConfig = useTranslations('errors.config');
    const tAuth = useTranslations('errors.auth');

    const namespaces = [tUser, tAdmin, tSub, tSource, tConfig, tAuth];

    return (key: string): string => {
        if (!key) return key;
        for (const t of namespaces) {
            try {
                const translated = t(key);
                if (translated !== key) return translated;
            } catch {
                // key not in this namespace, try next
            }
        }
        return key;
    };
}
