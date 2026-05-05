import { headers } from 'next/headers';

const locales = ['zh', 'en'] as const;
type Locale = (typeof locales)[number];

const messagesCache: Record<Locale, any> = {} as any;

async function loadMessages(locale: Locale) {
    if (!messagesCache[locale]) {
        messagesCache[locale] = (await import(`../messages/${locale}/api.json`)).default;
    }
    return messagesCache[locale];
}

export async function getApiLocale(): Promise<Locale> {
    const headersList = await headers();
    const acceptLanguage = headersList.get('accept-language');
    if (acceptLanguage) {
        const preferred = acceptLanguage.split(',')[0]?.split('-')[0];
        if (preferred && locales.includes(preferred as Locale)) {
            return preferred as Locale;
        }
    }
    return 'en';
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
