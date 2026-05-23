import { headers, cookies } from 'next/headers';
import { type Locale, localeCodes, DEFAULT_LOCALE, isLocale } from '@/i18n/locales';

const messagesCache: Record<string, any> = {};

async function loadMessages(locale: Locale) {
    if (!messagesCache[locale]) {
        messagesCache[locale] = (await import(`../messages/${locale}/api.json`)).default;
    }
    return messagesCache[locale];
}

export async function getApiLocale(): Promise<Locale> {
    // 1. Check NEXT_LOCALE cookie (app language switch)
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
    if (cookieLocale && isLocale(cookieLocale)) {
        return cookieLocale as Locale;
    }

    // 2. Fallback to accept-language header
    const headersList = await headers();
    const acceptLanguage = headersList.get('accept-language');
    if (acceptLanguage) {
        const preferred = acceptLanguage.split(',')[0]?.split('-')[0];
        if (preferred && isLocale(preferred)) {
            return preferred;
        }
    }
    return DEFAULT_LOCALE;
}

export async function tApi(key: string, locale?: Locale): Promise<string> {
    const resolvedLocale = locale || await getApiLocale();
    const messages = await loadMessages(resolvedLocale);
    const keys = key.split('.');
    let result: any = messages;
    for (const k of keys) {
        result = result?.[k];
    }
    return result || key;
}
