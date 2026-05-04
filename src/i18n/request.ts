import {getRequestConfig} from 'next-intl/server';
import {cookies, headers} from 'next/headers';

const locales = ['zh', 'en'] as const;
type Locale = (typeof locales)[number];

function isLocale(value: string): value is Locale {
    return locales.includes(value as Locale);
}

export default getRequestConfig(async () => {
    const cookieStore = await cookies();
    const headersList = await headers();

    let locale: Locale = 'zh';

    const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
    if (cookieLocale && isLocale(cookieLocale)) {
        locale = cookieLocale;
    } else {
        const acceptLanguage = headersList.get('accept-language');
        if (acceptLanguage) {
            const preferred = acceptLanguage.split(',')[0]?.split('-')[0];
            if (preferred && isLocale(preferred)) {
                locale = preferred;
            }
        }
    }

    return {
        locale,
        timeZone: 'Asia/Shanghai',
        messages: {
            common: (await import(`../messages/${locale}/common.json`)).default,
            auth: (await import(`../messages/${locale}/auth.json`)).default,
            dashboard: (await import(`../messages/${locale}/dashboard.json`)).default,
            admin: (await import(`../messages/${locale}/admin.json`)).default,
            errors: (await import(`../messages/${locale}/errors.json`)).default
        }
    };
});
